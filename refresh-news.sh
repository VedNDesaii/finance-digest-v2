#!/usr/bin/env bash
# Finance Digest — news-only refresh.
#   ./refresh-news.sh   clear ALL articles → fetch news → process & upload
#
# Does ONLY the news pipeline. No market summary, no quiz.
# Processing inserts straight into Supabase, so the site updates live —
# there is no separate upload step.
#
# Reads the API key from .env (so you never paste it). If your shell has a
# stale ANTHROPIC_API_KEY exported, we drop it so .env wins.
set -euo pipefail
cd "$(dirname "$0")"

unset ANTHROPIC_API_KEY 2>/dev/null || true   # let .env be the source of truth

# prefer the project's venv python; fall back to system python3
PY=".venv/bin/python"
[ -x "$PY" ] || PY="python3"

# ── Connectivity pre-check ──────────────────────────────────────────────
# The pipeline clears all articles FIRST, then rebuilds. If the connection
# drops after the clear, the site is left empty. So refuse to start unless
# Supabase is reachable right now — abort BEFORE deleting anything.
echo "══ 0/3  connectivity check ══"
"$PY" - <<'PYCHK' || { echo "❌ Can't reach Supabase — check your internet, then retry. Nothing was cleared."; exit 1; }
import os, sys
from dotenv import load_dotenv
from supabase import create_client
load_dotenv(override=True)
try:
    sb = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
    sb.table("raw_articles").select("id").limit(1).execute()
except Exception as e:
    print("  ✗", str(e)[:120]); sys.exit(1)
print("  ✅ Supabase reachable")
PYCHK

echo "══ 1/3  clear all articles ══" ; "$PY" clear_articles.py
echo "══ 2/3  fetch news ══"          ; "$PY" fetch_news.py
echo "══ 3/3  process & upload ══"    ; "$PY" process_articles.py

echo "✅ news refreshed (no market summary, no quiz)"
