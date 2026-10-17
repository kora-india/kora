/**
 * Logical copy of the primary database to the disaster-recovery standby.
 *
 * Prefer your database provider's point-in-time recovery (Neon/Supabase) or
 * scheduled `pg_dump` for real backups; this script is a supplementary copy.
 *
 * D15: the model list comes from the Prisma schema, so new tables are never
 * left out; deletes on the primary are propagated; and every failed row is
 * counted and reported, with a non-zero exit code, instead of being ignored.
 *
 *   pnpm db:dr:sync     copy primary -> standby, then compare row counts
 *   pnpm db:dr:verify   compare row counts only
 *   pnpm db:dr:dump     write a JSON snapshot of the primary
 */
import { Prisma, PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const primaryUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const standbyUrl =
  process.env.BACKUP_DIRECT_URL || process.env.BACKUP_DATABASE_URL;

if (!primaryUrl) {
  console.error("❌ Primary DATABASE_URL / DIRECT_URL is not configured.");
  process.exit(1);
}

if (!standbyUrl) {
  console.error(
    "❌ Standby BACKUP_DIRECT_URL / BACKUP_DATABASE_URL is not configured.",
  );
  process.exit(1);
}

const primaryDb = new PrismaClient({
  datasources: { db: { url: primaryUrl } },
});

const standbyDb = new PrismaClient({
  datasources: { db: { url: standbyUrl } },
});

const BATCH = 500;

interface ModelPlan {
  name: string;
  delegate: string;
  /** Nullable foreign keys pointing at a model copied later; set in pass 2. */
  deferredFields: string[];
  jsonFields: string[];
}

/**
 * Every model in the schema, ordered so a row's required parents are copied
 * before it. Optional foreign keys that would point forward (the
 * Class <-> Teacher loop) are written in a second pass.
 */
function syncPlan(): ModelPlan[] {
  const models = Prisma.dmmf.datamodel.models;
  const requiredDeps = new Map<string, Set<string>>();
  for (const m of models) {
    const deps = new Set<string>();
    for (const f of m.fields) {
      if (f.kind !== "object" || !f.relationFromFields?.length) continue;
      const required = f.relationFromFields.every(
        (fk) => m.fields.find((x) => x.name === fk)?.isRequired,
      );
      if (required && f.type !== m.name) deps.add(f.type);
    }
    requiredDeps.set(m.name, deps);
  }

  const order: string[] = [];
  const done = new Set<string>();
  const visiting = new Set<string>();
  const visit = (name: string) => {
    if (done.has(name) || visiting.has(name)) return;
    visiting.add(name);
    for (const dep of requiredDeps.get(name) ?? []) visit(dep);
    visiting.delete(name);
    done.add(name);
    order.push(name);
  };
  for (const m of models) visit(m.name);

  const position = new Map(order.map((n, i) => [n, i]));
  return order.map((name) => {
    const model = models.find((m) => m.name === name)!;
    const deferredFields: string[] = [];
    for (const f of model.fields) {
      if (f.kind !== "object" || !f.relationFromFields?.length) continue;
      if ((position.get(f.type) ?? -1) >= position.get(name)!) {
        deferredFields.push(...f.relationFromFields);
      }
    }
    return {
      name,
      delegate: name[0].toLowerCase() + name.slice(1),
      deferredFields,
      jsonFields: model.fields
        .filter((f) => f.type === "Json")
        .map((f) => f.name),
    };
  });
}

/** Prisma rejects plain null for nullable Json columns. */
function writable(record: any, plan: ModelPlan, deferNulls: boolean) {
  const data = { ...record };
  for (const f of plan.jsonFields) {
    if (data[f] === null) data[f] = Prisma.DbNull;
  }
  if (deferNulls) {
    for (const f of plan.deferredFields) data[f] = null;
  }
  return data;
}

interface ModelResult {
  Model: string;
  Copied: number;
  Deleted: number;
  Failed: number;
}

export async function verifyParity(): Promise<boolean> {
  console.log("\n🔍 Comparing row counts between primary and standby...");
  const rows: {
    Model: string;
    Primary: number;
    Standby: number;
    Status: string;
  }[] = [];
  let healthy = true;

  for (const plan of syncPlan()) {
    const [p, s] = await Promise.all([
      (primaryDb as any)[plan.delegate].count(),
      (standbyDb as any)[plan.delegate].count().catch(() => -1),
    ]);
    const match = p === s;
    if (!match) healthy = false;
    rows.push({
      Model: plan.name,
      Primary: p,
      Standby: s,
      Status: s === -1 ? "❌ Missing on standby" : match ? "✅" : "⚠️ Differs",
    });
  }

  console.table(rows);
  console.log(
    healthy
      ? "✅ Every table has the same row count.\n"
      : "⚠️ Some tables differ. Run `pnpm db:dr:sync`.\n",
  );
  return healthy;
}

export async function syncToStandby(): Promise<boolean> {
  console.log("\n🚀 Copying primary -> standby");
  console.log(`📡 Source:      ${primaryUrl!.replace(/:[^:@]+@/, ":***@")}`);
  console.log(`🎯 Destination: ${standbyUrl!.replace(/:[^:@]+@/, ":***@")}`);

  const startTime = Date.now();
  const plans = syncPlan();
  const results = new Map<string, ModelResult>(
    plans.map((p) => [
      p.name,
      { Model: p.name, Copied: 0, Deleted: 0, Failed: 0 },
    ]),
  );
  const sampleErrors: string[] = [];
  const recordFailure = (model: string, err: any) => {
    results.get(model)!.Failed++;
    if (sampleErrors.length < 10) {
      sampleErrors.push(`${model}: ${err?.message?.split("\n").pop() ?? err}`);
    }
  };
  const primaryIds = new Map<string, Set<string>>();

  // Pass 1: upsert every row, in dependency order.
  for (const plan of plans) {
    const source = (primaryDb as any)[plan.delegate];
    const target = (standbyDb as any)[plan.delegate];
    const records: any[] = await source.findMany();
    primaryIds.set(plan.name, new Set(records.map((r) => r.id)));
    process.stdout.write(
      `Copying ${plan.name.padEnd(24)} ${records.length} rows... `,
    );

    for (const record of records) {
      try {
        const data = writable(record, plan, true);
        await target.upsert({
          where: { id: record.id },
          update: data,
          create: data,
        });
        results.get(plan.name)!.Copied++;
      } catch (err) {
        recordFailure(plan.name, err);
      }
    }
    console.log("done");
  }

  // Pass 2: fill in the optional foreign keys that pointed forward.
  for (const plan of plans.filter((p) => p.deferredFields.length > 0)) {
    const source = (primaryDb as any)[plan.delegate];
    const target = (standbyDb as any)[plan.delegate];
    const select = Object.fromEntries(
      ["id", ...plan.deferredFields].map((f) => [f, true]),
    );
    const records: any[] = await source.findMany({ select });
    for (const record of records) {
      const { id, ...fks } = record;
      if (Object.values(fks).every((v) => v === null)) continue;
      try {
        await target.update({ where: { id }, data: fks });
      } catch (err) {
        recordFailure(plan.name, err);
      }
    }
  }

  // Pass 3: delete standby rows that no longer exist on the primary,
  // children first.
  for (const plan of [...plans].reverse()) {
    const target = (standbyDb as any)[plan.delegate];
    const keep = primaryIds.get(plan.name)!;
    const standbyRows: { id: string }[] = await target.findMany({
      select: { id: true },
    });
    const stale = standbyRows.map((r) => r.id).filter((id) => !keep.has(id));
    for (let i = 0; i < stale.length; i += BATCH) {
      try {
        const res = await target.deleteMany({
          where: { id: { in: stale.slice(i, i + BATCH) } },
        });
        results.get(plan.name)!.Deleted += res.count;
      } catch (err) {
        recordFailure(plan.name, err);
      }
    }
  }

  const summary = [...results.values()];
  console.table(summary);
  const failed = summary.reduce((s, r) => s + r.Failed, 0);
  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  if (failed > 0) {
    console.error(
      `\n❌ ${failed} row operations failed in ${durationSec}s. First errors:`,
    );
    for (const e of sampleErrors) console.error(`   ${e}`);
  } else {
    console.log(`\n🎉 Copy finished in ${durationSec}s with no failures.`);
  }

  const parity = await verifyParity();
  return failed === 0 && parity;
}

export async function exportDump() {
  console.log("\n📦 Exporting JSON snapshot of the primary database...");
  const backupsDir = path.resolve(__dirname, "../../backups");
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = path.join(backupsDir, `schoolos_backup_${timestamp}.json`);

  const dumpData: Record<string, any[]> = {};
  for (const plan of syncPlan()) {
    dumpData[plan.name] = await (primaryDb as any)[plan.delegate].findMany();
  }

  fs.writeFileSync(filename, JSON.stringify(dumpData, null, 2), "utf-8");
  console.log(`✅ Snapshot saved to: ${filename}\n`);
}

async function main() {
  const args = process.argv.slice(2);
  let ok = true;

  try {
    if (args.includes("--verify")) {
      ok = await verifyParity();
    } else if (args.includes("--dump")) {
      await exportDump();
    } else {
      ok = await syncToStandby();
    }
  } catch (error) {
    console.error("❌ DR operation failed:", error);
    ok = false;
  } finally {
    await primaryDb.$disconnect();
    await standbyDb.$disconnect();
  }

  if (!ok) process.exit(1);
}

if (require.main === module) {
  main();
}
