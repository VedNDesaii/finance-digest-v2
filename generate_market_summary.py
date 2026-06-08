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

def fetch_indian_prices():
    tickers = {"Sensex": "^BSESN", "Nifty 50": "^NSEI", "Bank Nifty": "^NSEBANK"}
    results = {}
    for name, symbol in tickers.items():
        try:
            t = yf.Ticker(symbol)
            hist = t.history(period="2d")
            if len(hist) >= 2:
                prev, curr = hist["Close"].iloc[-2], hist["Close"].iloc[-1]
                change = curr - prev
                pct = (change / prev) * 100
                results[name] = {"value": f"{curr:,.0f}", "change": f"{'▲' if change>=0 else '▼'} {abs(change):,.0f}", "pct": f"{'+'if change>=0 else ''}{pct:.2f}%", "up": change >= 0}
            elif len(hist) == 1:
                curr = hist["Close"].iloc[-1]
                results[name] = {"value": f"{curr:,.0f}", "change": "▲ 0", "pct": "0.00%", "up": True}
        except Exception as e:
            print(f"  Warning: could not fetch {name}: {e}")
            results[name] = {"value": "N/A", "change": "N/A", "pct": "N/A", "up": True}
    return results

def fetch_us_prices():
    tickers = {"S&P 500": "^GSPC", "Nasdaq": "^IXIC", "Dow Jones": "^DJI"}
    results = {}
    for name, symbol in tickers.items():
        try:
            t = yf.Ticker(symbol)
            hist = t.history(period="2d")
            if len(hist) >= 2:
                prev, curr = hist["Close"].iloc[-2], hist["Close"].iloc[-1]
                change = curr - prev
                pct = (change / prev) * 100
                results[name] = {"value": f"{curr:,.0f}", "change": f"{'▲' if change>=0 else '▼'} {abs(change):,.0f}", "pct": f"{'+'if change>=0 else ''}{pct:.2f}%", "up": change >= 0}
            elif len(hist) == 1:
                curr = hist["Close"].iloc[-1]
                results[name] = {"value": f"{curr:,.0f}", "change": "▲ 0", "pct": "0.00%", "up": True}
        except Exception as e:
            print(f"  Warning: could not fetch {name}: {e}")
            results[name] = {"value": "N/A", "change": "N/A", "pct": "N/A", "up": True}
    return results

def get_recent_articles(categories, limit=5):
    articles = []
    for cat in categories:
        result = supabase.table("processed_articles").select("title, simplified_article").eq("category", cat).order("created_at", desc=True).limit(limit).execute()
        articles += result.data or []
    return articles[:15]

def generate_indian_summary():
    print("  Fetching live Indian prices...")
    prices = fetch_indian_prices()
    articles = get_recent_articles(["indian-markets", "banking-finance", "macro-policy"])
    articles_text = "\n".join([f"- {a['title']}: {a['simplified_article'][:200]}" for a in articles])
    today = datetime.now().strftime("%d %B %Y")
    s = prices.get("Sensex", {}); n = prices.get("Nifty 50", {}); b = prices.get("Bank Nifty", {})

    prompt = f"""Today is {today}. Real Indian market data:
Sensex: {s.get('value')} ({s.get('change')}, {s.get('pct')})
Nifty 50: {n.get('value')} ({n.get('change')}, {n.get('pct')})
Bank Nifty: {b.get('value')} ({b.get('change')}, {b.get('pct')})

Recent news:
{articles_text}

Return ONLY this JSON (no markdown, no explanation):
{{"headline":"one sentence max 30 words about today's Indian market","indices":[{{"label":"Sensex","value":"{s.get('value')}","change":"{s.get('change')}","pct":"{s.get('pct')}","up":{str(s.get('up',True)).lower()}}},{{"label":"Nifty 50","value":"{n.get('value')}","change":"{n.get('change')}","pct":"{n.get('pct')}","up":{str(n.get('up',True)).lower()}}},{{"label":"Bank Nifty","value":"{b.get('value')}","change":"{b.get('change')}","pct":"{b.get('pct')}","up":{str(b.get('up',True)).lower()}}}],"tiles":[{{"icon":"🌍","label":"Global Cues","value":"Weak or Strong","sub":"US Futures context","subUp":false}},{{"icon":"🏦","label":"FII Activity","value":"Bought/Sold ₹X Cr","sub":"context","subUp":null}},{{"icon":"🛢","label":"Crude Oil","value":"$XX / bbl","sub":"move today","subUp":false}}],"sectors":[{{"name":"Banking","pct":0.3}},{{"name":"IT","pct":-0.5}},{{"name":"Auto","pct":-0.3}},{{"name":"FMCG","pct":0.1}}],"watch":"one sentence max 25 words about tomorrow"}}

Fill headline, tiles, sectors, watch from the news. Keep indices exactly as given above."""

    message = client.messages.create(model="claude-haiku-4-5-20251001", max_tokens=1000, messages=[{"role": "user", "content": prompt}])
    text = message.content[0].text.strip()
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"): text = text[4:]
    return json.loads(text.strip())

def generate_us_summary():
    print("  Fetching live US prices...")
    prices = fetch_us_prices()
    articles = get_recent_articles(["us-markets", "global-economy", "technology-it"])
    articles_text = "\n".join([f"- {a['title']}: {a['simplified_article'][:200]}" for a in articles])
    today = datetime.now().strftime("%d %B %Y")
    sp = prices.get("S&P 500", {}); nq = prices.get("Nasdaq", {}); dj = prices.get("Dow Jones", {})

    prompt = f"""Today is {today}. Real US market data:
S&P 500: {sp.get('value')} ({sp.get('change')}, {sp.get('pct')})
Nasdaq: {nq.get('value')} ({nq.get('change')}, {nq.get('pct')})
Dow Jones: {dj.get('value')} ({dj.get('change')}, {dj.get('pct')})

Recent news:
{articles_text}

Return ONLY this JSON (no markdown, no explanation):
{{"headline":"one sentence max 30 words about today's US market","indices":[{{"label":"S&P 500","value":"{sp.get('value')}","change":"{sp.get('change')}","pct":"{sp.get('pct')}","up":{str(sp.get('up',True)).lower()}}},{{"label":"Nasdaq","value":"{nq.get('value')}","change":"{nq.get('change')}","pct":"{nq.get('pct')}","up":{str(nq.get('up',True)).lower()}}},{{"label":"Dow Jones","value":"{dj.get('value')}","change":"{dj.get('change')}","pct":"{dj.get('pct')}","up":{str(dj.get('up',True)).lower()}}}],"tiles":[{{"icon":"📈","label":"Big Mover","value":"STOCK +X%","sub":"reason","subUp":true}},{{"icon":"💰","label":"Key Data","value":"data","sub":"context","subUp":true}},{{"icon":"🏛","label":"10yr Yield","value":"X.XX%","sub":"move","subUp":true}}],"sectors":[{{"name":"Tech","pct":0.5}},{{"name":"Energy","pct":-0.3}},{{"name":"Financials","pct":0.4}},{{"name":"Healthcare","pct":0.2}}],"watch":"one sentence max 25 words about tomorrow"}}

Fill headline, tiles, sectors, watch from the news. Keep indices exactly as given above."""

    message = client.messages.create(model="claude-haiku-4-5-20251001", max_tokens=1000, messages=[{"role": "user", "content": prompt}])
    text = message.content[0].text.strip()
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"): text = text[4:]
    return json.loads(text.strip())

def save_summary(market, data):
    table = "indian_market_summary" if market == "indian" else "us_market_summary"
    row = {"headline": data["headline"], "indices": data["indices"], "tiles": data["tiles"], "sectors": data["sectors"], "watch": data["watch"], "updated_at": datetime.utcnow().isoformat()}
    existing = supabase.table(table).select("id").limit(1).execute()
    if existing.data:
        supabase.table(table).update(row).eq("id", existing.data[0]["id"]).execute()
        print(f"  ✅ Updated {table}")
    else:
        supabase.table(table).insert(row).execute()
        print(f"  ✅ Inserted into {table}")

if __name__ == "__main__":
    print("Generating Indian market summary...")
    try:
        indian = generate_indian_summary()
        save_summary("indian", indian)
        print("  Headline:", indian["headline"])
    except Exception as e:
        print(f"  ❌ Indian summary failed: {e}")

    print("\nGenerating US market summary...")
    try:
        us = generate_us_summary()
        save_summary("us", us)
        print("  Headline:", us["headline"])
    except Exception as e:
        print(f"  ❌ US summary failed: {e}")

    print("\n✅ Done!")