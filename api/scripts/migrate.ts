import fs from "node:fs";
import path from "node:path";
import { db } from "../src/db";

const migrationsDir = path.resolve(process.cwd(), "data", "migrations");
const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort();

for (const file of files) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
  try {
    db.exec(sql);
  } catch (error) {
    const message = String((error as Error).message);
    // Allow reruns in local dev for additive ALTERs that may already be applied.
    if (message.includes("duplicate column name")) {
      continue;
    }
    throw error;
  }
}

console.log(`Applied ${files.length} migrations.`);
