import feedparser
import requests
import re
from bs4 import BeautifulSoup
from supabase import create_client
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
import os

load_dotenv(override=True)  # .env always wins over a stale shell key

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

ET_HEADERS = {
    "User-Agent": "Feedfetcher-Google; (+http://www.google.com/feedfetcher.html)",
    "Accept": "application/rss+xml, application/xml, text/xml, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
}

FETCH_PER_FEED  = 50     # scan deeper into each feed so headlines aren't truncated (was 25)
MAX_TOTAL_FETCH = 500    # cap on articles scraped + saved per run — the biggest stories are saved FIRST

RSS_FEEDS = [
    # ── Indian Markets ──
    {"url": "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",               "category": "indian-markets"},
    {"url": "https://www.moneycontrol.com/rss/latestnews.xml",                                    "category": "indian-markets"},
    {"url": "https://www.thehindubusinessline.com/markets/?service=rss",                          "category": "indian-markets"},
    {"url": "https://www.business-standard.com/rss/markets-106.rss",                              "category": "indian-markets"},
    {"url": "https://economictimes.indiatimes.com/markets/stocks/rssfeeds/2146842.cms",           "category": "indian-markets"},
    {"url": "https://www.moneycontrol.com/rss/marketreports.xml",                                 "category": "indian-markets"},
    {"url": "https://www.livemint.com/rss/markets",                                               "category": "indian-markets"},
    # ── Top stories (BROAD) — catch the day's biggest news across every beat;
    #    the processor reclassifies each by its actual content. ──
    {"url": "https://economictimes.indiatimes.com/rssfeedstopstories.cms",                         "category": "indian-markets"},
    {"url": "https://www.livemint.com/rss/news",                                                   "category": "indian-markets"},
    {"url": "https://www.business-standard.com/rss/home_page_top_stories.rss",                      "category": "indian-markets"},
    {"url": "https://www.moneycontrol.com/rss/business.xml",                                        "category": "banking-finance"},
    # ── Google News aggregators — the day's biggest stories across EVERY
    #    publisher, so a major story can't be missed before processing sees it.
    #    (category here is a placeholder; the processor reclassifies each.) ──
    {"url": "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-IN&gl=IN&ceid=IN:en",   "category": "indian-markets"},
    {"url": "https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-IN&gl=IN&ceid=IN:en", "category": "technology-it"},
    {"url": "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-US&gl=US&ceid=US:en",   "category": "us-markets"},
    {"url": "https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-US&gl=US&ceid=US:en", "category": "technology-it"},
    {"url": "https://news.google.com/rss/search?q=(acquisition%20OR%20merger%20OR%20IPO%20OR%20%22new%20CEO%22%20OR%20layoffs%20OR%20bankruptcy%20OR%20%22rate%20cut%22%20OR%20earnings%20OR%20regulation)%20when:2d&hl=en-IN&gl=IN&ceid=IN:en", "category": "global-economy"},
    {"url": "https://news.google.com/rss/search?q=(stock%20market%20OR%20Federal%20Reserve%20OR%20tariffs%20OR%20earnings%20OR%20acquisition%20OR%20chipmaker)%20when:1d&hl=en-US&gl=US&ceid=US:en", "category": "us-markets"},
    # ── US Markets ──
    {"url": "https://www.cnbc.com/id/10001147/device/rss/rss.html",                               "category": "us-markets"},
    {"url": "https://feeds.content.dowjones.io/public/rss/mw_topstories",                        "category": "us-markets"},
    {"url": "https://www.cnbc.com/id/20910258/device/rss/rss.html",                               "category": "us-markets"},
    {"url": "https://www.cnbc.com/id/15839069/device/rss/rss.html",                               "category": "us-markets"},
    {"url": "https://www.cnbc.com/id/100003114/device/rss/rss.html",                              "category": "us-markets"},
    {"url": "https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines",                 "category": "us-markets"},
    # ── Global Economy ──
    {"url": "https://feeds.bbci.co.uk/news/business/rss.xml",                                     "category": "global-economy"},
    {"url": "https://feeds.bbci.co.uk/news/world/rss.xml",                                        "category": "global-economy"},
    {"url": "https://www.theguardian.com/business/economics/rss",                                 "category": "global-economy"},
    {"url": "https://economictimes.indiatimes.com/news/international/rssfeeds/858478126.cms",     "category": "global-economy"},
    # ── Banking & Finance ──
    {"url": "https://www.business-standard.com/rss/finance-103.rss",                              "category": "banking-finance"},
    {"url": "https://www.business-standard.com/rss/banking-105.rss",                              "category": "banking-finance"},
    {"url": "https://economictimes.indiatimes.com/industry/rssfeeds/13352306.cms",                "category": "banking-finance"},
    {"url": "https://www.moneycontrol.com/rss/banking.xml",                                       "category": "banking-finance"},
    {"url": "https://www.thehindubusinessline.com/money-and-banking/?service=rss",                "category": "banking-finance"},
    {"url": "https://www.cnbc.com/id/10000664/device/rss/rss.html",                               "category": "banking-finance"},
    {"url": "https://www.livemint.com/rss/industry",                                              "category": "banking-finance"},

    # ── Investment Banking (deals, IPOs, PE/VC, startups) ──
    {"url": "https://news.crunchbase.com/feed/",                                                   "category": "investment-banking"},
    {"url": "https://inc42.com/feed/",                                                             "category": "investment-banking"},
    # ── Macro & Policy ──
    {"url": "https://www.business-standard.com/rss/economy-policy-102.rss",                       "category": "macro-policy"},
    {"url": "https://economictimes.indiatimes.com/news/economy/rssfeeds/1373380680.cms",          "category": "macro-policy"},
    {"url": "https://www.thehindubusinessline.com/economy/?service=rss",                          "category": "macro-policy"},
    {"url": "https://www.moneycontrol.com/rss/economy.xml",                                       "category": "macro-policy"},
    # ── Technology & IT ──
    {"url": "https://economictimes.indiatimes.com/tech/rssfeeds/13357270.cms",                    "category": "technology-it"},
    {"url": "https://www.business-standard.com/rss/technology-108.rss",                           "category": "technology-it"},
    {"url": "https://www.thehindubusinessline.com/info-tech/?service=rss",                        "category": "technology-it"},
    {"url": "https://www.moneycontrol.com/rss/technology.xml",                                    "category": "technology-it"},
    {"url": "https://www.cnbc.com/id/19854910/device/rss/rss.html",                               "category": "technology-it"},
    {"url": "https://www.livemint.com/rss/technology",                                            "category": "technology-it"},
    # ── Pharma & Health ──
    {"url": "https://economictimes.indiatimes.com/industry/healthcare/biotech/rssfeeds/13358050.cms", "category": "pharma-health"},
    {"url": "https://www.business-standard.com/rss/healthcare-241.rss",                           "category": "pharma-health"},
    {"url": "https://www.thehindubusinessline.com/pharma/?service=rss",                           "category": "pharma-health"},
    {"url": "https://www.moneycontrol.com/rss/pharma.xml",                                        "category": "pharma-health"},
    {"url": "https://www.livemint.com/rss/science",                                               "category": "pharma-health"},
    {"url": "https://feeds.bbci.co.uk/news/health/rss.xml",                                       "category": "pharma-health"},
    # ── Auto & EV ──
    {"url": "https://economictimes.indiatimes.com/industry/rssfeeds/13352306.cms",                "category": "auto-ev"},
    {"url": "https://www.business-standard.com/rss/automobile-103.rss",                           "category": "auto-ev"},
    {"url": "https://www.thehindubusinessline.com/auto/?service=rss",                             "category": "auto-ev"},
    {"url": "https://www.moneycontrol.com/rss/automobile.xml",                                    "category": "auto-ev"},
    {"url": "https://www.livemint.com/rss/auto",                                                  "category": "auto-ev"},
    # ── Energy & Oil ──
    {"url": "https://economictimes.indiatimes.com/industry/rssfeeds/13352306.cms",                "category": "energy-oil"},
    {"url": "https://www.business-standard.com/rss/oil-gas-109.rss",                              "category": "energy-oil"},
    {"url": "https://www.thehindubusinessline.com/economy/energy/?service=rss",                   "category": "energy-oil"},
    {"url": "https://www.cnbc.com/id/10000734/device/rss/rss.html",                               "category": "energy-oil"},
    # ── Metals & Mining ──
    {"url": "https://economictimes.indiatimes.com/industry/indl-goods/svs/rssfeeds/13357688.cms", "category": "metals-mining"},
    {"url": "https://www.business-standard.com/rss/metals-mining-120.rss",                        "category": "metals-mining"},
    {"url": "https://www.thehindubusinessline.com/markets/commodities/?service=rss",              "category": "metals-mining"},
    {"url": "https://www.moneycontrol.com/rss/commodities.xml",                                   "category": "metals-mining"},
    # ── Infrastructure ──
    {"url": "https://economictimes.indiatimes.com/industry/indl-goods/svs/rssfeeds/13357688.cms", "category": "infrastructure"},
    {"url": "https://www.business-standard.com/rss/infrastructure-217.rss",                       "category": "infrastructure"},
    {"url": "https://economictimes.indiatimes.com/news/economy/rssfeeds/1373380680.cms",          "category": "infrastructure"},
    {"url": "https://www.thehindubusinessline.com/economy/logistics/?service=rss",                "category": "infrastructure"},
    {"url": "https://economictimes.indiatimes.com/industry/transportation/rssfeeds/13353990.cms", "category": "infrastructure"},
    # ── FMCG & Consumer ──
    {"url": "https://economictimes.indiatimes.com/industry/rssfeeds/13352306.cms",                "category": "fmcg-consumer"},
    {"url": "https://www.business-standard.com/rss/consumer-104.rss",                             "category": "fmcg-consumer"},
    {"url": "https://www.moneycontrol.com/rss/fmcg.xml",                                          "category": "fmcg-consumer"},
    {"url": "https://www.thehindubusinessline.com/companies/?service=rss",                        "category": "fmcg-consumer"},
    {"url": "https://www.livemint.com/rss/companies",                                             "category": "fmcg-consumer"},
    # ── Renewables ──
    {"url": "https://economictimes.indiatimes.com/industry/renewables/rssfeeds/81585238.cms",     "category": "renewables"},
    {"url": "https://www.business-standard.com/rss/renewable-energy-193.rss",                     "category": "renewables"},
    {"url": "https://www.thehindubusinessline.com/economy/agri-business/green/?service=rss",      "category": "renewables"},
    {"url": "https://www.livemint.com/rss/industry",                                              "category": "renewables"},
    # ── Real Estate ──
    {"url": "https://economictimes.indiatimes.com/wealth/rssfeeds/837555174.cms",                 "category": "banking-finance"},
    {"url": "https://www.moneycontrol.com/rss/realestate.xml",                                    "category": "real-estate"},
    {"url": "https://www.livemint.com/rss/real-estate",                                           "category": "real-estate"},
    {"url": "https://www.thehindubusinessline.com/real-estate/?service=rss",                      "category": "real-estate"},
    {"url": "https://www.business-standard.com/rss/real-estate-175.rss",                          "category": "real-estate"},
    # ── Telecom & Media ──
    {"url": "https://economictimes.indiatimes.com/industry/rssfeeds/13352306.cms",                "category": "telecom-media"},
    {"url": "https://www.business-standard.com/rss/telecom-141.rss",                              "category": "telecom-media"},
    {"url": "https://www.moneycontrol.com/rss/telecom.xml",                                       "category": "telecom-media"},
    {"url": "https://www.livemint.com/rss/technology",                                            "category": "telecom-media"},
    {"url": "https://economictimes.indiatimes.com/industry/media/entertainment/rssfeeds/13357212.cms", "category": "telecom-media"},
    {"url": "https://www.thehindubusinessline.com/info-tech/telecom/?service=rss",                "category": "telecom-media"},

    # ── Sector-specialist sources (Sector News Source Directory; feeds verified live) ──
    # Technology & IT
    {"url": "https://analyticsindiamag.com/feed/",                                                "category": "technology-it"},
    {"url": "https://yourstory.com/feed",                                                         "category": "technology-it"},
    {"url": "https://www.expresscomputer.in/feed/",                                               "category": "technology-it"},
    {"url": "https://feeds.feedburner.com/TheHackersNews",                                         "category": "technology-it"},
    {"url": "https://www.darkreading.com/rss.xml",                                                 "category": "technology-it"},
    {"url": "https://www.ciodive.com/feeds/news/",                                                 "category": "technology-it"},
    # Pharma & Health
    {"url": "https://www.expresspharma.in/feed/",                                                  "category": "pharma-health"},
    {"url": "https://www.biopharmadive.com/feeds/news/",                                           "category": "pharma-health"},
    {"url": "https://www.statnews.com/feed/",                                                      "category": "pharma-health"},
    {"url": "https://pharma.economictimes.indiatimes.com/rss/topstories",                          "category": "pharma-health"},
    # Auto & EV
    {"url": "https://electrek.co/feed/",                                                           "category": "auto-ev"},
    {"url": "https://cnevpost.com/feed/",                                                          "category": "auto-ev"},
    # Energy & Oil
    {"url": "https://oilprice.com/rss/main",                                                       "category": "energy-oil"},
    # Metals & Mining
    {"url": "https://im-mining.com/feed/",                                                         "category": "metals-mining"},
    {"url": "https://www.mining.com/feed/",                                                        "category": "metals-mining"},
    # Renewables
    {"url": "https://mercomindia.com/feed/",                                                       "category": "renewables"},
    {"url": "https://www.pv-magazine-india.com/feed/",                                             "category": "renewables"},
    # Real Estate
    {"url": "https://www.mingtiandi.com/feed/",                                                    "category": "real-estate"},
    {"url": "https://www.bisnow.com/rss",                                                          "category": "real-estate"},
    # Infrastructure
    {"url": "https://www.constructiondive.com/feeds/news/",                                        "category": "infrastructure"},
    # FMCG & Consumer
    {"url": "https://www.fooddive.com/feeds/news/",                                                "category": "fmcg-consumer"},
    {"url": "https://www.retaildive.com/feeds/news/",                                              "category": "fmcg-consumer"},
    # Telecom & Media
    {"url": "https://www.lightreading.com/rss.xml",                                                "category": "telecom-media"},
    {"url": "https://www.mobileworldlive.com/feed/",                                               "category": "telecom-media"},
    # ── Crypto (new sector) ──
    {"url": "https://www.coindesk.com/arc/outboundfeeds/rss/",                                     "category": "crypto"},
    {"url": "https://cointelegraph.com/rss",                                                       "category": "crypto"},
    {"url": "https://decrypt.co/feed",                                                             "category": "crypto"},
    {"url": "https://blockworks.co/feed",                                                          "category": "crypto"},
    {"url": "https://www.theblock.co/rss.xml",                                                     "category": "crypto"},
]


def delete_in_chunks(table, id_list):
    for i in range(0, len(id_list), 50):
        chunk = id_list[i:i + 50]
        supabase.table(table).delete().in_("id", chunk).execute()


# Days of history to retain so the app can browse "previous days". Past this
# window articles are pruned to stay well within the Supabase free tier.
RETENTION_DAYS = 30

def cleanup_old_articles():
    cutoff = (datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)).isoformat()
    print(f"\n🧹 Cleaning up articles older than {RETENTION_DAYS} days...")
    old_raw = supabase.table("raw_articles").select("id").lt("created_at", cutoff).execute()
    old_raw_ids = [r["id"] for r in old_raw.data]
    if not old_raw_ids:
        print("  ✅ No old articles to delete")
        return
    print(f"  Found {len(old_raw_ids)} old raw articles")
    all_processed_ids = []
    for i in range(0, len(old_raw_ids), 50):
        chunk = old_raw_ids[i:i + 50]
        res = supabase.table("processed_articles").select("id").in_("raw_article_id", chunk).execute()
        all_processed_ids.extend([r["id"] for r in res.data])
    if all_processed_ids:
        delete_in_chunks("processed_articles", all_processed_ids)
        print(f"  🗑️  Deleted {len(all_processed_ids)} old processed articles")
    delete_in_chunks("raw_articles", old_raw_ids)
    print(f"  🗑️  Deleted {len(old_raw_ids)} old raw articles")


def get_existing_links():
    # Exact-URL dedup stays broad (never re-ingest the same link across the whole
    # 30-day archive). But the title-prefix dedup is scoped to ~48h — otherwise
    # recurring daily headline formats collide with weeks of old titles and block
    # fresh news from being fetched at all.
    all_rows = supabase.table("raw_articles").select("link").execute()
    links = {r["link"] for r in all_rows.data if r.get("link")}
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()
    recent = supabase.table("raw_articles").select("title").gte("created_at", cutoff).execute()
    titles = {r["title"][:60].lower().strip() for r in recent.data if r.get("title")}
    return links, titles


def fetch_feed(feed_url):
    try:
        is_et = "economictimes" in feed_url or "business-standard" in feed_url
        headers = ET_HEADERS if is_et else HEADERS
        response = requests.get(feed_url, headers=headers, timeout=15)
        if response.status_code == 403 and not is_et:
            response = requests.get(feed_url, headers=ET_HEADERS, timeout=15)
        response.raise_for_status()
        return feedparser.parse(response.content)
    except Exception as e:
        print(f"  ❌ Could not fetch feed: {e}")
        return None


def get_rss_summary(entry):
    summary = getattr(entry, 'summary', '') or getattr(entry, 'description', '') or ''
    return re.sub(r'<[^>]+>', '', summary).strip()


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


def get_image_from_entry(entry):
    if hasattr(entry, 'media_content') and entry.media_content:
        return entry.media_content[0].get('url')
    if hasattr(entry, 'media_thumbnail') and entry.media_thumbnail:
        return entry.media_thumbnail[0].get('url')
    return None


def get_og_image(url):
    try:
        r    = requests.get(url, headers=HEADERS, timeout=8, allow_redirects=True)
        soup = BeautifulSoup(r.text, "html.parser")
        og   = soup.find("meta", property="og:image")
        if og and og.get("content"):
            img = og["content"].strip()
            if img.startswith("http"):
                return img
        tw = soup.find("meta", attrs={"name": "twitter:image"})
        if tw and tw.get("content"):
            img = tw["content"].strip()
            if img.startswith("http"):
                return img
    except Exception:
        pass
    return None


def is_today(entry):
    published = getattr(entry, 'published_parsed', None) or getattr(entry, 'updated_parsed', None)
    if not published:
        return True
    try:
        pub_dt = datetime(*published[:6], tzinfo=timezone.utc)
        cutoff = datetime.now(timezone.utc) - timedelta(hours=36)
        return pub_dt >= cutoff
    except Exception:
        return True


def scrape_vccircle(existing_links, existing_titles):
    """VCCircle has no RSS feed and blocks the search crawler, so scrape its
    homepage directly. Headlines are bare anchor tags with single-segment
    article slugs (e.g. /baincapital-to-acquire-...); nav links are shorter."""
    print("\n📡 [investment-banking] Scraping VCCircle homepage...")
    saved = 0
    try:
        r = requests.get("https://www.vccircle.com/", headers=HEADERS, timeout=15)
        soup = BeautifulSoup(r.text, "html.parser")
        seen, picks = set(), []
        for a in soup.find_all("a", href=True):
            t = a.get_text(strip=True)
            h = a["href"]
            if len(t) >= 35 and h.startswith("/") and h.count("/") == 1 and len(h) > 25 and h not in seen:
                seen.add(h)
                picks.append((t, "https://www.vccircle.com" + h))

        for title, link in picks[:15]:
            if link in existing_links or title[:60].lower().strip() in existing_titles:
                continue
            content = scrape_content(link)
            if len(content) < 100:
                content = title
            article_data = {
                "title":        title,
                "source":       "VCCircle",
                "link":         link,
                "published_at": datetime.utcnow().isoformat(),
                "content":      content,
                "image_url":    get_og_image(link),
                "category":     "investment-banking",
            }
            supabase.table("raw_articles").insert(article_data).execute()
            existing_links.add(link)
            existing_titles.add(title[:60].lower().strip())
            saved += 1
    except Exception as e:
        print(f"  ❌ VCCircle scrape failed: {e}")
    print(f"  📊 Saved {saved} from VCCircle")
    return saved


def scrape_investindia(existing_links, existing_titles):
    """Invest India (national investment promotion agency) has no RSS feed.
    Scrape its blog listing; article links are /blogs/<slug>. These are
    slower-moving FDI / sector investment pieces, so we take whatever's fresh."""
    print("\n📡 [investment-banking] Scraping Invest India blogs...")
    saved = 0
    try:
        r = requests.get("https://www.investindia.gov.in/team-india-blogs",
                         headers=HEADERS, timeout=15)
        soup = BeautifulSoup(r.text, "html.parser")
        seen, picks = set(), []
        for a in soup.find_all("a", href=True):
            t = a.get_text(strip=True)
            h = a["href"]
            if h.startswith("/blogs/") and len(t) >= 30 and h not in seen:
                seen.add(h)
                picks.append((t, "https://www.investindia.gov.in" + h))

        for title, link in picks[:10]:
            if link in existing_links or title[:60].lower().strip() in existing_titles:
                continue
            content = scrape_content(link)
            if len(content) < 100:
                content = title
            article_data = {
                "title":        title,
                "source":       "Invest India",
                "link":         link,
                "published_at": datetime.utcnow().isoformat(),
                "content":      content,
                "image_url":    get_og_image(link),
                "category":     "investment-banking",
            }
            supabase.table("raw_articles").insert(article_data).execute()
            existing_links.add(link)
            existing_titles.add(title[:60].lower().strip())
            saved += 1
    except Exception as e:
        print(f"  ❌ Invest India scrape failed: {e}")
    print(f"  📊 Saved {saved} from Invest India")
    return saved


# ── Significance scoring — how "major" a story is, by EVENT TYPE (a change is
#    coming), not by which company it's about. Used to fetch the biggest stories
#    first so they can never be dropped before the processor ranks them. ──
_MAJOR_PATTERNS = [
    (r'\b(ceo|cfo|coo|chairman|chief executive|managing director|founder|president)\b.{0,45}\b(resign|step(s|ped)? down|quit|appoint|named|replace|to lead|ousted|fired|exit|succeed|depart)', 5),
    (r'\b(acqui(re|res|sition)|to buy|buyout|take ?over|merger|merges?|\bstake\b|divest|spin[- ]?off)', 4),
    (r'\b(bankrupt|insolvenc|default|layoff|job cuts?|shut(s|ting)? down|crisis|fraud|scam|collapse)', 4),
    (r'\b(ipo|lists? on|public offering|goes public|fund ?rais|valuation of|raises? [₹$])', 4),
    (r'\b(antitrust|lawsuit|sued|fined|penalt|ban(ned|s)?|sanction|probe|investigat|regulat|approv(es|ed|al)|\bsebi\b|\brbi\b|\bsec\b|\bcci\b)', 3),
    (r'\b(crash|plunge|plummet|surge|soar|record (high|low)|all-time|tumbl|slump|rally|wipe[sd]? out|rout|sell-?off)', 3),
    (r'\b(rate (cut|hike)|repo rate|budget|tariff|\bgdp\b|inflation|\bfed\b|monetary policy|stimulus|recession)', 3),
    (r'\b(unveil|launch|breakthrough|enters? (the )?[a-z ]{0,20}market|exits?|partnership|to invest|landmark|first-ever|billion[- ]dollar)', 2),
]
_MAG_RE = re.compile(r'[₹$]\s?\d[\d,.]*\s?(billion|trillion|bn|tn|crore|lakh\s*crore)|\b\d{2,3}(\.\d+)?\s?%', re.I)

def major_score(text):
    """0+ : higher = a bigger, more change-signaling story."""
    t = (text or '').lower()
    s = sum(w for pat, w in _MAJOR_PATTERNS if re.search(pat, t))
    if _MAG_RE.search(text or ''):
        s += 2
    return s


def fetch_articles():
    cleanup_old_articles()

    print("\n📋 Loading existing articles for dedup check...")
    existing_links, existing_titles = get_existing_links()
    print(f"  Found {len(existing_links)} existing articles in DB")

    # ── Phase 1: GATHER candidates from every feed (cheap — no scraping yet) ──
    seen_links, seen_titles = set(existing_links), set(existing_titles)
    candidates = []
    for feed_item in RSS_FEEDS:
        feed_url, category = feed_item["url"], feed_item["category"]
        print(f"\n📡 [{category}] {feed_url}")
        feed = fetch_feed(feed_url)
        if not feed or not feed.entries:
            print("  ⚠️  No entries found")
            continue
        src = feed.feed.get('title', feed_url) if getattr(feed, 'feed', None) else feed_url
        new_here = 0
        for entry in feed.entries[:FETCH_PER_FEED]:
            title = getattr(entry, 'title', 'No Title')
            link  = getattr(entry, 'link', None)
            if not link or not is_today(entry):
                continue
            tkey = title[:60].lower().strip()
            if link in seen_links or tkey in seen_titles:
                continue
            seen_links.add(link)
            seen_titles.add(tkey)
            summary = get_rss_summary(entry)
            candidates.append({
                "title": title, "link": link, "summary": summary,
                "category": category, "source": src, "entry": entry,
                "score": major_score(title + " " + summary),
            })
            new_here += 1
        print(f"  ✅ {len(feed.entries)} found · {new_here} new")

    # ── Phase 2: RANK — biggest, most change-signaling stories first ──
    candidates.sort(key=lambda c: c["score"], reverse=True)
    majors = sum(1 for c in candidates if c["score"] >= 3)
    print(f"\n🏆 {len(candidates)} unique stories gathered · {majors} flagged major — saving the biggest first…")

    # ── Phase 3: SAVE (scrape + insert) in significance order, up to the cap ──
    total_saved = 0
    for c in candidates[:MAX_TOTAL_FETCH]:
        try:
            content = scrape_content(c["link"])
            if len(content) < 100:
                content = c["summary"] if len(c["summary"]) >= 30 else c["title"]
            image_url = get_og_image(c["link"]) or get_image_from_entry(c["entry"])
            supabase.table("raw_articles").insert({
                "title":        c["title"],
                "source":       c["source"],
                "link":         c["link"],
                "published_at": datetime.utcnow().isoformat(),
                "content":      content,
                "image_url":    image_url,
                "category":     c["category"],
            }).execute()
            total_saved += 1
            if total_saved % 50 == 0:
                print(f"  📊 saved {total_saved}…")
        except Exception as e:
            msg = str(e)
            if "23505" not in msg and "duplicate key" not in msg:
                print(f"  ❌ ERROR: {e}")

    total_saved += scrape_vccircle(seen_links, seen_titles)
    total_saved += scrape_investindia(seen_links, seen_titles)

    print(f"\n🎉 DONE. Total articles saved: {total_saved}")


if __name__ == "__main__":
    fetch_articles()