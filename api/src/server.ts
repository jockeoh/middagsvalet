import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import { buildShoppingList, Dish, generateWeeklyMenu, getSwapCandidates, swapMenuDish } from "@middagsvalet/shared";
import { z } from "zod";
import { db, PersistedDish } from "./db";
import { hashPassword, randomId, randomToken, verifyPassword } from "./auth";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

type AuthUser = {
  id: string;
  email: string;
  displayName: string;
};

type AuthedRequest = Request & { authUser: AuthUser };

const parseDish = (row: PersistedDish): Dish => ({
  id: row.id,
  title: row.title,
  cuisineTags: JSON.parse(row.cuisineTags),
  proteinTag: row.proteinTag,
  timeMinutes: row.timeMinutes,
  difficulty: row.difficulty as Dish["difficulty"],
  kidFriendlyScore: row.kidFriendlyScore,
  ingredients: JSON.parse(row.ingredients),
  instructionsShort: row.instructionsShort,
  allergens: JSON.parse(row.allergens),
  tags: JSON.parse(row.tags),
  imageUrl: row.imageUrl ?? undefined,
});

const getAllDishes = (mainOnly = true): Dish[] => {
  const rows = (mainOnly
    ? db.prepare("SELECT * FROM dishes WHERE mealType = 'main'")
    : db.prepare("SELECT * FROM dishes")
  ).all() as PersistedDish[];
  return rows.map(parseDish);
};

const preferencesSchema = z.object({
  cuisines: z.array(z.string()),
  proteins: z.array(z.string()),
  avoidAllergens: z.array(z.string()),
  avoidIngredients: z.array(z.string()),
  maxTimeMinutes: z.union([z.literal(15), z.literal(30), z.literal(45)]),
  dinnersPerWeek: z.union([z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7)]),
  moodTags: z.array(z.string()),
});

const profileSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["adult", "child"]),
  pickyLevel: z.number().min(0).max(2),
  weight: z.number().optional(),
});

const householdSchema = z.object({
  id: z.string(),
  name: z.string(),
  childWeightBoost: z.number().optional(),
  profiles: z.array(profileSchema),
  preferences: preferencesSchema,
});

const contextSchema = z.object({
  recentDishIds: z.array(z.string()),
  recentProteinTags: z.array(z.string()),
  likesByProfile: z.record(z.array(z.string())),
  dislikesByProfile: z.record(z.array(z.string())),
});

const ratingSchema = z.object({
  householdId: z.string(),
  profileId: z.string(),
  dishId: z.string(),
  reaction: z.enum(["like", "dislike", "skip"]),
});

const authSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(2).max(50).optional(),
  password: z.string().min(8).max(120),
});

const householdCreateSchema = z.object({
  name: z.string().min(2).max(80),
  initialProfiles: z.array(profileSchema).default([]),
  preferences: preferencesSchema.optional(),
  childWeightBoost: z.number().optional(),
});

const householdConfigSchema = z.object({
  profiles: z.array(profileSchema),
  preferences: preferencesSchema,
  childWeightBoost: z.number().optional(),
});

const extractBearerToken = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
};

const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  const row = db
    .prepare(
      `SELECT u.id, u.email, u.displayName
       FROM sessions s
       JOIN users u ON u.id = s.userId
       WHERE s.token = ? AND s.expiresAt > ?`,
    )
    .get(token, new Date().toISOString()) as AuthUser | undefined;

  if (!row) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  (req as AuthedRequest).authUser = row;
  next();
};

const requireMembership = (userId: string, householdId: string): void => {
  const membership = db
    .prepare("SELECT id FROM household_memberships WHERE householdId = ? AND userId = ?")
    .get(householdId, userId) as { id: string } | undefined;

  if (!membership) {
    throw new Error("FORBIDDEN");
  }
};

const toDefaultPreferences = () => ({
  cuisines: ["italienskt", "asiatiskt"],
  proteins: ["kyckling", "vegetariskt"],
  avoidAllergens: [],
  avoidIngredients: [],
  maxTimeMinutes: 30 as const,
  dinnersPerWeek: 5 as const,
  moodTags: ["fresh", "budget"],
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/register", (req, res) => {
  const payload = authSchema.extend({ displayName: z.string().min(2).max(50) }).parse(req.body);
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(payload.email) as { id: string } | undefined;
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const now = new Date().toISOString();
  const userId = `usr_${randomId(10)}`;
  const sessionId = `ses_${randomId(10)}`;
  const token = randomToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();

  db.prepare("INSERT INTO users (id, email, displayName, passwordHash, createdAt) VALUES (?, ?, ?, ?, ?)").run(
    userId,
    payload.email,
    payload.displayName,
    hashPassword(payload.password),
    now,
  );

  db.prepare("INSERT INTO sessions (id, userId, token, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?)").run(
    sessionId,
    userId,
    token,
    now,
    expiresAt,
  );

  res.status(201).json({
    token,
    user: { id: userId, email: payload.email, displayName: payload.displayName },
  });
});

app.post("/api/auth/login", (req, res) => {
  const payload = authSchema.pick({ email: true, password: true }).parse(req.body);

  const user = db
    .prepare("SELECT id, email, displayName, passwordHash FROM users WHERE email = ?")
    .get(payload.email) as { id: string; email: string; displayName: string; passwordHash: string } | undefined;

  if (!user || !verifyPassword(payload.password, user.passwordHash)) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const now = new Date().toISOString();
  const sessionId = `ses_${randomId(10)}`;
  const token = randomToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();

  db.prepare("INSERT INTO sessions (id, userId, token, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?)").run(
    sessionId,
    user.id,
    token,
    now,
    expiresAt,
  );

  res.json({
    token,
    user: { id: user.id, email: user.email, displayName: user.displayName },
  });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  const user = (req as AuthedRequest).authUser;
  res.json({ user });
});

app.post("/api/households", requireAuth, (req, res) => {
  const payload = householdCreateSchema.parse(req.body);
  const user = (req as AuthedRequest).authUser;

  const householdId = `hh_${randomId(10)}`;
  const now = new Date().toISOString();
  const shareCode = randomId(4).toUpperCase();
  const preferences = payload.preferences ?? toDefaultPreferences();

  const tx = db.transaction(() => {
    db.prepare("INSERT INTO households (id, name, ownerUserId, shareCode, createdAt) VALUES (?, ?, ?, ?, ?)").run(
      householdId,
      payload.name,
      user.id,
      shareCode,
      now,
    );

    db.prepare("INSERT INTO household_memberships (id, householdId, userId, role, createdAt) VALUES (?, ?, ?, ?, ?)").run(
      `hm_${randomId(10)}`,
      householdId,
      user.id,
      "owner",
      now,
    );

    const insertProfile = db.prepare(
      "INSERT INTO household_profiles (id, householdId, name, type, pickyLevel, weight, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );

    for (const profile of payload.initialProfiles) {
      insertProfile.run(
        profile.id,
        householdId,
        profile.name,
        profile.type,
        profile.pickyLevel,
        profile.weight ?? null,
        now,
      );
    }

    db.prepare(
      `INSERT INTO household_preferences (
        householdId, cuisines, proteins, avoidAllergens, avoidIngredients,
        maxTimeMinutes, dinnersPerWeek, moodTags, childWeightBoost, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      householdId,
      JSON.stringify(preferences.cuisines),
      JSON.stringify(preferences.proteins),
      JSON.stringify(preferences.avoidAllergens),
      JSON.stringify(preferences.avoidIngredients),
      preferences.maxTimeMinutes,
      preferences.dinnersPerWeek,
      JSON.stringify(preferences.moodTags),
      payload.childWeightBoost ?? 1.2,
      now,
    );
  });

  tx();
  res.status(201).json({ householdId, shareCode });
});

app.post("/api/households/join", requireAuth, (req, res) => {
  const payload = z.object({ shareCode: z.string().min(4).max(32) }).parse(req.body);
  const user = (req as AuthedRequest).authUser;

  const household = db
    .prepare("SELECT id FROM households WHERE shareCode = ?")
    .get(payload.shareCode.toUpperCase()) as { id: string } | undefined;

  if (!household) {
    res.status(404).json({ error: "Household not found" });
    return;
  }

  const existing = db
    .prepare("SELECT id FROM household_memberships WHERE householdId = ? AND userId = ?")
    .get(household.id, user.id) as { id: string } | undefined;

  if (!existing) {
    db.prepare("INSERT INTO household_memberships (id, householdId, userId, role, createdAt) VALUES (?, ?, ?, ?, ?)").run(
      `hm_${randomId(10)}`,
      household.id,
      user.id,
      "member",
      new Date().toISOString(),
    );
  }

  res.json({ householdId: household.id });
});

app.get("/api/households", requireAuth, (req, res) => {
  const user = (req as AuthedRequest).authUser;

  const households = db
    .prepare(
      `SELECT h.id, h.name, h.shareCode, hm.role
       FROM household_memberships hm
       JOIN households h ON h.id = hm.householdId
       WHERE hm.userId = ?
       ORDER BY h.createdAt DESC`,
    )
    .all(user.id);

  res.json({ households });
});

app.get("/api/households/:householdId", requireAuth, (req, res) => {
  const user = (req as AuthedRequest).authUser;
  const householdId = String(req.params.householdId);

  try {
    requireMembership(user.id, householdId);
  } catch {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const household = db
    .prepare("SELECT id, name, shareCode, ownerUserId FROM households WHERE id = ?")
    .get(householdId) as { id: string; name: string; shareCode: string; ownerUserId: string } | undefined;

  if (!household) {
    res.status(404).json({ error: "Household not found" });
    return;
  }

  const profiles = db
    .prepare("SELECT id, name, type, pickyLevel, weight FROM household_profiles WHERE householdId = ? ORDER BY createdAt")
    .all(householdId);

  const pref = db
    .prepare("SELECT * FROM household_preferences WHERE householdId = ?")
    .get(householdId) as
    | {
        cuisines: string;
        proteins: string;
        avoidAllergens: string;
        avoidIngredients: string;
        maxTimeMinutes: 15 | 30 | 45;
        dinnersPerWeek: 3 | 4 | 5 | 6 | 7;
        moodTags: string;
        childWeightBoost: number;
      }
    | undefined;

  const preferences = pref
    ? {
        cuisines: JSON.parse(pref.cuisines),
        proteins: JSON.parse(pref.proteins),
        avoidAllergens: JSON.parse(pref.avoidAllergens),
        avoidIngredients: JSON.parse(pref.avoidIngredients),
        maxTimeMinutes: pref.maxTimeMinutes,
        dinnersPerWeek: pref.dinnersPerWeek,
        moodTags: JSON.parse(pref.moodTags),
      }
    : toDefaultPreferences();

  res.json({
    household: {
      id: household.id,
      name: household.name,
      childWeightBoost: pref?.childWeightBoost ?? 1.2,
      preferences,
      profiles,
      shareCode: household.shareCode,
    },
  });
});

app.put("/api/households/:householdId/config", requireAuth, (req, res) => {
  const user = (req as AuthedRequest).authUser;
  const householdId = String(req.params.householdId);

  try {
    requireMembership(user.id, householdId);
  } catch {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const payload = householdConfigSchema.parse(req.body);
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare("DELETE FROM household_profiles WHERE householdId = ?").run(householdId);

    const insertProfile = db.prepare(
      "INSERT INTO household_profiles (id, householdId, name, type, pickyLevel, weight, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );

    for (const profile of payload.profiles) {
      insertProfile.run(
        profile.id,
        householdId,
        profile.name,
        profile.type,
        profile.pickyLevel,
        profile.weight ?? null,
        now,
      );
    }

    db.prepare(
      `INSERT INTO household_preferences (
        householdId, cuisines, proteins, avoidAllergens, avoidIngredients,
        maxTimeMinutes, dinnersPerWeek, moodTags, childWeightBoost, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(householdId) DO UPDATE SET
        cuisines=excluded.cuisines,
        proteins=excluded.proteins,
        avoidAllergens=excluded.avoidAllergens,
        avoidIngredients=excluded.avoidIngredients,
        maxTimeMinutes=excluded.maxTimeMinutes,
        dinnersPerWeek=excluded.dinnersPerWeek,
        moodTags=excluded.moodTags,
        childWeightBoost=excluded.childWeightBoost,
        updatedAt=excluded.updatedAt`,
    ).run(
      householdId,
      JSON.stringify(payload.preferences.cuisines),
      JSON.stringify(payload.preferences.proteins),
      JSON.stringify(payload.preferences.avoidAllergens),
      JSON.stringify(payload.preferences.avoidIngredients),
      payload.preferences.maxTimeMinutes,
      payload.preferences.dinnersPerWeek,
      JSON.stringify(payload.preferences.moodTags),
      payload.childWeightBoost ?? 1.2,
      now,
    );
  });

  tx();
  res.json({ ok: true });
});

app.get("/api/bootstrap", (_req, res) => {
  const dishes = getAllDishes(true);
  const stats = {
    totalDishes: dishes.length,
    cuisines: Array.from(new Set(dishes.flatMap((dish) => dish.cuisineTags))).sort(),
    proteins: Array.from(new Set(dishes.map((dish) => dish.proteinTag))).sort(),
  };

  res.json({ dishes, stats });
});

app.post("/api/rate", (req, res) => {
  const payload = ratingSchema.parse(req.body);
  db.prepare(
    "INSERT INTO rating_events (householdId, profileId, dishId, reaction, createdAt) VALUES (?, ?, ?, ?, ?)",
  ).run(payload.householdId, payload.profileId, payload.dishId, payload.reaction, new Date().toISOString());
  res.status(201).json({ ok: true });
});

app.get("/api/history/:householdId", (req, res) => {
  const householdId = String(req.params.householdId);

  const recent = db
    .prepare(
      "SELECT dishId, reaction, createdAt FROM rating_events WHERE householdId = ? ORDER BY createdAt DESC LIMIT 30",
    )
    .all(householdId);

  const likedRows = db
    .prepare("SELECT DISTINCT dishId FROM rating_events WHERE householdId = ? AND reaction = 'like' LIMIT 50")
    .all(householdId) as Array<{ dishId: string }>;
  const liked = likedRows.map((row) => row.dishId);

  const avoidedRows = db
    .prepare("SELECT DISTINCT dishId FROM rating_events WHERE householdId = ? AND reaction = 'dislike' LIMIT 50")
    .all(householdId) as Array<{ dishId: string }>;
  const avoided = avoidedRows.map((row) => row.dishId);

  res.json({ recent, liked, avoided });
});

app.post("/api/menu/generate", (req, res) => {
  const payload = z
    .object({
      household: householdSchema,
      context: contextSchema,
      lockedDays: z
        .array(
          z.object({
            dayIndex: z.number(),
            dishId: z.string(),
            score: z.number().optional(),
            locked: z.boolean().optional(),
          }),
        )
        .optional(),
    })
    .parse(req.body);

  const dishMap = new Map(getAllDishes(true).map((dish) => [dish.id, dish]));
  const lockedDays = (payload.lockedDays ?? [])
    .map((day) => {
      const dish = dishMap.get(day.dishId);
      if (!dish) return null;
      return {
        dayIndex: day.dayIndex,
        dish,
        score: day.score ?? 0,
        profileScores: [],
        locked: true,
      };
    })
    .filter(Boolean);

  const menu = generateWeeklyMenu(getAllDishes(true), payload.household, payload.context, {
    lockedDays: lockedDays as any,
  });

  res.json(menu);
});

app.post("/api/menu/swap", (req, res) => {
  const payload = z
    .object({
      currentMenu: z.object({
        householdId: z.string(),
        createdAt: z.string(),
        dinners: z.array(
          z.object({
            dayIndex: z.number(),
            dishId: z.string(),
            score: z.number(),
            locked: z.boolean().optional(),
          }),
        ),
      }),
      dayIndex: z.number(),
      household: householdSchema,
      context: contextSchema,
    })
    .parse(req.body);

  const dishMap = new Map(getAllDishes(true).map((dish) => [dish.id, dish]));
  const hydratedMenu = {
    ...payload.currentMenu,
    dinners: payload.currentMenu.dinners
      .map((day) => {
        const dish = dishMap.get(day.dishId);
        if (!dish) return null;
        return {
          ...day,
          dish,
          profileScores: [],
        };
      })
      .filter(Boolean) as any,
  };

  const swapped = swapMenuDish(
    hydratedMenu as any,
    payload.dayIndex,
    getAllDishes(true),
    payload.household,
    payload.context,
  );
  res.json(swapped);
});

app.post("/api/menu/swap-options", (req, res) => {
  const payload = z
    .object({
      currentMenu: z.object({
        householdId: z.string(),
        createdAt: z.string(),
        dinners: z.array(
          z.object({
            dayIndex: z.number(),
            dishId: z.string(),
            score: z.number(),
            locked: z.boolean().optional(),
          }),
        ),
      }),
      dayIndex: z.number(),
      household: householdSchema,
      context: contextSchema,
      limit: z.number().int().min(1).max(10).optional(),
    })
    .parse(req.body);

  const dishMap = new Map(getAllDishes(true).map((dish) => [dish.id, dish]));
  const hydratedMenu = {
    ...payload.currentMenu,
    dinners: payload.currentMenu.dinners
      .map((day) => {
        const dish = dishMap.get(day.dishId);
        if (!dish) return null;
        return {
          ...day,
          dish,
          profileScores: [],
        };
      })
      .filter(Boolean) as any,
  };

  const candidates = getSwapCandidates(
    hydratedMenu as any,
    payload.dayIndex,
    getAllDishes(true),
    payload.household,
    payload.context,
    { limit: payload.limit ?? 5 },
  );

  res.json({ candidates });
});

app.post("/api/shopping-list", (req, res) => {
  const payload = z
    .object({
      householdId: z.string(),
      dishIds: z.array(z.string()),
      pantryState: z.record(z.boolean()).default({}),
    })
    .parse(req.body);

  const all = new Map(getAllDishes(false).map((dish) => [dish.id, dish]));
  const dishes = payload.dishIds.map((id) => all.get(id)).filter(Boolean) as Dish[];
  const shoppingList = buildShoppingList(payload.householdId, dishes, payload.pantryState);
  res.json(shoppingList);
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
