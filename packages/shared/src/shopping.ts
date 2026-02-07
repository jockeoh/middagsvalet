import { Dish, ShoppingList } from "./types";

const categories = ["Frukt&Gront", "Mejeri", "Skafferi", "Kott/Fisk", "Kryddor"] as const;

export const buildShoppingList = (
  householdId: string,
  dishes: Dish[],
  pantryState: Record<string, boolean> = {},
): ShoppingList => {
  const bucket = new Map<string, { name: string; amount: number; unit: string; category: (typeof categories)[number] }>();

  for (const dish of dishes) {
    for (const ingredient of dish.ingredients) {
      const key = `${ingredient.name.toLowerCase()}__${ingredient.unit}`;
      const current = bucket.get(key);
      if (current) {
        current.amount += ingredient.amount;
      } else {
        bucket.set(key, {
          name: ingredient.name,
          amount: ingredient.amount,
          unit: ingredient.unit,
          category: ingredient.category,
        });
      }
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
    itemsByCategory[item.category].push({
      ...item,
      amount: Number(item.amount.toFixed(2)),
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
