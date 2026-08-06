#!/usr/bin/env bash
# Finance Digest — one-command daily pipeline.
#   ./run.sh           fetch news → process → market summary → daily quiz
#   ./run.sh --clear   wipe all articles first, then rebuild everything
#
# Reads the API key from .env (so you never paste it). If your shell has a
# stale ANTHROPIC_API_KEY exported, we drop it so .env wins.
set -euo pipefail
cd "$(dirname "$0")"

unset ANTHROPIC_API_KEY 2>/dev/null || true   # let .env be the source of truth

# prefer the project's venv python; fall back to system python3
PY=".venv/bin/python"
[ -x "$PY" ] || PY="python3"

if [ "${1:-}" = "--clear" ]; then
  echo "══ 0/4  clearing all articles ══"
  "$PY" clear_articles.py
fi

echo "══ 1/4  fetch news ══"        ; "$PY" fetch_news.py
echo "══ 2/4  process articles ══"  ; "$PY" process_articles.py
echo "══ 3/4  market summary ══"    ; "$PY" generate_market_summary.py
echo "══ 4/4  daily quiz ══"        ; "$PY" generate_quiz.py

echo "✅ pipeline complete"
