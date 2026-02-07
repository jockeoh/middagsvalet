import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(scriptDir, "../data/dinner.db");

export const db = new Database(dbPath);

export interface PersistedDish {
  id: string;
  title: string;
  sourceUrl: string | null;
  cuisineTags: string;
  mealType?: string;
  proteinTag: string;
  timeMinutes: number;
  difficulty: string;
  kidFriendlyScore: number;
  ingredients: string;
  instructionsShort: string;
  allergens: string;
  tags: string;
  imageUrl: string | null;
}
