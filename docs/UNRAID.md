# Recipe Book on Unraid — baby steps

Do these in order. Stop after each step if stuck and ask — don’t skip ahead.

Your **recipes and photos live in folders on the Unraid disk**, not inside the app image. Updating the app does **not** wipe the archive if you leave those folders alone.

---

## What you’ll end up with

- **Mac:** keep coding with `npm run dev`
- **GitHub:** stores the code; builds a Docker image automatically
- **Unraid:** runs that image; keeps your database + photos in `appdata`

---

## Step A — GitHub (we do this together from your Mac)

1. Create a free account at [github.com](https://github.com) if you don’t have one.
2. On the Mac we’ll install GitHub’s helper (`gh`), sign in once in the browser, create the repo, and push.
3. After push, GitHub Actions builds an image like:  
   `ghcr.io/YOUR_USERNAME/recipe-book:latest`

You only need to do the sign-in once.

---

## Step B — Folders on Unraid (do this in the Unraid web UI)

1. Open Unraid → **Shares** (or file browser).
2. Under `appdata`, create a folder: `recipe-book`
3. Inside it create two folders:
   - `pg` ← database (the archive)
   - `uploads` ← recipe photos

Full paths will look like:

- `/mnt/user/appdata/recipe-book/pg`
- `/mnt/user/appdata/recipe-book/uploads`

**Never delete these** when updating.

---

## Step C — Env file on Unraid

1. In `/mnt/user/appdata/recipe-book/` create a file named `.env` (same folder as you’ll put compose).
2. Paste something like this (change the secret and URLs):

```bash
BETTER_AUTH_SECRET=paste-a-long-random-string-here
BETTER_AUTH_URL=https://recipes.yourdomain.com
NEXT_PUBLIC_APP_URL=https://recipes.yourdomain.com

# Optional AI (same as on your Mac) — needed for “import from photo”
# IMPORT_API_KEY=your-key-here
# IMPORT_API_BASE=https://api.mistral.ai/v1
# IMPORT_MODEL=mistral-small-latest
# IMPORT_VISION_MODEL=pixtral-12b-2409
```

Use your real reverse-proxy URL if you have one. For a first test on the LAN only, you can use `http://TOWER_IP:3000` (replace with your Unraid IP).

If your vars live **inside the compose file** (recommended for the paste-in stack), you can skip a separate `.env` — an empty `.env` is fine.

Generate a secret on the Mac with:

```bash
openssl rand -hex 32
```

---

## Step D — Compose stack

Use the file [`docker-compose.unraid.yml`](../docker-compose.unraid.yml) in this repo.

1. On Unraid, install **Docker Compose Manager** (Community Apps) if you don’t have it.
2. Create a new stack called `recipe-book`.
3. Paste the contents of `docker-compose.unraid.yml`.
4. Change `YOUR_GITHUB_USERNAME` to your GitHub username (lowercase).
5. Confirm the two volume paths match Step B.
6. Point the stack at the `.env` from Step C (or paste the same variables into the UI).
7. **Compose Up**.

First pull may take a few minutes. Then open `http://UNRAID_IP:3000` (or your HTTPS URL).

Sign up — that creates your household. This Unraid database starts **empty**; it’s not a copy of your Mac recipes unless you export/import later.

---

## Step E — Updating later (safe)

When we’ve pushed new code to GitHub and the Actions build is green:

1. Unraid → your `recipe-book` stack  
2. **Pull** then **Up** (or `docker compose pull && docker compose up -d`)  
3. Do **not** remove the `pg` or `uploads` folders  
4. Do **not** tick “delete volumes” / “remove data”

The new app image starts, runs database migrations if needed, and your archive is still there.

---

## Step F — Optional but wise: backups

In Unraid, include this path in your backup app (CA Backup / rclone / etc.):

`/mnt/user/appdata/recipe-book/`

That folder is your family archive.

---

## If the image won’t pull (private package)

If GitHub Package is private, Unraid needs a login:

1. GitHub → Settings → Developer settings → Personal access token (classic)  
2. Enable `read:packages`  
3. On Unraid terminal:  
   `docker login ghcr.io -u YOUR_USERNAME`  
   (paste the token as password)

Or make the package public: GitHub repo → Packages → package settings → Change visibility.

---

## Mac vs Unraid data

| | Mac (dev) | Unraid (home) |
|--|-----------|----------------|
| Purpose | Building features | Real household use |
| Database | Local Postgres | `appdata/recipe-book/pg` |
| Updates | `npm run dev` | Pull new image |

They are **separate** until you choose to migrate (library export/import, or a one-off database copy). That’s normal and safer while developing.
