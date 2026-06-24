import anthropic
import json
import re
from supabase import create_client
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
import os

load_dotenv()

SUPABASE_URL  = os.getenv("SUPABASE_URL")
SUPABASE_KEY  = os.getenv("SUPABASE_KEY")
ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
client   = anthropic.Anthropic(api_key=ANTHROPIC_KEY)

HEADLINE_MAX = 20

# ── Haiku 4.5 pricing ────────────────────────────────────────────────────────
COST_PER_M_INPUT  = 1.00
COST_PER_M_OUTPUT = 5.00
COST_PER_M_CACHE  = 0.10
DAILY_BUDGET      = 0.68   # leaves $0.32 for doubts + market summary
AVG_INPUT_TOKENS  = 1000
AVG_OUTPUT_TOKENS = 300
SYSTEM_TOKENS     = 1100   # cached after first call
# With caching: system prompt costs 0.10/M instead of 1.00/M
COST_PER_ARTICLE  = (SYSTEM_TOKENS / 1e6) * COST_PER_M_CACHE \
                  + (AVG_INPUT_TOKENS / 1e6) * COST_PER_M_INPUT \
                  + (AVG_OUTPUT_TOKENS / 1e6) * COST_PER_M_OUTPUT

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

# Hard floor — NEVER show fewer than this many articles in any section
# Even if Claude rejects everything, Pass 3 will scrape the barrel to hit this
CATEGORY_FLOOR = {cat: 3 for cat in CATEGORY_LIMITS}

FOREIGN_CATEGORIES        = {"us-markets", "global-economy"}
HEADLINE_INDIAN_MIN_SHARE = 14
CATEGORIES                = list(CATEGORY_LIMITS.keys())

# Which categories are "related" — used in Pass 3 to find articles
# that might belong to an underfilled category from adjacent raw feeds
RELATED_CATEGORIES = {
    "renewables":      ["energy-oil", "infrastructure", "technology-it"],
    "real-estate":     ["banking-finance", "fmcg-consumer", "infrastructure"],
    "infrastructure":  ["macro-policy", "energy-oil", "metals-mining"],
    "metals-mining":   ["energy-oil", "infrastructure", "indian-markets"],
    "fmcg-consumer":   ["indian-markets", "pharma-health", "auto-ev"],
    "telecom-media":   ["technology-it", "indian-markets", "banking-finance"],
    "auto-ev":         ["energy-oil", "renewables", "indian-markets"],
    "pharma-health":   ["technology-it", "global-economy", "indian-markets"],
}

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

SYSTEM_PROMPT = """You are a financial news editor for an India-based financial news platform.
Your reader is a curious 16-year-old who knows what a stock market is and reads the news,
but has never studied finance. Your job: filter weak articles, then write the good ones clearly.

FILTER RULES:
REJECT: celebrity gossip, sports money, product ads, opinion columns, tiny company announcements,
tick-by-tick market updates with no explanation, individual property listings.
ACCEPT: central bank decisions, major economic data, significant company earnings, government policy
changes, M&A, commodity/currency moves with reasons, regulatory shifts, CEO/leadership news at major
listed companies (top 100 firms, banks, PSUs), corporate fraud or governance events.

CATEGORY LIST (pick exactly one string):
"indian-markets" | "us-markets" | "global-economy" | "technology-it" |
"pharma-health"  | "auto-ev"    | "energy-oil"     | "metals-mining" |
"infrastructure" | "fmcg-consumer" | "renewables"  | "real-estate"   |
"telecom-media"  | "banking-finance" | "macro-policy"

CATEGORY RULES:
- Indian stock prices / NSE/BSE / Indian company stock → "indian-markets"
- US indices / Fed / US company stocks → "us-markets"
- Inflation data / GDP / government budget → "macro-policy"
- Bank / NBFC / insurance / lending → "banking-finance"
- Pure foreign story with no India angle → "global-economy" or "us-markets"

HEADLINE RULES (India-first site):
- Prioritise Indian market moves, RBI/govt policy, major Indian company earnings/M&A
- Foreign stories: only is_headline:true if truly extraordinary (major central bank, global crisis)
- Routine foreign market updates → is_headline:false

WRITING FORMAT:
PART 1: Exactly 1 sentence, max 25 words. WHO did WHAT + one precise number + immediate impact.
PART 2: Exactly 4 sentences, max 110 words.
  S1-Before: What was the situation before? One number or fact as context.
  S2-What: Exactly what happened, who, when, how big.
  S3-Effect: What changes now for investors, companies, or people.
  S4-Watch: One specific thing to look out for next (name a date/event/figure).
PART 3 (MANDATORY investor_take): Exactly 2 sentences, max 40 words.
  S1: Likely implication for investors in this sector and why (neutral analytical language).
  S2: One specific thing to watch — a stock, index, date, or data release.
GLOSSARY: 2-3 genuinely unfamiliar finance terms only. Max 20 words each.

WRITING RULES:
✓ Plain English — explain jargon in brackets right after the term
✓ Specific numbers always — never "significant rise", always "rose 3.2%"
✓ Active voice
✗ No: "market participants", "headwinds", "tailwinds", "going forward", "remain cautious"
✗ No investment advice — never say "buy", "sell", or "invest in"

OUTPUT: Return ONLY valid JSON, nothing before or after, no markdown.
REJECT format: {"verdict":"reject"}
ACCEPT format: {"verdict":"accept","category":"<str>","is_headline":true/false,
"simplified_article":"PART1\\n\\nPART2","investor_take":"PART3",
"glossary":[{"word":"","meaning":""}]}"""

# ── Same system prompt used in Pass 3 (lenient mode) ─────────────────────────
# The only difference is the filter rules are relaxed for underfilled sectors
SYSTEM_PROMPT_LENIENT = """You are a financial news editor filling gaps in a news platform's sector coverage.
Your reader is a curious 16-year-old. Write clearly and simply.

FILTER RULES (LENIENT MODE — sector is underfilled, be generous):
ACCEPT almost anything business or finance related:
  - Company updates, quarterly results, sector trends, analyst opinions
  - Price movements with any explanation at all
  - Industry data, policy impacts, market commentary
  - Executive appointments, company expansions, new products with market impact
REJECT ONLY: pure celebrity gossip, sports scores, recipes, travel guides,
  completely unrelated non-business content.

The category is FIXED — do not change it.
is_headline must always be false in lenient mode.

WRITING FORMAT:
PART 1: 1 sentence, max 25 words. WHO + WHAT + impact.
PART 2: 3-4 sentences, max 100 words. Context / What happened / Effect / Watch.
PART 3 (MANDATORY investor_take): 2 sentences, max 40 words. Sector implication + what to watch.
GLOSSARY: 1-2 terms max.

OUTPUT: Return ONLY valid JSON, no markdown.
REJECT format: {"verdict":"reject"}
ACCEPT format: {"verdict":"accept","category":"<FIXED_CATEGORY>","is_headline":false,
"simplified_article":"PART1\\n\\nPART2","investor_take":"PART3",
"glossary":[{"word":"","meaning":""}]}"""


# ─────────────────────────────────────────────────────────────────────────────
# SMART DEDUP
# ─────────────────────────────────────────────────────────────────────────────

def get_title_fingerprint(title):
    numbers     = {n for n in re.findall(r'\d+(?:\.\d+)?', title) if float(n) > 5}
    caps        = set(re.findall(r'\b[A-Z][a-z]{2,}\b', title))
    fin_entities = set(re.findall(
        r'\b(rbi|sebi|nse|bse|nifty|sensex|fed|mpc|ipo|fii|dii|npa|gdp|cpi|wpi|repo|usfda|opec|imf)\b',
        title.lower()
    ))
    return numbers, caps, fin_entities


def is_same_story(title_new, existing_titles_data):
    n1, c1, e1 = get_title_fingerprint(title_new)

    def kw(t):
        t = t.lower()
        t = re.sub(r'\b(the|a|an|in|on|at|to|of|for|by|as|its|with|after|amid|says|'
                   r'report|reports|per|cent|yoy|qoq|quarter|results|earnings|beats|misses)\b', ' ', t)
        return set(w for w in re.findall(r'\b[a-z]{4,}\b', t))

    kw1 = kw(title_new)

    for existing_title, (n2, c2, e2) in existing_titles_data:
        if (c1 & c2) and (n1 & n2):       return True
        if (e1 & e2) and (n1 & n2):       return True
        kw2 = kw(existing_title)
        if kw1 and kw2 and len(kw1 & kw2) / len(kw1 | kw2) >= 0.60:
            return True
    return False


def build_existing_titles_data(titles_list):
    return [(t, get_title_fingerprint(t)) for t in titles_list]


# ─────────────────────────────────────────────────────────────────────────────
# DB HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def get_category_counts():
    counts = {cat: 0 for cat in CATEGORIES}
    counts["headlines"] = counts["headlines_indian"] = counts["headlines_foreign"] = 0
    result = supabase.table("processed_articles").select("category, is_headline").execute()
    for row in result.data:
        cat = row.get("category")
        if cat in counts:
            counts[cat] += 1
        if row.get("is_headline"):
            counts["headlines"] += 1
            if cat in FOREIGN_CATEGORIES:
                counts["headlines_foreign"] += 1
            else:
                counts["headlines_indian"] += 1
    return counts


def get_existing_titles():
    result = supabase.table("processed_articles").select("title").execute()
    return [r["title"] for r in result.data if r.get("title")]


def get_unprocessed_articles(extra_categories=None):
    """Get unprocessed raw articles. If extra_categories given, filter to those."""
    processed     = supabase.table("processed_articles").select("raw_article_id").execute()
    processed_ids = {p["raw_article_id"] for p in processed.data}
    raw           = supabase.table("raw_articles").select("*").execute()
    articles      = [a for a in raw.data if a["id"] not in processed_ids]
    if extra_categories:
        articles = [a for a in articles if a.get("category") in extra_categories]
    return articles


def is_valid_output(d):
    s     = d.get("simplified_article", "")
    parts = s.strip().split("\n\n")
    if len(parts) < 2:                               return False
    if len(parts[0].strip()) < 30:                   return False
    if len(parts[1].strip()) < 60:                   return False  # slightly relaxed for pass 3
    if len(d.get("investor_take","").strip()) < 30:  return False  # slightly relaxed
    if not isinstance(d.get("glossary",[]), list):   return False
    return True


def enforce_per_category_limit():
    print("\n🔢 Enforcing per-category limits...")
    for category in CATEGORIES:
        limit    = CATEGORY_LIMITS[category]
        articles = (
            supabase.table("processed_articles")
            .select("id").eq("category", category)
            .order("created_at", desc=True).execute()
        )
        if len(articles.data) > limit:
            for r in articles.data[limit:]:
                supabase.table("processed_articles").delete().eq("id", r["id"]).execute()
            print(f"  🗑️  [{category}] Trimmed → kept {limit}")
        else:
            print(f"  ✅ [{category}] {len(articles.data)}/{limit} — OK")

    headlines = (
        supabase.table("processed_articles")
        .select("id").eq("is_headline", True)
        .order("created_at", desc=True).execute()
    )
    if len(headlines.data) > HEADLINE_MAX:
        for row in headlines.data[HEADLINE_MAX:]:
            supabase.table("processed_articles").update({"is_headline": False}).eq("id", row["id"]).execute()
        print(f"  🗑️  Headlines trimmed → kept {HEADLINE_MAX}")
    else:
        print(f"  ✅ Headlines: {len(headlines.data)}/{HEADLINE_MAX} — OK")


# ─────────────────────────────────────────────────────────────────────────────
# CLAUDE CALLS
# ─────────────────────────────────────────────────────────────────────────────

def call_claude(user_content, max_tokens=900, lenient=False):
    prompt = SYSTEM_PROMPT_LENIENT if lenient else SYSTEM_PROMPT
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=max_tokens,
        system=[{
            "type": "text",
            "text": prompt,
            "cache_control": {"type": "ephemeral"}
        }],
        messages=[{"role": "user", "content": user_content}]
    )
    text = message.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"): text = text[4:]
        text = text.strip()
    return json.loads(text)


def process_strict(title, content, feed_category, headline_count, headline_foreign_count):
    if headline_count < 10:
        hl = "Be GENEROUS — mark is_headline:true for any page-1 financial story today."
    elif headline_count < HEADLINE_MAX:
        hl = f"Need {HEADLINE_MAX - headline_count} more headlines. Mark true only for clearly front-page news."
    else:
        hl = f"Already have {HEADLINE_MAX} headlines. Set is_headline:false unless truly breaking."

    foreign_note = ""
    if headline_foreign_count >= (HEADLINE_MAX - HEADLINE_INDIAN_MIN_SHARE):
        foreign_note = "\nFOREIGN HEADLINE QUOTA FULL: If no direct India angle, set is_headline:false."

    category_kw = "\n".join(f"  • {k}: {v}" for k, v in CATEGORY_KEYWORDS.items())

    user_content = f"""RSS feed hint: "{feed_category}" — use as strong starting category. Only override if article clearly belongs elsewhere.

Category keywords:
{category_kw}

Headline instruction: {hl}{foreign_note}

Title: {title}
Content: {content[:1000]}"""

    parsed = call_claude(user_content, max_tokens=900)
    return None if parsed.get("verdict") == "reject" else parsed


def process_lenient(title, content, target_category):
    """
    Lenient mode for underfilled sectors.
    Category is FIXED — Claude cannot change it.
    Rejection bar is much lower — accept anything business-related.
    """
    user_content = f"""CATEGORY (FIXED, do not change): "{target_category}"

Title: {title}
Content: {content[:1000]}"""

    parsed = call_claude(user_content, max_tokens=700, lenient=True)
    if parsed.get("verdict") == "reject":
        return None
    parsed["category"]    = target_category   # enforce — Claude cannot override
    parsed["is_headline"] = False
    return parsed


def save_processed_article(raw_article, processed_data):
    if not processed_data.get("investor_take"):
        processed_data["investor_take"] = "Markets may react as more details emerge. Watch for follow-up announcements."
    if not processed_data.get("glossary"):
        processed_data["glossary"] = []
    data = {
        "raw_article_id":     raw_article["id"],
        "title":              raw_article["title"],
        "source":             raw_article["source"],
        "image_url":          raw_article.get("image_url"),
        "simplified_article": processed_data["simplified_article"],
        "investor_take":      processed_data.get("investor_take", ""),
        "glossary":           processed_data["glossary"],
        "category":           processed_data.get("category", "global-economy"),
        "is_headline":        processed_data.get("is_headline", False),
    }
    return supabase.table("processed_articles").insert(data).execute()


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def run():
    running_cost = 0.0

    print("=" * 60)
    print(f"💰 Budget: ${DAILY_BUDGET:.2f}/day | ~${COST_PER_ARTICLE:.5f}/article (cached)")
    print(f"   Max articles: {int(DAILY_BUDGET / COST_PER_ARTICLE)}")
    print(f"   Haiku 4.5: $1/M input · $5/M output · $0.10/M cache")
    print("=" * 60)

    articles        = get_unprocessed_articles()
    category_counts = get_category_counts()
    existing_titles_data = build_existing_titles_data(get_existing_titles())

    print(f"\nUnprocessed articles: {len(articles)}")
    print(f"Dedup index: {len(existing_titles_data)} existing titles")
    print(f"Current counts: { {k:v for k,v in category_counts.items() if k in CATEGORIES} }")

    # ════ PASS 1 — Strict, all categories, NO 75% budget guard ══════════════
    # FIX: Removed the 75% guard. With caching at $0.0026/article we can
    # process 260 articles within $0.68 budget. Let budget be the only guard.
    print(f"\n{'='*60}")
    print("PASS 1 — Strict (all categories, full budget available)")
    print("="*60)

    def sort_priority(article):
        cat   = article.get("category", "global-economy")
        count = category_counts.get(cat, 0)
        minim = CATEGORY_MINIMUMS.get(cat, 5)
        limit = CATEGORY_LIMITS.get(cat, 7)
        if count < minim:  return 0   # underfilled — highest priority
        if count < limit:  return 1   # between min and limit
        return 2                       # already at limit — lowest priority

    articles.sort(key=sort_priority)

    accepted = rejected = skipped_full = skipped_dup = 0

    for article in articles:
        # Only hard stop is the actual budget limit
        if running_cost + COST_PER_ARTICLE > DAILY_BUDGET:
            print(f"\n🛑 Budget limit reached (${running_cost:.3f}). Stopping Pass 1.")
            break

        title   = article["title"]
        content = article.get("content", "")

        try:
            if is_same_story(title, existing_titles_data):
                skipped_dup += 1
                continue

            feed_category          = article.get("category", "global-economy")
            headline_count         = category_counts.get("headlines", 0)
            headline_foreign_count = category_counts.get("headlines_foreign", 0)

            if category_counts.get(feed_category, 0) >= CATEGORY_LIMITS.get(feed_category, 7):
                skipped_full += 1
                continue

            processed = process_strict(title, content, feed_category, headline_count, headline_foreign_count)
            running_cost += COST_PER_ARTICLE

            if processed is None:
                rejected += 1
                continue

            if not is_valid_output(processed):
                continue

            category    = processed.get("category", feed_category)
            is_headline = processed.get("is_headline", False)

            if category_counts.get(category, 0) >= CATEGORY_LIMITS.get(category, 7):
                skipped_full += 1
                continue

            if is_headline and headline_count >= HEADLINE_MAX:
                processed["is_headline"] = False
                is_headline = False

            if is_headline and category in FOREIGN_CATEGORIES:
                if headline_foreign_count >= (HEADLINE_MAX - HEADLINE_INDIAN_MIN_SHARE):
                    processed["is_headline"] = False
                    is_headline = False

            save_processed_article(article, processed)
            existing_titles_data.append((title, get_title_fingerprint(title)))

            category_counts[category] = category_counts.get(category, 0) + 1
            if is_headline:
                category_counts["headlines"] += 1
                if category in FOREIGN_CATEGORIES:
                    category_counts["headlines_foreign"] += 1
                else:
                    category_counts["headlines_indian"] += 1

            gap    = category_counts[category] - CATEGORY_MINIMUMS.get(category, 5)
            status = "✅" if gap >= 0 else f"⚠️  {abs(gap)} below min"
            hl_tag = " 🔥" if is_headline else ""
            print(f"  ✓{hl_tag} [{category}] {category_counts[category]}/{CATEGORY_LIMITS[category]} {status} | ${running_cost:.3f} | {title[:40]}")
            accepted += 1

        except json.JSONDecodeError as e:
            running_cost += COST_PER_ARTICLE
            print(f"  ❌ JSON: {e}")
        except Exception as e:
            print(f"  ❌ {e}")

    print(f"\nPass 1 — Accepted: {accepted} | Rejected: {rejected} | Dupes: {skipped_dup} | ${running_cost:.3f}")

    # ════ PASS 2 — Lenient top-up for underfilled categories ═════════════════
    # FIX: Uses LENIENT mode — much lower rejection bar for small sectors
    # Also searches RELATED categories' raw articles if own category is empty
    under_min = {
        cat: CATEGORY_MINIMUMS[cat] - category_counts.get(cat, 0)
        for cat in CATEGORIES
        if category_counts.get(cat, 0) < CATEGORY_MINIMUMS[cat]
    }

    if under_min:
        print(f"\n{'='*60}")
        print(f"PASS 2 — Lenient top-up ({len(under_min)} sectors below minimum)")
        for cat, needed in sorted(under_min.items(), key=lambda x: -x[1]):
            print(f"  ⚠️  {cat}: needs {needed} more")
        print("="*60)

        # For each underfilled category, gather raw articles from:
        # 1. Its own feed category
        # 2. Related categories (in case Claude miscategorised them)
        p2_accepted = 0

        for target_cat, needed in sorted(under_min.items(), key=lambda x: -x[1]):
            if running_cost + COST_PER_ARTICLE > DAILY_BUDGET:
                print(f"\n🛑 Budget exhausted. Stopping Pass 2.")
                break

            # Sources to search: own category + related
            search_cats = {target_cat} | set(RELATED_CATEGORIES.get(target_cat, []))
            candidates  = get_unprocessed_articles(extra_categories=search_cats)

            # Also include ALL unprocessed if still very short
            if len(candidates) < 5:
                candidates = get_unprocessed_articles()

            filled = 0
            for article in candidates:
                if filled >= needed:
                    break
                if running_cost + COST_PER_ARTICLE > DAILY_BUDGET:
                    break

                title   = article["title"]
                content = article.get("content", "")

                if is_same_story(title, existing_titles_data):
                    continue

                try:
                    processed = process_lenient(title, content, target_cat)
                    running_cost += COST_PER_ARTICLE

                    if processed is None:
                        continue
                    if not is_valid_output(processed):
                        continue

                    category = processed.get("category", target_cat)
                    if category_counts.get(category, 0) >= CATEGORY_LIMITS.get(category, 7):
                        continue

                    save_processed_article(article, processed)
                    existing_titles_data.append((title, get_title_fingerprint(title)))
                    category_counts[category] = category_counts.get(category, 0) + 1
                    filled     += 1
                    p2_accepted += 1

                    print(f"  ↑ [{category}] {category_counts[category]}/{CATEGORY_LIMITS[category]} | ${running_cost:.3f} | {title[:45]}")

                except Exception as e:
                    running_cost += COST_PER_ARTICLE
                    print(f"  ❌ {e}")

            if filled > 0:
                print(f"  ✅ [{target_cat}] filled +{filled}")

        print(f"\nPass 2 — +{p2_accepted} articles | ${running_cost:.3f} total")

    # ════ PASS 3 — Floor guarantee (never show fewer than 3 articles) ════════
    # FIX: Hard floor — if any section still has < 3 articles,
    # force-process raw articles with ultra-lenient mode
    under_floor = {
        cat: CATEGORY_FLOOR[cat] - category_counts.get(cat, 0)
        for cat in CATEGORIES
        if category_counts.get(cat, 0) < CATEGORY_FLOOR[cat]
    }

    if under_floor:
        print(f"\n{'='*60}")
        print(f"PASS 3 — FLOOR GUARANTEE (never show < 3 articles per section)")
        for cat, needed in under_floor.items():
            print(f"  🚨 {cat}: only {CATEGORY_FLOOR[cat]-needed} articles — needs {needed} more")
        print("="*60)

        all_unprocessed = get_unprocessed_articles()
        p3_accepted = 0

        for target_cat, needed in under_floor.items():
            filled = 0
            for article in all_unprocessed:
                if filled >= needed:
                    break
                if running_cost + COST_PER_ARTICLE > DAILY_BUDGET:
                    break

                title   = article["title"]
                content = article.get("content", "")

                if is_same_story(title, existing_titles_data):
                    continue

                try:
                    processed = process_lenient(title, content, target_cat)
                    running_cost += COST_PER_ARTICLE

                    if processed is None:
                        continue
                    if not is_valid_output(processed):
                        continue

                    save_processed_article(article, processed)
                    existing_titles_data.append((title, get_title_fingerprint(title)))
                    category_counts[target_cat] = category_counts.get(target_cat, 0) + 1
                    filled     += 1
                    p3_accepted += 1

                    print(f"  🆙 [{target_cat}] {category_counts[target_cat]} articles now | {title[:50]}")

                except Exception as e:
                    running_cost += COST_PER_ARTICLE
                    print(f"  ❌ {e}")

        print(f"\nPass 3 — +{p3_accepted} articles forced in")

    # ════ Final report ════════════════════════════════════════════════════════
    final   = get_category_counts()
    all_met = True
    print(f"\n{'='*60}")
    print("FINAL COUNTS")
    print("="*60)
    for cat in CATEGORIES:
        count  = final.get(cat, 0)
        floor  = CATEGORY_FLOOR[cat]
        minim  = CATEGORY_MINIMUMS[cat]
        limit  = CATEGORY_LIMITS[cat]
        if count < floor:
            status = f"🚨 CRITICAL ({count} < floor {floor})"
            all_met = False
        elif count < minim:
            status = f"⚠️  BELOW MIN ({count} < {minim})"
            all_met = False
        else:
            status = f"✅ {count}/{limit}"
        print(f"  {status:<35} {cat}")

    indian  = final.get("headlines_indian", 0)
    foreign = final.get("headlines_foreign", 0)
    print(f"\n  Headlines: {final.get('headlines',0)}/{HEADLINE_MAX} | Indian: {indian} | Foreign: {foreign}")
    print(f"\n{'✅ ALL GOOD' if all_met else '⚠️  SOME SECTORS LOW — check fetch_news feeds'}")
    print(f"💰 Total: ${running_cost:.4f} / ${DAILY_BUDGET:.2f} budget")
    print(f"   Remaining for doubts + market summary: ${1.00 - running_cost:.4f}")
    print("="*60)

    enforce_per_category_limit()


if __name__ == "__main__":
    run()