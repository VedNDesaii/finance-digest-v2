import anthropic
import json
import yfinance as yf
from supabase import create_client
from dotenv import load_dotenv
from datetime import datetime
import os

load_dotenv(override=True)

SUPABASE_URL  = os.getenv("SUPABASE_URL")
SUPABASE_KEY  = os.getenv("SUPABASE_KEY")
ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY").strip().replace("\n", "").replace("\r", "")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
client   = anthropic.Anthropic(api_key=ANTHROPIC_KEY)

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
                    "up":     change >= 0,
                }
            elif len(hist) == 1:
                curr = hist["Close"].iloc[-1]
                results[name] = {"value": f"{curr:,.0f}", "change": "▲ 0", "pct": "0.00%", "up": True}
        except Exception as e:
            print(f"  ⚠️  Could not fetch {name} ({symbol}): {e}")
            results[name] = {"value": "N/A", "change": "N/A", "pct": "N/A", "up": True}
    return results


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
        model="claude-haiku-4-5-20251001",
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
    articles = get_recent_articles(["indian-markets", "banking-finance", "macro-policy"])
    news     = "\n".join(f"- {a['title']}: {a['simplified_article'][:180]}" for a in articles)
    today    = datetime.now().strftime("%d %B %Y")

    s = prices.get("Sensex",    {})
    n = prices.get("Nifty 50",  {})
    b = prices.get("Bank Nifty",{})

    prompt = f"""Today is {today}.

LIVE INDIAN MARKET DATA (use these exact values in the indices array):
Sensex:     {s.get('value')} | {s.get('change')} | {s.get('pct')} | up={s.get('up')}
Nifty 50:   {n.get('value')} | {n.get('change')} | {n.get('pct')} | up={n.get('up')}
Bank Nifty: {b.get('value')} | {b.get('change')} | {b.get('pct')} | up={b.get('up')}

RECENT NEWS HEADLINES:
{news}

Return ONLY this JSON (fill headline, tiles, sectors, watch using the news above — keep indices exactly as given):
{{
  "headline": "<one sentence, max 30 words, summarising today's Indian market mood and key driver>",
  "indices": [
    {{"label":"Sensex",    "value":"{s.get('value')}","change":"{s.get('change')}","pct":"{s.get('pct')}","up":{str(s.get('up',True)).lower()}}},
    {{"label":"Nifty 50",  "value":"{n.get('value')}","change":"{n.get('change')}","pct":"{n.get('pct')}","up":{str(n.get('up',True)).lower()}}},
    {{"label":"Bank Nifty","value":"{b.get('value')}","change":"{b.get('change')}","pct":"{b.get('pct')}","up":{str(b.get('up',True)).lower()}}}
  ],
  "tiles": [
    {{"icon":"🌍","label":"Global Cues",  "value":"<Weak/Mixed/Strong>","sub":"<1 line US futures context>","subUp":false}},
    {{"icon":"🏦","label":"FII Activity", "value":"<Bought/Sold ₹X Cr>","sub":"<context>","subUp":null}},
    {{"icon":"🛢","label":"Crude Oil",    "value":"$<price>/bbl","sub":"<▲/▼ move today>","subUp":false}}
  ],
  "sectors": [
    {{"name":"Banking","pct":0.0}},
    {{"name":"IT",     "pct":0.0}},
    {{"name":"Auto",   "pct":0.0}},
    {{"name":"FMCG",   "pct":0.0}}
  ],
  "watch": "<one sentence, max 25 words, one key thing to watch tomorrow>"
}}"""

    return call_claude_cached(prompt, max_tokens=800)


def generate_us_summary() -> dict:
    print("  Fetching live US prices...")
    prices   = fetch_prices({"S&P 500": "^GSPC", "Nasdaq": "^IXIC", "Dow Jones": "^DJI"})
    articles = get_recent_articles(["us-markets", "global-economy", "technology-it"])
    news     = "\n".join(f"- {a['title']}: {a['simplified_article'][:180]}" for a in articles)
    today    = datetime.now().strftime("%d %B %Y")

    sp = prices.get("S&P 500",  {})
    nq = prices.get("Nasdaq",   {})
    dj = prices.get("Dow Jones",{})

    prompt = f"""Today is {today}.

LIVE US MARKET DATA (use these exact values in the indices array):
S&P 500:   {sp.get('value')} | {sp.get('change')} | {sp.get('pct')} | up={sp.get('up')}
Nasdaq:    {nq.get('value')} | {nq.get('change')} | {nq.get('pct')} | up={nq.get('up')}
Dow Jones: {dj.get('value')} | {dj.get('change')} | {dj.get('pct')} | up={dj.get('up')}

RECENT NEWS HEADLINES:
{news}

Return ONLY this JSON (fill headline, tiles, sectors, watch using the news above — keep indices exactly as given):
{{
  "headline": "<one sentence, max 30 words, summarising today's US market mood and key driver>",
  "indices": [
    {{"label":"S&P 500",  "value":"{sp.get('value')}","change":"{sp.get('change')}","pct":"{sp.get('pct')}","up":{str(sp.get('up',True)).lower()}}},
    {{"label":"Nasdaq",   "value":"{nq.get('value')}","change":"{nq.get('change')}","pct":"{nq.get('pct')}","up":{str(nq.get('up',True)).lower()}}},
    {{"label":"Dow Jones","value":"{dj.get('value')}","change":"{dj.get('change')}","pct":"{dj.get('pct')}","up":{str(dj.get('up',True)).lower()}}}
  ],
  "tiles": [
    {{"icon":"📈","label":"Big Mover",  "value":"<TICKER +X%>","sub":"<1 line reason>","subUp":true}},
    {{"icon":"💰","label":"Key Data",   "value":"<data point>","sub":"<context>","subUp":true}},
    {{"icon":"🏛", "label":"10yr Yield","value":"<X.XX%>","sub":"<▲/▼ move>","subUp":true}}
  ],
  "sectors": [
    {{"name":"Tech",       "pct":0.0}},
    {{"name":"Energy",     "pct":0.0}},
    {{"name":"Financials", "pct":0.0}},
    {{"name":"Healthcare", "pct":0.0}}
  ],
  "watch": "<one sentence, max 25 words, one key thing to watch tomorrow>"
}}"""

    return call_claude_cached(prompt, max_tokens=800)


def save_summary(market: str, data: dict):
    table = "indian_market_summary" if market == "indian" else "us_market_summary"
    row   = {
        "headline":   data["headline"],
        "indices":    data["indices"],
        "tiles":      data["tiles"],
        "sectors":    data["sectors"],
        "watch":      data["watch"],
        "updated_at": datetime.utcnow().isoformat(),
    }
    existing = supabase.table(table).select("id").limit(1).execute()
    if existing.data:
        supabase.table(table).update(row).eq("id", existing.data[0]["id"]).execute()
        print(f"  ✅ Updated {table}")
    else:
        supabase.table(table).insert(row).execute()
        print(f"  ✅ Inserted into {table}")


def save_to_json():
    indian = supabase.table("indian_market_summary").select("*").order("updated_at", desc=True).limit(1).execute()
    us     = supabase.table("us_market_summary").select("*").order("updated_at", desc=True).limit(1).execute()
    out    = {
        "indian": indian.data[0] if indian.data else {},
        "us":     us.data[0]     if us.data     else {},
    }
    os.makedirs("public", exist_ok=True)
    with open("public/market-data.json", "w") as f:
        json.dump(out, f)
    print("  ✅ Saved to public/market-data.json")


if __name__ == "__main__":
    total_cost = 0.0

    print("=" * 50)
    print("📊 Generating market summaries (Haiku 4.5, cached)")
    print(f"   Estimated cost: ~$0.005 total for both summaries")
    print("=" * 50)

    print("\n🇮🇳 Generating Indian market summary...")
    try:
        indian = generate_indian_summary()
        save_summary("indian", indian)
        print(f"  Headline: {indian['headline']}")
    except Exception as e:
        print(f"  ❌ Indian summary failed: {e}")

    print("\n🇺🇸 Generating US market summary...")
    try:
        us = generate_us_summary()
        save_summary("us", us)
        print(f"  Headline: {us['headline']}")
    except Exception as e:
        print(f"  ❌ US summary failed: {e}")

    print("\n💾 Saving to JSON...")
    try:
        save_to_json()
    except Exception as e:
        print(f"  ❌ JSON save failed: {e}")

    print("\n✅ Done! Estimated spend: ~$0.005")