# Recipe Book

Household recipe archive, meal planner, and shopping list — local-first while developing, Docker for Unraid.

## Local development

```bash
brew services start postgresql@16   # if needed
createdb recipe_book                # once
cp .env.example .env                # edit DATABASE_URL / secrets
npm install
npx prisma db push
npm run dev
```

Open http://localhost:3000

### Optional AI (OpenAI or Mistral)

Photo OCR and tag/type/veg suggestions need an API key. The app talks to any **OpenAI-compatible** chat API.

**Mistral works well** if you already have an account — use **Pixtral** for recipe photos and a small text model for tags.

```bash
IMPORT_API_KEY=your-mistral-key
IMPORT_API_BASE=https://api.mistral.ai/v1
IMPORT_MODEL=mistral-small-latest
IMPORT_VISION_MODEL=pixtral-12b-2409
```

#### Avoid surprise bills

1. In [Mistral console](https://console.mistral.ai/) → **Subscriptions / Billing**, set a **monthly organisation spending limit** (e.g. €5–10). API calls stop when you hit it.
2. Prefer cheap models (`mistral-small-latest` + `pixtral-12b-*`) — a handful of photo imports per week is usually cents, not pounds.
3. Leave `IMPORT_API_KEY` unset until you need AI — URL scrape and the rest of the app work without it.
4. Check **Usage** in the admin panel after the first few imports.

Same idea on OpenAI: set usage limits / budgets in the OpenAI dashboard.

| Variable | Purpose |
|----------|---------|
| `IMPORT_API_KEY` | API key |
| `IMPORT_API_BASE` | Default OpenAI; set `https://api.mistral.ai/v1` for Mistral |
| `IMPORT_MODEL` | Text model for tags/veg |
| `IMPORT_VISION_MODEL` | Vision model for photo import |
| `SMTP_*` | Email a recipe PDF (otherwise Download PDF / Copy text) |

## Features

- Household accounts + invites + meal types
- Recipe library (categories, search, veg filter, rating sort)
- Import from URL / photo / manual; AI type & tags when configured
- Meal plan: pin, skip, auto-fill (veg/fish, rating weight, avoid last N weeks), batch leftovers
- Shopping list: aisles, smart quantities, pantry, custom suggest, check-off → Got it
- Home ideas + To try parking list
- Share recipe as PDF/text/email; export library CSV/PDF
- Installable PWA with offline shell for recent pages

Living brief: [`docs/MASTER_PLAN.md`](docs/MASTER_PLAN.md)

## Docker / Unraid

**New to this?** Follow the baby-steps guide: [`docs/UNRAID.md`](docs/UNRAID.md).

Local test of Compose on the Mac:

```bash
docker compose up -d
```

Production on Unraid uses [`docker-compose.unraid.yml`](docker-compose.unraid.yml) (bind mounts under `appdata` so updates never wipe the archive).

### GHCR image (CI)

On push to `main`, GitHub Actions builds and pushes:

`ghcr.io/<you>/recipe-book:latest`

Update Unraid with pull + up only — never delete `appdata/recipe-book/pg` or `uploads`.
