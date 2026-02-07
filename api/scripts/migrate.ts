import fs from "node:fs";
import path from "node:path";
import { db } from "../src/db";

const migrationsDir = path.resolve(process.cwd(), "data", "migrations");
const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort();

for (const file of files) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
  db.exec(sql);
}

console.log(`Applied ${files.length} migrations.`);
