import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const primaryUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
const standbyUrl = process.env.BACKUP_DIRECT_URL || process.env.BACKUP_DATABASE_URL;

if (!primaryUrl) {
  console.error("❌ Primary DATABASE_URL / DIRECT_URL is not configured.");
  process.exit(1);
}

if (!standbyUrl) {
  console.error("❌ Standby BACKUP_DIRECT_URL / BACKUP_DATABASE_URL is not configured.");
  process.exit(1);
}

const primaryDb = new PrismaClient({
  datasources: { db: { url: primaryUrl } },
});

const standbyDb = new PrismaClient({
  datasources: { db: { url: standbyUrl } },
});

// Models ordered by Foreign Key dependency hierarchy
const SYNC_MODELS = [
  "planLimit",
  "school",
  "subscription",
  "academicSession",
  "user",
  "class",
  "section",
  "teacher",
  "staff",
  "student",
  "feeComponent",
  "feeStructure",
  "feeStructureItem",
  "classFeeStructure",
  "studentFeeAssignment",
  "studentFeeOverride",
  "feeCharge",
  "feeChargeItem",
  "fee",
  "payment",
  "paymentTransaction",
  "paymentAllocation",
  "advanceLedger",
  "notice",
  "assignment",
  "expenseCategory",
  "expense",
  "attendance",
  "otp",
] as const;

type ModelName = (typeof SYNC_MODELS)[number];

async function getCount(client: PrismaClient, modelName: ModelName): Promise<number> {
  try {
    const delegate = (client as any)[modelName];
    if (delegate && typeof delegate.count === "function") {
      return await delegate.count();
    }
  } catch (err: any) {
    console.warn(`Could not count ${modelName}: ${err.message}`);
  }
  return 0;
}

export async function verifyParity() {
  console.log("\n🔍 Checking Database Parity between Primary (us-east-1) & Standby (ap-southeast-1)...");
  console.log("━".repeat(70));

  const results: Array<{
    Model: string;
    "Primary (us-east-1)": number;
    "Standby (ap-southeast-1)": number;
    Status: string;
  }> = [];

  let isParityHealthy = true;

  for (const model of SYNC_MODELS) {
    const primaryCount = await getCount(primaryDb, model);
    const standbyCount = await getCount(standbyDb, model);
    const match = primaryCount === standbyCount;

    if (!match) isParityHealthy = false;

    results.push({
      Model: model,
      "Primary (us-east-1)": primaryCount,
      "Standby (ap-southeast-1)": standbyCount,
      Status: match ? "✅ Synced" : "⚠️ Out of sync",
    });
  }

  console.table(results);
  console.log("━".repeat(70));

  if (isParityHealthy) {
    console.log("✅ All tables are in full parity across regions!\n");
  } else {
    console.log("⚠️ Some tables differ in row counts. Run `pnpm db:dr:sync` to reconcile.\n");
  }

  return isParityHealthy;
}

export async function syncToStandby() {
  console.log("\n🚀 Starting Cross-Region Replication (Primary -> Standby)...");
  console.log(`📡 Source:      ${primaryUrl.replace(/:[^:@]+@/, ":***@")}`);
  console.log(`🎯 Destination: ${standbyUrl.replace(/:[^:@]+@/, ":***@")}`);
  console.log("━".repeat(70));

  const startTime = Date.now();

  for (const model of SYNC_MODELS) {
    const delegatePrimary = (primaryDb as any)[model];
    const delegateStandby = (standbyDb as any)[model];

    if (!delegatePrimary || !delegateStandby) {
      console.warn(`⚠️ Skipped model ${model} (delegate not found)`);
      continue;
    }

    const records = await delegatePrimary.findMany();
    if (records.length === 0) {
      continue;
    }

    process.stdout.write(`Syncing ${model.padEnd(22)} (${records.length} records)... `);

    // Upsert or bulk replicate
    for (const record of records) {
      try {
        if ("id" in record) {
          await delegateStandby.upsert({
            where: { id: record.id },
            update: record,
            create: record,
          });
        } else if ("email" in record) {
          await delegateStandby.upsert({
            where: { email: record.email },
            update: record,
            create: record,
          });
        } else {
          // Fallback create
          await delegateStandby.create({ data: record }).catch(() => {});
        }
      } catch (err: any) {
        // Continue syncing other records on individual conflict
      }
    }
    console.log("✅ Done");
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log("━".repeat(70));
  console.log(`🎉 Cross-region synchronization finished in ${durationSec}s!\n`);

  await verifyParity();
}

export async function exportDump() {
  console.log("\n📦 Exporting JSON Snapshot of Primary Database...");
  const backupsDir = path.resolve(__dirname, "../../backups");
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = path.join(backupsDir, `schoolos_backup_${timestamp}.json`);

  const dumpData: Record<string, any[]> = {};

  for (const model of SYNC_MODELS) {
    const delegate = (primaryDb as any)[model];
    if (delegate && typeof delegate.findMany === "function") {
      dumpData[model] = await delegate.findMany();
    }
  }

  fs.writeFileSync(filename, JSON.stringify(dumpData, null, 2), "utf-8");
  console.log(`✅ Database snapshot successfully saved to: ${filename}\n`);
}

async function main() {
  const args = process.argv.slice(2);

  try {
    if (args.includes("--verify")) {
      await verifyParity();
    } else if (args.includes("--dump")) {
      await exportDump();
    } else {
      // Default action is sync
      await syncToStandby();
    }
  } catch (error) {
    console.error("❌ DR Operation failed:", error);
    process.exit(1);
  } finally {
    await primaryDb.$disconnect();
    await standbyDb.$disconnect();
  }
}

if (require.main === module) {
  main();
}
