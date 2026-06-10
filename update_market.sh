#!/bin/bash
cd ~/Desktop/finance-digest-v2
source .venv/bin/activate
python3 generate_market_summary.py
git add public/market-data.json && git commit -m "update market data $(date)" && git push origin main
echo "✅ Market data updated!"
