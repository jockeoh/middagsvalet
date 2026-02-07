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

  it("keeps placeholder count rows together with concrete units for review visibility", () => {
    const dishes: Dish[] = [
      {
        id: "d2",
        title: "Pasta 1",
        cuisineTags: ["italienskt"],
        proteinTag: "vegetariskt",
        timeMinutes: 20,
        difficulty: "easy",
        kidFriendlyScore: 70,
        instructionsShort: "Test",
        allergens: [],
        tags: ["budget"],
        ingredients: [
          { name: "Pasta", amount: 1, unit: "st", category: "Skafferi" },
          { name: "Pasta", amount: 400, unit: "g", category: "Skafferi" },
          { name: "Chili", amount: 1, unit: "st", category: "Kryddor" },
          { name: "Chili", amount: 5, unit: "ml", category: "Kryddor" },
        ],
      },
    ];

    const list = buildShoppingList("h1", dishes, {});
    const pantryItems = list.itemsByCategory.Skafferi;
    const spiceItems = list.itemsByCategory.Kryddor;

    expect(pantryItems.some((i) => i.name === "Pasta" && i.unit === "st")).toBe(true);
    expect(pantryItems.some((i) => i.name === "Pasta" && i.unit === "g")).toBe(true);
    expect(spiceItems.some((i) => i.name === "Chili" && i.unit === "st")).toBe(true);
    expect(spiceItems.some((i) => i.name === "Chili" && i.unit === "ml")).toBe(true);
  });
});
