import { Dish, Household, MenuDay, ScoreContext, WeeklyMenu } from "./types";
import { rankDishes } from "./scoring";

interface MenuOptions {
  lockedDays?: MenuDay[];
  topK?: number;
  randomFn?: () => number;
}

const violatesProteinRule = (selected: Dish[], candidate: Dish): boolean => {
  if (selected.length < 2) return false;
  const a = selected[selected.length - 1];
  const b = selected[selected.length - 2];
  return a.proteinTag === b.proteinTag && b.proteinTag === candidate.proteinTag;
};

const pickFromTopK = <T>(items: T[], topK: number, randomFn: () => number): T => {
  const limit = Math.max(1, Math.min(topK, items.length));
  const index = Math.floor(randomFn() * limit);
  return items[index];
};

export const generateWeeklyMenu = (
  dishes: Dish[],
  household: Household,
  context: ScoreContext,
  options: MenuOptions = {},
): WeeklyMenu => {
  const dinnersCount = household.preferences.dinnersPerWeek;
  const randomFn = options.randomFn ?? Math.random;
  const topK = options.topK ?? 8;

  const ranked = rankDishes(dishes, household, context);
  const lockedByDay = new Map((options.lockedDays ?? []).map((day) => [day.dayIndex, day]));

  const selected: MenuDay[] = [];
  const usedDishIds = new Set<string>();

  for (let dayIndex = 0; dayIndex < dinnersCount; dayIndex += 1) {
    const locked = lockedByDay.get(dayIndex);
    if (locked) {
      selected.push({ ...locked, locked: true });
      usedDishIds.add(locked.dish.id);
      continue;
    }

    const eligible = ranked.filter((item) => {
      if (usedDishIds.has(item.dish.id)) return false;
      if (item.dish.allergens.some((allergen) => household.preferences.avoidAllergens.includes(allergen))) return false;
      if (violatesProteinRule(selected.map((day) => day.dish), item.dish)) return false;
      return true;
    });

    const candidate = pickFromTopK(eligible, topK, randomFn);

    selected.push({
      dayIndex,
      dish: candidate.dish,
      score: candidate.totalScore,
      profileScores: candidate.profileScores,
    });

    usedDishIds.add(candidate.dish.id);
  }

  return {
    householdId: household.id,
    createdAt: new Date().toISOString(),
    dinners: selected,
  };
};

export const swapMenuDish = (
  currentMenu: WeeklyMenu,
  dayIndex: number,
  dishes: Dish[],
  household: Household,
  context: ScoreContext,
  randomFn: () => number = Math.random,
): WeeklyMenu => {
  const lockedDays = currentMenu.dinners.filter((day) => day.dayIndex !== dayIndex && day.locked);
  const baseMenu = currentMenu.dinners.filter((day) => day.dayIndex !== dayIndex);
  const blockedIds = new Set(baseMenu.map((day) => day.dish.id));

  const newMenu = generateWeeklyMenu(
    dishes.filter((dish) => !blockedIds.has(dish.id)),
    household,
    context,
    { lockedDays, topK: 10, randomFn },
  );

  const replacement = newMenu.dinners.find((day) => day.dayIndex === dayIndex);
  if (!replacement) {
    return currentMenu;
  }

  const updated = currentMenu.dinners.map((day) => (day.dayIndex === dayIndex ? { ...replacement } : day));

  return {
    ...currentMenu,
    dinners: updated,
    createdAt: new Date().toISOString(),
  };
};
