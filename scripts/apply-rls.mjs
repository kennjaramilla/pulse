// Applies prisma/rls.sql to DATABASE_URL. Run after `prisma db push`.
import { readFileSync } from "node:fs";
import pg from "pg";

try {
  process.loadEnvFile(".env");
} catch {}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(readFileSync("prisma/rls.sql", "utf8"));
  console.log("row-level security applied");
} finally {
  await client.end();
}
