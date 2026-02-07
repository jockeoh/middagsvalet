# Middagsvalet MVP

Mobil-first app som hjälper hushåll att välja veckans middagar på cirka 3 minuter.

## Product Brief
- Problem: Beslutsstress kring vardagsmiddag, särskilt med barn och olika preferenser.
- Mål: Maximera `family-fit score` snabbt, med låg friktion.
- Primärt flöde:
  1. Onboarding (<90 sek): hushåll, profiler, preferenschips.
  2. Snabbranking: Like/Dislike/Skip i card stack.
  3. Veckomeny: generera och byt rätt direkt.
  4. Inköpslista: summerad, kategoriserad, markera "har hemma".
- Sticky UX: sparar lokalt utan konto, visar favoriter/historik/undvik.

## Arkitektur
- `apps/web`: React + Vite + TypeScript (mobil-first UI)
- `api`: Node + Express + TypeScript + SQLite (`better-sqlite3`)
- `packages/shared`: gemensamma typer + scoring + menygenerator + inköpslista

## Datamodeller (kärna)
- `UserAccount`: användare med email/displayName
- `Session`: bearer-token för auth
- `Household`: hushåll med profiler + preferenser
- `HouseholdMembership`: relation användare ↔ hushåll (`owner`/`member`)
- `Profile`: `id`, `name`, `type(adult|child)`, `pickyLevel`, `weight`
- `Dish`: `id`, `title`, `sourceUrl?`, `cuisineTags[]`, `proteinTag`, `timeMinutes`, `difficulty`, `kidFriendlyScore`, `ingredients[]`, `instructionsShort`, `allergens[]`, `tags[]`, `imageUrl`
- `RatingEvent`: like/dislike/skip per profil + hushåll
- `WeeklyMenu`: lista av `MenuDay` med score per profil och total
- `ShoppingList`: summerade ingredienser per kategori

## Scoring (V1 utan ML-träning)
- Plus: matchande kök/protein/tid/moodtags
- Minus: allergener och undvik-ingredienser
- Barn: kid-friendly vägs in extra (default child boost 1.2)
- Variation: straff för nyligen ätet/protein nyligen använt
- Historik: bonus för likes, straff för dislikes
- Aggregat: viktat snitt per profil
- Menyval: random inom top-k för variation

## Regler i menygenerator
- Antal middagar: 3-7
- Ingen allergen-matchning mot hushållets undviklista
- Ingen upprepning av samma rätt under veckan
- Huvudprotein får inte upprepas 3 dagar i rad
- I menyvyn finns `Byt rätt` (instant) och `Recept`-länk när `sourceUrl` finns

## Seeddata
- `api/scripts/seed.ts` genererar 300 rätter till SQLite.
- Fält enligt krav + tags `comfort`, `fresh`, `spicy`, `budget`.

## API-endpoints
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/households` (auth)
- `POST /api/households/join` (auth + shareCode)
- `GET /api/households` (auth)
- `GET /api/households/:householdId` (auth)
- `PUT /api/households/:householdId/config` (auth)
- `GET /api/bootstrap`
- `POST /api/rate`
- `GET /api/history/:householdId`
- `POST /api/menu/generate`
- `POST /api/menu/swap`
- `POST /api/menu/swap-options`
- `POST /api/shopping-list`
- `GET /api/review/pending` (auth, osäkra recept i väntkö)
- `POST /api/review/:dishId/approve` (auth, flytta till `main`)

## Kör lokalt
```bash
npm install
npm run seed
npm run dev:api
npm run dev:web
```
- Webb: `http://localhost:5173`
- API: `http://localhost:4000`

## Snabb auth-exempel
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","displayName":"Demo","password":"password123"}'
```
Använd returnerad `token` som `Authorization: Bearer <token>`.

## Tester
```bash
npm test
```
Innehåller enhetstest för scoring, menygenerering och smart byte.

## Dataimport (Köket-samples)
Förväntad default-fil är `api/data/koket-samples.json`.

```bash
npm run import:koket --workspace api
```

Med explicit filväg:

```bash
npm run import:koket --workspace api -- --input=C:/path/to/koket-samples.json --replace=true
```

Normalisering vid import:
- deterministisk parser för mängd/enhet/rånamn
- canonical mapping via ingredienskatalog
- fuzzy-match med confidence score
- fallback till unresolved-queue för låg säkerhet
- metadata-rader som `Till servering`/`Topping` filtreras bort
- recept med osäkra nyckelmått (t.ex. `pasta 1 st`) flyttas till `pending_review` och visas inte i menyflödet

Rapporter:
- aliasdiagnostik: `api/data/ingredient_alias_report.json`
- unresolved queue: `api/data/unresolved_ingredients.json`
- merge-kandidater f\u00f6r manuell/AI-klumpning: `api/data/ingredient_merge_candidates.json`
- recept-v\u00e4nth\u00f6g: `api/data/recipe_review_queue.json`

## Framtida utbyggnad
- Delade hushåll med realtids-synk
- Export av inköpslista till externa korgar (ICA/Willys) via adapterlager
- Optional LLM-modul för substitutionsförslag och kort rätt-beskrivning baserat på seeddata
