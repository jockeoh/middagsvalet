import { Ingredient } from "./types";

type IngredientCategory = Ingredient["category"];
type MatchMode = "exact" | "fuzzy" | "fallback";

type CatalogEntry = {
  canonicalName: string;
  displayName: string;
  category: IngredientCategory;
  aliases: string[];
};

export type IngredientNormalization = {
  canonicalName: string;
  displayName: string;
  category: IngredientCategory;
  amount: number;
  unit: string;
  confidence: number;
  matchMode: MatchMode;
  cleanedLine: string;
  rawName: string;
};

const UNIT_ALIASES: Record<string, string> = {
  kg: "kg",
  hg: "hg",
  g: "g",
  gram: "g",
  l: "l",
  liter: "l",
  dl: "dl",
  cl: "cl",
  ml: "ml",
  msk: "msk",
  matsked: "msk",
  matskedar: "msk",
  tsk: "tsk",
  tesked: "tsk",
  teskedar: "tsk",
  krm: "krm",
  kryddmatt: "krm",
  st: "st",
  styck: "st",
  stycken: "st",
  forp: "st",
  forpackning: "st",
  forpackningar: "st",
  fp: "st",
  paket: "st",
  pkt: "st",
  burk: "st",
  burkar: "st",
  kruka: "st",
  krukor: "st",
  knippe: "st",
  knippen: "st",
};

const NOISE_WORDS = new Set([
  "att",
  "till",
  "servering",
  "stekning",
  "stek",
  "fritering",
  "fritera",
  "finhackad",
  "finhackade",
  "hackad",
  "hackade",
  "grovhackad",
  "grovhackade",
  "strimlad",
  "skivad",
  "tarnad",
  "tarningar",
  "farsk",
  "farska",
  "valfritt",
  "eventuellt",
  "nymalen",
  "malen",
  "port",
  "portion",
  "portioner",
  "forp",
  "forpackning",
  "forpackningar",
  "fp",
  "pkt",
  "paket",
  "ekologisk",
  "ekologiska",
  "smak",
  "smaksatt",
  "klyfta",
  "klyftor",
  "kvist",
  "kvistar",
  "kruka",
  "krukor",
  "blad",
  "hela",
  "hel",
  "liten",
  "litet",
  "små",
  "sma",
]);

const TYPO_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bvitlok\b/g, "vitlok"],
  [/\bvitl\s*k\b/g, "vitlok"],
  [/\bsvartpepar\b/g, "svartpeppar"],
  [/\bollivolja\b/g, "olivolja"],
  [/\badvokado\b/g, "avokado"],
];

const CATALOG: CatalogEntry[] = [
  { canonicalName: "vatten", displayName: "Vatten", category: "Skafferi", aliases: ["vatten"] },
  { canonicalName: "salt", displayName: "Salt", category: "Kryddor", aliases: ["salt", "havssalt", "flingsalt"] },
  { canonicalName: "svartpeppar", displayName: "Svartpeppar", category: "Kryddor", aliases: ["svartpeppar", "peppar"] },
  { canonicalName: "vitlok", displayName: "Vitl\u00f6k", category: "Frukt&Gront", aliases: ["vitlok", "vitloksklyfta", "vitloksklyftor"] },
  { canonicalName: "gul lok", displayName: "Gul l\u00f6k", category: "Frukt&Gront", aliases: ["gul lok", "lok", "lokar"] },
  { canonicalName: "rod lok", displayName: "R\u00f6d l\u00f6k", category: "Frukt&Gront", aliases: ["rod lok"] },
  { canonicalName: "morot", displayName: "Morot", category: "Frukt&Gront", aliases: ["morot", "morotter"] },
  { canonicalName: "potatis", displayName: "Potatis", category: "Frukt&Gront", aliases: ["potatis"] },
  { canonicalName: "tomat", displayName: "Tomat", category: "Frukt&Gront", aliases: ["tomat", "tomater"] },
  { canonicalName: "citron", displayName: "Citron", category: "Frukt&Gront", aliases: ["citron"] },
  { canonicalName: "lime", displayName: "Lime", category: "Frukt&Gront", aliases: ["lime"] },
  { canonicalName: "avokado", displayName: "Avokado", category: "Frukt&Gront", aliases: ["avokado", "avokador"] },
  { canonicalName: "farsk koriander", displayName: "F\u00e4rsk koriander", category: "Frukt&Gront", aliases: ["koriander", "farsk koriander", "korianderkvistar"] },
  { canonicalName: "mynta", displayName: "Mynta", category: "Frukt&Gront", aliases: ["mynta", "farsk mynta"] },
  { canonicalName: "basilika", displayName: "Basilika", category: "Frukt&Gront", aliases: ["basilika", "farsk basilika"] },
  { canonicalName: "olivolja", displayName: "Olivolja", category: "Skafferi", aliases: ["olivolja"] },
  { canonicalName: "rapsolja", displayName: "Rapsolja", category: "Skafferi", aliases: ["rapsolja"] },
  { canonicalName: "smor", displayName: "Sm\u00f6r", category: "Mejeri", aliases: ["smor"] },
  { canonicalName: "mjolk", displayName: "Mj\u00f6lk", category: "Mejeri", aliases: ["mjolk"] },
  { canonicalName: "gradde", displayName: "Gr\u00e4dde", category: "Mejeri", aliases: ["gradde", "vispgradde", "matlagningsgradde"] },
  { canonicalName: "creme fraiche", displayName: "Cr\u00e8me fraiche", category: "Mejeri", aliases: ["creme fraiche", "fraiche"] },
  { canonicalName: "yoghurt", displayName: "Yoghurt", category: "Mejeri", aliases: ["yoghurt", "grekisk yoghurt"] },
  { canonicalName: "ost", displayName: "Ost", category: "Mejeri", aliases: ["ost", "parmesan", "mozzarella"] },
  { canonicalName: "ris", displayName: "Ris", category: "Skafferi", aliases: ["ris", "basmatiris", "jasminris"] },
  { canonicalName: "pasta", displayName: "Pasta", category: "Skafferi", aliases: ["pasta", "spaghetti", "penne"] },
  { canonicalName: "gnocchi", displayName: "Gnocchi", category: "Skafferi", aliases: ["gnocchi"] },
  { canonicalName: "nudlar", displayName: "Nudlar", category: "Skafferi", aliases: ["nudlar", "risnudlar", "aggnudlar"] },
  { canonicalName: "vetemjol", displayName: "Vetemj\u00f6l", category: "Skafferi", aliases: ["vetemjol", "mjol"] },
  { canonicalName: "strobrod", displayName: "Str\u00f6br\u00f6d", category: "Skafferi", aliases: ["strobrod"] },
  { canonicalName: "krossade tomater", displayName: "Krossade tomater", category: "Skafferi", aliases: ["krossade tomater"] },
  { canonicalName: "tomatpure", displayName: "Tomatpur\u00e9", category: "Skafferi", aliases: ["tomatpure"] },
  { canonicalName: "strosocker", displayName: "Str\u00f6socker", category: "Skafferi", aliases: ["strosocker", "socker"] },
  { canonicalName: "vaniljpulver", displayName: "Vaniljpulver", category: "Skafferi", aliases: ["vaniljpulver"] },
  { canonicalName: "havregryn", displayName: "Havregryn", category: "Skafferi", aliases: ["havregryn"] },
  { canonicalName: "hoisinsas", displayName: "Hoisins\u00e5s", category: "Skafferi", aliases: ["hoisinsas"] },
  { canonicalName: "sojasas", displayName: "Sojas\u00e5s", category: "Skafferi", aliases: ["sojasas", "soja"] },
  { canonicalName: "japansk soja", displayName: "Japansk soja", category: "Skafferi", aliases: ["japansk soja"] },
  { canonicalName: "sesamolja", displayName: "Sesamolja", category: "Skafferi", aliases: ["sesamolja"] },
  { canonicalName: "chili", displayName: "Chili", category: "Kryddor", aliases: ["chili", "chiliflakes"] },
  { canonicalName: "paprikapulver", displayName: "Paprikapulver", category: "Kryddor", aliases: ["paprikapulver"] },
  { canonicalName: "spiskummin", displayName: "Spiskummin", category: "Kryddor", aliases: ["spiskummin"] },
  { canonicalName: "oregano", displayName: "Oregano", category: "Kryddor", aliases: ["oregano"] },
  { canonicalName: "kanel", displayName: "Kanel", category: "Kryddor", aliases: ["kanel"] },
  { canonicalName: "agg", displayName: "\u00c4gg", category: "Skafferi", aliases: ["agg", "agget", "aggen"] },
  { canonicalName: "lagerblad", displayName: "Lagerblad", category: "Kryddor", aliases: ["lagerblad", "lagerbladet"] },
  { canonicalName: "kyckling", displayName: "Kyckling", category: "Kott/Fisk", aliases: ["kyckling", "kycklingfile", "kycklinglar"] },
  { canonicalName: "lax", displayName: "Lax", category: "Kott/Fisk", aliases: ["lax"] },
  { canonicalName: "torsk", displayName: "Torsk", category: "Kott/Fisk", aliases: ["torsk"] },
  { canonicalName: "rakor", displayName: "R\u00e4kor", category: "Kott/Fisk", aliases: ["rakor", "raka", "scampi"] },
  { canonicalName: "notkott", displayName: "N\u00f6tk\u00f6tt", category: "Kott/Fisk", aliases: ["notkott", "biff", "entrecote", "hogrev", "oxfile", "rostbiff"] },
  { canonicalName: "notfars", displayName: "N\u00f6tf\u00e4rs", category: "Kott/Fisk", aliases: ["notfars", "kottfars"] },
  { canonicalName: "flaskkott", displayName: "Fl\u00e4skk\u00f6tt", category: "Kott/Fisk", aliases: ["flask", "flaskkott", "bacon", "skinka"] },
  { canonicalName: "tofu", displayName: "Tofu", category: "Skafferi", aliases: ["tofu"] },
  { canonicalName: "linser", displayName: "Linser", category: "Skafferi", aliases: ["linser"] },
  { canonicalName: "bonor", displayName: "B\u00f6nor", category: "Skafferi", aliases: ["bonor", "kidneybonor", "svarta bonor"] },
  { canonicalName: "jordnotter", displayName: "Jordn\u00f6tter", category: "Skafferi", aliases: ["jordnotter", "jordnotssmor", "jordnot"] },
  { canonicalName: "mandel", displayName: "Mandel", category: "Skafferi", aliases: ["mandel", "mandelsmor"] },
  { canonicalName: "wontonplattor", displayName: "Wontonplattor", category: "Skafferi", aliases: ["wontonplattor"] },
  { canonicalName: "endive", displayName: "Endive", category: "Frukt&Gront", aliases: ["endive", "endiver"] },
];

const ALIAS_TO_ENTRY = new Map<string, CatalogEntry>();
for (const entry of CATALOG) {
  for (const alias of entry.aliases) {
    ALIAS_TO_ENTRY.set(alias, entry);
  }
}

const CATEGORY_HINTS: Array<{ pattern: RegExp; category: IngredientCategory }> = [
  { pattern: /kyckling|lax|fisk|notkott|notfars|kottfars|flask|skinka|rakor|scampi|torsk/, category: "Kott/Fisk" },
  { pattern: /mjolk|gradde|smor|yoghurt|ost|fraiche/, category: "Mejeri" },
  { pattern: /salt|peppar|chili|oregano|kanel|spiskummin|paprika/, category: "Kryddor" },
  { pattern: /tomat|lok|morot|potatis|broccoli|spenat|gurka|zucchini|vitlok|citron|avokado|koriander|endive/, category: "Frukt&Gront" },
];

const FRACTIONS: Record<string, number> = {
  "1/2": 0.5,
  "1/3": 1 / 3,
  "2/3": 2 / 3,
  "1/4": 0.25,
  "3/4": 0.75,
  "¼": 0.25,
  "½": 0.5,
  "¾": 0.75,
};

const repairMojibake = (value: string): string =>
  value
    .replace(/Ã¥/g, "å")
    .replace(/Ã¤/g, "ä")
    .replace(/Ã¶/g, "ö")
    .replace(/Ã…/g, "Å")
    .replace(/Ã„/g, "Ä")
    .replace(/Ã–/g, "Ö")
    .replace(/Â¼/g, "¼")
    .replace(/Â½/g, "½")
    .replace(/Â¾/g, "¾");

export const foldText = (value: string): string =>
  repairMojibake(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s./-]/g, " ");

const squeezeSpaces = (value: string): string => value.replace(/\s+/g, " ").trim();

export const cleanIngredientLine = (raw: string): string => {
  let line = repairMojibake(raw.trim());
  line = line.replace(/^\s*ca\.?\s+/i, "");
  line = line.replace(/[–—]/g, "-");
  line = line.replace(/^\s*-\s*/g, "");
  line = line.replace(/\s*-\s*(\d+(?:[.,]\d+)?)\s*(st|g|kg|hg|ml|cl|dl|l|msk|tsk|krm)\s*$/i, "");
  line = line.replace(/^\s*(\d+)\s*-\s*(.+)$/g, "$1 $2");
  line = line.replace(/\s{2,}/g, " ");
  return line.trim();
};

const normalizeNameText = (rawName: string): string => {
  let name = foldText(rawName);
  name = name.replace(/\(.*?\)/g, " ");
  name = name.replace(/,/g, " ");
  for (const [pattern, replacement] of TYPO_REPLACEMENTS) {
    name = name.replace(pattern, replacement);
  }
  const tokens = squeezeSpaces(name)
    .split(" ")
    .filter(Boolean)
    .filter((token) => !/^\d+$/.test(token))
    .filter((token) => !NOISE_WORDS.has(token));
  return squeezeSpaces(tokens.join(" "));
};

const parseAmount = (token: string): number | null => {
  const cleaned = token.trim().replace(",", ".");
  if (!cleaned) return null;
  if (FRACTIONS[cleaned] !== undefined) return FRACTIONS[cleaned];
  if (/^\d+(?:\.\d+)?$/.test(cleaned)) return Number(cleaned);
  if (/^\d+\s+\d\/\d$/.test(cleaned)) {
    const [whole, frac] = cleaned.split(/\s+/);
    return Number(whole) + (FRACTIONS[frac] ?? 0);
  }
  if (/^\d+\/\d+$/.test(cleaned)) {
    const [a, b] = cleaned.split("/");
    const denominator = Number(b);
    if (!denominator) return null;
    return Number(a) / denominator;
  }
  return null;
};

const parseAmountAndUnit = (line: string): { amount: number; unit: string; namePart: string } => {
  const match = line.match(/^((?:\d+(?:[.,]\d+)?(?:\s+\d\/\d)?|\d\/\d|[¼½¾]))\s*([a-zA-ZåäöÅÄÖ]+)?\s*(.*)$/);
  if (!match) return { amount: 1, unit: "st", namePart: line };
  const amount = parseAmount(match[1]) ?? 1;
  const tokenAfterAmount = match[2] ? foldText(match[2]) : "";
  const tail = squeezeSpaces(match[3] || "");
  const hasKnownUnit = tokenAfterAmount && Object.prototype.hasOwnProperty.call(UNIT_ALIASES, tokenAfterAmount);
  const unit = hasKnownUnit ? UNIT_ALIASES[tokenAfterAmount] : "st";
  const namePart = hasKnownUnit
    ? squeezeSpaces(tail || line)
    : squeezeSpaces(`${tokenAfterAmount} ${tail}`.trim() || line);
  return { amount, unit, namePart };
};

const levenshtein = (a: string, b: string): number => {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j += 1) dp[j] = j;
  for (let i = 1; i <= m; i += 1) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const temp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return dp[n];
};

const fuzzyFind = (normalizedName: string): { entry: CatalogEntry; confidence: number } | null => {
  const tokensA = new Set(normalizedName.split(" ").filter(Boolean));
  let best: { entry: CatalogEntry; confidence: number } | null = null;

  for (const entry of CATALOG) {
    for (const alias of entry.aliases) {
      const tokensB = new Set(alias.split(" ").filter(Boolean));
      const intersect = Array.from(tokensA).filter((token) => tokensB.has(token)).length;
      const union = new Set([...tokensA, ...tokensB]).size || 1;
      const jaccard = intersect / union;
      const distance = levenshtein(normalizedName, alias);
      const distanceScore = 1 - distance / Math.max(normalizedName.length, alias.length, 1);
      const score = jaccard * 0.6 + distanceScore * 0.4;
      if (!best || score > best.confidence) best = { entry, confidence: score };
    }
  }

  if (!best || best.confidence < 0.74) return null;
  return best;
};

const inferCategoryFallback = (normalizedName: string): IngredientCategory => {
  for (const hint of CATEGORY_HINTS) {
    if (hint.pattern.test(normalizedName)) return hint.category;
  }
  return "Skafferi";
};

export const normalizeUnit = (unit: string): string => {
  const folded = foldText(unit).trim();
  if (!folded) return "st";
  return UNIT_ALIASES[folded] ?? folded;
};

export const canonicalizeIngredientName = (rawName: string): string => {
  const normalizedName = normalizeNameText(rawName);
  const exact = ALIAS_TO_ENTRY.get(normalizedName);
  if (exact) return exact.canonicalName;
  const fuzzy = fuzzyFind(normalizedName);
  if (fuzzy) return fuzzy.entry.canonicalName;
  return normalizedName || "okand ingrediens";
};

export const displayIngredientName = (canonicalName: string): string => {
  const exact = CATALOG.find((entry) => entry.canonicalName === canonicalName);
  if (exact) return exact.displayName;
  const cleaned = repairMojibake(canonicalName).trim();
  return cleaned.length ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : "Okänd ingrediens";
};

export const toBaseUnit = (_canonicalName: string, amount: number, unit: string): { amount: number; unit: string } => {
  if (unit === "l") return { amount: amount * 1000, unit: "ml" };
  if (unit === "dl") return { amount: amount * 100, unit: "ml" };
  if (unit === "cl") return { amount: amount * 10, unit: "ml" };
  if (unit === "ml") return { amount, unit: "ml" };
  if (unit === "kg") return { amount: amount * 1000, unit: "g" };
  if (unit === "hg") return { amount: amount * 100, unit: "g" };
  if (unit === "g") return { amount, unit: "g" };
  if (unit === "msk") return { amount: amount * 15, unit: "ml" };
  if (unit === "tsk") return { amount: amount * 5, unit: "ml" };
  if (unit === "krm") return { amount, unit: "ml" };
  return { amount, unit: unit || "st" };
};

export const normalizeIngredient = (rawLine: string): IngredientNormalization => {
  const cleanedLine = cleanIngredientLine(rawLine);
  if (!cleanedLine) {
    return {
      canonicalName: "okand ingrediens",
      displayName: "Okänd ingrediens",
      category: "Skafferi",
      amount: 1,
      unit: "st",
      confidence: 0,
      matchMode: "fallback",
      cleanedLine,
      rawName: rawLine,
    };
  }

  const parsed = parseAmountAndUnit(cleanedLine);
  const normalizedName = normalizeNameText(parsed.namePart);
  const exact = ALIAS_TO_ENTRY.get(normalizedName);
  const fuzzy = exact ? null : fuzzyFind(normalizedName);
  const canonicalName = exact?.canonicalName ?? fuzzy?.entry.canonicalName ?? (normalizedName || "okand ingrediens");
  const displayName = exact?.displayName ?? fuzzy?.entry.displayName ?? displayIngredientName(canonicalName);
  const category = exact?.category ?? fuzzy?.entry.category ?? inferCategoryFallback(normalizedName);
  const confidence = exact ? 1 : fuzzy?.confidence ?? (normalizedName ? 0.45 : 0);
  const matchMode: MatchMode = exact ? "exact" : fuzzy ? "fuzzy" : "fallback";
  const base = toBaseUnit(canonicalName, parsed.amount, normalizeUnit(parsed.unit));

  return {
    canonicalName,
    displayName,
    category,
    amount: Number(base.amount.toFixed(2)),
    unit: base.unit,
    confidence: Number(confidence.toFixed(3)),
    matchMode,
    cleanedLine,
    rawName: parsed.namePart || cleanedLine,
  };
};

export const hasNutSignals = (value: string): boolean =>
  /jordnot|notter|mandel|cashew|hasselnot|valnot|pistage/.test(foldText(value));
