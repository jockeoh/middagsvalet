import fs from "node:fs";
import path from "node:path";
import {
  cleanIngredientLine,
  canonicalizeIngredientName,
  displayIngredientName,
  foldText,
  normalizeUnit,
  toBaseUnit,
  Dish,
} from "@middagsvalet/shared";
import { db } from "../src/db";

type KoketSample = {
  id: string;
  sourceUrl: string;
  title: string;
  proteinTag?: string;
  timeMinutes?: number;
  difficulty?: "easy" | "medium" | "hard";
  kidFriendlyScore?: number;
  ingredients?: Array<{ raw?: string; name?: string }>;
  instructionsShort?: string;
  tags?: string[];
  raw?: {
    totalTime?: string;
    recipeCuisine?: string;
    recipeInstructions?: string[];
    keywords?: string[];
  };
};

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.split("=");
    return [key.replace(/^--/, ""), value ?? "true"];
  }),
);

const inputFile = path.resolve(process.cwd(), args.get("input") ?? "../data/koket-samples.json");
const replace = (args.get("replace") ?? "true") === "true";
const aliasReportFile = path.resolve(
  process.cwd(),
  args.get("aliasReport") ?? "../data/ingredient_alias_report.json",
);

const dessertWords = ["kaka", "tårta", "glass", "dessert", "kladdkaka", "mousse", "paj", "cookie", "chokladboll", "våffla", "pannkaka", "overnight oats", "bakelse", "cheesecake"];
const mainWords = ["gryta", "wok", "pasta", "soppa", "lasagne", "pizza", "burgare", "tacos", "sallad", "bowl", "kyckling", "lax", "färs", "middag", "ragu"];

const parseIsoDurationMinutes = (raw?: string): number | null => {
  if (!raw) return null;
  const match = raw.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!match) return null;
  return Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);
};

const normalizeText = (value: string): string => foldText(value).replace(/[^a-z0-9\s]/g, " ");

type AliasDiag = {
  canonicalName: string;
  count: number;
  rawExamples: Set<string>;
  units: Set<string>;
};

const aliasDiagMap = new Map<string, AliasDiag>();

const trackAlias = (canonicalName: string, rawLine: string, unit: string): void => {
  const key = canonicalName.toLowerCase();
  const current = aliasDiagMap.get(key);
  if (current) {
    current.count += 1;
    if (current.rawExamples.size < 25) current.rawExamples.add(rawLine);
    current.units.add(unit);
    return;
  }

  aliasDiagMap.set(key, {
    canonicalName,
    count: 1,
    rawExamples: new Set([rawLine]),
    units: new Set([unit]),
  });
};

const detectMealType = (sample: KoketSample): "main" | "dessert" | "other" => {
  const joined = normalizeText(
    [sample.title, ...(sample.tags ?? []), ...(sample.raw?.keywords ?? []), ...(sample.ingredients ?? []).map((i) => i.raw ?? i.name ?? "")].join(" "),
  );
  if (dessertWords.some((word) => joined.includes(normalizeText(word)))) return "dessert";
  if (mainWords.some((word) => joined.includes(normalizeText(word)))) return "main";
  return "other";
};

const detectProtein = (sample: KoketSample): string => {
  const text = normalizeText([sample.title, ...(sample.ingredients ?? []).map((i) => i.raw ?? i.name ?? "")].join(" "));
  if (/kyckling/.test(text)) return "kyckling";
  if (/lax|fisk|torsk|rak|scampi/.test(text)) return "fisk";
  if (/not|hogrev|entrecote|fars/.test(text)) return "nötkött";
  if (/flask|bacon|skinka/.test(text)) return "fläsk";
  if (/tofu|linser|bonor|veg|vegetar/.test(text)) return "vegetariskt";
  return "vegetariskt";
};

const categorizeIngredient = (line: string): Dish["ingredients"][number]["category"] => {
  const l = normalizeText(line);
  if (/kyckling|lax|fisk|not|fars|flask|skinka|rak|scampi/.test(l)) return "Kott/Fisk";
  if (/mjolk|ost|gradde|yoghurt|smor|creme fraiche|creme fraiche/.test(l)) return "Mejeri";
  if (/salt|peppar|chili|oregano|kanel|krydda|spiskummin|paprika/.test(l)) return "Kryddor";
  if (/tomat|lok|morot|potatis|broccoli|spenat|gurka|zucchini|vitlok|citron|basilika|koriander|avokado/.test(l)) return "Frukt&Gront";
  return "Skafferi";
};

const parseIngredient = (line: string): Dish["ingredients"][number] => {
  const cleanedLine = cleanIngredientLine(line);
  if (!cleanedLine) {
    return { name: "Okänd ingrediens", amount: 1, unit: "st", category: "Skafferi" };
  }

  const amountMatch = cleanedLine.match(/^(\d+(?:[\.,]\d+)?)\s*(kg|g|hg|l|dl|cl|ml|msk|tsk|krm|st)?\s*(.*)$/i);

  const rawAmount = amountMatch ? Number(String(amountMatch[1]).replace(",", ".")) : 1;
  const rawUnit = normalizeUnit(amountMatch?.[2] ?? "st");
  const rawName = amountMatch ? amountMatch[3] || cleanedLine : cleanedLine;

  const canonicalName = canonicalizeIngredientName(rawName);
  const base = toBaseUnit(canonicalName, Number.isFinite(rawAmount) ? rawAmount : 1, rawUnit);

  trackAlias(displayIngredientName(canonicalName), cleanedLine, base.unit);

  return {
    name: displayIngredientName(canonicalName),
    amount: Number(base.amount.toFixed(2)),
    unit: base.unit,
    category: categorizeIngredient(canonicalName),
  };
};

const detectTags = (sample: KoketSample): Dish["tags"] => {
  const text = normalizeText([sample.title, ...(sample.tags ?? []), ...(sample.raw?.keywords ?? [])].join(" "));
  const tags: Dish["tags"] = [];
  if (/budget|billig|vardag/.test(text)) tags.push("budget");
  if (/frasch|frisk|sallad|citron|sommar/.test(text)) tags.push("fresh");
  if (/stark|chili|spicy/.test(text)) tags.push("spicy");
  if (/comfort|kramig|graddig|klassisk|husman/.test(text)) tags.push("comfort");
  if (tags.length === 0) tags.push("comfort");
  return Array.from(new Set(tags)).slice(0, 2) as Dish["tags"];
};

const inferAllergens = (ingredients: Dish["ingredients"]): string[] => {
  const joined = normalizeText(ingredients.map((i) => i.name).join(" "));
  const allergens: string[] = [];
  if (/mjol|pasta|brod|strobrod|vetemjol/.test(joined)) allergens.push("gluten");
  if (/mjolk|gradde|smor|ost|yoghurt/.test(joined)) allergens.push("laktos");
  if (/agg/.test(joined)) allergens.push("ägg");
  if (/not|mandel|cashew|jordnot/.test(joined)) allergens.push("nötter");
  if (/soja/.test(joined)) allergens.push("soja");
  return allergens;
};

const toDish = (sample: KoketSample, index: number): { dish: Dish; mealType: "main" | "dessert" | "other" } => {
  const ingredientLines = (sample.ingredients ?? []).map((ing) => ing.raw ?? ing.name ?? "").filter(Boolean).slice(0, 30);
  const ingredients = ingredientLines.map(parseIngredient);

  const mealType = detectMealType(sample);
  const timeMinutes = parseIsoDurationMinutes(sample.raw?.totalTime) ?? sample.timeMinutes ?? 30;

  return {
    mealType,
    dish: {
      id: `koket-${index + 1}`,
      title: sample.title,
      cuisineTags: sample.raw?.recipeCuisine ? [String(sample.raw.recipeCuisine).toLowerCase()] : [],
      proteinTag: detectProtein(sample),
      timeMinutes: Math.max(10, Math.min(timeMinutes, 120)),
      difficulty: sample.difficulty ?? (timeMinutes <= 25 ? "easy" : timeMinutes <= 45 ? "medium" : "hard"),
      kidFriendlyScore: sample.kidFriendlyScore ?? (mealType === "dessert" ? 80 : 62),
      ingredients,
      instructionsShort:
        sample.instructionsShort ||
        (sample.raw?.recipeInstructions ?? []).slice(0, 2).join(" ") ||
        "Tillaga enligt receptsteg.",
      allergens: inferAllergens(ingredients),
      tags: detectTags(sample),
      imageUrl: `https://picsum.photos/seed/${sample.id}/640/480`,
    },
  };
};

const run = () => {
  if (!fs.existsSync(inputFile)) throw new Error(`Input file not found: ${inputFile}`);

  const raw = fs.readFileSync(inputFile, "utf8");
  const samples = JSON.parse(raw) as KoketSample[];
  const mapped = samples.map(toDish);

  const insert = db.prepare(`
    INSERT INTO dishes (
      id, title, cuisineTags, mealType, proteinTag, timeMinutes, difficulty, kidFriendlyScore,
      ingredients, instructionsShort, allergens, tags, imageUrl, createdAt
    ) VALUES (
      @id, @title, @cuisineTags, @mealType, @proteinTag, @timeMinutes, @difficulty, @kidFriendlyScore,
      @ingredients, @instructionsShort, @allergens, @tags, @imageUrl, @createdAt
    )
  `);

  const tx = db.transaction((entries: typeof mapped) => {
    if (replace) db.prepare("DELETE FROM dishes").run();

    for (const entry of entries) {
      insert.run({
        ...entry.dish,
        cuisineTags: JSON.stringify(entry.dish.cuisineTags),
        mealType: entry.mealType,
        ingredients: JSON.stringify(entry.dish.ingredients),
        allergens: JSON.stringify(entry.dish.allergens),
        tags: JSON.stringify(entry.dish.tags),
        createdAt: new Date().toISOString(),
      });
    }
  });

  tx(mapped);

  const counts = db.prepare("SELECT mealType, COUNT(*) as count FROM dishes GROUP BY mealType").all() as Array<{
    mealType: string;
    count: number;
  }>;

  const aliasReport = Array.from(aliasDiagMap.values())
    .sort((a, b) => b.count - a.count)
    .map((entry) => ({
      canonicalName: entry.canonicalName,
      count: entry.count,
      units: Array.from(entry.units).sort(),
      rawExamples: Array.from(entry.rawExamples).sort(),
    }));

  fs.writeFileSync(
    aliasReportFile,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: path.basename(inputFile),
        totalCanonicalIngredients: aliasReport.length,
        aliases: aliasReport,
      },
      null,
      2,
    ),
    "utf8",
  );

  const mains = counts.find((c) => c.mealType === "main")?.count ?? 0;
  const desserts = counts.find((c) => c.mealType === "dessert")?.count ?? 0;
  const other = counts.find((c) => c.mealType === "other")?.count ?? 0;

  console.log(`Imported ${mapped.length} recipes from ${path.basename(inputFile)}.`);
  console.log(`Meal types => main: ${mains}, dessert: ${desserts}, other: ${other}`);
  console.log(`Alias report => ${aliasReportFile}`);
};

run();
