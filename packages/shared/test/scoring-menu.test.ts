import { describe, expect, it } from "vitest";
import { generateWeeklyMenu, getSwapCandidates } from "../src/menu";
import { Dish, Household, ScoreContext } from "../src/types";
import { scoreDishForHousehold } from "../src/scoring";

const household: Household = {
  id: "h1",
  name: "Testfamilj",
  childWeightBoost: 1.2,
  profiles: [
    { id: "a1", name: "Anna", type: "adult", pickyLevel: 0 },
    { id: "c1", name: "Leo", type: "child", pickyLevel: 1 },
  ],
  preferences: {
    cuisines: ["italienskt", "asiatiskt"],
    proteins: ["kyckling", "vegetariskt"],
    avoidAllergens: ["nötter"],
    avoidIngredients: ["svamp"],
    maxTimeMinutes: 30,
    dinnersPerWeek: 3,
    moodTags: ["fresh", "budget"],
  },
};

const dishes: Dish[] = [
  {
    id: "d1",
    title: "Kycklingwok",
    cuisineTags: ["asiatiskt"],
    proteinTag: "kyckling",
    timeMinutes: 25,
    difficulty: "easy",
    kidFriendlyScore: 80,
    ingredients: [],
    instructionsShort: "Woka snabbt",
    allergens: [],
    tags: ["fresh"],
  },
  {
    id: "d2",
    title: "Pad Thai",
    cuisineTags: ["asiatiskt"],
    proteinTag: "kyckling",
    timeMinutes: 30,
    difficulty: "medium",
    kidFriendlyScore: 70,
    ingredients: [],
    instructionsShort: "Ror ihop",
    allergens: ["nötter"],
    tags: ["spicy"],
  },
  {
    id: "d3",
    title: "Pasta pesto",
    cuisineTags: ["italienskt"],
    proteinTag: "vegetariskt",
    timeMinutes: 15,
    difficulty: "easy",
    kidFriendlyScore: 90,
    ingredients: [],
    instructionsShort: "Koka pasta",
    allergens: [],
    tags: ["budget"],
  },
  {
    id: "d4",
    title: "Chicken tacos",
    cuisineTags: ["mexikanskt"],
    proteinTag: "kyckling",
    timeMinutes: 20,
    difficulty: "easy",
    kidFriendlyScore: 65,
    ingredients: [],
    instructionsShort: "Montera",
    allergens: [],
    tags: ["comfort"],
  },
  {
    id: "d5",
    title: "Vegetarisk bowl",
    cuisineTags: ["asiatiskt"],
    proteinTag: "vegetariskt",
    timeMinutes: 20,
    difficulty: "easy",
    kidFriendlyScore: 82,
    ingredients: [],
    instructionsShort: "Bygg bowl",
    allergens: [],
    tags: ["fresh"],
  },
];

const context: ScoreContext = {
  recentDishIds: [],
  recentProteinTags: ["kyckling"],
  likesByProfile: {},
  dislikesByProfile: {},
};

describe("scoring", () => {
  it("penalizes avoided allergens", () => {
    const safe = scoreDishForHousehold(dishes[0], household, context);
    const allergic = scoreDishForHousehold(dishes[1], household, context);
    expect(safe.totalScore).toBeGreaterThan(allergic.totalScore);
  });
});

describe("menu generation", () => {
  it("respects variation protein rule and avoids allergens", () => {
    const menu = generateWeeklyMenu(dishes, household, context, { randomFn: () => 0.05, topK: 3 });

    expect(menu.dinners).toHaveLength(3);
    expect(menu.dinners.some((day) => day.dish.allergens.includes("nötter"))).toBe(false);

    for (let i = 2; i < menu.dinners.length; i += 1) {
      const p0 = menu.dinners[i - 2].dish.proteinTag;
      const p1 = menu.dinners[i - 1].dish.proteinTag;
      const p2 = menu.dinners[i].dish.proteinTag;
      expect(!(p0 === p1 && p1 === p2)).toBe(true);
    }
  });
});

describe("smart swap", () => {
  it("returns safe alternatives without creating 3 proteins in a row", () => {
    const currentMenu = {
      householdId: household.id,
      createdAt: new Date().toISOString(),
      dinners: [
        { dayIndex: 0, dish: dishes[0], score: 70, profileScores: [] },
        { dayIndex: 1, dish: dishes[3], score: 62, profileScores: [] },
        { dayIndex: 2, dish: dishes[2], score: 74, profileScores: [] },
      ],
    };

    const alternatives = getSwapCandidates(currentMenu, 2, dishes, household, context, { limit: 5 });

    expect(alternatives.length).toBeGreaterThan(0);
    expect(alternatives.some((day) => day.dish.allergens.includes("nÃ¶tter"))).toBe(false);

    for (const option of alternatives) {
      const protein0 = currentMenu.dinners[0].dish.proteinTag;
      const protein1 = currentMenu.dinners[1].dish.proteinTag;
      const protein2 = option.dish.proteinTag;
      expect(!(protein0 === protein1 && protein1 === protein2)).toBe(true);
    }
  });
});
