export type ProfileType = "adult" | "child";
export type HouseholdRole = "owner" | "member";

export interface UserAccount {
  id: string;
  email: string;
  displayName: string;
}

export interface SessionInfo {
  token: string;
  user: UserAccount;
}

export interface HouseholdMembership {
  householdId: string;
  role: HouseholdRole;
}

export interface Profile {
  id: string;
  name: string;
  type: ProfileType;
  pickyLevel: number;
  weight?: number;
}

export interface HouseholdPreferences {
  cuisines: string[];
  proteins: string[];
  avoidAllergens: string[];
  avoidIngredients: string[];
  maxTimeMinutes: 15 | 30 | 45;
  dinnersPerWeek: 3 | 4 | 5 | 6 | 7;
  moodTags: string[];
}

export interface Ingredient {
  name: string;
  amount: number;
  unit: string;
  category: "Frukt&Gront" | "Mejeri" | "Skafferi" | "Kott/Fisk" | "Kryddor";
}

export interface Dish {
  id: string;
  title: string;
  cuisineTags: string[];
  proteinTag: string;
  timeMinutes: number;
  difficulty: "easy" | "medium" | "hard";
  kidFriendlyScore: number;
  ingredients: Ingredient[];
  instructionsShort: string;
  allergens: string[];
  tags: Array<"comfort" | "fresh" | "spicy" | "budget">;
  imageUrl?: string;
}

export interface Household {
  id: string;
  name: string;
  profiles: Profile[];
  preferences: HouseholdPreferences;
  childWeightBoost?: number;
}

export interface ProfileDishScore {
  profileId: string;
  score: number;
  reasons: string[];
}

export interface ScoredDish {
  dish: Dish;
  profileScores: ProfileDishScore[];
  totalScore: number;
}

export interface RatingEvent {
  householdId: string;
  profileId: string;
  dishId: string;
  reaction: "like" | "dislike" | "skip";
  createdAt: string;
}

export interface MenuDay {
  dayIndex: number;
  dish: Dish;
  score: number;
  profileScores: ProfileDishScore[];
  locked?: boolean;
}

export interface WeeklyMenu {
  householdId: string;
  createdAt: string;
  dinners: MenuDay[];
}

export interface ScoreContext {
  recentDishIds: string[];
  recentProteinTags: string[];
  likesByProfile: Record<string, string[]>;
  dislikesByProfile: Record<string, string[]>;
}

export interface ShoppingItem {
  name: string;
  amount: number;
  unit: string;
  category: Ingredient["category"];
  inPantry: boolean;
}

export interface ShoppingList {
  householdId: string;
  itemsByCategory: Record<Ingredient["category"], ShoppingItem[]>;
}
