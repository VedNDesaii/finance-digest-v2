import anthropic
import json
import re
from supabase import create_client
from datetime import datetime, date, timedelta, timezone
from dotenv import load_dotenv
import os

load_dotenv()

SUPABASE_URL  = os.getenv("SUPABASE_URL")
SUPABASE_KEY  = os.getenv("SUPABASE_KEY")
ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
client   = anthropic.Anthropic(api_key=ANTHROPIC_KEY)

import feedparser
import httpx
from bs4 import BeautifulSoup


# ═══════════════════════════════════════════════════════════════
# LAYER 1 — RSS HARVEST
# ═══════════════════════════════════════════════════════════════

RSS_FEEDS = [
    "https://economictimes.indiatimes.com/rssfeedstopstories.cms",
    "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
    "https://economictimes.indiatimes.com/industry/rssfeeds/13352306.cms",
    "https://economictimes.indiatimes.com/tech/technology/rssfeeds/13357270.cms",
    "https://economictimes.indiatimes.com/markets/stocks/rssfeeds/2143429.cms",
    "https://economictimes.indiatimes.com/industry/banking/finance/rssfeeds/13358319.cms",
    "https://www.business-standard.com/rss/markets-106.rss",
    "https://www.livemint.com/rss/markets",
    "https://www.thehindubusinessline.com/feeder/default.rss",
    "https://www.ft.com/rss/home/india",
]


def fetch_rss_headlines():
    """Layer 1: Fetch latest headlines from top financial RSS feeds."""
    headlines = []
    for url in RSS_FEEDS:
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries[:15]:
                headlines.append({
                    "title":   entry.get("title", ""),
                    "content": entry.get("summary", entry.get("description", "")),
                    "source":  feed.feed.get("title", url),
                    "link":    entry.get("link", ""),
                })
        except Exception as e:
            print(f"  ⚠️  RSS fetch failed for {url}: {e}")

    print(f"  📡 Layer 1 — Harvested {len(headlines)} headlines from RSS feeds")
    return headlines


# ═══════════════════════════════════════════════════════════════
# LAYER 2 — MANDATORY DAILY SEARCHES
# ═══════════════════════════════════════════════════════════════

DAILY_MANDATORY = [
    "RBI announcement decision today",
    "SEBI order regulation today",
    "India GDP inflation IIP data today",
    "India external debt RBI data today",
    "major Indian company acquisition today",
    "Nifty Sensex crash rally today",
    "crude oil India impact today",
    "US Fed India impact today",
    "India US trade tariff today",
    "NSE BSE IPO listing today",
    "India nuclear energy policy today",
    "India LPG energy security today",
    "India IT sector earnings warning today",
]


def run_mandatory_searches(client):
    """Layer 2: Force-search critical topics daily regardless of RSS."""
    print("\n🔒 Layer 2 — Running mandatory daily searches...")
    headlines = []

    for query in DAILY_MANDATORY:
        try:
            message = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=300,
                tools=[{"type": "web_search_20250305", "name": "web_search"}],
                messages=[{
                    "role": "user",
                    "content": (
                        f"Search for: {query}. Return the single most important "
                        f"headline and a 2 sentence summary. JSON only, no markdown: "
                        f'{{"title": "", "summary": "", "relevant": true}}'
                    )
                }]
            )
            for block in message.content:
                if block.type == "text":
                    text = block.text.strip()
                    if text.startswith("```"):
                        text = text.split("```")[1]
                        if text.startswith("json"):
                            text = text[4:]
                        text = text.strip()
                    data = json.loads(text)
                    if data.get("relevant") and data.get("title"):
                        headlines.append({
                            "title":   data["title"],
                            "content": data.get("summary", ""),
                            "source":  "Mandatory Search",
                            "link":    "",
                        })
                        print(f"  🔒 Mandatory: {data['title'][:60]}...")
        except Exception as e:
            print(f"  ⚠️  Mandatory search failed for '{query}': {e}")

    print(f"  ✅ Layer 2 — Found {len(headlines)} stories")
    return headlines


# ═══════════════════════════════════════════════════════════════
# LAYER 3 — HOMEPAGE SCRAPE
# ═══════════════════════════════════════════════════════════════

HOMEPAGES = [
    {
        "url": "https://economictimes.indiatimes.com/markets",
        "selector": "h3.story-title, h2.story-title, a.story-title",
        "source": "Economic Times"
    },
    {
        "url": "https://economictimes.indiatimes.com/industry",
        "selector": "h3.story-title, h2.story-title, a.story-title",
        "source": "Economic Times Industry"
    },
    {
        "url": "https://www.livemint.com/market",
        "selector": "h2.headline, h2",
        "source": "Mint"
    },
    {
        "url": "https://www.business-standard.com/markets",
        "selector": "h2.headline, h3.headline",
        "source": "Business Standard"
    },
]


def scrape_homepages():
    """Layer 3: Directly scrape homepage headlines as final safety net."""
    headlines = []
    headers = {"User-Agent": "Mozilla/5.0 (compatible; FinanceDigestBot/1.0)"}

    for site in HOMEPAGES:
        try:
            resp = httpx.get(site["url"], headers=headers, timeout=10)
            soup = BeautifulSoup(resp.text, "html.parser")
            tags = soup.select(site["selector"])
            count = 0
            for tag in tags[:20]:
                text = tag.get_text(strip=True)
                link_tag = tag if tag.name == "a" else tag.find("a")
                href = link_tag["href"] if link_tag and link_tag.has_attr("href") else ""
                if text and len(text) > 20:
                    headlines.append({
                        "title":   text,
                        "content": text,
                        "source":  site["source"],
                        "link":    href,
                    })
                    count += 1
            print(f"  🌐 {site['source']}: {count} headlines scraped")
        except Exception as e:
            print(f"  ⚠️  Scrape failed for {site['url']}: {e}")

    print(f"  🌐 Layer 3 — Scraped {len(headlines)} homepage headlines")
    return headlines


# ═══════════════════════════════════════════════════════════════
# LAYER 4 — DYNAMIC WATCHLIST (PERMANENT FIX)
# Asks Claude to generate today's must-search topics based on
# what's actively developing — catches named-company stories
# that RSS and fixed searches never find.
# ═══════════════════════════════════════════════════════════════

def generate_dynamic_watchlist(client):
    """Ask Claude to generate today's must-search topics dynamically."""
    today = date.today().strftime("%B %d, %Y")

    prompt = f"""You are a senior financial editor for Finance Digest,
an Indian financial news platform for retail investors.

List the 20 most important stories, companies, and developing situations
that Indian investors must track TODAY — {today}.

Think about:
- Named Indian companies with recent major news (results, M&A, CEO changes,
  regulatory action, order wins, earnings warnings, block deals)
- Active RBI/SEBI/government policy developments
- Macro data releases due this week (IIP, CPI, GDP, trade data, fiscal deficit)
- Global events with direct India market impact (oil, Fed, US-India trade,
  geopolitical events affecting Indian exports/imports)
- Sectors under pressure or momentum (earnings season, regulatory cycle,
  monsoon impact, energy policy)
- Ongoing sagas needing daily tracking (HDFC leadership, NSE IPO,
  Adani developments, US-Iran ceasefire, India-China trade, IT sector warnings)
- FII/DII flow trends and block deal activity

Return ONLY a JSON array of 20 specific search queries, each under 8 words.
No markdown, no explanation, no preamble.

Example format:
["KPIT Technologies revenue warning IT sector", "Kotak Deutsche Bank acquisition details"]"""

    try:
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}]
        )

        text = message.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()

        queries = json.loads(text)
        print(f"  🧠 Dynamic watchlist: {len(queries)} topics generated")
        return queries

    except Exception as e:
        print(f"  ⚠️  Watchlist generation failed: {e}")
        return []


def run_dynamic_watchlist(client, supabase,
                          existing_titles_data,
                          is_duplicate_story_fn):
    """Layer 4: Search every topic on today's dynamic watchlist."""
    print("\n🧠 Layer 4 — Dynamic Watchlist")
    print("=" * 50)

    queries = generate_dynamic_watchlist(client)
    if not queries:
        print("  ⚠️  No watchlist queries generated, skipping.")
        return 0

    injected = 0

    existing_raw = supabase.table("raw_articles").select("title").execute()
    existing_raw_titles = {
        r["title"].lower().strip() for r in existing_raw.data
    }
    seen_in_batch = set()

    for query in queries:
        try:
            message = client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=400,
                tools=[{"type": "web_search_20250305",
                        "name": "web_search"}],
                messages=[{
                    "role": "user",
                    "content": (
                        f"Search for the latest news on: {query}. "
                        f"Find the single most important and recent story. "
                        f"Return JSON only, no markdown: "
                        f'{{"title": "", "summary": "", "source": "", '
                        f'"relevant": true}}'
                    )
                }]
            )

            for block in message.content:
                if block.type == "text":
                    text = block.text.strip()
                    if text.startswith("```"):
                        text = text.split("```")[1]
                        if text.startswith("json"):
                            text = text[4:]
                        text = text.strip()

                    data = json.loads(text)

                    if not data.get("relevant"):
                        continue

                    title   = data.get("title", "").strip()
                    summary = data.get("summary", "").strip()

                    if not title or len(title) < 15:
                        continue
                    if title.lower() in existing_raw_titles:
                        continue
                    if title.lower() in seen_in_batch:
                        continue
                    if is_duplicate_story_fn(title, existing_titles_data):
                        continue

                    supabase.table("raw_articles").insert({
                        "title":    title,
                        "content":  summary if summary else title,
                        "source":   data.get("source", "Dynamic Watchlist"),
                        "url":      "",
                        "category": "indian-markets",
                    }).execute()

                    existing_raw_titles.add(title.lower())
                    seen_in_batch.add(title.lower())
                    injected += 1
                    print(f"  💉 Watchlist: {title[:65]}...")

        except Exception as e:
            print(f"  ⚠️  Watchlist search failed for '{query}': {e}")

    print(f"\n  ✅ Layer 4 — Injected {injected} watchlist stories")
    return injected


# ═══════════════════════════════════════════════════════════════
# SCORING + INJECTION (for Layers 1, 2, 3)
# ═══════════════════════════════════════════════════════════════

def score_headline_importance(client, title, summary):
    """Use Haiku to score if this headline is important enough to force-cover."""
    prompt = f"""You are a financial editor for Indian retail investors.

Score this headline 1-10. Return ONLY JSON, no markdown.

Score 8-10 (must publish) if:
- Named Indian company: acquisition, CEO change, fraud, major results, IPO >₹500cr
- RBI or SEBI announcement
- India macro data: GDP, inflation, IIP, trade deficit, external debt
- Direct India impact: oil price spike, US-India trade, Fed decision
- Market structure: exchange news, FII flows data, block deals
- Energy/nuclear/defence policy with named companies

Score 4-7 (publish if relevant):
- Indian sector trend with named companies
- Global macro with India linkage

Score 1-3 (skip):
- US/global lifestyle with zero India angle
- Pure opinion, no new facts
- Sports, celebrity, crime unrelated to markets

Return ONLY: {{"score": 7, "category": "banking-finance", "reason": "one line"}}

Title: {title}
Summary: {summary[:300]}"""

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=100,
        messages=[{"role": "user", "content": prompt}]
    )
    text = message.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    return json.loads(text)


def inject_important_headlines(client, supabase, headlines,
                               existing_titles_data,
                               is_duplicate_story_fn):
    """Score all headlines from Layers 1-3, inject important ones."""
    injected = 0
    scoring_cost = 0.0
    HAIKU_COST_PER_SCORE = 0.0001

    print(f"\n🔍 Scoring {len(headlines)} headlines from Layers 1-3...")

    existing_raw = supabase.table("raw_articles").select("title").execute()
    existing_raw_titles = {
        r["title"].lower().strip() for r in existing_raw.data
    }
    seen_in_batch = set()

    for h in headlines:
        title   = h["title"].strip()
        content = h["content"].strip()

        if not title or len(title) < 15:
            continue
        if title.lower() in existing_raw_titles:
            continue
        if title.lower() in seen_in_batch:
            continue
        if is_duplicate_story_fn(title, existing_titles_data):
            continue

        try:
            scored = score_headline_importance(client, title, content)
            scoring_cost += HAIKU_COST_PER_SCORE

            score    = scored.get("score", 0)
            category = scored.get("category", "indian-markets")

            if score >= 7:
                supabase.table("raw_articles").insert({
                    "title":    title,
                    "content":  content if len(content) > 50 else title,
                    "source":   h["source"],
                    "url":      h.get("link", ""),
                    "category": category,
                }).execute()

                seen_in_batch.add(title.lower())
                injected += 1
                print(f"  💉 Injected [{score}/10] [{category}] {title[:60]}...")
            else:
                print(f"  ⏭️  Skipped [{score}/10] {title[:60]}...")

        except Exception as e:
            print(f"  ❌ Score error on '{title[:40]}...': {e}")

    print(f"\n  ✅ Injected {injected} stories | Scoring cost: ${scoring_cost:.4f}")
    return injected


# ═══════════════════════════════════════════════════════════════
# MASTER PRE-PASS — runs all 4 layers before Pass 1
# ═══════════════════════════════════════════════════════════════

def run_prepass(client, supabase, existing_titles_data,
                is_duplicate_story_fn):
    """Runs all 4 layers and injects important headlines into raw_articles."""
    print("\n" + "=" * 50)
    print("PRE-PASS — Four-Layer News Coverage")
    print("=" * 50)

    # Layers 1, 2, 3 — harvest and score
    all_headlines = []
    all_headlines += fetch_rss_headlines()         # Layer 1
    all_headlines += scrape_homepages()             # Layer 3
    all_headlines += run_mandatory_searches(client) # Layer 2

    inject_important_headlines(
        client, supabase, all_headlines,
        existing_titles_data, is_duplicate_story_fn
    )

    # Layer 4 — dynamic watchlist (permanent fix for named-company gaps)
    run_dynamic_watchlist(
        client, supabase,
        existing_titles_data,
        is_duplicate_story_fn
    )

    print("=" * 50)


# ═══════════════════════════════════════════════════════════════
# BUDGET GUARD
# ═══════════════════════════════════════════════════════════════

COST_PER_M_INPUT  = 0.80
COST_PER_M_OUTPUT = 4.00
DAILY_BUDGET      = 0.88
AVG_INPUT_TOKENS  = 800
AVG_OUTPUT_TOKENS = 300
COST_PER_ARTICLE  = (AVG_INPUT_TOKENS / 1_000_000) * COST_PER_M_INPUT + (AVG_OUTPUT_TOKENS / 1_000_000) * COST_PER_M_OUTPUT

CATEGORY_LIMITS = {
    "indian-markets":  12,
    "us-markets":      12,
    "global-economy":  10,
    "banking-finance": 12,
    "macro-policy":    10,
    "technology-it":   7,
    "pharma-health":   7,
    "auto-ev":         7,
    "energy-oil":      7,
    "metals-mining":   6,
    "infrastructure":  6,
    "fmcg-consumer":   6,
    "renewables":      6,
    "real-estate":     6,
    "telecom-media":   6,
}

CATEGORY_MINIMUMS = {
    "indian-markets":  10,
    "us-markets":      10,
    "global-economy":  8,
    "banking-finance": 10,
    "macro-policy":    8,
    "technology-it":   6,
    "pharma-health":   6,
    "auto-ev":         6,
    "energy-oil":      6,
    "metals-mining":   5,
    "infrastructure":  5,
    "fmcg-consumer":   5,
    "renewables":      5,
    "real-estate":     5,
    "telecom-media":   5,
}

CATEGORIES = list(CATEGORY_LIMITS.keys())

CATEGORY_KEYWORDS = {
    "indian-markets":  "Sensex, Nifty, BSE, NSE, Indian stocks, Dalal Street, Indian IPO, FII, DII, rupee vs dollar, SEBI, RBI rate, Nifty Bank",
    "us-markets":      "S&P 500, Dow Jones, NASDAQ, NYSE, Fed rate, US stocks, Wall Street, US IPO, dollar index, US Treasury, US earnings",
    "global-economy":  "IMF, World Bank, global GDP, trade war, sanctions, WTO, G7, G20, emerging markets, global inflation, geopolitics impact on economy",
    "banking-finance": "bank earnings, NPA, credit growth, NBFC, RBI policy, lending rate, insurance, fintech, loan, deposit rate, SBI, HDFC Bank, ICICI Bank",
    "macro-policy":    "CPI inflation, WPI, GDP data, IIP, fiscal deficit, government budget, tax policy, government scheme, RBI MPC, unemployment rate",
    "technology-it":   "TCS, Infosys, Wipro, HCL Tech, IT sector, software exports, AI startup, chip, semiconductor, tech layoffs, SaaS, tech IPO",
    "pharma-health":   "pharma company, drug approval, USFDA, clinical trial, hospital, health policy, API, generic drug, Cipla, Sun Pharma, Dr Reddy",
    "auto-ev":         "car sales, two-wheeler, EV policy, electric vehicle, battery, Maruti, Tata Motors, Bajaj, Hero, auto sector, EV subsidy",
    "energy-oil":      "crude oil, Brent, WTI, OPEC, petroleum, natural gas, LNG, ONGC, Reliance oil, fuel price, energy sector",
    "metals-mining":   "steel, aluminium, copper, iron ore, zinc, Tata Steel, JSW, Hindalco, Vedanta, coal, mining, metal prices",
    "infrastructure":  "roads, highways, NHAI, ports, airport, railway, construction, government capex, infra spending, L&T, NIP",
    "fmcg-consumer":   "HUL, Nestle, ITC, Dabur, Marico, FMCG sales, rural consumption, consumer goods, retail demand, FMCG earnings",
    "renewables":      "solar, wind energy, green hydrogen, renewable energy, EV charging, clean energy, NTPC Renewable, Adani Green, ReNew",
    "real-estate":     "housing sales, property prices, REIT, mortgage, home loan, residential demand, commercial property, DLF, Godrej Properties",
    "telecom-media":   "Jio, Airtel, Vi, BSNL, spectrum, 5G, OTT, streaming, telecom tariff, media merger, broadband",
}


# ═══════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════

def get_category_counts():
    counts = {cat: 0 for cat in CATEGORIES}
    result = supabase.table("processed_articles").select("category").execute()
    for row in result.data:
        cat = row.get("category")
        if cat in counts:
            counts[cat] += 1
    return counts


def enforce_per_category_limit():
    print("\n🔢 Enforcing per-category limits...")
    for category in CATEGORIES:
        limit = CATEGORY_LIMITS[category]
        articles = (
            supabase.table("processed_articles")
            .select("id")
            .eq("category", category)
            .order("created_at", desc=True)
            .execute()
        )
        if len(articles.data) > limit:
            ids_to_delete = [r["id"] for r in articles.data[limit:]]
            for aid in ids_to_delete:
                supabase.table("processed_articles").delete().eq("id", aid).execute()
            print(f"  🗑️  [{category}] Trimmed → kept {limit}")
        else:
            print(f"  ✅ [{category}] {len(articles.data)}/{limit} — OK")


def get_title_fingerprint(title):
    numbers  = {n for n in re.findall(r'\d+(?:\.\d+)?', title) if float(n) > 5}
    caps     = set(re.findall(r'\b[A-Z][a-z]{2,}\b', title))
    entities = set(re.findall(
        r'\b(rbi|sebi|nse|bse|nifty|sensex|fed|mpc|ipo|fii|dii|npa|gdp|cpi|wpi|repo|usfda|opec|imf)\b',
        title.lower()
    ))
    return numbers, caps, entities


def get_existing_titles():
    result = supabase.table("processed_articles").select("title").execute()
    titles = [r["title"] for r in result.data if r.get("title")]
    return [(t, get_title_fingerprint(t)) for t in titles]


def is_duplicate_story(title, existing_titles_data):
    n1, c1, e1 = get_title_fingerprint(title)

    def kw(t):
        t = re.sub(r'\b(the|a|an|in|on|at|to|of|for|by|as|its|with|after|amid|says|report|reports|per|cent|yoy|qoq|quarter|results|earnings|beats|misses)\b', ' ', t.lower())
        return set(w for w in re.findall(r'\b[a-z]{4,}\b', t))

    kw1 = kw(title)
    for existing_title, (n2, c2, e2) in existing_titles_data:
        if (c1 & c2) and (n1 & n2):
            return True
        if (e1 & e2) and (n1 & n2):
            return True
        kw2 = kw(existing_title)
        if kw1 and kw2 and len(kw1 & kw2) / len(kw1 | kw2) >= 0.55:
            return True
    return False


def get_unprocessed_articles():
    processed     = supabase.table("processed_articles").select("raw_article_id").execute()
    processed_ids = [p["raw_article_id"] for p in processed.data]
    raw           = supabase.table("raw_articles").select("*").execute()
    return [a for a in raw.data if a["id"] not in processed_ids]


def is_valid_output(processed_data):
    simplified = processed_data.get("simplified_article", "")
    investor   = processed_data.get("investor_take", "")
    glossary   = processed_data.get("glossary", [])
    parts = simplified.strip().split("\n\n")
    if len(parts) < 2: return False
    if len(parts[0].strip()) < 30: return False
    if len(parts[1].strip()) < 50: return False
    if len(investor.strip()) < 40: return False
    if not isinstance(glossary, list): return False
    return True


# ═══════════════════════════════════════════════════════════════
# ARTICLE PROCESSING
# ═══════════════════════════════════════════════════════════════

def process_strict(title, content, feed_category):
    category_hint = f"""
The RSS feed that supplied this article was tagged as: "{feed_category}".
Use this as a STRONG starting hint. Only override if article clearly belongs elsewhere.

Category keyword reference:
{chr(10).join(f'  • {k}: {v}' for k, v in CATEGORY_KEYWORDS.items())}
"""

    prompt = f"""You are a financial news editor for an India-based financial news platform. Your reader is a curious 16-year-old who knows what a stock market is and reads the news, but has never studied finance. Your job: filter weak articles, then write the good ones clearly.

━━━ STEP 1: FILTER ━━━
REJECT if: celebrity gossip, sports money, product ads, opinion columns, tick-by-tick intraday updates, property listings, personal lifestyle articles.
ACCEPT if ANY of these: central bank decisions, economic data (GDP/CPI/IIP), major company earnings/results, government policy, M&A/deals, commodity/currency moves, regulatory shifts, contract wins, analyst upgrades/downgrades, IPO news, company expansions, sector trends, fund flows (FII/DII), price hikes, capacity additions, new product launches with financial impact.
WHEN IN DOUBT — ACCEPT. It is better to accept a borderline article than reject a useful one.

━━━ STEP 2: CATEGORY ━━━
{category_hint}
Pick EXACTLY ONE:
  "indian-markets" | "us-markets" | "global-economy" | "technology-it" |
  "pharma-health"  | "auto-ev"    | "energy-oil"      | "metals-mining" |
  "infrastructure" | "fmcg-consumer" | "renewables"   | "real-estate"   |
  "telecom-media"  | "banking-finance" | "macro-policy"
If the story is foreign/global with no Indian company or market involved, prefer "global-economy" (or "us-markets" for US market/Fed/Wall Street news).

━━━ STEP 3: IMPORTANCE ━━━
Set is_headline: false for all articles. The briefing section auto-selects the best story per category separately.

━━━ STEP 4: WRITE ━━━
PART 1: 1 sentence, max 25 words. WHO+WHAT+number+impact.
PART 2: 4 sentences, max 110 words. Before/What/Effect/Watch.
PART 3 (MANDATORY): 2 sentences, max 40 words. Explain the likely implication for investors and why, in neutral analytical language (avoid "good/bad" verdicts). One thing to watch.
GLOSSARY: 2-3 unfamiliar terms, max 20 words each.

Return ONLY valid JSON:
REJECT: {{"verdict":"reject"}}
ACCEPT: {{"verdict":"accept","category":"<str>","is_headline":false,"simplified_article":"PART1\\n\\nPART2","investor_take":"PART3","glossary":[{{"word":"","meaning":""}}]}}

Title: {title}
Content: {content[:2000]}"""

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=900,
        messages=[{"role": "user", "content": prompt}]
    )
    text = message.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"): text = text[4:]
        text = text.strip()
    parsed = json.loads(text)
    return None if parsed.get("verdict") == "reject" else parsed


def process_relaxed(title, content, target_category):
    prompt = f"""You are filling a news section that needs more articles. Category is FIXED: "{target_category}".

ONLY reject if completely unrelated to finance or business.
ACCEPT quarterly results, company updates, sector news, price moves, analyst reports, industry data, contract wins, expansions, fund flows.
Category is FIXED as "{target_category}" — do not change it.

WRITE:
PART 1: 1 sentence, max 25 words. WHO+WHAT+number+impact.
PART 2: 4 sentences, max 110 words. Before/What/Effect/Watch.
PART 3 (MANDATORY): 2 sentences, max 40 words. Explain the likely implication for investors and why, in neutral analytical language (avoid "good/bad" verdicts). One thing to watch.
GLOSSARY: 1-2 terms max.

Return ONLY valid JSON:
REJECT: {{"verdict":"reject"}}
ACCEPT: {{"verdict":"accept","category":"{target_category}","is_headline":false,"simplified_article":"PART1\\n\\nPART2","investor_take":"PART3","glossary":[{{"word":"","meaning":""}}]}}

Title: {title}
Content: {content[:2000]}"""

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=700,
        messages=[{"role": "user", "content": prompt}]
    )
    text = message.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"): text = text[4:]
        text = text.strip()
    parsed = json.loads(text)
    return None if parsed.get("verdict") == "reject" else parsed


def save_processed_article(raw_article, processed_data):
    if not processed_data.get("investor_take"):
        processed_data["investor_take"] = "Markets may react as more details emerge."
    if not processed_data.get("glossary"):
        processed_data["glossary"] = []
    data = {
        "raw_article_id": raw_article["id"],
        "title":          raw_article["title"],
        "source":         raw_article["source"],
        "image_url":      raw_article.get("image_url"),
        "simplified_article": processed_data["simplified_article"],
        "investor_take":  processed_data.get("investor_take", ""),
        "glossary":       processed_data["glossary"],
        "category":       processed_data.get("category", "global-economy"),
        "is_headline":    False,
    }
    return supabase.table("processed_articles").insert(data).execute()


# ═══════════════════════════════════════════════════════════════
# MAIN RUN
# ═══════════════════════════════════════════════════════════════

def run():
    running_cost = 0.0

    print("=" * 50)
    print(f"💰 Daily budget: ${DAILY_BUDGET:.2f} | ~${COST_PER_ARTICLE:.4f}/article")
    print(f"   Max articles in budget: {int(DAILY_BUDGET / COST_PER_ARTICLE)}")
    print("=" * 50)

    # ════ PRE-PASS: Four-Layer Coverage ════
    existing_titles_data_early = get_existing_titles()
    run_prepass(
        client, supabase,
        existing_titles_data_early,
        is_duplicate_story
    )
    # ════ END PRE-PASS ════

    # ════ PASS 1 — Strict ════
    print("\nPASS 1 — Strict filtering")
    print("=" * 50)

    articles             = get_unprocessed_articles()
    category_counts      = get_category_counts()
    existing_titles_data = get_existing_titles()

    print(f"Found {len(articles)} unprocessed articles")
    print(f"Dedup index: {len(existing_titles_data)} existing titles")

    def sort_priority(article):
        cat   = article.get("category", "global-economy")
        count = category_counts.get(cat, 0)
        minim = CATEGORY_MINIMUMS.get(cat, 5)
        limit = CATEGORY_LIMITS.get(cat, 7)
        if count < minim:  return 0
        if count < limit:  return 1
        return 2

    articles.sort(key=sort_priority)

    accepted = rejected = skipped_full = skipped_dup = skipped_inv = 0

    for article in articles:
        if running_cost + COST_PER_ARTICLE > DAILY_BUDGET * 0.75:
            print(f"\n⚠️  Reached 75% of budget (${running_cost:.3f}). Reserving rest for top-up pass.")
            break

        title   = article["title"]
        content = article.get("content", "")

        try:
            if is_duplicate_story(title, existing_titles_data):
                skipped_dup += 1
                continue

            feed_category = article.get("category", "global-economy")

            if category_counts.get(feed_category, 0) >= CATEGORY_LIMITS.get(feed_category, 7):
                skipped_full += 1
                continue

            processed = process_strict(title, content, feed_category)
            running_cost += COST_PER_ARTICLE

            if processed is None:
                rejected += 1
                continue

            if not is_valid_output(processed):
                skipped_inv += 1
                continue

            category  = processed.get("category", feed_category)
            cat_limit = CATEGORY_LIMITS.get(category, 7)

            if category_counts.get(category, 0) >= cat_limit:
                skipped_full += 1
                continue

            save_processed_article(article, processed)
            existing_titles_data.append((title, get_title_fingerprint(title)))
            category_counts[category] = category_counts.get(category, 0) + 1

            gap    = category_counts[category] - CATEGORY_MINIMUMS.get(category, 5)
            status = "✅" if gap >= 0 else f"⚠️  {abs(gap)} below min"
            print(f"  ✓ [{category}] {category_counts[category]}/{CATEGORY_LIMITS[category]} {status} | 💰 ${running_cost:.3f}")
            accepted += 1

        except json.JSONDecodeError as e:
            running_cost += COST_PER_ARTICLE
            print(f"  ❌ JSON error: {e}")
        except Exception as e:
            print(f"  ❌ Error: {e}")

    print(f"\nPass 1 — Accepted: {accepted} | Rejected: {rejected} | Dupes blocked: {skipped_dup} | 💰 ${running_cost:.3f} spent")

    # ════ PASS 2 — Top-up ════
    under_filled = {
        cat: CATEGORY_MINIMUMS[cat] - category_counts.get(cat, 0)
        for cat in CATEGORIES
        if category_counts.get(cat, 0) < CATEGORY_MINIMUMS[cat]
    }

    if under_filled:
        print(f"\n{'=' * 50}")
        print(f"PASS 2 — Top-up for {len(under_filled)} under-filled categories")
        for cat, needed in under_filled.items():
            print(f"  • {cat}: needs {needed} more")
        print("=" * 50)

        topup_articles = get_unprocessed_articles()
        topup_accepted = 0

        for article in topup_articles:
            if not under_filled:
                break
            if running_cost + COST_PER_ARTICLE > DAILY_BUDGET:
                print(f"\n🛑 Budget limit reached (${running_cost:.3f}). Stopping.")
                break

            title    = article["title"]
            content  = article.get("content", "")
            feed_cat = article.get("category", "global-economy")

            if feed_cat not in under_filled:
                continue
            if is_duplicate_story(title, existing_titles_data):
                continue

            try:
                processed = process_relaxed(title, content, feed_cat)
                running_cost += COST_PER_ARTICLE

                if processed is None:
                    continue
                if not is_valid_output(processed):
                    continue

                category  = processed.get("category", feed_cat)
                cat_limit = CATEGORY_LIMITS.get(category, 7)

                if category_counts.get(category, 0) >= cat_limit:
                    continue

                save_processed_article(article, processed)
                existing_titles_data.append((title, get_title_fingerprint(title)))
                category_counts[category] = category_counts.get(category, 0) + 1
                topup_accepted += 1

                if category in under_filled:
                    under_filled[category] -= 1
                    if under_filled[category] <= 0:
                        del under_filled[category]
                        print(f"  ✅ [{category}] minimum reached!")

                print(f"  ↑ [{category}] {category_counts[category]}/{CATEGORY_LIMITS[category]} | 💰 ${running_cost:.3f}")

            except Exception as e:
                running_cost += COST_PER_ARTICLE
                print(f"  ❌ {e}")

        print(f"\nTop-up: +{topup_accepted} articles | 💰 ${running_cost:.3f} total")

    # ════ Final report ════
    final   = get_category_counts()
    all_met = True
    print(f"\n{'=' * 50}")
    print("FINAL COUNTS")
    print("=" * 50)
    for cat in CATEGORIES:
        count  = final.get(cat, 0)
        minim  = CATEGORY_MINIMUMS[cat]
        limit  = CATEGORY_LIMITS[cat]
        status = "✅" if count >= minim else "❌ BELOW MIN"
        print(f"  {status} [{cat}] {count}/{limit} (min {minim})")
        if count < minim:
            all_met = False

    print(f"\n{'✅ ALL MINIMUMS MET' if all_met else '⚠️  SOME STILL BELOW MIN'}")
    print(f"💰 Total cost this run: ${running_cost:.4f} / ${DAILY_BUDGET:.2f} budget")
    print(f"   Remaining: ${DAILY_BUDGET - running_cost:.4f}")
    print("=" * 50)

    enforce_per_category_limit()


if __name__ == "__main__":
    run()