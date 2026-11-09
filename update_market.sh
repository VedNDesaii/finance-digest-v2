#!/bin/bash
# Update the market summary.
#   ./update_market.sh
#
# The generator now publishes LIVE to Supabase (the market_data table), so the
# website updates INSTANTLY — no git push, no Vercel deploy needed. The old
# "generate → commit → push → wait for deploy" chain (which kept breaking on
# flaky connections) is gone.
#
# One-time setup, if you haven't already: create the table in Supabase → SQL:
#   create table if not exists market_data (
#     id text primary key, data jsonb, updated_at timestamptz);
#   alter table market_data enable row level security;
#   create policy "public read" on market_data for select using (true);
set -euo pipefail
cd "$(dirname "$0")"

PY=".venv/bin/python"
[ -x "$PY" ] || PY="python3"

"$PY" generate_market_summary.py
echo "✅ Market summary is LIVE (published to Supabase) — the site is already updated."

# Keep the committed static file in sync as a fallback, when the connection
# allows. This never blocks: if you're offline, the live summary is already up.
if git add public/market-data.json 2>/dev/null \
   && ! git diff --cached --quiet 2>/dev/null \
   && git commit -m "update market data $(date -u +'%Y-%m-%d %H:%M')" 2>/dev/null \
   && git push origin main 2>/dev/null; then
  echo "✅ Static fallback also committed + pushed."
else
  echo "ℹ️  Static fallback not pushed (offline / nothing new / main not here) — that's fine, the live summary is already showing."
fi
