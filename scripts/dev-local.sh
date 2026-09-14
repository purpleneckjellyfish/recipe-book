#!/bin/zsh
# Clean local restart — kills stuck Next servers and starts with .env (not a poisoned shell URL).
set -e
cd "$(dirname "$0")/.."

echo "Stopping any Next.js dev servers…"
pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
sleep 1

# Drop any leftover test DATABASE_URL from the shell
unset DATABASE_URL
unset BETTER_AUTH_SECRET
unset BETTER_AUTH_URL
unset NEXT_PUBLIC_APP_URL

if ! command -v psql >/dev/null; then
  echo "psql not found — start Postgres first (brew services start postgresql@16)"
  exit 1
fi

if ! psql "postgresql://david:recipe_dev@127.0.0.1:5432/recipe_book" -c 'SELECT 1' >/dev/null 2>&1; then
  echo "Cannot reach local Postgres as david/recipe_dev on recipe_book."
  echo "Start it with: brew services start postgresql@16"
  exit 1
fi

echo "Starting http://localhost:3000 …"
echo "Local logins (password reset for testing):"
echo "  david@example.com / password123"
echo "  davidpkemble@pm.me / password123"
exec npm run dev
