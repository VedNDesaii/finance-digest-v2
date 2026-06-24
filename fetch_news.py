import feedparser
import requests
import re
import uuid
from bs4 import BeautifulSoup
from supabase import create_client
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
import os

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
    "Cache-Control": "no-cache",
}

# ET and Business Standard block regular bots — use Google's feedfetcher UA
ET_HEADERS = {
    "User-Agent": "Feedfetcher-Google; (+http://www.google.com/feedfetcher.html)",
    "Accept": "application/rss+xml, application/xml, text/xml, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
}

FETCH_PER_FEED = 25
IMAGE_BUCKET   = "article-images"

# ─────────────────────────────────────────────────────────────────────────────
# RSS FEEDS
#
# KEY RULES ENFORCED HERE:
# 1. Every URL appears exactly ONCE across the entire list
# 2. Each category has its OWN specific feed — no generic ET industry catch-all
# 3. Google News feeds added for each category — catches EVERY major story
#    that individual publication feeds miss (e.g. Reliance Finance CEO news)
# 4. FETCH_PER_FEED=25 so stories lower down in feeds aren't cut off
#
# HOW DEDUP WORKS (no repeating news across sections):
# - fetch_articles() loads ALL existing links + title prefixes into memory ONCE
# - Every article saved adds its link+title to those in-memory sets
# - So even if the same story appears in 5 different feeds, only the FIRST
#   occurrence is saved — all subsequent hits are skipped instantly
# ─────────────────────────────────────────────────────────────────────────────

RSS_FEEDS = [

    # ══════════════════════════════════════════════════════════════
    # INDIAN MARKETS
    # ══════════════════════════════════════════════════════════════
    {"url": "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",        "category": "indian-markets"},
    {"url": "https://economictimes.indiatimes.com/markets/stocks/rssfeeds/2146842.cms",    "category": "indian-markets"},
    {"url": "https://economictimes.indiatimes.com/markets/ipos/fpos/rssfeeds/9307785.cms", "category": "indian-markets"},
    {"url": "https://www.moneycontrol.com/rss/latestnews.xml",                             "category": "indian-markets"},
    {"url": "https://www.moneycontrol.com/rss/marketreports.xml",                          "category": "indian-markets"},
    {"url": "https://www.business-standard.com/rss/markets-106.rss",                       "category": "indian-markets"},
    {"url": "https://www.thehindubusinessline.com/markets/?service=rss",                   "category": "indian-markets"},
    {"url": "https://www.livemint.com/rss/markets",                                        "category": "indian-markets"},
    # Google News sweep — catches major Indian market stories from ALL sources
    {"url": "https://news.google.com/rss/search?q=nifty+sensex+indian+stock+market&hl=en-IN&gl=IN&ceid=IN:en", "category": "indian-markets"},
    {"url": "https://news.google.com/rss/search?q=NSE+BSE+india+IPO+FII+DII+rupee&hl=en-IN&gl=IN&ceid=IN:en", "category": "indian-markets"},
    {"url": "https://news.google.com/rss/search?q=SEBI+india+stock+market+regulation&hl=en-IN&gl=IN&ceid=IN:en","category": "indian-markets"},

    # ══════════════════════════════════════════════════════════════
    # US MARKETS
    # ══════════════════════════════════════════════════════════════
    {"url": "https://www.cnbc.com/id/10001147/device/rss/rss.html",                        "category": "us-markets"},
    {"url": "https://www.cnbc.com/id/20910258/device/rss/rss.html",                        "category": "us-markets"},
    {"url": "https://www.cnbc.com/id/15839069/device/rss/rss.html",                        "category": "us-markets"},
    {"url": "https://feeds.content.dowjones.io/public/rss/mw_topstories",                  "category": "us-markets"},
    {"url": "https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines",           "category": "us-markets"},
    # Google News sweep — Fed decisions, US earnings, Wall Street moves
    {"url": "https://news.google.com/rss/search?q=fed+interest+rates+SP500+nasdaq+wall+street&hl=en-IN&gl=IN&ceid=IN:en", "category": "us-markets"},
    {"url": "https://news.google.com/rss/search?q=US+stock+market+earnings+dow+jones&hl=en-IN&gl=IN&ceid=IN:en",           "category": "us-markets"},

    # ══════════════════════════════════════════════════════════════
    # GLOBAL ECONOMY
    # ══════════════════════════════════════════════════════════════
    {"url": "https://feeds.bbci.co.uk/news/business/rss.xml",                              "category": "global-economy"},
    {"url": "https://feeds.bbci.co.uk/news/world/rss.xml",                                 "category": "global-economy"},
    {"url": "https://www.theguardian.com/business/economics/rss",                          "category": "global-economy"},
    {"url": "https://economictimes.indiatimes.com/news/international/rssfeeds/858478126.cms", "category": "global-economy"},
    # Google News sweep
    {"url": "https://news.google.com/rss/search?q=global+economy+IMF+world+bank+trade+war+GDP&hl=en-IN&gl=IN&ceid=IN:en", "category": "global-economy"},

    # ══════════════════════════════════════════════════════════════
    # BANKING & FINANCE
    # ══════════════════════════════════════════════════════════════
    {"url": "https://economictimes.indiatimes.com/industry/banking/finance/rssfeeds/13352306.cms",         "category": "banking-finance"},
    {"url": "https://economictimes.indiatimes.com/industry/banking/finance/banking/rssfeeds/1139366.cms",  "category": "banking-finance"},
    {"url": "https://economictimes.indiatimes.com/industry/banking/finance/insure/rssfeeds/1139367.cms",   "category": "banking-finance"},
    {"url": "https://www.business-standard.com/rss/finance-103.rss",                       "category": "banking-finance"},
    {"url": "https://www.business-standard.com/rss/banking-105.rss",                       "category": "banking-finance"},
    {"url": "https://www.moneycontrol.com/rss/banking.xml",                                "category": "banking-finance"},
    {"url": "https://www.thehindubusinessline.com/money-and-banking/?service=rss",         "category": "banking-finance"},
    {"url": "https://www.cnbc.com/id/10000664/device/rss/rss.html",                        "category": "banking-finance"},
    {"url": "https://www.livemint.com/rss/industry",                                       "category": "banking-finance"},
    # Google News — catches CEO arrests, bank frauds, RBI actions missed by RSS
    {"url": "https://news.google.com/rss/search?q=india+bank+CEO+RBI+NBFC+fraud+NPA+banking&hl=en-IN&gl=IN&ceid=IN:en", "category": "banking-finance"},
    {"url": "https://news.google.com/rss/search?q=SBI+HDFC+ICICI+Kotak+bank+india+results+news&hl=en-IN&gl=IN&ceid=IN:en","category": "banking-finance"},

    # ══════════════════════════════════════════════════════════════
    # MACRO & POLICY
    # ══════════════════════════════════════════════════════════════
    {"url": "https://economictimes.indiatimes.com/news/economy/rssfeeds/1373380680.cms",   "category": "macro-policy"},
    {"url": "https://economictimes.indiatimes.com/news/economy/policy/rssfeeds/1114531926.cms", "category": "macro-policy"},
    {"url": "https://economictimes.indiatimes.com/news/economy/indicators/rssfeeds/1114531927.cms","category": "macro-policy"},
    {"url": "https://www.business-standard.com/rss/economy-policy-102.rss",                "category": "macro-policy"},
    {"url": "https://www.moneycontrol.com/rss/economy.xml",                                "category": "macro-policy"},
    {"url": "https://www.thehindubusinessline.com/economy/?service=rss",                   "category": "macro-policy"},
    # Google News sweep
    {"url": "https://news.google.com/rss/search?q=india+GDP+inflation+CPI+RBI+MPC+budget+fiscal+policy&hl=en-IN&gl=IN&ceid=IN:en", "category": "macro-policy"},

    # ══════════════════════════════════════════════════════════════
    # TECHNOLOGY & IT
    # ══════════════════════════════════════════════════════════════
    {"url": "https://economictimes.indiatimes.com/tech/rssfeeds/13357270.cms",             "category": "technology-it"},
    {"url": "https://economictimes.indiatimes.com/tech/startups/rssfeeds/14080.cms",       "category": "technology-it"},
    {"url": "https://www.business-standard.com/rss/technology-108.rss",                    "category": "technology-it"},
    {"url": "https://www.moneycontrol.com/rss/technology.xml",                             "category": "technology-it"},
    {"url": "https://www.thehindubusinessline.com/info-tech/?service=rss",                 "category": "technology-it"},
    {"url": "https://www.cnbc.com/id/19854910/device/rss/rss.html",                        "category": "technology-it"},
    {"url": "https://www.livemint.com/rss/technology",                                     "category": "technology-it"},
    # Google News sweep
    {"url": "https://news.google.com/rss/search?q=TCS+Infosys+Wipro+HCL+IT+sector+india+tech&hl=en-IN&gl=IN&ceid=IN:en", "category": "technology-it"},

    # ══════════════════════════════════════════════════════════════
    # PHARMA & HEALTH
    # ══════════════════════════════════════════════════════════════
    {"url": "https://economictimes.indiatimes.com/industry/healthcare/biotech/rssfeeds/13358050.cms", "category": "pharma-health"},
    {"url": "https://economictimes.indiatimes.com/industry/healthcare/biotech/pharmaceuticals/rssfeeds/13358052.cms", "category": "pharma-health"},
    {"url": "https://www.business-standard.com/rss/healthcare-241.rss",                    "category": "pharma-health"},
    {"url": "https://www.moneycontrol.com/rss/pharma.xml",                                 "category": "pharma-health"},
    {"url": "https://www.thehindubusinessline.com/pharma/?service=rss",                    "category": "pharma-health"},
    {"url": "https://feeds.bbci.co.uk/news/health/rss.xml",                                "category": "pharma-health"},
    {"url": "https://www.livemint.com/rss/science",                                        "category": "pharma-health"},
    # Google News sweep
    {"url": "https://news.google.com/rss/search?q=india+pharma+drug+approval+USFDA+Cipla+Sun+pharma&hl=en-IN&gl=IN&ceid=IN:en", "category": "pharma-health"},

    # ══════════════════════════════════════════════════════════════
    # AUTO & EV
    # ══════════════════════════════════════════════════════════════
    {"url": "https://economictimes.indiatimes.com/industry/auto/rssfeeds/13354085.cms",    "category": "auto-ev"},
    {"url": "https://economictimes.indiatimes.com/industry/auto/cars-/-uvs/rssfeeds/13354086.cms", "category": "auto-ev"},
    {"url": "https://economictimes.indiatimes.com/industry/auto/two-wheelers-/-four-wheelers/rssfeeds/13354087.cms", "category": "auto-ev"},
    {"url": "https://www.business-standard.com/rss/automobile-103.rss",                    "category": "auto-ev"},
    {"url": "https://www.moneycontrol.com/rss/automobile.xml",                             "category": "auto-ev"},
    {"url": "https://www.thehindubusinessline.com/auto/?service=rss",                      "category": "auto-ev"},
    {"url": "https://www.livemint.com/rss/auto",                                           "category": "auto-ev"},
    # Google News sweep
    {"url": "https://news.google.com/rss/search?q=india+car+sales+EV+electric+vehicle+Maruti+Tata+Motors&hl=en-IN&gl=IN&ceid=IN:en", "category": "auto-ev"},

    # ══════════════════════════════════════════════════════════════
    # ENERGY & OIL
    # ══════════════════════════════════════════════════════════════
    {"url": "https://economictimes.indiatimes.com/industry/energy/rssfeeds/13352502.cms",  "category": "energy-oil"},
    {"url": "https://economictimes.indiatimes.com/industry/energy/oil-gas/rssfeeds/13352503.cms", "category": "energy-oil"},
    {"url": "https://economictimes.indiatimes.com/industry/energy/power/rssfeeds/13352504.cms",   "category": "energy-oil"},
    {"url": "https://www.business-standard.com/rss/oil-gas-109.rss",                       "category": "energy-oil"},
    {"url": "https://www.thehindubusinessline.com/economy/energy/?service=rss",            "category": "energy-oil"},
    {"url": "https://www.cnbc.com/id/10000734/device/rss/rss.html",                        "category": "energy-oil"},
    # Google News sweep
    {"url": "https://news.google.com/rss/search?q=crude+oil+OPEC+Brent+WTI+ONGC+fuel+price+india&hl=en-IN&gl=IN&ceid=IN:en", "category": "energy-oil"},

    # ══════════════════════════════════════════════════════════════
    # METALS & MINING
    # ══════════════════════════════════════════════════════════════
    {"url": "https://economictimes.indiatimes.com/industry/indl-goods/svs/metals-mining/rssfeeds/13357688.cms", "category": "metals-mining"},
    {"url": "https://economictimes.indiatimes.com/industry/indl-goods/svs/steel/rssfeeds/13357689.cms",         "category": "metals-mining"},
    {"url": "https://www.business-standard.com/rss/metals-mining-120.rss",                 "category": "metals-mining"},
    {"url": "https://www.moneycontrol.com/rss/commodities.xml",                            "category": "metals-mining"},
    {"url": "https://www.thehindubusinessline.com/markets/commodities/?service=rss",       "category": "metals-mining"},
    # Google News sweep
    {"url": "https://news.google.com/rss/search?q=steel+aluminium+copper+Tata+Steel+Hindalco+Vedanta+india&hl=en-IN&gl=IN&ceid=IN:en", "category": "metals-mining"},

    # ══════════════════════════════════════════════════════════════
    # INFRASTRUCTURE
    # ══════════════════════════════════════════════════════════════
    {"url": "https://economictimes.indiatimes.com/industry/transportation/rssfeeds/13353990.cms",   "category": "infrastructure"},
    {"url": "https://economictimes.indiatimes.com/industry/indl-goods/svs/construction/rssfeeds/13357690.cms", "category": "infrastructure"},
    {"url": "https://economictimes.indiatimes.com/news/economy/infrastructure/rssfeeds/1114531928.cms","category": "infrastructure"},
    {"url": "https://www.business-standard.com/rss/infrastructure-217.rss",                "category": "infrastructure"},
    {"url": "https://www.thehindubusinessline.com/economy/logistics/?service=rss",         "category": "infrastructure"},
    # Google News sweep
    {"url": "https://news.google.com/rss/search?q=india+infrastructure+NHAI+railway+airport+capex+L%26T&hl=en-IN&gl=IN&ceid=IN:en", "category": "infrastructure"},

    # ══════════════════════════════════════════════════════════════
    # FMCG & CONSUMER
    # ══════════════════════════════════════════════════════════════
    {"url": "https://economictimes.indiatimes.com/industry/cons-products/rssfeeds/13356558.cms",    "category": "fmcg-consumer"},
    {"url": "https://economictimes.indiatimes.com/industry/cons-products/fmcg/rssfeeds/13356559.cms","category": "fmcg-consumer"},
    {"url": "https://economictimes.indiatimes.com/industry/cons-products/food/rssfeeds/13356560.cms","category": "fmcg-consumer"},
    {"url": "https://www.business-standard.com/rss/consumer-104.rss",                      "category": "fmcg-consumer"},
    {"url": "https://www.moneycontrol.com/rss/fmcg.xml",                                   "category": "fmcg-consumer"},
    {"url": "https://www.thehindubusinessline.com/companies/?service=rss",                 "category": "fmcg-consumer"},
    {"url": "https://www.livemint.com/rss/companies",                                      "category": "fmcg-consumer"},
    # Google News sweep
    {"url": "https://news.google.com/rss/search?q=HUL+Nestle+ITC+Dabur+FMCG+india+consumer+demand&hl=en-IN&gl=IN&ceid=IN:en", "category": "fmcg-consumer"},

    # ══════════════════════════════════════════════════════════════
    # RENEWABLES
    # ══════════════════════════════════════════════════════════════
    {"url": "https://economictimes.indiatimes.com/industry/renewables/rssfeeds/81585238.cms",       "category": "renewables"},
    {"url": "https://economictimes.indiatimes.com/industry/energy/renewables/rssfeeds/13352505.cms", "category": "renewables"},
    {"url": "https://www.business-standard.com/rss/renewable-energy-193.rss",              "category": "renewables"},
    {"url": "https://www.thehindubusinessline.com/economy/agri-business/green/?service=rss","category": "renewables"},
    # Google News sweep
    {"url": "https://news.google.com/rss/search?q=solar+wind+green+hydrogen+Adani+Green+NTPC+india+renewable&hl=en-IN&gl=IN&ceid=IN:en", "category": "renewables"},

    # ══════════════════════════════════════════════════════════════
    # REAL ESTATE
    # ══════════════════════════════════════════════════════════════
    {"url": "https://economictimes.indiatimes.com/industry/services/property-/-cstruction/rssfeeds/13356561.cms", "category": "real-estate"},
    {"url": "https://economictimes.indiatimes.com/wealth/real-estate/rssfeeds/837555174.cms", "category": "real-estate"},
    {"url": "https://www.business-standard.com/rss/real-estate-175.rss",                   "category": "real-estate"},
    {"url": "https://www.moneycontrol.com/rss/realestate.xml",                             "category": "real-estate"},
    {"url": "https://www.thehindubusinessline.com/real-estate/?service=rss",               "category": "real-estate"},
    {"url": "https://www.livemint.com/rss/real-estate",                                    "category": "real-estate"},
    # Google News sweep
    {"url": "https://news.google.com/rss/search?q=india+housing+real+estate+DLF+property+REIT&hl=en-IN&gl=IN&ceid=IN:en", "category": "real-estate"},

    # ══════════════════════════════════════════════════════════════
    # TELECOM & MEDIA
    # ══════════════════════════════════════════════════════════════
    {"url": "https://economictimes.indiatimes.com/industry/telecom/rssfeeds/13354090.cms",          "category": "telecom-media"},
    {"url": "https://economictimes.indiatimes.com/industry/telecom/telecom-news/rssfeeds/13354091.cms","category": "telecom-media"},
    {"url": "https://economictimes.indiatimes.com/industry/media/entertainment/rssfeeds/13357212.cms","category": "telecom-media"},
    {"url": "https://www.business-standard.com/rss/telecom-141.rss",                       "category": "telecom-media"},
    {"url": "https://www.moneycontrol.com/rss/telecom.xml",                                "category": "telecom-media"},
    {"url": "https://www.thehindubusinessline.com/info-tech/telecom/?service=rss",         "category": "telecom-media"},
    # Google News sweep
    {"url": "https://news.google.com/rss/search?q=Jio+Airtel+5G+spectrum+telecom+india+OTT&hl=en-IN&gl=IN&ceid=IN:en", "category": "telecom-media"},

]


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def delete_in_chunks(table, id_list):
    for i in range(0, len(id_list), 50):
        supabase.table(table).delete().in_("id", id_list[i:i+50]).execute()


def cleanup_old_articles():
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    print(f"\n🧹 Cleaning up articles older than 24 hours...")
    old_raw = supabase.table("raw_articles").select("id").lt("created_at", cutoff).execute()
    old_ids = [r["id"] for r in old_raw.data]
    if not old_ids:
        print("  ✅ Nothing to clean")
        return
    print(f"  Found {len(old_ids)} old raw articles")
    all_proc = []
    for i in range(0, len(old_ids), 50):
        res = supabase.table("processed_articles").select("id").in_("raw_article_id", old_ids[i:i+50]).execute()
        all_proc.extend([r["id"] for r in res.data])
    if all_proc:
        delete_in_chunks("processed_articles", all_proc)
        print(f"  🗑️  Deleted {len(all_proc)} old processed articles")
    delete_in_chunks("raw_articles", old_ids)
    print(f"  🗑️  Deleted {len(old_ids)} old raw articles")


def get_existing_links():
    """Load all existing links and title prefixes into memory for O(1) dedup."""
    result = supabase.table("raw_articles").select("link, title").execute()
    links  = {r["link"]  for r in result.data if r.get("link")}
    titles = {r["title"][:60].lower().strip() for r in result.data if r.get("title")}
    return links, titles


def fetch_feed(feed_url):
    try:
        is_et = "economictimes" in feed_url or "business-standard" in feed_url
        headers  = ET_HEADERS if is_et else HEADERS
        response = requests.get(feed_url, headers=headers, timeout=15)
        if response.status_code == 403 and not is_et:
            response = requests.get(feed_url, headers=ET_HEADERS, timeout=15)
        response.raise_for_status()
        return feedparser.parse(response.content)
    except Exception as e:
        print(f"  ❌ Could not fetch feed: {e}")
        return None


def get_rss_summary(entry):
    raw = getattr(entry, 'summary', '') or getattr(entry, 'description', '') or ''
    return re.sub(r'<[^>]+>', '', raw).strip()


def scrape_content(url):
    try:
        r    = requests.get(url, headers=HEADERS, timeout=8, allow_redirects=True)
        soup = BeautifulSoup(r.text, "html.parser")
        for tag in soup(["script", "style", "nav", "header", "footer", "aside", "iframe"]):
            tag.decompose()
        article = (
            soup.find("article") or
            soup.find(class_=re.compile(r"article.body|story.body|article.content", re.I)) or
            soup.find("div", class_=re.compile(r"content|body|story|article", re.I))
        )
        text = article.get_text(separator=" ", strip=True) if article else soup.get_text(separator=" ", strip=True)
        return re.sub(r'\s+', ' ', text).strip()[:3000]
    except Exception:
        return ""


def get_og_image(url):
    try:
        r    = requests.get(url, headers=HEADERS, timeout=8, allow_redirects=True)
        soup = BeautifulSoup(r.text, "html.parser")
        for attr in [("meta", {"property": "og:image"}), ("meta", {"name": "twitter:image"})]:
            tag = soup.find(*attr)
            if tag and tag.get("content", "").startswith("http"):
                return tag["content"].strip()
    except Exception:
        pass
    return None


def get_image_from_entry(entry):
    if hasattr(entry, 'media_content')   and entry.media_content:
        return entry.media_content[0].get('url')
    if hasattr(entry, 'media_thumbnail') and entry.media_thumbnail:
        return entry.media_thumbnail[0].get('url')
    return None


def upload_image_to_supabase(image_url):
    if not image_url:
        return None
    try:
        response = requests.get(image_url, headers=HEADERS, timeout=8)
        if response.status_code != 200:
            return None
        ct = response.headers.get("Content-Type", "image/jpeg")
        if not ct.startswith("image/"):
            return None
        ext = "jpg"
        if "png"  in ct: ext = "png"
        elif "webp" in ct: ext = "webp"
        elif "gif"  in ct: ext = "gif"
        filename = f"{uuid.uuid4().hex}.{ext}"
        supabase.storage.from_(IMAGE_BUCKET).upload(
            path=filename,
            file=response.content,
            file_options={"content-type": ct, "upsert": "true"}
        )
        return f"{SUPABASE_URL}/storage/v1/object/public/{IMAGE_BUCKET}/{filename}"
    except Exception as e:
        print(f"  ⚠️  Image upload failed: {e}")
        return None


def is_recent(entry):
    """Accept only articles published within the last 36 hours."""
    pub = getattr(entry, 'published_parsed', None) or getattr(entry, 'updated_parsed', None)
    if not pub:
        return True   # no date = accept
    try:
        pub_dt = datetime(*pub[:6], tzinfo=timezone.utc)
        return pub_dt >= datetime.now(timezone.utc) - timedelta(hours=36)
    except Exception:
        return True


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def fetch_articles():
    cleanup_old_articles()

    print("\n📋 Loading existing articles for dedup check...")
    existing_links, existing_titles = get_existing_links()
    print(f"  {len(existing_links)} existing articles in DB")

    # Track per-category counts so we can log useful stats
    category_saved = {}
    total_saved    = 0
    seen_feeds     = set()   # guard against any accidental duplicate feed URLs

    for feed_item in RSS_FEEDS:
        feed_url = feed_item["url"]
        category = feed_item["category"]

        # Skip if somehow the same URL appears twice
        if feed_url in seen_feeds:
            print(f"  ⚠️  Skipping duplicate feed URL: {feed_url}")
            continue
        seen_feeds.add(feed_url)

        print(f"\n📡 [{category}] {feed_url}")
        feed = fetch_feed(feed_url)

        if not feed or not feed.entries:
            print("  ⚠️  No entries")
            continue

        print(f"  ✅ {len(feed.entries)} entries")
        saved_this = 0

        for entry in feed.entries[:FETCH_PER_FEED]:
            try:
                title = getattr(entry, 'title', '').strip()
                link  = getattr(entry, 'link',  None)

                if not title or not link:
                    continue

                # ── Recency check ──────────────────────────────────────────
                if not is_recent(entry):
                    continue

                # ── Dedup: exact link ──────────────────────────────────────
                if link in existing_links:
                    continue

                # ── Dedup: near-identical title (first 60 chars) ───────────
                title_key = title[:60].lower().strip()
                if title_key in existing_titles:
                    continue

                # ── Scrape content ─────────────────────────────────────────
                content = scrape_content(link)
                if len(content) < 100:
                    rss_summary = get_rss_summary(entry)
                    content     = rss_summary if len(rss_summary) >= 30 else title

                # ── Image ──────────────────────────────────────────────────
                raw_img   = get_og_image(link) or get_image_from_entry(entry)
                image_url = upload_image_to_supabase(raw_img) or raw_img

                # ── Save ───────────────────────────────────────────────────
                supabase.table("raw_articles").insert({
                    "title":        title,
                    "source":       feed.feed.get('title', feed_url),
                    "link":         link,
                    "published_at": datetime.utcnow().isoformat(),
                    "content":      content,
                    "image_url":    image_url,
                    "category":     category,
                }).execute()

                # ── Update in-memory dedup sets ────────────────────────────
                existing_links.add(link)
                existing_titles.add(title_key)

                saved_this  += 1
                total_saved += 1
                category_saved[category] = category_saved.get(category, 0) + 1

            except Exception as e:
                print(f"  ❌ {e}")

        print(f"  📊 Saved {saved_this}")

    # ── Summary ────────────────────────────────────────────────────────────
    print(f"\n{'='*50}")
    print(f"🎉 DONE — {total_saved} articles saved")
    print("Per-category breakdown:")
    for cat, count in sorted(category_saved.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {count}")
    print("="*50)


if __name__ == "__main__":
    fetch_articles()