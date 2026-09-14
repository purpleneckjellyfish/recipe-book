#!/bin/zsh
set -e
echo "Killing stuck Next.js processes…"
kill -9 66710 2>/dev/null || true
pkill -9 -f "next dev" 2>/dev/null || true
pkill -9 -f "next-server" 2>/dev/null || true
sleep 2

cd "/Users/david/Desktop/Recipe Book"
unset DATABASE_URL
unset BETTER_AUTH_SECRET
unset BETTER_AUTH_URL
unset NEXT_PUBLIC_APP_URL

export DATABASE_URL="postgresql://david:recipe_dev@127.0.0.1:5432/recipe_book?schema=public"
export BETTER_AUTH_SECRET="dev-secret-change-me-in-production-recipe-book-32c"
export BETTER_AUTH_URL="http://localhost:3000"
export NEXT_PUBLIC_APP_URL="http://localhost:3000"

echo "Port 3000 status:"
lsof -iTCP:3000 -sTCP:LISTEN || echo "  free"

echo ""
echo "Starting Recipe Book at http://localhost:3000"
echo "Login: david@example.com / password123"
echo ""
npm run dev
