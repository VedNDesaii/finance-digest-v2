import anthropic
import json
import yfinance as yf
from supabase import create_client
from dotenv import load_dotenv
from datetime import datetime
import os

load_dotenv(override=True)

from llm import make_client, MODEL_ID, USE_BEDROCK

SUPABASE_URL  = os.getenv("SUPABASE_URL")
SUPABASE_KEY  = os.getenv("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
client   = make_client()   # Bedrock if AWS keys present, else Anthropic API

# ── Haiku 4.5 pricing ────────────────────────────────────────────────────────
# Indian summary:  ~800 input + ~350 output = ~$0.0026
# US summary:      ~800 input + ~350 output = ~$0.0026
# Total both:      ~$0.0052/day — very cheap

# ── Shared system prompt (cached) ────────────────────────────────────────────
MARKET_SYSTEM_PROMPT = """You are a financial data analyst writing crisp market summaries
for a finance news platform aimed at Indian retail investors and curious young readers.
Your summaries must be factual, data-driven, and written in plain English.
Never use jargon without explaining it. Keep every field concise.
Always return ONLY valid JSON — no markdown, no explanation, nothing else."""


def fetch_prices(tickers: dict) -> dict:
    """Fetch latest price + day change for a dict of {name: symbol}."""
    results = {}
    for name, symbol in tickers.items():
        try:
            hist = yf.Ticker(symbol).history(period="2d")
            if len(hist) >= 2:
                prev, curr = hist["Close"].iloc[-2], hist["Close"].iloc[-1]
                change = curr - prev
                pct    = (change / prev) * 100
                results[name] = {
                    "value":  f"{curr:,.0f}",
                    "change": f"{'▲' if change >= 0 else '▼'} {abs(change):,.0f}",
                    "pct":    f"{'+'if change >= 0 else ''}{pct:.2f}%",
                    "up":     bool(change >= 0),   # native bool (numpy bool_ isn't JSON-serializable)
                }
            elif len(hist) == 1:
                curr = hist["Close"].iloc[-1]
                results[name] = {"value": f"{curr:,.0f}", "change": "▲ 0", "pct": "0.00%", "up": True}
        except Exception as e:
            print(f"  ⚠️  Could not fetch {name} ({symbol}): {e}")
            results[name] = {"value": "N/A", "change": "N/A", "pct": "N/A", "up": True}
    return results


def fetch_sector_moves(tickers: dict) -> list:
    """Real sector index moves (percent), sorted best→worst. No AI guessing."""
    out = []
    for name, symbol in tickers.items():
        try:
            hist = yf.Ticker(symbol).history(period="2d")
            if len(hist) >= 2:
                prev, curr = hist["Close"].iloc[-2], hist["Close"].iloc[-1]
                out.append({"name": name, "pct": round(float((curr - prev) / prev * 100), 1)})
        except Exception as e:
            print(f"  ⚠️  sector {name} ({symbol}) failed: {e}")
    out.sort(key=lambda s: s["pct"], reverse=True)
    return out


def compute_verdict(indices: list) -> str:
    """up / down / mixed, from how many indices closed higher."""
    ups = sum(1 for i in indices if i.get("up"))
    if ups == len(indices): return "up"
    if ups == 0:            return "down"
    return "mixed"


INDIA_SECTORS = {
    "Banking": "^NSEBANK", "IT": "^CNXIT", "Auto": "^CNXAUTO", "FMCG": "^CNXFMCG",
    "Pharma": "^CNXPHARMA", "Metal": "^CNXMETAL", "Realty": "^CNXREALTY", "Energy": "^CNXENERGY",
}
US_SECTORS = {"Tech": "XLK", "Financials": "XLF", "Energy": "XLE", "Healthcare": "XLV"}


def get_recent_articles(categories: list, limit: int = 5) -> list:
    articles = []
    for cat in categories:
        result = (
            supabase.table("processed_articles")
            .select("title, simplified_article")
            .eq("category", cat)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        articles += result.data or []
    return articles[:15]


def call_claude_cached(user_content: str, max_tokens: int = 800) -> dict:
    """Call Haiku with a cached system prompt to save input token costs."""
    message = client.messages.create(
        model=MODEL_ID,
        max_tokens=max_tokens,
        system=[
            {
                "type": "text",
                "text": MARKET_SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": user_content}],
    )
    text = message.content[0].text.strip()
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


def generate_indian_summary() -> dict:
    print("  Fetching live Indian prices...")
    prices   = fetch_prices({"Sensex": "^BSESN", "Nifty 50": "^NSEI", "Bank Nifty": "^NSEBANK"})
    sectors  = fetch_sector_moves(INDIA_SECTORS)          # REAL sector moves, not AI guesses
    articles = get_recent_articles(["indian-markets", "banking-finance", "macro-policy"])
    news     = "\n".join(f"- {a['title']}: {a['simplified_article'][:180]}" for a in articles)
    today    = datetime.now().strftime("%d %B %Y")

    s = prices.get("Sensex",    {})
    n = prices.get("Nifty 50",  {})
    b = prices.get("Bank Nifty",{})
    indices = [
        {"label": "Sensex",     "value": s.get("value"), "change": s.get("change"), "pct": s.get("pct"), "up": s.get("up", True)},
        {"label": "Nifty 50",   "value": n.get("value"), "change": n.get("change"), "pct": n.get("pct"), "up": n.get("up", True)},
        {"label": "Bank Nifty", "value": b.get("value"), "change": b.get("change"), "pct": b.get("pct"), "up": b.get("up", True)},
    ]
    verdict = compute_verdict(indices)
    sector_txt = ", ".join(f"{x['name']} {x['pct']:+.1f}%" for x in sectors) or "n/a"

    prompt = f"""Today is {today}. The Indian market had an overall "{verdict}" day.

LIVE INDEX DATA: Sensex {s.get('pct')}, Nifty 50 {n.get('pct')}, Bank Nifty {b.get('pct')}.
REAL SECTOR MOVES (already computed — reference these, do NOT invent numbers): {sector_txt}
RECENT NEWS HEADLINES:
{news}

Write a market summary. Return ONLY this JSON:
{{
  "lead": "<ONE short sentence, max 22 words: the day's verdict + the single biggest driver, plain English>",
  "brief": "<1 sentence with the key index moves in words, e.g. 'Sensex rose 0.8% and Nifty 0.6% on ...'>",
  "narrative": "PARA1\\n\\nPARA2 — 2 short paragraphs telling the day in full (open→close, the main driver, the undercurrents). Use ONLY facts from the data and news above; never invent figures.",
  "tiles": [
    {{"icon":"🌍","label":"Global cues",  "value":"<Weak/Mixed/Strong>","sub":"<1 line context>","subUp":false}},
    {{"icon":"🏦","label":"FII activity", "value":"<Buying/Selling/Mixed>","sub":"<1 line, only if the news mentions it, else 'No fresh data'>","subUp":null}},
    {{"icon":"🛢","label":"Crude oil",    "value":"<Rising/Falling/Steady>","sub":"<1 line context>","subUp":false}}
  ],
  "watch": "<one sentence, max 22 words, the key thing to watch tomorrow>"
}}"""

    ai = call_claude_cached(prompt, max_tokens=700)
    return {
        "verdict":  verdict,
        "headline": ai.get("lead", ""),          # kept for backward compat
        "lead":     ai.get("lead", ""),
        "brief":    ai.get("brief", ""),
        "narrative": ai.get("narrative", ""),
        "indices":  indices,
        "sectors":  sectors,                      # REAL data
        "tiles":    ai.get("tiles", []),
        "watch":    ai.get("watch", ""),
    }


def generate_us_summary() -> dict:
    print("  Fetching live US prices...")
    prices   = fetch_prices({"S&P 500": "^GSPC", "Nasdaq": "^IXIC", "Dow Jones": "^DJI"})
    articles = get_recent_articles(["us-markets", "global-economy", "technology-it"])
    news     = "\n".join(f"- {a['title']}: {a['simplified_article'][:180]}" for a in articles)
    today    = datetime.now().strftime("%d %B %Y")

    sp = prices.get("S&P 500",  {})
    nq = prices.get("Nasdaq",   {})
    dj = prices.get("Dow Jones",{})
    sectors = fetch_sector_moves(US_SECTORS)          # REAL sector moves
    indices = [
        {"label": "S&P 500",   "value": sp.get("value"), "change": sp.get("change"), "pct": sp.get("pct"), "up": sp.get("up", True)},
        {"label": "Nasdaq",    "value": nq.get("value"), "change": nq.get("change"), "pct": nq.get("pct"), "up": nq.get("up", True)},
        {"label": "Dow Jones", "value": dj.get("value"), "change": dj.get("change"), "pct": dj.get("pct"), "up": dj.get("up", True)},
    ]
    verdict = compute_verdict(indices)
    sector_txt = ", ".join(f"{x['name']} {x['pct']:+.1f}%" for x in sectors) or "n/a"

    prompt = f"""Today is {today}. US markets had an overall "{verdict}" day.

LIVE INDEX DATA: S&P 500 {sp.get('pct')}, Nasdaq {nq.get('pct')}, Dow {dj.get('pct')}.
REAL SECTOR MOVES (reference these, do NOT invent numbers): {sector_txt}
RECENT NEWS HEADLINES:
{news}

Write a market summary. Return ONLY this JSON:
{{
  "lead": "<ONE short sentence, max 22 words: the verdict + biggest driver, plain English>",
  "brief": "<1 sentence with the key index moves in words>",
  "narrative": "PARA1\\n\\nPARA2 — 2 short paragraphs telling the day in full. Use ONLY facts above; never invent figures.",
  "tiles": [
    {{"icon":"📈","label":"Big mover",  "value":"<name/move if in news, else 'Mixed'>","sub":"<1 line>","subUp":true}},
    {{"icon":"💰","label":"Key data",   "value":"<data point from news or 'None today'>","sub":"<context>","subUp":true}},
    {{"icon":"🏛","label":"Backdrop",   "value":"<Risk-on/Risk-off/Mixed>","sub":"<1 line>","subUp":true}}
  ],
  "watch": "<one sentence, max 22 words, key thing to watch tomorrow>"
}}"""

    ai = call_claude_cached(prompt, max_tokens=700)
    return {
        "verdict":  verdict,
        "headline": ai.get("lead", ""),
        "lead":     ai.get("lead", ""),
        "brief":    ai.get("brief", ""),
        "narrative": ai.get("narrative", ""),
        "indices":  indices,
        "sectors":  sectors,
        "tiles":    ai.get("tiles", []),
        "watch":    ai.get("watch", ""),
    }


def save_summary(market: str, data: dict):
    """Persist the legacy columns to the DB (best effort; JSON is the source of truth)."""
    table = "indian_market_summary" if market == "indian" else "us_market_summary"
    row   = {
        "headline":   data.get("headline", ""),
        "indices":    data.get("indices", []),
        "tiles":      data.get("tiles", []),
        "sectors":    data.get("sectors", []),
        "watch":      data.get("watch", ""),
        "updated_at": datetime.utcnow().isoformat(),
    }
    try:
        existing = supabase.table(table).select("id").limit(1).execute()
        if existing.data:
            supabase.table(table).update(row).eq("id", existing.data[0]["id"]).execute()
        else:
            supabase.table(table).insert(row).execute()
        print(f"  ✅ Saved legacy row to {table}")
    except Exception as e:
        print(f"  ⚠️  DB save skipped ({table}): {e}")


def save_to_json(indian: dict, us: dict):
    """Write the FULL summaries (incl. verdict/brief/narrative) straight to JSON."""
    now = datetime.utcnow().isoformat()
    indian = {**indian, "updated_at": now}
    us     = {**us,     "updated_at": now}
    os.makedirs("public", exist_ok=True)
    with open("public/market-data.json", "w") as f:
        json.dump({"indian": indian, "us": us}, f)
    print("  ✅ Saved to public/market-data.json")


if __name__ == "__main__":
    print("=" * 50)
    print("📊 Generating market summaries (Haiku 4.5, cached)")
    print("   Estimated cost: ~$0.006 total for both summaries")
    print("=" * 50)

    indian, us = {}, {}
    print("\n🇮🇳 Generating Indian market summary...")
    try:
        indian = generate_indian_summary()
        save_summary("indian", indian)
        print(f"  Verdict: {indian.get('verdict')} | {indian.get('lead')}")
    except Exception as e:
        print(f"  ❌ Indian summary failed: {e}")

    print("\n🇺🇸 Generating US market summary...")
    try:
        us = generate_us_summary()
        save_summary("us", us)
        print(f"  Verdict: {us.get('verdict')} | {us.get('lead')}")
    except Exception as e:
        print(f"  ❌ US summary failed: {e}")

    print("\n💾 Saving to JSON...")
    try:
        save_to_json(indian, us)
    except Exception as e:
        print(f"  ❌ JSON save failed: {e}")

    print("\n✅ Done! Estimated spend: ~$0.006")