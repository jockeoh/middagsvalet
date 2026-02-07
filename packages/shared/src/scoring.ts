import { Dish, Household, Profile, ProfileDishScore, ScoreContext, ScoredDish } from "./types";

const MAX_SCORE = 100;
const MIN_SCORE = 0;

const clamp = (value: number) => Math.max(MIN_SCORE, Math.min(MAX_SCORE, value));

export const scoreDishForProfile = (
  dish: Dish,
  profile: Profile,
  household: Household,
  context: ScoreContext,
): ProfileDishScore => {
  let score = 50;
  const reasons: string[] = [];

  if (household.preferences.cuisines.some((cuisine) => dish.cuisineTags.includes(cuisine))) {
    score += 16;
    reasons.push("matchande kok");
  }

  if (household.preferences.proteins.includes(dish.proteinTag)) {
    score += 12;
    reasons.push("onskat protein");
  }

  if (dish.timeMinutes <= household.preferences.maxTimeMinutes) {
    score += 10;
    reasons.push("snabb tillagning");
  } else {
    score -= 8;
    reasons.push("for lang tid");
  }

  if (dish.tags.some((tag) => household.preferences.moodTags.includes(tag))) {
    score += 6;
  }

  const hasAvoidedAllergen = dish.allergens.some((allergen) => household.preferences.avoidAllergens.includes(allergen));
  if (hasAvoidedAllergen) {
    score -= 45;
    reasons.push("innehaller allergen");
  }

  const hasAvoidedIngredient = dish.ingredients.some((ingredient) =>
    household.preferences.avoidIngredients.includes(ingredient.name.toLowerCase()),
  );
  if (hasAvoidedIngredient) {
    score -= 30;
    reasons.push("innehaller undvik-ingrediens");
  }

  if (profile.type === "child") {
    const pickyPenalty = profile.pickyLevel * 0.2;
    score += dish.kidFriendlyScore * (0.14 - pickyPenalty * 0.08);
    reasons.push("barnanpassning");
  }

  if (context.recentDishIds.includes(dish.id)) {
    score -= 14;
    reasons.push("nyligen atits");
  }

  if (context.recentProteinTags.includes(dish.proteinTag)) {
    score -= 6;
    reasons.push("protein nyligen anvant");
  }

  if (context.likesByProfile[profile.id]?.includes(dish.id)) {
    score += 20;
    reasons.push("tidigare like");
  }

  if (context.dislikesByProfile[profile.id]?.includes(dish.id)) {
    score -= 28;
    reasons.push("tidigare dislike");
  }

  return {
    profileId: profile.id,
    score: clamp(score),
    reasons,
  };
};

export const scoreDishForHousehold = (
  dish: Dish,
  household: Household,
  context: ScoreContext,
): ScoredDish => {
  const childBoost = household.childWeightBoost ?? 1.2;

  const profileScores = household.profiles.map((profile) => scoreDishForProfile(dish, profile, household, context));

  const weightedTotal = profileScores.reduce((acc, profileScore) => {
    const profile = household.profiles.find((item) => item.id === profileScore.profileId);
    const baseWeight = profile?.weight ?? 1;
    const effectiveWeight = profile?.type === "child" ? baseWeight * childBoost : baseWeight;
    return acc + profileScore.score * effectiveWeight;
  }, 0);

  const totalWeight = household.profiles.reduce((acc, profile) => {
    const baseWeight = profile.weight ?? 1;
    return acc + (profile.type === "child" ? baseWeight * childBoost : baseWeight);
  }, 0);

  return {
    dish,
    profileScores,
    totalScore: Number((weightedTotal / Math.max(totalWeight, 1)).toFixed(2)),
  };
};

export const rankDishes = (dishes: Dish[], household: Household, context: ScoreContext): ScoredDish[] => {
  return dishes.map((dish) => scoreDishForHousehold(dish, household, context)).sort((a, b) => b.totalScore - a.totalScore);
};
