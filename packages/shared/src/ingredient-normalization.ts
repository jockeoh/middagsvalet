export const INGREDIENT_RULES = {
  removeWords: [
    "att steka i",
    "att fritera i",
    "till servering",
    "finhackad",
    "hackad",
    "grovhackad",
    "skivad",
    "strimlad",
    "tarnad",
    "valfritt",
    "nymalen",
    "farsk",
    "kvist",
    "kvistar",
    "klyfta",
    "klyftor",
  ],
  canonicalContains: [
    { canonical: "vitlok", patterns: ["vitlok"] },
    { canonical: "olivolja", patterns: ["olivolja"] },
    { canonical: "rapsolja", patterns: ["rapsolja"] },
    { canonical: "smor", patterns: [" smor "] },
    { canonical: "svartpeppar", patterns: ["svartpeppar"] },
    { canonical: "koriander", patterns: ["koriander"] },
    { canonical: "avokado", patterns: ["avokado"] },
    { canonical: "jordnotssmor", patterns: ["jordnotssmor"] },
    { canonical: "mandelsmor", patterns: ["mandelsmor"] },
    { canonical: "hasselnotssmor", patterns: ["hasselnotssmor"] },
  ],
  singularReplacements: [
    ["avokador", "avokado"],
    ["tomater", "tomat"],
    ["lokar", "lok"],
  ] as Array<[string, string]>,
  unitAliases: {
    matsked: "msk",
    tesked: "tsk",
    kryddmatt: "krm",
    klyfta: "st",
    klyftor: "st",
  } as Record<string, string>,
  displayNames: {
    vitlok: "Vitlök",
    smor: "Smör",
    svartpeppar: "Svartpeppar",
    koriander: "Koriander",
    avokado: "Avokado",
    jordnotssmor: "Jordnötssmör",
    mandelsmor: "Mandelsmör",
    hasselnotssmor: "Hasselnötssmör",
  } as Record<string, string>,
};

export const foldText = (value: string): string =>
  value.toLowerCase().replace(/[åä]/g, "a").replace(/ö/g, "o");

const squeezeSpaces = (value: string): string => value.replace(/\s+/g, " ").trim();

export const cleanIngredientLine = (raw: string): string => {
  let line = raw.trim();
  line = line.replace(/[–—]/g, "-");
  line = line.replace(/^\s*-\s*/g, "");
  line = line.replace(/\s*-\s*(\d+(?:[.,]\d+)?)\s*(st|g|kg|hg|ml|cl|dl|l|msk|tsk|krm)\s*$/i, "");
  line = line.replace(/^\s*(\d+)\s*-\s*(.+)$/g, "$1 $2");
  line = line.replace(/\s{2,}/g, " ").trim();
  return line;
};

export const canonicalizeIngredientName = (rawName: string): string => {
  let name = foldText(rawName);
  name = name.replace(/\(.*?\)/g, " ");
  name = name.replace(/,/g, " ");
  for (const removeWord of INGREDIENT_RULES.removeWords) {
    const pattern = new RegExp(`\\b${removeWord}\\b`, "g");
    name = name.replace(pattern, " ");
  }
  name = ` ${squeezeSpaces(name)} `;

  for (const row of INGREDIENT_RULES.canonicalContains) {
    if (row.patterns.some((pattern) => name.includes(pattern))) {
      return row.canonical;
    }
  }

  let cleaned = squeezeSpaces(name);
  for (const [from, to] of INGREDIENT_RULES.singularReplacements) {
    cleaned = cleaned.replace(new RegExp(`\\b${from}\\b`, "g"), to);
  }
  return cleaned;
};

export const normalizeUnit = (unit: string): string => {
  const folded = foldText(unit).trim();
  if (!folded) return "st";
  return INGREDIENT_RULES.unitAliases[folded] ?? folded;
};

export const toBaseUnit = (
  canonicalName: string,
  amount: number,
  unit: string,
): { amount: number; unit: string } => {
  if (unit === "l") return { amount: amount * 1000, unit: "ml" };
  if (unit === "dl") return { amount: amount * 100, unit: "ml" };
  if (unit === "cl") return { amount: amount * 10, unit: "ml" };
  if (unit === "ml") return { amount, unit: "ml" };

  if (unit === "kg") return { amount: amount * 1000, unit: "g" };
  if (unit === "hg") return { amount: amount * 100, unit: "g" };
  if (unit === "g") {
    if (canonicalName === "salt") return { amount: amount / 6, unit: "tsk" };
    if (canonicalName === "svartpeppar") return { amount: amount / 2, unit: "tsk" };
    return { amount, unit: "g" };
  }

  if (unit === "msk") return { amount: amount * 3, unit: "tsk" };
  if (unit === "krm") return { amount: amount * 0.2, unit: "tsk" };
  if (unit === "tsk") return { amount, unit: "tsk" };

  if (unit === "st" && canonicalName === "koriander") return { amount, unit: "tsk" };
  return { amount, unit };
};

export const displayIngredientName = (canonicalName: string): string =>
  INGREDIENT_RULES.displayNames[canonicalName] ??
  (canonicalName.length ? canonicalName.charAt(0).toUpperCase() + canonicalName.slice(1) : canonicalName);
