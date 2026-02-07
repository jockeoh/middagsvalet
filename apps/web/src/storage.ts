import { Profile, SessionInfo } from "@middagsvalet/shared";

const KEY = "middagsvalet-state";

export interface LocalState {
  householdName: string;
  activeHouseholdId: string;
  token: string;
  user: SessionInfo["user"] | null;
  profiles: Profile[];
  pantryState: Record<string, boolean>;
  likesByProfile: Record<string, string[]>;
  dislikesByProfile: Record<string, string[]>;
  recentDishIds: string[];
  recentProteinTags: string[];
  favorites: string[];
  avoidDishIds: string[];
}

export const loadState = (): LocalState | null => {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LocalState;
  } catch {
    return null;
  }
};

export const saveState = (state: LocalState): void => {
  localStorage.setItem(KEY, JSON.stringify(state));
};

export const clearState = (): void => {
  localStorage.removeItem(KEY);
};
