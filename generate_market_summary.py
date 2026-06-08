import anthropic
import json
from supabase import create_client
from dotenv import load_dotenv
from datetime import datetime
import os

load_dotenv()
SUPABASE_URL  = os.getenv("SUPABASE_URL")
SUPABASE_KEY  = os.getenv("SUPABASE_KEY")
ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY").strip().replace("\n", "").replace("\r", "").replace('\n', '').replace('\r', '')
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
client   = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
MARKET_BUDGET = 0.28
COST_PER_CALL = 0.002
running_cost  = 0.0

def get_recent_articles(categories, limit=5):
    articles = []
    for cat in categories:
        result = supabase.table("processed_articles") \
            .select("title, simplified_article") \
            .eq("category", cat) \
            .order("created_at", desc=True) \
            .limit(limit) \
            .execute()
        articles += result.data or []
    return articles[:15]

def generate_indian_summary():
    articles = get_recent_articles(["indian-markets", "banking-finance", "macro-policy"])
    articles_text = "\n".join([f"- {a['title']}: {a['simplified_article'][:200]}" for a in articles])

    prompt = f"""Based on these recent Indian financial news articles, generate a market summary card in JSON.

Articles:
{articles_text}

Return ONLY this exact JSON structure, no markdown:
{{
  "headline": "One sentence, max 30 words, factual summary of what drove Indian markets today",
  "indices": [
    {{"label": "Sensex",     "value": "81,234", "change": "▲ 312", "pct": "+0.38%", "up": true}},
    {{"label": "Nifty 50",   "value": "24,678", "change": "▼ 94",  "pct": "-0.38%", "up": false}},
    {{"label": "Bank Nifty", "value": "52,110", "change": "▲ 128", "pct": "+0.25%", "up": true}}
  ],
  "tiles": [
    {{"icon": "🌍", "label": "Global Cues",  "value": "Weak",           "sub": "US Futures -0.4%", "subUp": false}},
    {{"icon": "🏦", "label": "FII Activity", "value": "Sold ₹2,100 Cr","sub": "3rd day selling",   "subUp": null}},
    {{"icon": "🛢",  "label": "Crude Oil",   "value": "$84.2 / bbl",    "sub": "Up 1.2% today",    "subUp": false}}
  ],
  "sectors": [
    {{"name": "Banking", "pct": 0.3}},
    {{"name": "IT",      "pct": -1.1}},
    {{"name": "Auto",    "pct": -0.8}},
    {{"name": "FMCG",    "pct": 0.2}}
  ],
  "watch": "One sentence max 25 words about what to watch tomorrow for Indian markets"
}}

Fill all values based on the news articles. Use realistic numbers. Keep it factual."""

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=900,
        messages=[{"role": "user", "content": prompt}]
    )
    text = message.content[0].text.strip()
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"): text = text[4:]
    return json.loads(text.strip())

def generate_us_summary():
    articles = get_recent_articles(["us-markets", "global-economy", "technology-it"])
    articles_text = "\n".join([f"- {a['title']}: {a['simplified_article'][:200]}" for a in articles])

    prompt = f"""Based on these recent US financial news articles, generate a market summary card in JSON.

Articles:
{articles_text}

Return ONLY this exact JSON structure, no markdown:
{{
  "headline": "One sentence, max 30 words, factual summary of what drove US markets today",
  "indices": [
    {{"label": "S&P 500",   "value": "5,304",  "change": "▲ 38",  "pct": "+0.72%", "up": true}},
    {{"label": "Nasdaq",    "value": "16,780", "change": "▲ 142", "pct": "+0.85%", "up": true}},
    {{"label": "Dow Jones", "value": "39,112", "change": "▲ 210", "pct": "+0.54%", "up": true}}
  ],
  "tiles": [
    {{"icon": "📈", "label": "Big Mover",  "value": "Nvidia +9%", "sub": "Record earnings",      "subUp": true}},
    {{"icon": "💰", "label": "Inflation",  "value": "CPI 3.1%",   "sub": "Better than expected", "subUp": true}},
    {{"icon": "🏛",  "label": "10yr Yield","value": "4.42%",      "sub": "Fell 6 bps",           "subUp": true}}
  ],
  "sectors": [
    {{"name": "Tech",       "pct": 1.4}},
    {{"name": "Energy",     "pct": -0.5}},
    {{"name": "Financials", "pct": 0.7}},
    {{"name": "Healthcare", "pct": 0.3}}
  ],
  "watch": "One sentence max 25 words about what to watch tonight for US markets"
}}

Fill all values based on the news articles. Use realistic numbers. Keep it factual."""

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=900,
        messages=[{"role": "user", "content": prompt}]
    )
    text = message.content[0].text.strip()
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"): text = text[4:]
    return json.loads(text.strip())

def save_summary(market, data):
    table = "indian_market_summary" if market == "indian" else "us_market_summary"
    row = {
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
        print(f"✅ Updated {table}")
    else:
        supabase.table(table).insert(row).execute()
        print(f"✅ Inserted into {table}")

if __name__ == "__main__":
    print("Generating Indian market summary...")
    try:
        indian = generate_indian_summary()
        save_summary("indian", indian)
        print("Headline:", indian["headline"])
    except Exception as e:
        print(f"❌ Indian summary failed: {e}")

    print("\nGenerating US market summary...")
    try:
        us = generate_us_summary()
        save_summary("us", us)
        print("Headline:", us["headline"])
    except Exception as e:
        print(f"❌ US summary failed: {e}")

    print("\n✅ Done!")
