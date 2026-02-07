import { Dish, Household, Profile, SessionInfo, ShoppingList, WeeklyMenu } from "@middagsvalet/shared";
import { useEffect, useMemo, useState } from "react";
import {
  approvePendingDish,
  createHousehold,
  fetchBootstrap,
  fetchHousehold,
  fetchMe,
  fetchPendingReviewDishes,
  fetchShoppingList,
  fetchSwapOptions,
  generateMenu,
  joinHousehold,
  listHouseholds,
  loginUser,
  registerUser,
  saveRating,
  updateHouseholdConfig,
  HouseholdListItem,
  PendingReviewDish,
} from "./api";
import { clearState, loadState, LocalState, saveState } from "./storage";

type Step = "onboarding" | "rank" | "menu" | "shopping" | "review";
type Mode = "auth" | "household" | "app";
type AuthMode = "login" | "register";

const cuisines = ["italienskt", "asiatiskt", "husman", "mexikanskt", "medelhav", "indiskt"];
const proteins = ["kyckling", "fisk", "nötkött", "vegetariskt", "fläsk"];
const moodTags = ["comfort", "fresh", "spicy", "budget"];
const allergens = ["gluten", "laktos", "nötter", "ägg", "soja"];

const defaultProfiles: Profile[] = [
  { id: "adult-1", name: "Vuxen", type: "adult", pickyLevel: 0, weight: 1 },
  { id: "child-1", name: "Barn", type: "child", pickyLevel: 1, weight: 1 },
];

const defaultState: LocalState = {
  householdName: "",
  activeHouseholdId: "",
  token: "",
  user: null,
  profiles: defaultProfiles,
  pantryState: {},
  likesByProfile: {},
  dislikesByProfile: {},
  recentDishIds: [],
  recentProteinTags: [],
  favorites: [],
  avoidDishIds: [],
};

export function App() {
  const persisted = useMemo(() => loadState() ?? defaultState, []);

  const [mode, setMode] = useState<Mode>(persisted.token ? "household" : "auth");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [step, setStep] = useState<Step>("onboarding");
  const [token, setToken] = useState(persisted.token);
  const [user, setUser] = useState<SessionInfo["user"] | null>(persisted.user);
  const [households, setHouseholds] = useState<HouseholdListItem[]>([]);
  const [activeHouseholdId, setActiveHouseholdId] = useState(persisted.activeHouseholdId);

  const [allDishes, setAllDishes] = useState<Dish[]>([]);
  const [rankingIndex, setRankingIndex] = useState(0);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>(["italienskt", "asiatiskt"]);
  const [selectedProteins, setSelectedProteins] = useState<string[]>(["kyckling", "vegetariskt"]);
  const [selectedMood, setSelectedMood] = useState<string[]>(["fresh", "budget"]);
  const [selectedAvoid, setSelectedAvoid] = useState<string[]>([]);
  const [maxTime, setMaxTime] = useState<15 | 30 | 45>(30);
  const [dinnersPerWeek, setDinnersPerWeek] = useState<3 | 4 | 5 | 6 | 7>(5);
  const [householdName, setHouseholdName] = useState(persisted.householdName || "Familjen");
  const [profiles, setProfiles] = useState<Profile[]>(persisted.profiles);
  const [shareCode, setShareCode] = useState("");

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [newHouseholdName, setNewHouseholdName] = useState("Familjen");

  const [likesByProfile, setLikesByProfile] = useState<Record<string, string[]>>(persisted.likesByProfile);
  const [dislikesByProfile, setDislikesByProfile] = useState<Record<string, string[]>>(persisted.dislikesByProfile);
  const [recentDishIds, setRecentDishIds] = useState<string[]>(persisted.recentDishIds);
  const [recentProteinTags, setRecentProteinTags] = useState<string[]>(persisted.recentProteinTags);
  const [favorites, setFavorites] = useState<string[]>(persisted.favorites);
  const [avoidDishIds, setAvoidDishIds] = useState<string[]>(persisted.avoidDishIds);
  const [pantryState, setPantryState] = useState<Record<string, boolean>>(persisted.pantryState);
  const [menu, setMenu] = useState<WeeklyMenu | null>(null);
  const [swapQueues, setSwapQueues] = useState<Record<number, WeeklyMenu["dinners"]>>({});
  const [swappingDayIndex, setSwappingDayIndex] = useState<number | null>(null);
  const [shoppingList, setShoppingList] = useState<ShoppingList | null>(null);
  const [pendingReviewDishes, setPendingReviewDishes] = useState<PendingReviewDish[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHouseholdIntoState = async (accessToken: string, householdId: string) => {
    const household = await fetchHousehold(accessToken, householdId);
    setHouseholdName(household.name);
    setProfiles(household.profiles.length > 0 ? household.profiles : defaultProfiles);
    setSelectedCuisines(household.preferences.cuisines);
    setSelectedProteins(household.preferences.proteins);
    setSelectedAvoid(household.preferences.avoidAllergens);
    setSelectedMood(household.preferences.moodTags);
    setMaxTime(household.preferences.maxTimeMinutes);
    setDinnersPerWeek(household.preferences.dinnersPerWeek);
    setMode("app");
  };

  useEffect(() => {
    fetchBootstrap()
      .then((data) => setAllDishes(data.dishes))
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!token) return;

    Promise.all([fetchMe(token), listHouseholds(token)])
      .then(([me, owned]) => {
        setUser(me);
        setHouseholds(owned);
        setMode(owned.length === 0 ? "household" : "household");
      })
      .catch(() => {
        setToken("");
        setUser(null);
        setMode("auth");
      });
  }, [token]);

  useEffect(() => {
    if (!token || !activeHouseholdId) return;

    loadHouseholdIntoState(token, activeHouseholdId).catch((err: Error) => setError(err.message));
  }, [token, activeHouseholdId]);

  useEffect(() => {
    saveState({
      householdName,
      activeHouseholdId,
      token,
      user,
      profiles,
      pantryState,
      likesByProfile,
      dislikesByProfile,
      recentDishIds,
      recentProteinTags,
      favorites,
      avoidDishIds,
    });
  }, [
    householdName,
    activeHouseholdId,
    token,
    user,
    profiles,
    pantryState,
    likesByProfile,
    dislikesByProfile,
    recentDishIds,
    recentProteinTags,
    favorites,
    avoidDishIds,
  ]);

  const household: Household = {
    id: activeHouseholdId || "local-household",
    name: householdName,
    childWeightBoost: 1.2,
    profiles,
    preferences: {
      cuisines: selectedCuisines,
      proteins: selectedProteins,
      avoidAllergens: selectedAvoid,
      avoidIngredients: [],
      maxTimeMinutes: maxTime,
      dinnersPerWeek,
      moodTags: selectedMood,
    },
  };

  const context = {
    recentDishIds,
    recentProteinTags,
    likesByProfile,
    dislikesByProfile,
  };

  const rankPool = useMemo(() => allDishes.filter((dish) => !avoidDishIds.includes(dish.id)).slice(0, 80), [allDishes, avoidDishIds]);

  const currentCard = rankPool[rankingIndex];

  const toggle = (value: string, list: string[], setter: (next: string[]) => void) => {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  };

  const handleAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      const session =
        authMode === "register"
          ? await registerUser({ email, displayName, password })
          : await loginUser({ email, password });

      setToken(session.token);
      setUser(session.user);
      setMode("household");
      const owned = await listHouseholds(session.token);
      setHouseholds(owned);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenHousehold = async (householdId: string) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      if (activeHouseholdId !== householdId) {
        setActiveHouseholdId(householdId);
      } else {
        await loadHouseholdIntoState(token, householdId);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateHousehold = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const created = await createHousehold(token, {
        name: newHouseholdName,
        initialProfiles: profiles,
      });
      setActiveHouseholdId(created.householdId);
      const owned = await listHouseholds(token);
      setHouseholds(owned);
      setStep("onboarding");
      setMode("app");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinHousehold = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const joined = await joinHousehold(token, shareCode.trim().toUpperCase());
      setActiveHouseholdId(joined.householdId);
      const owned = await listHouseholds(token);
      setHouseholds(owned);
      setMode("app");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!token || !activeHouseholdId) {
      setStep("rank");
      return;
    }

    setLoading(true);
    try {
      await updateHouseholdConfig(token, activeHouseholdId, {
        profiles,
        preferences: household.preferences,
        childWeightBoost: 1.2,
      });
      setStep("rank");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleRate = async (reaction: "like" | "dislike" | "skip") => {
    if (!currentCard || profiles.length === 0) return;

    const profileId = profiles[0].id;

    if (reaction === "like") {
      setLikesByProfile((prev) => ({
        ...prev,
        [profileId]: Array.from(new Set([...(prev[profileId] ?? []), currentCard.id])),
      }));
      setFavorites((prev) => Array.from(new Set([...prev, currentCard.id])));
    }

    if (reaction === "dislike") {
      setDislikesByProfile((prev) => ({
        ...prev,
        [profileId]: Array.from(new Set([...(prev[profileId] ?? []), currentCard.id])),
      }));
      setAvoidDishIds((prev) => Array.from(new Set([...prev, currentCard.id])));
    }

    setRecentDishIds((prev) => Array.from(new Set([currentCard.id, ...prev])).slice(0, 20));
    setRecentProteinTags((prev) => [currentCard.proteinTag, ...prev].slice(0, 20));

    await saveRating({
      householdId: household.id,
      profileId,
      dishId: currentCard.id,
      reaction,
    });

    setRankingIndex((prev) => prev + 1);
  };

  const handleGenerateMenu = async () => {
    setLoading(true);
    setError(null);
    try {
      const nextMenu = await generateMenu({ household, context });
      setMenu(nextMenu);
      setSwapQueues({});
      setStep("menu");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const applySwapCandidate = (dayIndex: number, candidate: WeeklyMenu["dinners"][number]) => {
    setMenu((current) => {
      if (!current) return current;
      return {
        ...current,
        createdAt: new Date().toISOString(),
        dinners: current.dinners.map((day) =>
          day.dayIndex === dayIndex ? { ...candidate, dayIndex, locked: false } : day,
        ),
      };
    });
  };

  const wouldCreateTripleProtein = (
    currentMenu: WeeklyMenu,
    dayIndex: number,
    candidateProtein: string,
  ): boolean => {
    const proteinsByDay = new Map<number, string>();
    for (const day of currentMenu.dinners) {
      proteinsByDay.set(day.dayIndex, day.dayIndex === dayIndex ? candidateProtein : day.dish.proteinTag);
    }

    const maxDay = Math.max(...Array.from(proteinsByDay.keys()));
    for (let i = 0; i <= maxDay - 2; i += 1) {
      const a = proteinsByDay.get(i);
      const b = proteinsByDay.get(i + 1);
      const c = proteinsByDay.get(i + 2);
      if (a && b && c && a === b && b === c) return true;
    }
    return false;
  };

  const isValidSwapCandidate = (
    currentMenu: WeeklyMenu,
    dayIndex: number,
    candidate: WeeklyMenu["dinners"][number],
  ): boolean => {
    const duplicate = currentMenu.dinners.some(
      (day) => day.dayIndex !== dayIndex && day.dish.id === candidate.dish.id,
    );
    if (duplicate) return false;
    return !wouldCreateTripleProtein(currentMenu, dayIndex, candidate.dish.proteinTag);
  };

  const setQueueForDay = (dayIndex: number, queue: WeeklyMenu["dinners"]) => {
    setSwapQueues((prev) => {
      const next = { ...prev };
      if (queue.length === 0) {
        delete next[dayIndex];
      } else {
        next[dayIndex] = queue;
      }
      return next;
    });
  };

  const handleSmartSwap = async (dayIndex: number) => {
    if (!menu) return;

    const queue = swapQueues[dayIndex] ?? [];
    const validQueued = queue.filter((candidate) => isValidSwapCandidate(menu, dayIndex, candidate));
    if (validQueued.length > 0) {
      const [next, ...rest] = validQueued;
      applySwapCandidate(dayIndex, next);
      setQueueForDay(dayIndex, rest);
      return;
    }

    setSwappingDayIndex(dayIndex);
    try {
      const result = await fetchSwapOptions({
        currentMenu: menu,
        dayIndex,
        household,
        context,
        limit: 5,
      });
      if (result.candidates.length === 0) return;

      const [next, ...rest] = result.candidates;
      applySwapCandidate(dayIndex, next);
      setQueueForDay(dayIndex, rest);
    } finally {
      setSwappingDayIndex(null);
    }
  };

  const handleBuildShoppingList = async () => {
    if (!menu) return;
    const list = (await fetchShoppingList({
      householdId: household.id,
      dishIds: menu.dinners.map((day) => day.dish.id),
      pantryState,
    })) as ShoppingList;
    setShoppingList(list);
    setStep("shopping");
  };

  const handleOpenReview = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const pending = await fetchPendingReviewDishes(token);
      setPendingReviewDishes(pending);
      setStep("review");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePending = async (dishId: string) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      await approvePendingDish(token, dishId);
      const pending = await fetchPendingReviewDishes(token);
      setPendingReviewDishes(pending);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const togglePantry = (name: string) => {
    const next = { ...pantryState, [name.toLowerCase()]: !pantryState[name.toLowerCase()] };
    setPantryState(next);
    if (shoppingList && menu) {
      fetchShoppingList({
        householdId: household.id,
        dishIds: menu.dinners.map((day) => day.dish.id),
        pantryState: next,
      }).then((list) => setShoppingList(list as ShoppingList));
    }
  };

  const handleLogout = () => {
    setToken("");
    setUser(null);
    setHouseholds([]);
    setActiveHouseholdId("");
    setMode("auth");
    clearState();
  };

  return (
    <div className="app-shell">
      <header>
        <p className="eyebrow">3 MIN DINNER FLOW</p>
        <h1>Veckans meny utan friktion</h1>
        {user ? <p>Inloggad som {user.displayName}</p> : null}
        {mode === "app" ? (
          <div className="steps">
            <span data-active={step === "onboarding"}>1 Onboarding</span>
            <span data-active={step === "rank"}>2 Snabbranking</span>
            <span data-active={step === "menu"}>3 Meny</span>
            <span data-active={step === "shopping"}>4 Inköp</span>
            <span data-active={step === "review"}>5 Review</span>
          </div>
        ) : null}
      </header>

      {error ? <div className="error">{error}</div> : null}

      {mode === "auth" && (
        <section className="panel">
          <h2>{authMode === "login" ? "Logga in" : "Skapa konto"}</h2>
          <label>
            E-post
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {authMode === "register" && (
            <label>
              Namn
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </label>
          )}
          <label>
            Lösenord
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button className="cta" onClick={() => void handleAuth()} disabled={loading}>
            {authMode === "login" ? "Logga in" : "Skapa konto"}
          </button>
          <button onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}>
            {authMode === "login" ? "Byt till skapa konto" : "Byt till logga in"}
          </button>
        </section>
      )}

      {mode === "household" && token && (
        <section className="panel">
          <h2>Välj hushåll</h2>
          {households.map((item) => (
            <article key={item.id} className="menu-item">
              <div>
                <h3>{item.name}</h3>
                <p>Delningskod: {item.shareCode} | Roll: {item.role}</p>
              </div>
              <button onClick={() => void handleOpenHousehold(item.id)} disabled={loading}>Öppna</button>
            </article>
          ))}

          <div className="shopping-block">
            <h3>Skapa nytt hushåll</h3>
            <label>
              Namn
              <input value={newHouseholdName} onChange={(e) => setNewHouseholdName(e.target.value)} />
            </label>
            <button onClick={() => void handleCreateHousehold()} disabled={loading}>Skapa hushåll</button>
          </div>

          <div className="shopping-block">
            <h3>Gå med via kod</h3>
            <label>
              Delningskod
              <input value={shareCode} onChange={(e) => setShareCode(e.target.value)} />
            </label>
            <button onClick={() => void handleJoinHousehold()} disabled={loading}>Gå med</button>
          </div>

          <button onClick={handleLogout}>Logga ut</button>
        </section>
      )}

      {mode === "app" && (
        <>
          <section className="panel" style={{ marginBottom: "0.75rem" }}>
            <p>
              Hushåll: <strong>{householdName}</strong>
              {households.find((item) => item.id === activeHouseholdId)?.shareCode
                ? ` | Delningskod: ${households.find((item) => item.id === activeHouseholdId)?.shareCode}`
                : ""}
            </p>
            <div className="actions">
              <button onClick={() => setMode("household")}>Byt hushåll</button>
              <button onClick={handleLogout}>Logga ut</button>
              <button onClick={() => setStep("onboarding")}>Redigera onboarding</button>
              <button onClick={() => void handleOpenReview()} disabled={loading}>
                Review-kö
              </button>
            </div>
          </section>

          {step === "onboarding" && (
            <section className="panel">
              <h2>Onboarding (90 sek)</h2>
              <label>
                Hushåll
                <input value={householdName} onChange={(e) => setHouseholdName(e.target.value)} />
              </label>

              <div className="profile-grid">
                {profiles.map((profile) => (
                  <div key={profile.id} className="profile-card">
                    <input
                      value={profile.name}
                      onChange={(e) =>
                        setProfiles((prev) => prev.map((item) => (item.id === profile.id ? { ...item, name: e.target.value } : item)))
                      }
                    />
                    <select
                      value={profile.type}
                      onChange={(e) =>
                        setProfiles((prev) =>
                          prev.map((item) =>
                            item.id === profile.id ? { ...item, type: e.target.value as Profile["type"] } : item,
                          ),
                        )
                      }
                    >
                      <option value="adult">Vuxen</option>
                      <option value="child">Barn</option>
                    </select>
                    <label>
                      Picky: {profile.pickyLevel}
                      <input
                        type="range"
                        min={0}
                        max={2}
                        step={1}
                        value={profile.pickyLevel}
                        onChange={(e) =>
                          setProfiles((prev) =>
                            prev.map((item) =>
                              item.id === profile.id ? { ...item, pickyLevel: Number(e.target.value) } : item,
                            ),
                          )
                        }
                      />
                    </label>
                  </div>
                ))}
              </div>

              <div className="chip-block">
                <p>Kök</p>
                {cuisines.map((item) => (
                  <button
                    key={item}
                    className="chip"
                    data-on={selectedCuisines.includes(item)}
                    onClick={() => toggle(item, selectedCuisines, setSelectedCuisines)}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="chip-block">
                <p>Protein</p>
                {proteins.map((item) => (
                  <button
                    key={item}
                    className="chip"
                    data-on={selectedProteins.includes(item)}
                    onClick={() => toggle(item, selectedProteins, setSelectedProteins)}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="chip-block">
                <p>Undvik allergener</p>
                {allergens.map((item) => (
                  <button
                    key={item}
                    className="chip"
                    data-on={selectedAvoid.includes(item)}
                    onClick={() => toggle(item, selectedAvoid, setSelectedAvoid)}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="chip-block">
                <p>Känsla</p>
                {moodTags.map((item) => (
                  <button
                    key={item}
                    className="chip"
                    data-on={selectedMood.includes(item)}
                    onClick={() => toggle(item, selectedMood, setSelectedMood)}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="inline-controls">
                <label>
                  Tid
                  <select value={maxTime} onChange={(e) => setMaxTime(Number(e.target.value) as 15 | 30 | 45)}>
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                  </select>
                </label>
                <label>
                  Middagar
                  <select value={dinnersPerWeek} onChange={(e) => setDinnersPerWeek(Number(e.target.value) as 3 | 4 | 5 | 6 | 7)}>
                    {[3, 4, 5, 6, 7].map((count) => (
                      <option key={count} value={count}>
                        {count}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <button className="cta" onClick={() => void handleSaveConfig()} disabled={loading}>
                Spara och starta ranking
              </button>
            </section>
          )}

          {step === "rank" && currentCard && (
            <section className="panel">
              <h2>Snabbranking</h2>
              <article className="dish-card">
                <img src={currentCard.imageUrl} alt={currentCard.title} />
                <div>
                  <h3>{currentCard.title}</h3>
                  <p>
                    {currentCard.cuisineTags.join(" | ")} | {currentCard.timeMinutes} min
                  </p>
                  <div className="tag-row">
                    <span>{currentCard.proteinTag}</span>
                    {currentCard.tags.slice(0, 2).map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                </div>
              </article>
              <div className="actions">
                <button onClick={() => void handleRate("dislike")}>Dislike</button>
                <button onClick={() => void handleRate("skip")}>Skip</button>
                <button className="primary" onClick={() => void handleRate("like")}>Like</button>
              </div>
              <button className="cta" onClick={() => void handleGenerateMenu()} disabled={loading}>
                Generera veckomeny
              </button>
            </section>
          )}

          {step === "menu" && menu && (
            <section className="panel">
              <h2>Veckomeny</h2>
              {menu.dinners.map((day) => (
                <article key={day.dayIndex} className="menu-item">
                  <div>
                    <h3>
                      Dag {day.dayIndex + 1}: {day.dish.title}
                    </h3>
                    <p>
                      Family-fit: {day.score.toFixed(1)} | {day.dish.proteinTag} | {day.dish.timeMinutes} min
                    </p>
                  </div>
                  <div className="menu-actions">
                    {day.dish.sourceUrl ? (
                      <a className="menu-link" href={day.dish.sourceUrl} target="_blank" rel="noreferrer">
                        Recept
                      </a>
                    ) : (
                      <button disabled>Recept saknas</button>
                    )}
                    <button
                      onClick={() => void handleSmartSwap(day.dayIndex)}
                      disabled={loading || swappingDayIndex === day.dayIndex}
                    >
                      Byt rätt
                    </button>
                  </div>
                </article>
              ))}
              <button className="cta" onClick={() => void handleBuildShoppingList()}>
                Skapa inköpslista
              </button>
            </section>
          )}

          {step === "shopping" && shoppingList && (
            <section className="panel">
              <h2>Inköpslista</h2>
              {(Object.keys(shoppingList.itemsByCategory) as Array<keyof ShoppingList["itemsByCategory"]>).map((category) => (
                <div key={category} className="shopping-block">
                  <h3>{category}</h3>
                  {shoppingList.itemsByCategory[category].map((item) => (
                    <label key={`${item.name}-${item.unit}`} className="shopping-item">
                      <input type="checkbox" checked={item.inPantry} onChange={() => togglePantry(item.name)} />
                      <span>
                        {item.name} - {item.amount} {item.unit}
                      </span>
                    </label>
                  ))}
                </div>
              ))}
              <button className="cta" onClick={() => setStep("menu")}>
                Tillbaka till meny
              </button>
            </section>
          )}

          {step === "review" && (
            <section className="panel">
              <h2>Review-kö (osäkra recept)</h2>
              {pendingReviewDishes.length === 0 ? (
                <p>Inga recept väntar på granskning.</p>
              ) : (
                pendingReviewDishes.map((dish) => (
                  <article key={dish.id} className="menu-item">
                    <div>
                      <h3>{dish.title}</h3>
                      <p>
                        {dish.proteinTag} | {dish.timeMinutes} min | {dish.ingredients.length} ingredienser
                      </p>
                    </div>
                    <div className="menu-actions">
                      {dish.sourceUrl ? (
                        <a className="menu-link" href={dish.sourceUrl} target="_blank" rel="noreferrer">
                          Recept
                        </a>
                      ) : (
                        <button disabled>Recept saknas</button>
                      )}
                      <button onClick={() => void handleApprovePending(dish.id)} disabled={loading}>
                        Godkänn
                      </button>
                    </div>
                  </article>
                ))
              )}
              <button className="cta" onClick={() => setStep("menu")}>
                Tillbaka till meny
              </button>
            </section>
          )}
        </>
      )}
    </div>
  );
}
