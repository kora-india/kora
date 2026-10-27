// Starts the app for the end-to-end tests; playwright.config.ts runs it with
// the settings from e2e/env.ts. Wipes and migrates the test database, seeds
// it, builds the app and serves it, so every run starts from the same state.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = fileURLToPath(new URL("..", import.meta.url));
const dbDir = path.resolve(appDir, "../../packages/db");

function fail(message) {
  console.error(`[e2e] ${message}`);
  process.exit(1);
}

for (const name of ["NEXT_DIST_DIR", "APP_PORT"]) {
  if (!process.env[name]) {
    fail(`${name} is not set; run this through \`pnpm test:e2e\`.`);
  }
}

// The next step wipes this database, so only a local one named for tests.
// Both URLs are checked: Prisma migrates through DIRECT_URL.
for (const name of ["DATABASE_URL", "DIRECT_URL"]) {
  let url;
  try {
    url = new URL(process.env[name] ?? "");
  } catch {
    fail(`${name} is not set; run this through \`pnpm test:e2e\`.`);
  }
  const database = url.pathname.slice(1);
  const isLocal = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (!isLocal || !/e2e|test/.test(database)) {
    fail(
      `${name} must be a local database with "e2e" or "test" in its name, ` +
        `because every run wipes it (got ${url.hostname}/${database}).`,
    );
  }
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(
  "pnpm",
  [
    "exec",
    "prisma",
    "migrate",
    "reset",
    "--force",
    "--skip-seed",
    "--skip-generate",
  ],
  dbDir,
);
run("pnpm", ["run", "seed"], dbDir);

// Cached plan catalogues and pages from the last run would outlive the wipe.
fs.rmSync(
  path.join(appDir, process.env.NEXT_DIST_DIR, "cache", "fetch-cache"),
  {
    recursive: true,
    force: true,
  },
);
// The build points next-env.d.ts at its own folder; keep the committed file.
const nextEnvFile = path.join(appDir, "next-env.d.ts");
const nextEnv = fs.readFileSync(nextEnvFile);
run("pnpm", ["exec", "next", "build"], appDir);
fs.writeFileSync(nextEnvFile, nextEnv);

const server = spawn(
  "pnpm",
  ["exec", "next", "start", "-p", process.env.APP_PORT],
  { cwd: appDir, stdio: "inherit" },
);
server.on("exit", (code) => process.exit(code ?? 0));
