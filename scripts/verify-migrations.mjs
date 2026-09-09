import { execFileSync } from "node:child_process";
import { mkdir, open } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
await mkdir("artifacts", { recursive: true });
const file = resolve(
  "artifacts",
  `migration-check-${Date.now()}.db`,
).replaceAll("\\", "/");
await (await open(file, "a")).close();
const env = { ...process.env, DATABASE_URL: `file:${file}` };
execFileSync(
  process.execPath,
  ["node_modules/prisma/build/index.js", "migrate", "deploy"],
  { env, stdio: "inherit" },
);
execFileSync(process.execPath, ["--import", "tsx", "prisma/seed.ts"], {
  env,
  stdio: "inherit",
});
const db = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
try {
  if ((await db.demoLocation.count()) !== 24)
    throw new Error("Seed count mismatch");
  await db.recentLocation.create({ data: { key: "demo:migration-check" } });
  if ((await db.recentLocation.count()) !== 1)
    throw new Error("History table unavailable");
  if ((await db.match.count()) !== 0)
    throw new Error("Fresh DB has unexpected matches");
  console.log("Fresh SQLite migrations, seed, and history write passed.");
} finally {
  await db.$disconnect();
}
