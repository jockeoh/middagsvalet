import { Dish, ShoppingList } from "./types";
import { canonicalizeIngredientName, displayIngredientName, normalizeUnit, toBaseUnit } from "./ingredient-normalization";

const categories = ["Frukt&Gront", "Mejeri", "Skafferi", "Kott/Fisk", "Kryddor"] as const;

const prettifyAmountAndUnit = (amount: number, unit: string): { amount: number; unit: string } => {
  if (unit === "ml") {
    if (amount >= 1000) return { amount: Number((amount / 1000).toFixed(2)), unit: "l" };
    if (amount >= 100) return { amount: Number((amount / 100).toFixed(2)), unit: "dl" };
    return { amount: Number(amount.toFixed(0)), unit: "ml" };
  }

  if (unit === "g") {
    if (amount >= 1000) return { amount: Number((amount / 1000).toFixed(2)), unit: "kg" };
    return { amount: Number(amount.toFixed(0)), unit: "g" };
  }

  if (unit === "tsk" && amount >= 3) {
    return { amount: Number((amount / 3).toFixed(2)), unit: "msk" };
  }

  return { amount: Number(amount.toFixed(2)), unit };
};

export const buildShoppingList = (
  householdId: string,
  dishes: Dish[],
  pantryState: Record<string, boolean> = {},
): ShoppingList => {
  const bucket = new Map<
    string,
    { canonicalName: string; name: string; amount: number; unit: string; category: (typeof categories)[number] }
  >();

  for (const dish of dishes) {
    for (const ingredient of dish.ingredients) {
      const canonicalName = canonicalizeIngredientName(ingredient.name);
      if (canonicalName === "vatten") continue;
      const unit = normalizeUnit(ingredient.unit);
      const base = toBaseUnit(canonicalName, ingredient.amount, unit);
      const key = `${canonicalName}__${base.unit}`;
      const current = bucket.get(key);
      if (current) {
        current.amount += base.amount;
      } else {
        bucket.set(key, {
          canonicalName,
          name: displayIngredientName(canonicalName),
          amount: base.amount,
          unit: base.unit,
          category: ingredient.category,
        });
      }
    }
  }

  const measurableUnitsByIngredient = new Map<string, Set<string>>();
  for (const item of bucket.values()) {
    if (item.unit === "st") continue;
    const units = measurableUnitsByIngredient.get(item.canonicalName);
    if (units) {
      units.add(item.unit);
    } else {
      measurableUnitsByIngredient.set(item.canonicalName, new Set([item.unit]));
    }
  }

  const itemsByCategory = {
    "Frukt&Gront": [] as ShoppingList["itemsByCategory"]["Frukt&Gront"],
    Mejeri: [] as ShoppingList["itemsByCategory"]["Mejeri"],
    Skafferi: [] as ShoppingList["itemsByCategory"]["Skafferi"],
    "Kott/Fisk": [] as ShoppingList["itemsByCategory"]["Kott/Fisk"],
    Kryddor: [] as ShoppingList["itemsByCategory"]["Kryddor"],
  };

  for (const item of bucket.values()) {
    // If the same ingredient already exists with measurable units, suppress count placeholders.
    if (item.unit === "st" && measurableUnitsByIngredient.has(item.canonicalName)) continue;
    const formatted = prettifyAmountAndUnit(item.amount, item.unit);
    itemsByCategory[item.category].push({
      name: item.name,
      amount: formatted.amount,
      unit: formatted.unit,
      category: item.category,
      inPantry: Boolean(pantryState[item.name.toLowerCase()]),
    });
  }

  for (const category of categories) {
    itemsByCategory[category].sort((a, b) => a.name.localeCompare(b.name));
  }

  return {
    householdId,
    itemsByCategory,
  };
};
