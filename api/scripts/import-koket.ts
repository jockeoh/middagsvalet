import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalizeIngredientName,
  foldText,
  hasNutSignals,
  normalizeIngredient,
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

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(scriptDir, "../data");

const inputArg = args.get("input");
const inputFile = inputArg
  ? path.resolve(process.cwd(), inputArg)
  : path.resolve(dataDir, "koket-samples.json");
const replace = (args.get("replace") ?? "true") === "true";
const aliasReportArg = args.get("aliasReport");
const aliasReportFile = aliasReportArg
  ? path.resolve(process.cwd(), aliasReportArg)
  : path.resolve(dataDir, "ingredient_alias_report.json");
const unresolvedReportArg = args.get("unresolvedReport");
const unresolvedReportFile = unresolvedReportArg
  ? path.resolve(process.cwd(), unresolvedReportArg)
  : path.resolve(dataDir, "unresolved_ingredients.json");
const mergeCandidateReportArg = args.get("mergeCandidateReport");
const mergeCandidateReportFile = mergeCandidateReportArg
  ? path.resolve(process.cwd(), mergeCandidateReportArg)
  : path.resolve(dataDir, "ingredient_merge_candidates.json");
const reviewQueueReportArg = args.get("reviewQueueReport");
const reviewQueueReportFile = reviewQueueReportArg
  ? path.resolve(process.cwd(), reviewQueueReportArg)
  : path.resolve(dataDir, "recipe_review_queue.json");

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
const unresolvedDiagMap = new Map<
  string,
  { rawName: string; count: number; examples: Set<string>; topCategory: string; topUnit: string; maxConfidence: number }
>();
const mergeCandidateMap = new Map<
  string,
  { mergeKey: string; count: number; variants: Map<string, number>; examples: Set<string> }
>();
const recipeReviewQueue: Array<{ id: string; title: string; reasons: string[] }> = [];
const inferredAmountAdjustments: Array<{
  recipeId: string;
  recipeTitle: string;
  ingredient: string;
  from: { amount: number; unit: string };
  to: { amount: number; unit: string };
  basis: string;
}> = [];

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

const trackUnresolved = (
  rawName: string,
  exampleLine: string,
  category: Dish["ingredients"][number]["category"],
  unit: string,
  confidence: number,
): void => {
  const key = normalizeText(rawName);
  if (!key) return;
  const current = unresolvedDiagMap.get(key);
  if (current) {
    current.count += 1;
    if (current.examples.size < 20) current.examples.add(exampleLine);
    current.maxConfidence = Math.max(current.maxConfidence, confidence);
    return;
  }

  unresolvedDiagMap.set(key, {
    rawName,
    count: 1,
    examples: new Set([exampleLine]),
    topCategory: category,
    topUnit: unit,
    maxConfidence: confidence,
  });
};

const mergeKeyStopWords = new Set([
  "och",
  "med",
  "till",
  "for",
  "att",
  "finrivet",
  "rivet",
  "riven",
  "rivna",
  "skal",
  "saft",
  "pressad",
  "pressat",
  "pressade",
  "zest",
]);

const toMergeKey = (value: string): string => {
  const normalized = normalizeText(value);
  const tokens = normalized
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !mergeKeyStopWords.has(token))
    .map((token) => (token.endsWith("er") && token.length > 4 ? token.slice(0, -2) : token))
    .map((token) => (token.endsWith("or") && token.length > 4 ? token.slice(0, -2) : token))
    .map((token) => (token.endsWith("ar") && token.length > 4 ? token.slice(0, -2) : token));
  return tokens.join(" ").trim();
};

const trackMergeCandidate = (rawName: string, normalizedName: string, line: string): void => {
  const key = toMergeKey(rawName);
  if (!key || key.length < 3) return;
  const current = mergeCandidateMap.get(key);
  if (current) {
    current.count += 1;
    current.variants.set(normalizedName, (current.variants.get(normalizedName) ?? 0) + 1);
    if (current.examples.size < 25) current.examples.add(line);
    return;
  }

  mergeCandidateMap.set(key, {
    mergeKey: key,
    count: 1,
    variants: new Map([[normalizedName, 1]]),
    examples: new Set([line]),
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
  const beefPattern = /notkott|notfars|hogrev|entrecote|oxfile|rostbiff|biff|kottfars/;
  if (/kyckling/.test(text)) return "kyckling";
  if (/lax|fisk|torsk|rak|scampi/.test(text)) return "fisk";
  if (beefPattern.test(text)) return "nötkött";
  if (/flask|bacon|skinka/.test(text)) return "fläsk";
  if (/tofu|linser|bonor|veg|vegetar/.test(text)) return "vegetariskt";
  return "vegetariskt";
};

const categorizeIngredient = (line: string): Dish["ingredients"][number]["category"] => {
  const l = normalizeText(line);
  if (/jordnot|notter|mandel|cashew|hasselnot|valnot|pistage/.test(l)) return "Skafferi";
  if (/kyckling|lax|fisk|notkott|notfars|hogrev|entrecote|oxfile|rostbiff|biff|kottfars|flask|skinka|rak|scampi/.test(l)) return "Kott/Fisk";
  if (/mjolk|ost|gradde|yoghurt|smor|creme fraiche|creme fraiche/.test(l)) return "Mejeri";
  if (/salt|peppar|chili|oregano|kanel|krydda|spiskummin|paprika/.test(l)) return "Kryddor";
  if (/tomat|lok|morot|potatis|broccoli|spenat|gurka|zucchini|vitlok|citron|basilika|koriander|avokado/.test(l)) return "Frukt&Gront";
  return "Skafferi";
};

const shouldSkipIngredientLine = (line: string): boolean => {
  const normalized = normalizeText(line);
  if (!normalized) return true;
  return /\b(till servering|servering|topping|garnering)\b/.test(normalized);
};

const parseIngredient = (line: string): Dish["ingredients"][number] | null => {
  if (shouldSkipIngredientLine(line)) return null;

  const normalized = normalizeIngredient(line);
  if (!normalized.cleanedLine) {
    return null;
  }

  trackAlias(normalized.displayName, normalized.cleanedLine, normalized.unit);
  trackMergeCandidate(normalized.rawName, normalized.displayName, normalized.cleanedLine);
  if (normalized.matchMode === "fallback" || normalized.confidence < 0.78) {
    trackUnresolved(
      normalized.rawName,
      normalized.cleanedLine,
      normalized.category,
      normalized.unit,
      normalized.confidence,
    );
  }

  return {
    name: normalized.displayName,
    amount: normalized.amount,
    unit: normalized.unit,
    category: normalized.category ?? categorizeIngredient(normalized.canonicalName),
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
  if (hasNutSignals(joined)) allergens.push("nötter");
  if (/soja/.test(joined)) allergens.push("soja");
  return allergens;
};

const stapleNeedsWeightPatterns = [
  /^pasta$/,
  /^ris$/,
  /^nudlar$/,
  /^gnocchi$/,
  /^bulgur$/,
  /^quinoa$/,
  /^couscous$/,
];

const proteinCanonicalNames = new Set([
  "kyckling",
  "lax",
  "torsk",
  "rakor",
  "notkott",
  "notfars",
  "flaskkott",
  "tofu",
  "linser",
  "bonor",
]);

const roundToNearest = (value: number, step: number): number => Math.round(value / step) * step;

const inferStapleWeightGrams = (ingredients: Dish["ingredients"]): { grams: number; basis: string } | null => {
  const proteinGrams = ingredients
    .filter((ing) => proteinCanonicalNames.has(canonicalizeIngredientName(ing.name)))
    .reduce((sum, ing) => {
      if (ing.unit !== "g") return sum;
      return sum + ing.amount;
    }, 0);

  if (proteinGrams < 150) return null;
  const grams = Math.max(200, Math.min(700, roundToNearest(proteinGrams * 0.8, 50)));
  return { grams, basis: `protein_grams:${proteinGrams}` };
};

const resolveStaplePlaceholders = (
  recipeId: string,
  recipeTitle: string,
  ingredients: Dish["ingredients"],
): { ingredients: Dish["ingredients"]; unresolvedReasons: string[] } => {
  const inferred = inferStapleWeightGrams(ingredients);
  const next = ingredients.map((ingredient) => ({ ...ingredient }));
  const unresolvedReasons: string[] = [];

  for (const ingredient of next) {
    const canonical = canonicalizeIngredientName(ingredient.name);
    const isStaple = stapleNeedsWeightPatterns.some((pattern) => pattern.test(canonical));
    if (!isStaple || ingredient.unit !== "st") continue;

    if (inferred) {
      inferredAmountAdjustments.push({
        recipeId,
        recipeTitle,
        ingredient: ingredient.name,
        from: { amount: ingredient.amount, unit: ingredient.unit },
        to: { amount: inferred.grams, unit: "g" },
        basis: inferred.basis,
      });
      ingredient.amount = inferred.grams;
      ingredient.unit = "g";
      continue;
    }

    unresolvedReasons.push(`${ingredient.name}: osäkert mått (${ingredient.amount} st)`);
  }

  return { ingredients: next, unresolvedReasons };
};

const findMeasurementRiskReasons = (ingredients: Dish["ingredients"]): string[] => {
  const reasons: string[] = [];
  for (const ing of ingredients) {
    const key = canonicalizeIngredientName(ing.name);
    const isStaple = stapleNeedsWeightPatterns.some((pattern) => pattern.test(key));
    if (!isStaple) continue;
    if (ing.unit === "st") {
      reasons.push(`${ing.name}: osäkert mått (${ing.amount} st)`);
    }
  }
  return Array.from(new Set(reasons));
};

const toDish = (
  sample: KoketSample,
  index: number,
): { dish: Dish; mealType: "main" | "dessert" | "other" | "pending_review" } => {
  const ingredientLines = (sample.ingredients ?? []).map((ing) => ing.raw ?? ing.name ?? "").filter(Boolean).slice(0, 30);
  const baseIngredients = ingredientLines.map(parseIngredient).filter(Boolean) as Dish["ingredients"];

  const mealType = detectMealType(sample);
  const timeMinutes = parseIsoDurationMinutes(sample.raw?.totalTime) ?? sample.timeMinutes ?? 30;
  const recipeId = `koket-${index + 1}`;
  const resolved = resolveStaplePlaceholders(recipeId, sample.title, baseIngredients);
  const ingredients = resolved.ingredients;
  const reviewReasons = [
    ...resolved.unresolvedReasons,
    ...findMeasurementRiskReasons(ingredients),
  ];
  const resolvedMealType = mealType === "main" && reviewReasons.length > 0 ? "pending_review" : mealType;

  if (resolvedMealType === "pending_review") {
    recipeReviewQueue.push({
      id: recipeId,
      title: sample.title,
      reasons: reviewReasons,
    });
  }

  return {
    mealType: resolvedMealType,
    dish: {
      id: recipeId,
      title: sample.title,
      sourceUrl: sample.sourceUrl,
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
      id, title, sourceUrl, cuisineTags, mealType, proteinTag, timeMinutes, difficulty, kidFriendlyScore,
      ingredients, instructionsShort, allergens, tags, imageUrl, createdAt
    ) VALUES (
      @id, @title, @sourceUrl, @cuisineTags, @mealType, @proteinTag, @timeMinutes, @difficulty, @kidFriendlyScore,
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

  const unresolvedReport = Array.from(unresolvedDiagMap.values())
    .sort((a, b) => b.count - a.count)
    .map((entry) => ({
      rawName: entry.rawName,
      count: entry.count,
      topCategory: entry.topCategory,
      topUnit: entry.topUnit,
      maxConfidence: Number(entry.maxConfidence.toFixed(3)),
      examples: Array.from(entry.examples).sort(),
    }));

  const mergeCandidateReport = Array.from(mergeCandidateMap.values())
    .map((entry) => ({
      mergeKey: entry.mergeKey,
      count: entry.count,
      variants: Array.from(entry.variants.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([name, cnt]) => ({ name, count: cnt })),
      examples: Array.from(entry.examples).sort(),
    }))
    .filter((entry) => entry.variants.length > 1)
    .sort((a, b) => b.count - a.count);
  const inferredAmountReportFile = path.resolve(dataDir, "ingredient_inferred_amounts.json");

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

  fs.writeFileSync(
    unresolvedReportFile,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: path.basename(inputFile),
        totalUnresolvedTokens: unresolvedReport.length,
        unresolved: unresolvedReport,
      },
      null,
      2,
    ),
    "utf8",
  );

  fs.writeFileSync(
    mergeCandidateReportFile,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: path.basename(inputFile),
        totalMergeCandidateGroups: mergeCandidateReport.length,
        groups: mergeCandidateReport,
      },
      null,
      2,
    ),
    "utf8",
  );

  fs.writeFileSync(
    reviewQueueReportFile,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: path.basename(inputFile),
        totalPendingRecipes: recipeReviewQueue.length,
        recipes: recipeReviewQueue,
      },
      null,
      2,
    ),
    "utf8",
  );

  fs.writeFileSync(
    inferredAmountReportFile,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: path.basename(inputFile),
        totalInferredAdjustments: inferredAmountAdjustments.length,
        adjustments: inferredAmountAdjustments,
      },
      null,
      2,
    ),
    "utf8",
  );

  const mains = counts.find((c) => c.mealType === "main")?.count ?? 0;
  const desserts = counts.find((c) => c.mealType === "dessert")?.count ?? 0;
  const other = counts.find((c) => c.mealType === "other")?.count ?? 0;
  const pendingReview = counts.find((c) => c.mealType === "pending_review")?.count ?? 0;

  console.log(`Imported ${mapped.length} recipes from ${path.basename(inputFile)}.`);
  console.log(`Meal types => main: ${mains}, dessert: ${desserts}, other: ${other}, pending_review: ${pendingReview}`);
  console.log(`Alias report => ${aliasReportFile}`);
  console.log(`Unresolved report => ${unresolvedReportFile}`);
  console.log(`Merge candidate report => ${mergeCandidateReportFile}`);
  console.log(`Review queue report => ${reviewQueueReportFile}`);
  console.log(`Inferred amounts report => ${inferredAmountReportFile}`);
};

run();


