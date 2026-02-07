import { Dish, Household, MenuDay, ScoreContext, WeeklyMenu } from "./types";
import { rankDishes } from "./scoring";

interface MenuOptions {
  lockedDays?: MenuDay[];
  topK?: number;
  randomFn?: () => number;
}

interface SwapCandidateOptions {
  limit?: number;
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

const violatesProteinRuleAtDay = (dinners: MenuDay[], dayIndex: number, candidate: Dish): boolean => {
  const proteinsByDay = new Map<number, string>();
  for (const day of dinners) {
    proteinsByDay.set(day.dayIndex, day.dish.proteinTag);
  }
  proteinsByDay.set(dayIndex, candidate.proteinTag);

  const maxDay = Math.max(...Array.from(proteinsByDay.keys()));
  for (let i = 0; i <= maxDay - 2; i += 1) {
    const a = proteinsByDay.get(i);
    const b = proteinsByDay.get(i + 1);
    const c = proteinsByDay.get(i + 2);
    if (a && b && c && a === b && b === c) return true;
  }
  return false;
};

const scoreSwapCandidate = (candidate: ReturnType<typeof rankDishes>[number], targetDish: Dish): number => {
  let score = candidate.totalScore;
  if (candidate.dish.proteinTag === targetDish.proteinTag) score += 8;
  if (candidate.dish.cuisineTags.some((tag) => targetDish.cuisineTags.includes(tag))) score += 6;
  score -= Math.abs(candidate.dish.timeMinutes - targetDish.timeMinutes) * 0.35;
  return score;
};

export const getSwapCandidates = (
  currentMenu: WeeklyMenu,
  dayIndex: number,
  dishes: Dish[],
  household: Household,
  context: ScoreContext,
  options: SwapCandidateOptions = {},
): MenuDay[] => {
  const targetDay = currentMenu.dinners.find((day) => day.dayIndex === dayIndex);
  if (!targetDay) return [];

  const limit = Math.max(1, options.limit ?? 5);
  const blockedDishIds = new Set(
    currentMenu.dinners.filter((day) => day.dayIndex !== dayIndex).map((day) => day.dish.id),
  );

  const ranked = rankDishes(dishes, household, context)
    .filter((candidate) => {
      if (candidate.dish.id === targetDay.dish.id) return false;
      if (blockedDishIds.has(candidate.dish.id)) return false;
      if (candidate.dish.allergens.some((allergen) => household.preferences.avoidAllergens.includes(allergen))) return false;
      if (violatesProteinRuleAtDay(currentMenu.dinners, dayIndex, candidate.dish)) return false;
      return true;
    })
    .map((candidate) => ({
      candidate,
      swapScore: scoreSwapCandidate(candidate, targetDay.dish),
    }))
    .sort((a, b) => b.swapScore - a.swapScore)
    .slice(0, limit);

  return ranked.map(({ candidate }) => ({
    dayIndex,
    dish: candidate.dish,
    score: candidate.totalScore,
    profileScores: candidate.profileScores,
    locked: false,
  }));
};
