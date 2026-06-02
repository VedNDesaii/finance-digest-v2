import anthropic
import json
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

# ✅ Budget guard
COST_PER_M_INPUT  = 0.80
COST_PER_M_OUTPUT = 4.00
DAILY_BUDGET      = 0.72
AVG_INPUT_TOKENS  = 600
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


def get_category_counts():
    counts = {cat: 0 for cat in CATEGORIES}
    counts["headlines"] = 0
    result = supabase.table("processed_articles").select("category, is_headline").execute()
    for row in result.data:
        cat = row.get("category")
        if cat in counts:
            counts[cat] += 1
        if row.get("is_headline"):
            counts["headlines"] += 1
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

    headlines = (
        supabase.table("processed_articles")
        .select("id")
        .eq("is_headline", True)
        .order("created_at", desc=True)
        .execute()
    )
    if len(headlines.data) > HEADLINE_MAX:
        excess = headlines.data[HEADLINE_MAX:]
        for row in excess:
            supabase.table("processed_articles").update({"is_headline": False}).eq("id", row["id"]).execute()
        print(f"  🗑️  Headlines trimmed → kept {HEADLINE_MAX}")
    else:
        print(f"  ✅ Headlines: {len(headlines.data)}/{HEADLINE_MAX} — OK")


def get_existing_titles():
    result = supabase.table("processed_articles").select("title").execute()
    return [r["title"].lower()[:60] for r in result.data]


def is_duplicate_story(title, existing_titles):
    short = title.lower()[:60]
    for existing in existing_titles:
        if short[:40] == existing[:40]:
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
    if len(parts[1].strip()) < 80: return False
    if len(investor.strip()) < 40: return False
    if not isinstance(glossary, list): return False
    return True


def process_strict(title, content, feed_category, headline_count):
    if headline_count < 10:
        hl = "Be GENEROUS — mark is_headline: true for any page-1 financial story today."
    elif headline_count < HEADLINE_MAX:
        hl = f"Need {HEADLINE_MAX - headline_count} more headlines. Mark true for clearly front-page news."
    else:
        hl = f"Already have {HEADLINE_MAX} headlines. Set is_headline: false unless breaking news."

    category_hint = f"""
The RSS feed that supplied this article was tagged as: "{feed_category}".
Use this as a STRONG starting hint. Only override if article clearly belongs elsewhere.

Category keyword reference:
{chr(10).join(f'  • {k}: {v}' for k, v in CATEGORY_KEYWORDS.items())}
"""

    prompt = f"""You are a financial news editor. Your reader is a curious 16-year-old who knows what a stock market is and reads the news, but has never studied finance. Your job: filter weak articles, then write the good ones clearly.

━━━ STEP 1: FILTER ━━━
REJECT if: celebrity gossip, sports money, product ads, opinion columns, tiny announcements, tick-by-tick updates, property listings.
ACCEPT if: central bank decisions, economic data, major earnings, government policy, M&A, commodity/currency moves, regulatory shifts.

━━━ STEP 2: CATEGORY ━━━
{category_hint}
Pick EXACTLY ONE:
  "indian-markets" | "us-markets" | "global-economy" | "technology-it" |
  "pharma-health"  | "auto-ev"    | "energy-oil"      | "metals-mining" |
  "infrastructure" | "fmcg-consumer" | "renewables"   | "real-estate"   |
  "telecom-media"  | "banking-finance" | "macro-policy"

━━━ STEP 3: HEADLINE ━━━
{hl}
True only if: front-page ET/FT today, affects millions of people's money, landmark event.

━━━ STEP 4: WRITE ━━━
PART 1: 1 sentence, max 25 words. WHO+WHAT+number+impact.
PART 2: 4 sentences, max 110 words. Before/What/Effect/Watch.
PART 3 (MANDATORY): 2 sentences, max 40 words. Good/bad for investors+why. One thing to watch.
GLOSSARY: 2-3 unfamiliar terms, max 20 words each.

Return ONLY valid JSON:
REJECT: {{"verdict":"reject"}}
ACCEPT: {{"verdict":"accept","category":"<str>","is_headline":true/false,"simplified_article":"PART1\\n\\nPART2","investor_take":"PART3","glossary":[{{"word":"","meaning":""}}]}}

Title: {title}
Content: {content[:1000]}"""

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
ACCEPT quarterly results, company updates, sector news, price moves, analyst reports, industry data.
Category is FIXED as "{target_category}" — do not change it.

WRITE:
PART 1: 1 sentence, max 25 words. WHO+WHAT+number+impact.
PART 2: 4 sentences, max 110 words. Before/What/Effect/Watch.
PART 3 (MANDATORY): 2 sentences, max 40 words. Good/bad for investors. One thing to watch.
GLOSSARY: 1-2 terms max.

Return ONLY valid JSON:
REJECT: {{"verdict":"reject"}}
ACCEPT: {{"verdict":"accept","category":"{target_category}","is_headline":false,"simplified_article":"PART1\\n\\nPART2","investor_take":"PART3","glossary":[{{"word":"","meaning":""}}]}}

Title: {title}
Content: {content[:1000]}"""

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
        "is_headline":    processed_data.get("is_headline", False),
    }
    return supabase.table("processed_articles").insert(data).execute()


def run():
    running_cost = 0.0

    print("=" * 50)
    print(f"💰 Daily budget: ${DAILY_BUDGET:.2f} | ~${COST_PER_ARTICLE:.4f}/article")
    print(f"   Max articles in budget: {int(DAILY_BUDGET / COST_PER_ARTICLE)}")
    print("=" * 50)

    # ════ PASS 1 — Strict ════
    print("\nPASS 1 — Strict filtering")
    print("=" * 50)

    articles        = get_unprocessed_articles()
    category_counts = get_category_counts()
    existing_titles = get_existing_titles()

    print(f"Found {len(articles)} unprocessed articles")

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
        # ✅ Budget guard — stop before exceeding limit
        if running_cost + COST_PER_ARTICLE > DAILY_BUDGET * 0.75:
            print(f"\n⚠️  Reached 75% of budget (${running_cost:.3f}). Reserving rest for top-up pass.")
            break

        title   = article["title"]
        content = article.get("content", "")

        try:
            if is_duplicate_story(title, existing_titles):
                skipped_dup += 1; continue

            feed_category  = article.get("category", "global-economy")
            headline_count = category_counts.get("headlines", 0)

            if category_counts.get(feed_category, 0) >= CATEGORY_LIMITS.get(feed_category, 7):
                skipped_full += 1; continue

            processed = process_strict(title, content, feed_category, headline_count)
            running_cost += COST_PER_ARTICLE

            if processed is None:
                rejected += 1; continue

            if not is_valid_output(processed):
                skipped_inv += 1; continue

            category    = processed.get("category", feed_category)
            is_headline = processed.get("is_headline", False)
            cat_limit   = CATEGORY_LIMITS.get(category, 7)

            if category_counts.get(category, 0) >= cat_limit:
                skipped_full += 1; continue

            if is_headline and headline_count >= HEADLINE_MAX:
                processed["is_headline"] = False
                is_headline = False

            save_processed_article(article, processed)
            category_counts[category] = category_counts.get(category, 0) + 1
            if is_headline:
                category_counts["headlines"] = category_counts.get("headlines", 0) + 1
            existing_titles.append(title.lower()[:60])

            gap    = category_counts[category] - CATEGORY_MINIMUMS.get(category, 5)
            status = "✅" if gap >= 0 else f"⚠️  {abs(gap)} below min"
            print(f"  ✓ [{category}] {category_counts[category]}/{CATEGORY_LIMITS[category]} {status} | 💰 ${running_cost:.3f}")
            accepted += 1

        except json.JSONDecodeError as e:
            running_cost += COST_PER_ARTICLE
            print(f"  ❌ JSON error: {e}")
        except Exception as e:
            print(f"  ❌ Error: {e}")

    print(f"\nPass 1 — Accepted: {accepted} | Rejected: {rejected} | 💰 ${running_cost:.3f} spent")

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

            # ✅ Budget guard for pass 2
            if running_cost + COST_PER_ARTICLE > DAILY_BUDGET:
                print(f"\n🛑 Budget limit reached (${running_cost:.3f}). Stopping.")
                break

            title    = article["title"]
            content  = article.get("content", "")
            feed_cat = article.get("category", "global-economy")

            if feed_cat not in under_filled:
                continue
            if is_duplicate_story(title, existing_titles):
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
                category_counts[category] = category_counts.get(category, 0) + 1
                existing_titles.append(title.lower()[:60])
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
        if count < minim: all_met = False

    print(f"\n{'✅ ALL MINIMUMS MET' if all_met else '⚠️  SOME STILL BELOW MIN'}")
    print(f"💰 Total cost this run: ${running_cost:.4f} / ${DAILY_BUDGET:.2f} budget")
    print(f"   Remaining: ${DAILY_BUDGET - running_cost:.4f}")
    print("=" * 50)

    enforce_per_category_limit()


if __name__ == "__main__":
    run()