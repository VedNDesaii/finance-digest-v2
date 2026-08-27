import anthropic
import json
import re
from supabase import create_client
from datetime import datetime, date, timedelta, timezone
from dotenv import load_dotenv
import os

load_dotenv()

from llm import make_client, MODEL_ID, USE_BEDROCK

SUPABASE_URL  = os.getenv("SUPABASE_URL")
SUPABASE_KEY  = os.getenv("SUPABASE_KEY")

# Our own search sources, so web search works on Bedrock too (Anthropic's
# built-in web_search tool isn't available on Bedrock):
#   • Brave Search API — set BRAVE_API_KEY in .env (needs a key).
#   • DuckDuckGo — needs NO key and NO card; used automatically as a free
#     fallback whenever no Brave key is set.
BRAVE_API_KEY = (os.getenv("BRAVE_API_KEY") or "").strip()

try:                              # the library was renamed ddgs -> keep both
    from ddgs import DDGS
except Exception:
    try:
        from duckduckgo_search import DDGS
    except Exception:
        DDGS = None

HAVE_OWN_SEARCH = bool(BRAVE_API_KEY) or (DDGS is not None)   # card-free search
HAVE_SEARCH     = HAVE_OWN_SEARCH or (not USE_BEDROCK)        # +Anthropic's own tool

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
client   = make_client()   # Bedrock if AWS keys present, else Anthropic API

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


# ── WHOLE-RUN COST TRACKER ──────────────────────────────────────
# The pre-pass web searches used to run OUTSIDE the budget cap, so a run
# could cost far more than DAILY_BUDGET. Now every web search + scoring call
# adds to RUN_COST, the search phase stops at SEARCH_BUDGET, and the main
# processing loop counts RUN_COST too — so DAILY_BUDGET is a TRUE total cap.
RUN_COST         = {"spent": 0.0}
SEARCH_BUDGET    = 0.25    # hard cap on the whole pre-pass search phase

# Haiku 4.5 real pricing (per token)
_IN_RATE      = 0.80 / 1_000_000
_OUT_RATE     = 4.00 / 1_000_000
_CACHE_R_RATE = 0.08 / 1_000_000
_CACHE_W_RATE = 1.00 / 1_000_000
_SEARCH_RATE  = 0.01          # per web search request


def add_cost(message):
    """Add the REAL cost of one API call to RUN_COST, read from message.usage
    (input/output tokens + any web searches). This replaces flat estimates that
    undercounted and let runs blow past the budget."""
    try:
        u = message.usage
        cost = ((getattr(u, "input_tokens", 0) or 0)  * _IN_RATE +
                (getattr(u, "output_tokens", 0) or 0) * _OUT_RATE +
                (getattr(u, "cache_read_input_tokens", 0) or 0)     * _CACHE_R_RATE +
                (getattr(u, "cache_creation_input_tokens", 0) or 0) * _CACHE_W_RATE)
        stu = getattr(u, "server_tool_use", None)
        if stu:
            cost += (getattr(stu, "web_search_requests", 0) or 0) * _SEARCH_RATE
        RUN_COST["spent"] += cost
        return cost
    except Exception:
        RUN_COST["spent"] += 0.003   # tiny fallback so a call is never free
        return 0.003

# Optional columns that enrich each article for the "Read in full" detail page
# and the swipe card. Any that don't exist in the DB yet are simply skipped on
# insert, so a missing column never breaks the run or wastes an API call.
OPTIONAL_COLS = [
    "detailed_article", "market_impact", "what_this_means",
    "sentiment", "difficulty", "stat", "stat_label",
]
AVAILABLE_OPT_COLS = set(OPTIONAL_COLS)   # narrowed at startup by detect_optional_columns()


def detect_optional_columns():
    """Probe which optional columns exist; skip the rest on insert."""
    global AVAILABLE_OPT_COLS
    present, missing = set(), []
    for col in OPTIONAL_COLS:
        try:
            supabase.table("processed_articles").select(col).limit(1).execute()
            present.add(col)
        except Exception:
            missing.append(col)
    AVAILABLE_OPT_COLS = present
    if missing:
        print("⚠️ " * 12)
        print(f"⚠️  Missing columns in processed_articles: {', '.join(missing)}")
        print("⚠️  Articles still save & upload (without those fields — no money wasted).")
        print("⚠️  To enable the full detail page, run this once in Supabase → SQL Editor:")
        for col in missing:
            print(f"⚠️     alter table processed_articles add column if not exists {col} text;")
        print("⚠️ " * 12)


def brave_search(query, count=3, freshness="pd"):
    """Query the Brave Search API and return the top results as
    [{title, url, description}, ...]. Returns [] on any error / no key so a
    failed search never crashes the run. `freshness`: pd=past day, pw=past week."""
    if not BRAVE_API_KEY:
        return []
    try:
        resp = httpx.get(
            "https://api.search.brave.com/res/v1/web/search",
            params={
                "q": query,
                "count": count,
                "freshness": freshness,
                "country": "IN",
                "text_decorations": 0,
                "spellcheck": 0,
            },
            headers={
                "Accept": "application/json",
                "Accept-Encoding": "gzip",
                "X-Subscription-Token": BRAVE_API_KEY,
            },
            timeout=15.0,
        )
        resp.raise_for_status()
        results = (resp.json().get("web", {}) or {}).get("results", []) or []
        out = []
        for r in results[:count]:
            title = (r.get("title") or "").strip()
            if not title:
                continue
            out.append({
                "title": title,
                "url": (r.get("url") or "").strip(),
                "description": (r.get("description") or "").strip(),
            })
        return out
    except Exception as e:
        print(f"  ⚠️  Brave search failed for '{query}': {e}")
        return []


def ddg_search(query, count=3):
    """Query DuckDuckGo (no key, no card) and return the top results as
    [{title, url, description}, ...]. Tries the news endpoint first (fresher),
    falls back to text search. Returns [] on any error so a run never crashes."""
    if DDGS is None:
        return []
    try:
        out = []
        with DDGS() as ddgs:
            try:
                results = ddgs.news(query, region="in-en", max_results=count) or []
            except Exception:
                results = []
            for r in results[:count]:
                title = (r.get("title") or "").strip()
                if not title:
                    continue
                out.append({
                    "title": title,
                    "url": (r.get("url") or "").strip(),
                    "description": (r.get("body") or "").strip(),
                })
            if not out:   # news gave nothing — fall back to a plain text search
                results = ddgs.text(query, region="in-en", max_results=count) or []
                for r in results[:count]:
                    title = (r.get("title") or "").strip()
                    if not title:
                        continue
                    out.append({
                        "title": title,
                        "url": (r.get("href") or "").strip(),
                        "description": (r.get("body") or "").strip(),
                    })
        return out
    except Exception as e:
        print(f"  ⚠️  DuckDuckGo search failed for '{query}': {e}")
        return []


def search_web(query, count=3):
    """Unified search: Brave if a key is set, otherwise free DuckDuckGo."""
    if BRAVE_API_KEY:
        return brave_search(query, count=count)
    return ddg_search(query, count=count)


def run_mandatory_searches(client):
    """Layer 2: Force-search critical topics daily regardless of RSS.

    Uses Brave Search (BRAVE_API_KEY) when available — works on Bedrock too.
    Falls back to Anthropic's built-in web_search tool on the Anthropic API.
    If neither is available (Bedrock without a Brave key), the layer is skipped."""
    print("\n🔒 Layer 2 — Running mandatory daily searches...")

    # ── Preferred path: our own search (Brave or free DuckDuckGo, works on Bedrock) ──
    if HAVE_OWN_SEARCH:
        src = "Brave" if BRAVE_API_KEY else "DuckDuckGo"
        headlines, seen = [], set()
        for query in DAILY_MANDATORY:
            for r in search_web(query, count=2):
                key = r["title"].lower()
                if key in seen:
                    continue
                seen.add(key)
                headlines.append({
                    "title":   r["title"],
                    "content": r["description"],
                    "source":  "Mandatory Search",
                    "link":    r["url"],
                })
                print(f"  🔒 Mandatory: {r['title'][:60]}...")
        print(f"  ✅ Layer 2 ({src}) — Found {len(headlines)} stories")
        return headlines

    # ── No search source on Bedrock — skip, rely on RSS + scraped sources ──
    if USE_BEDROCK:
        print("  ⏭️  No search source available on Bedrock — skipping (install ddgs to enable free search).")
        return []

    # ── Fallback: Anthropic's built-in web_search tool ──
    headlines = []
    for query in DAILY_MANDATORY:
        if RUN_COST["spent"] >= SEARCH_BUDGET:
            print(f"  ⏹️  Search budget reached (${RUN_COST['spent']:.2f}); stopping mandatory searches.")
            break
        try:
            message = client.messages.create(
                model=MODEL_ID,
                max_tokens=300,
                tools=[{"type": "web_search_20250305", "name": "web_search", "max_uses": 1}],
                messages=[{
                    "role": "user",
                    "content": (
                        f"Search for: {query}. Return the single most important "
                        f"headline and a 2 sentence summary. JSON only, no markdown: "
                        f'{{"title": "", "summary": "", "relevant": true}}'
                    )
                }]
            )
            add_cost(message)
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
# LAYER 4 — DYNAMIC WATCHLIST
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
- IPO activity, QIP raises, block deals, PE/VC investments in India

Return ONLY a JSON array of 20 specific search queries, each under 8 words.
No markdown, no explanation, no preamble.

Example format:
["KPIT Technologies revenue warning IT sector", "Kotak Deutsche Bank acquisition details"]"""

    try:
        message = client.messages.create(
            model=MODEL_ID,
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}]
        )
        add_cost(message)

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
    # Needs a search source. Brave works on Bedrock; else fall back to
    # Anthropic's built-in tool; if neither is available, skip.
    if not HAVE_SEARCH:
        print("  ⏭️  No search source (set BRAVE_API_KEY to enable on Bedrock) — skipping watchlist.")
        return 0

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

    # ── Preferred path: our own search (Brave or free DuckDuckGo, works on Bedrock) ──
    if HAVE_OWN_SEARCH:
        src = "Brave" if BRAVE_API_KEY else "DuckDuckGo"
        for query in queries:
            for r in search_web(query, count=1):
                title   = r["title"].strip()
                summary = r["description"].strip()
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
                    "source":   "Dynamic Watchlist",
                    "url":      r["url"],
                    "category": "indian-markets",
                }).execute()
                existing_raw_titles.add(title.lower())
                seen_in_batch.add(title.lower())
                injected += 1
                print(f"  💉 Watchlist: {title[:65]}...")
        print(f"\n  ✅ Layer 4 ({src}) — Injected {injected} watchlist stories")
        return injected

    # ── Fallback: Anthropic's built-in web_search tool ──
    for query in queries:
        if RUN_COST["spent"] >= SEARCH_BUDGET:
            print(f"  ⏹️  Search budget reached (${RUN_COST['spent']:.2f}); stopping watchlist.")
            break
        try:
            message = client.messages.create(
                model=MODEL_ID,
                max_tokens=400,
                tools=[{"type": "web_search_20250305",
                        "name": "web_search", "max_uses": 1}],
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
            add_cost(message)

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
- IPO, QIP, block deal, PE/VC investment, M&A advisory in India

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
        model=MODEL_ID,
        max_tokens=100,
        messages=[{"role": "user", "content": prompt}]
    )
    add_cost(message)
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
            scoring_cost += HAIKU_COST_PER_SCORE  # local estimate for the log line only

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

    all_headlines = []
    all_headlines += fetch_rss_headlines()          # Layer 1
    all_headlines += scrape_homepages()              # Layer 3
    all_headlines += run_mandatory_searches(client)  # Layer 2

    inject_important_headlines(
        client, supabase, all_headlines,
        existing_titles_data, is_duplicate_story_fn
    )

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

# TRUE total cap for the whole run (pre-pass searches + scoring + processing),
# now that RUN_COST tracks everything. Kept under $1.00 with margin.
DAILY_BUDGET      = 0.90

# Realistic look-ahead ONLY (a safety buffer for the budget pre-check).
# Actual spend is measured from each response's usage via add_cost().
AVG_INPUT_TOKENS  = 2000   # instructions + up to 3500 chars of article content
AVG_OUTPUT_TOKENS = 1300   # summary + investor + glossary + full picture + impact + meta
COST_PER_ARTICLE  = (
    (AVG_INPUT_TOKENS  / 1_000_000) * COST_PER_M_INPUT +
    (AVG_OUTPUT_TOKENS / 1_000_000) * COST_PER_M_OUTPUT
)

# ── LIMITS: max articles kept per category ──
# banking-finance is 20 = 10 for banking/finance + 10 for investment banking (clubbed)
CATEGORY_LIMITS = {
    "indian-markets":  10,
    "us-markets":      10,
    "global-economy":  10,
    "banking-finance": 20,   # clubbed: banking-finance + investment banking
    "macro-policy":    10,
    "technology-it":    5,
    "pharma-health":    5,
    "auto-ev":          5,
    "energy-oil":       5,
    "metals-mining":    5,
    "infrastructure":   5,
    "fmcg-consumer":    3,
    "renewables":       3,
    "real-estate":      3,
    "telecom-media":    3,
}

# ── MINIMUMS: realistic floors per category ──
# banking-finance minimum = 12 (6 banking + 6 IB, achievable daily)
CATEGORY_MINIMUMS = {
    "indian-markets":  7,
    "us-markets":      6,
    "global-economy":  5,
    "banking-finance": 12,   # clubbed: higher floor to reflect two topics
    "macro-policy":    5,
    "technology-it":   4,
    "pharma-health":   3,
    "auto-ev":         3,
    "energy-oil":      3,
    "metals-mining":   3,
    "infrastructure":  3,
    "fmcg-consumer":   3,
    "renewables":      3,
    "real-estate":     3,
    "telecom-media":   3,
}

CATEGORIES = list(CATEGORY_LIMITS.keys())

CATEGORY_KEYWORDS = {
    "indian-markets":    "Sensex, Nifty, BSE, NSE, Indian stocks, Dalal Street, Indian IPO, FII, DII, rupee vs dollar, SEBI, RBI rate, Nifty Bank",
    "us-markets":        "S&P 500, Dow Jones, NASDAQ, NYSE, Fed rate, US stocks, Wall Street, US IPO, dollar index, US Treasury, US earnings",
    "global-economy":    "IMF, World Bank, global GDP, trade war, sanctions, WTO, G7, G20, emerging markets, global inflation, geopolitics impact on economy",
    "banking-finance":   "bank earnings, NPA, credit growth, NBFC, RBI policy, lending rate, insurance, fintech, loan, deposit rate, SBI, HDFC Bank, ICICI Bank, IPO, QIP, block deal, OFS, rights issue, PE fund, venture capital, M&A advisory, investment bank, Goldman Sachs India, Kotak Investment Banking, ICICI Securities, Axis Capital, private equity, debt raise, fundraise, investment banking deal",
    "macro-policy":      "CPI inflation, WPI, GDP data, IIP, fiscal deficit, government budget, tax policy, government scheme, RBI MPC, unemployment rate",
    "technology-it":     "TCS, Infosys, Wipro, HCL Tech, IT sector, software exports, AI startup, chip, semiconductor, tech layoffs, SaaS, tech IPO",
    "pharma-health":     "pharma company, drug approval, USFDA, clinical trial, hospital, health policy, API, generic drug, Cipla, Sun Pharma, Dr Reddy",
    "auto-ev":           "car sales, two-wheeler, EV policy, electric vehicle, battery, Maruti, Tata Motors, Bajaj, Hero, auto sector, EV subsidy",
    "energy-oil":        "crude oil, Brent, WTI, OPEC, petroleum, natural gas, LNG, ONGC, Reliance oil, fuel price, energy sector",
    "metals-mining":     "steel, aluminium, copper, iron ore, zinc, Tata Steel, JSW, Hindalco, Vedanta, coal, mining, metal prices",
    "infrastructure":    "roads, highways, NHAI, ports, airport, railway, construction, government capex, infra spending, L&T, NIP",
    "fmcg-consumer":     "HUL, Nestle, ITC, Dabur, Marico, FMCG sales, rural consumption, consumer goods, retail demand, FMCG earnings",
    "renewables":        "solar, wind energy, green hydrogen, renewable energy, EV charging, clean energy, NTPC Renewable, Adani Green, ReNew",
    "real-estate":       "housing sales, property prices, REIT, mortgage, home loan, residential demand, commercial property, DLF, Godrej Properties",
    "telecom-media":     "Jio, Airtel, Vi, BSNL, spectrum, 5G, OTT, streaming, telecom tariff, media merger, broadband",
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
ACCEPT if ANY of these: central bank decisions, economic data (GDP/CPI/IIP), major company earnings/results, government policy, M&A/deals, commodity/currency moves, regulatory shifts, contract wins, analyst upgrades/downgrades, IPO news, company expansions, sector trends, fund flows (FII/DII), price hikes, capacity additions, new product launches with financial impact, investment banking deals (IPO, QIP, block deal, PE/VC).
WHEN IN DOUBT — ACCEPT. It is better to accept a borderline article than reject a useful one.

━━━ STEP 2: CATEGORY ━━━
{category_hint}
Pick EXACTLY ONE:
  "indian-markets" | "us-markets" | "global-economy" | "technology-it" |
  "pharma-health"  | "auto-ev"    | "energy-oil"      | "metals-mining" |
  "infrastructure" | "fmcg-consumer" | "renewables"   | "real-estate"   |
  "telecom-media"  | "banking-finance" | "macro-policy"

Use "banking-finance" for: bank earnings, NPA, RBI lending policy, NBFC, credit growth, deposit rates, insurance, AND investment banking deals — IPOs, QIPs, block deals, OFS, PE/VC investments, M&A advisory, fundraising rounds.
If the story is foreign/global with no Indian company or market involved, prefer "global-economy" (or "us-markets" for US market/Fed/Wall Street news).

━━━ STEP 3: IMPORTANCE ━━━
Set is_headline: false for all articles.

━━━ STEP 4: WRITE ━━━
PART 1: 1 sentence, max 25 words. WHO+WHAT+number+impact.
PART 2: 4 sentences, max 110 words. Before/What/Effect/Watch.
PART 3 (MANDATORY): 2 sentences, max 40 words. Explain the likely implication for investors and why, in neutral analytical language (avoid "good/bad" verdicts). One thing to watch.
GLOSSARY: 2-3 unfamiliar terms, max 20 words each.

━━━ STEP 5: THE FULL PICTURE (deep dive for the "Read in full" view) ━━━
Write a detailed, structured explainer in the SAME simple 16-year-old-friendly voice, as several short paragraphs, each beginning with its own bold label. Use the labels that fit the story — for example:
  "**What happened.** ..."  "**The numbers.** ..."  "**Why it happened.** ..."
  "**The bigger picture.** ..."  "**What it means for borrowers/investors.** ..."  "**The outlook / what to watch.** ..."
GO AS DEEP AS THE SOURCE ACTUALLY SUPPORTS — pull in every relevant figure, name, decision split and driver that is present in the content. CRITICAL: use ONLY facts in the content. Do NOT pad, repeat, or invent to fill length. If the source is thin, write fewer paragraphs — a short, true deep dive beats a long, padded one.

━━━ STEP 6: MARKET IMPACT (in words — NO invented numbers) ━━━
2 short paragraphs explaining what could plausibly happen to markets, sectors and instruments, and WHY — as reasoning, not data. e.g. "rate-sensitive sectors like real estate and autos may stay soft because loans don't get cheaper". Do NOT state specific index/stock/percentage moves unless they are explicitly in the content. Reason it out; never fabricate figures.

━━━ STEP 7: WHAT THIS MEANS FOR YOU ━━━
1 short paragraph, 2-3 sentences: the practical angle for an ordinary Indian retail investor / saver (EMIs, FDs, jobs, everyday costs). Plain and concrete.

━━━ STEP 8: CARD METADATA ━━━
sentiment: one of "bullish" | "bearish" | "neutral" — the market read of this story.
difficulty: one of "Easy" | "Medium" | "Hard" — how much finance knowledge it takes to follow.
stat: the single most important NUMBER stated in the article for the card (e.g. "6.5%", "+640", "₹8,500cr"). If the article has no clear headline number, use "".
stat_label: a 2-4 word label for that number (e.g. "repo rate held"). "" if no stat.

Return ONLY valid JSON:
REJECT: {{"verdict":"reject"}}
ACCEPT: {{"verdict":"accept","category":"<str>","is_headline":false,"simplified_article":"PART1\\n\\nPART2","investor_take":"PART3","glossary":[{{"word":"","meaning":""}}],"detailed_article":"**What happened.** ...\\n\\n**The numbers.** ...\\n\\n**Why it happened.** ...\\n\\n**The outlook.** ...","market_impact":"PARA1\\n\\nPARA2","what_this_means":"...","sentiment":"bullish|bearish|neutral","difficulty":"Easy|Medium|Hard","stat":"","stat_label":""}}

Title: {title}
Content: {content[:3500]}"""

    message = client.messages.create(
        model=MODEL_ID,
        max_tokens=2200,
        messages=[{"role": "user", "content": prompt}]
    )
    add_cost(message)
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
ACCEPT quarterly results, company updates, sector news, price moves, analyst reports, industry data, contract wins, expansions, fund flows, IPOs, block deals, PE investments.
Category is FIXED as "{target_category}" — do not change it.

WRITE:
PART 1: 1 sentence, max 25 words. WHO+WHAT+number+impact.
PART 2: 4 sentences, max 110 words. Before/What/Effect/Watch.
PART 3 (MANDATORY): 2 sentences, max 40 words. Explain the likely implication for investors and why, in neutral analytical language (avoid "good/bad" verdicts). One thing to watch.
GLOSSARY: 1-2 terms max.
THE FULL PICTURE (deep dive): several short paragraphs, each with a bold label ("**What happened.** ...", "**The numbers.** ...", "**Why it happened.** ...", "**The outlook.** ..."). Go as deep as the source supports; use ONLY facts in the content; never pad or invent — a short true deep dive beats a padded one.
MARKET IMPACT (in words): 2 short paragraphs on what could happen to markets/sectors and WHY, as reasoning — NO specific figures unless in the content, never fabricated.
WHAT THIS MEANS FOR YOU: 1 short paragraph, the practical retail-investor/saver angle.
CARD METADATA: sentiment ("bullish"|"bearish"|"neutral"), difficulty ("Easy"|"Medium"|"Hard"), stat (key number from the article or ""), stat_label (2-4 words or "").

Return ONLY valid JSON:
REJECT: {{"verdict":"reject"}}
ACCEPT: {{"verdict":"accept","category":"{target_category}","is_headline":false,"simplified_article":"PART1\\n\\nPART2","investor_take":"PART3","glossary":[{{"word":"","meaning":""}}],"detailed_article":"**What happened.** ...\\n\\n**Why it happened.** ...\\n\\n**The outlook.** ...","market_impact":"PARA1\\n\\nPARA2","what_this_means":"...","sentiment":"bullish|bearish|neutral","difficulty":"Easy|Medium|Hard","stat":"","stat_label":""}}

Title: {title}
Content: {content[:3500]}"""

    message = client.messages.create(
        model=MODEL_ID,
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )
    add_cost(message)
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

    # Normalise the enriched fields, then write only the columns that exist.
    sentiment = (processed_data.get("sentiment") or "neutral").strip().lower()
    if sentiment not in ("bullish", "bearish", "neutral"):
        sentiment = "neutral"
    difficulty = (processed_data.get("difficulty") or "Medium").strip().capitalize()
    if difficulty not in ("Easy", "Medium", "Hard"):
        difficulty = "Medium"
    opt = {
        "detailed_article": (processed_data.get("detailed_article") or "").strip(),
        "market_impact":    (processed_data.get("market_impact") or "").strip(),
        "what_this_means":  (processed_data.get("what_this_means") or "").strip(),
        "sentiment":        sentiment,
        "difficulty":       difficulty,
        "stat":             (processed_data.get("stat") or "").strip(),
        "stat_label":       (processed_data.get("stat_label") or "").strip(),
    }
    for col in OPTIONAL_COLS:
        if col in AVAILABLE_OPT_COLS:
            data[col] = opt[col]
    return supabase.table("processed_articles").insert(data).execute()


# ═══════════════════════════════════════════════════════════════
# MAIN RUN
# ═══════════════════════════════════════════════════════════════

def run():
    RUN_COST["spent"] = 0.0
    total_minimum = sum(CATEGORY_MINIMUMS.values())

    # Detect which enrichment columns exist; missing ones are skipped on insert
    # (never breaks the run) and reported with the SQL to enable them.
    detect_optional_columns()

    print("=" * 50)
    print(f"💰 Total run budget: ${DAILY_BUDGET:.2f} (searches + processing) | ~${COST_PER_ARTICLE:.4f}/article")
    print(f"   Total minimum target: {total_minimum} articles")
    print("=" * 50)

    # ════ PRE-PASS: Four-Layer Coverage ════
    existing_titles_data_early = get_existing_titles()
    run_prepass(
        client, supabase,
        existing_titles_data_early,
        is_duplicate_story
    )

    # Pre-pass web searches + scoring already spent this much; the processing
    # loop below counts it so DAILY_BUDGET caps the WHOLE run.
    running_cost = RUN_COST["spent"]
    print(f"\n💰 Pre-pass spend so far: ${running_cost:.3f} (of ${DAILY_BUDGET:.2f} total)")

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
        minim = CATEGORY_MINIMUMS.get(cat, 3)
        limit = CATEGORY_LIMITS.get(cat, 5)
        if count < minim:  return 0
        if count < limit:  return 1
        return 2

    articles.sort(key=sort_priority)

    accepted = rejected = skipped_full = skipped_dup = skipped_inv = 0

    for article in articles:
        # Pass 1 stops at 85% — reserves 15% for top-up Pass 2. Uses REAL spend.
        if RUN_COST["spent"] + COST_PER_ARTICLE > DAILY_BUDGET * 0.85:
            print(f"\n⚠️  Reached 85% of budget (${RUN_COST['spent']:.3f}). Reserving rest for top-up pass.")
            break

        title   = article["title"]
        content = article.get("content", "")

        try:
            if is_duplicate_story(title, existing_titles_data):
                skipped_dup += 1
                continue

            feed_category = article.get("category", "global-economy")

            if category_counts.get(feed_category, 0) >= CATEGORY_LIMITS.get(feed_category, 5):
                skipped_full += 1
                continue

            processed = process_strict(title, content, feed_category)
            running_cost = RUN_COST["spent"]

            if processed is None:
                rejected += 1
                continue

            if not is_valid_output(processed):
                skipped_inv += 1
                continue

            category  = processed.get("category", feed_category)
            cat_limit = CATEGORY_LIMITS.get(category, 5)

            if category_counts.get(category, 0) >= cat_limit:
                skipped_full += 1
                continue

            save_processed_article(article, processed)
            existing_titles_data.append((title, get_title_fingerprint(title)))
            category_counts[category] = category_counts.get(category, 0) + 1

            gap    = category_counts[category] - CATEGORY_MINIMUMS.get(category, 3)
            status = "✅" if gap >= 0 else f"⚠️  {abs(gap)} below min"
            print(f"  ✓ [{category}] {category_counts[category]}/{CATEGORY_LIMITS[category]} {status} | 💰 ${running_cost:.3f}")
            accepted += 1

        except json.JSONDecodeError as e:
            running_cost = RUN_COST["spent"]
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
            if RUN_COST["spent"] + COST_PER_ARTICLE > DAILY_BUDGET:
                print(f"\n🛑 Budget limit reached (${RUN_COST['spent']:.3f}). Stopping.")
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
                running_cost = RUN_COST["spent"]

                if processed is None:
                    continue
                if not is_valid_output(processed):
                    continue

                category  = processed.get("category", feed_cat)
                cat_limit = CATEGORY_LIMITS.get(category, 5)

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
                running_cost = RUN_COST["spent"]
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

    total = RUN_COST["spent"]
    print(f"\n{'✅ ALL MINIMUMS MET' if all_met else '⚠️  SOME STILL BELOW MIN'}")
    print(f"💰 REAL total cost this run (searches + processing): ${total:.4f} / ${DAILY_BUDGET:.2f} cap")
    print("=" * 50)

    enforce_per_category_limit()


if __name__ == "__main__":
    run()