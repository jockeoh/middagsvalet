# Handoff Guide

## Repo
- Local path: `C:\Users\Vincent\my-app`
- GitHub: `https://github.com/jockeoh/middagsvalet`

## Current State
- Monorepo structure:
  - `apps/web` (React + Vite + TS)
  - `api` (Express + SQLite + TS)
  - `packages/shared` (types/scoring/menu/shopping/ingredient normalization)
- Auth + shared households implemented.
- Weekly menu generator + swap + shopping list implemented.
- Import pipeline exists via `api/scripts/import-koket.ts`.
- `mealType` introduced (`main`, `dessert`, `other`), app defaults to `main` dishes.
- Ingredient normalization centralised in:
  - `packages/shared/src/ingredient-normalization.ts`

## Important Note About Data
- Large/local data files are intentionally NOT versioned.
- Keep sample files locally under `api/data/`.

## Start Commands
Run from repo root:

```bash
npm install
npm run migrate --workspace api
npm run dev:api
npm run dev:web
```

## Import Command
Import recipes from local JSON:

```bash
npm run import:koket --workspace api -- --input=../data/koket-samples.json --replace=true
```

Alias diagnostics output:
- `api/data/ingredient_alias_report.json`

## Suggested Next Step (new chat)
Build a lightweight admin flow for normalization quality:
1. Load alias report in admin UI.
2. Show canonical ingredient + raw examples + counts.
3. Allow editing normalization rules (or override table) without code changes.
4. Trigger re-import and inspect delta.

## Suggested Bootstrap Prompt for New Chat
Use this:

```text
Arbeta i repo: C:\Users\Vincent\my-app (GitHub: jockeoh/middagsvalet).
Läs README.md och docs/HANDOFF.md först.
Kör install + migrate + dev.
Fokusera på adminvy för ingrediensnormalisering och aliasrapport.
Stora lokala datafiler ska inte commitas.
```
