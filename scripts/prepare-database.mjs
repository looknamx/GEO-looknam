import "dotenv/config";
import { mkdir, open } from "node:fs/promises";
import { dirname, resolve } from "node:path";
const url = process.env.DATABASE_URL;
if (!url)
  throw new Error("Missing DATABASE_URL. Copy .env.example to .env first.");
if (url.startsWith("file:")) {
  // Prisma resolves relative SQLite URLs from the schema folder. Creating the file first
  // avoids a schema-engine initialization failure on some Windows installations.
  const path = resolve("prisma", url.slice(5));
  await mkdir(dirname(path), { recursive: true });
  const handle = await open(path, "a");
  await handle.close();
}
