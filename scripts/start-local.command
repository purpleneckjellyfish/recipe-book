#!/bin/zsh
cd "/Users/david/Desktop/Recipe Book"
unset DATABASE_URL BETTER_AUTH_SECRET BETTER_AUTH_URL NEXT_PUBLIC_APP_URL
pkill -f "next dev" 2>/dev/null || true
sleep 1
echo "Starting Recipe Book at http://localhost:3000 …"
exec npm run dev
