import { Dish, Household, SessionInfo, WeeklyMenu, ScoreContext } from "@middagsvalet/shared";

const API_BASE = "http://localhost:4000/api";

export interface BootstrapResponse {
  dishes: Dish[];
  stats: {
    totalDishes: number;
    cuisines: string[];
    proteins: string[];
  };
}

export interface HouseholdListItem {
  id: string;
  name: string;
  shareCode: string;
  role: "owner" | "member";
}

export interface HouseholdWithShareCode extends Household {
  shareCode: string;
}

const parseJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Request failed");
  }
  return response.json() as Promise<T>;
};

const authedFetch = async (token: string, path: string, init?: RequestInit): Promise<Response> => {
  const headers = new Headers(init?.headers ?? {});
  headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${API_BASE}${path}`, { ...init, headers });
};

export const fetchBootstrap = async (): Promise<BootstrapResponse> => {
  const response = await fetch(`${API_BASE}/bootstrap`);
  return parseJson<BootstrapResponse>(response);
};

export const registerUser = async (payload: {
  email: string;
  displayName: string;
  password: string;
}): Promise<SessionInfo> => {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<SessionInfo>(response);
};

export const loginUser = async (payload: { email: string; password: string }): Promise<SessionInfo> => {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<SessionInfo>(response);
};

export const fetchMe = async (token: string): Promise<SessionInfo["user"]> => {
  const response = await authedFetch(token, "/auth/me");
  const data = await parseJson<{ user: SessionInfo["user"] }>(response);
  return data.user;
};

export const listHouseholds = async (token: string): Promise<HouseholdListItem[]> => {
  const response = await authedFetch(token, "/households");
  const data = await parseJson<{ households: HouseholdListItem[] }>(response);
  return data.households;
};

export const createHousehold = async (
  token: string,
  payload: {
    name: string;
    initialProfiles: Household["profiles"];
    preferences?: Household["preferences"];
    childWeightBoost?: number;
  },
): Promise<{ householdId: string; shareCode: string }> => {
  const response = await authedFetch(token, "/households", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return parseJson<{ householdId: string; shareCode: string }>(response);
};

export const joinHousehold = async (token: string, shareCode: string): Promise<{ householdId: string }> => {
  const response = await authedFetch(token, "/households/join", {
    method: "POST",
    body: JSON.stringify({ shareCode }),
  });
  return parseJson<{ householdId: string }>(response);
};

export const fetchHousehold = async (token: string, householdId: string): Promise<HouseholdWithShareCode> => {
  const response = await authedFetch(token, `/households/${householdId}`);
  const data = await parseJson<{ household: HouseholdWithShareCode }>(response);
  return {
    ...data.household,
    profiles: data.household.profiles.map((profile) => ({
      ...profile,
      weight: profile.weight ?? undefined,
    })),
  };
};

export const updateHouseholdConfig = async (
  token: string,
  householdId: string,
  payload: {
    profiles: Household["profiles"];
    preferences: Household["preferences"];
    childWeightBoost?: number;
  },
): Promise<void> => {
  const response = await authedFetch(token, `/households/${householdId}/config`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  await parseJson<{ ok: boolean }>(response);
};

export const saveRating = async (payload: {
  householdId: string;
  profileId: string;
  dishId: string;
  reaction: "like" | "dislike" | "skip";
}): Promise<void> => {
  const response = await fetch(`${API_BASE}/rate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await parseJson<{ ok: boolean }>(response);
};

export const generateMenu = async (payload: {
  household: Household;
  context: ScoreContext;
  lockedDays?: Array<{ dayIndex: number; dishId: string; score?: number; locked?: boolean }>;
}): Promise<WeeklyMenu> => {
  const response = await fetch(`${API_BASE}/menu/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson<WeeklyMenu>(response);
};

export const swapMenuDay = async (payload: {
  currentMenu: WeeklyMenu;
  dayIndex: number;
  household: Household;
  context: ScoreContext;
}): Promise<WeeklyMenu> => {
  const response = await fetch(`${API_BASE}/menu/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      currentMenu: {
        ...payload.currentMenu,
        dinners: payload.currentMenu.dinners.map((day) => ({
          dayIndex: day.dayIndex,
          dishId: day.dish.id,
          score: day.score,
          locked: day.locked,
        })),
      },
    }),
  });
  return parseJson<WeeklyMenu>(response);
};

export const fetchSwapOptions = async (payload: {
  currentMenu: WeeklyMenu;
  dayIndex: number;
  household: Household;
  context: ScoreContext;
  limit?: number;
}): Promise<{ candidates: WeeklyMenu["dinners"] }> => {
  const response = await fetch(`${API_BASE}/menu/swap-options`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      currentMenu: {
        ...payload.currentMenu,
        dinners: payload.currentMenu.dinners.map((day) => ({
          dayIndex: day.dayIndex,
          dishId: day.dish.id,
          score: day.score,
          locked: day.locked,
        })),
      },
    }),
  });
  return parseJson<{ candidates: WeeklyMenu["dinners"] }>(response);
};

export const fetchShoppingList = async (payload: {
  householdId: string;
  dishIds: string[];
  pantryState: Record<string, boolean>;
}) => {
  const response = await fetch(`${API_BASE}/shopping-list`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJson(response);
};
