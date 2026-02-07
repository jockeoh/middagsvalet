import Database from "better-sqlite3";
import path from "node:path";

const dbPath = path.resolve(process.cwd(), "data", "dinner.db");

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
