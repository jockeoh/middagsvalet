import { describe, expect, it } from "vitest";
import { buildShoppingList } from "../src/shopping";
import { Dish } from "../src/types";

describe("shopping list", () => {
  it("skips water items and keeps actual groceries", () => {
    const dishes: Dish[] = [
      {
        id: "d1",
        title: "Test",
        cuisineTags: ["husman"],
        proteinTag: "vegetariskt",
        timeMinutes: 20,
        difficulty: "easy",
        kidFriendlyScore: 70,
        instructionsShort: "Test",
        allergens: [],
        tags: ["budget"],
        ingredients: [
          { name: "Vatten", amount: 2, unit: "l", category: "Skafferi" },
          { name: "Gul lok stor", amount: 1, unit: "st", category: "Frukt&Gront" },
        ],
      },
    ];

    const list = buildShoppingList("h1", dishes, {});
    const skafferiNames = list.itemsByCategory.Skafferi.map((i) => i.name);
    const produceNames = list.itemsByCategory["Frukt&Gront"].map((i) => i.name);

    expect(skafferiNames.includes("Vatten")).toBe(false);
    expect(produceNames.includes("Gul lök")).toBe(true);
  });
});

