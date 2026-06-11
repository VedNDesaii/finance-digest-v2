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

ET_HEADERS = {
    "User-Agent": "Feedfetcher-Google; (+http://www.google.com/feedfetcher.html)",
    "Accept": "application/rss+xml, application/xml, text/xml, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
}

FETCH_PER_FEED = 25
IMAGE_BUCKET   = "article-images"


def upload_image_to_supabase(image_url: str) -> str | None:
    if not image_url:
        return None
    try:
        response = requests.get(image_url, headers=HEADERS, timeout=8)
        if response.status_code != 200:
            return None
        content_type = response.headers.get("Content-Type", "image/jpeg")
        if not content_type.startswith("image/"):
            return None
        ext = "jpg"
        if "png"  in content_type: ext = "png"
        elif "webp" in content_type: ext = "webp"
        elif "gif"  in content_type: ext = "gif"
        filename = f"{uuid.uuid4().hex}.{ext}"
        supabase.storage.from_(IMAGE_BUCKET).upload(
            path=filename,
            file=response.content,
            file_options={"content-type": content_type, "upsert": "true"}
        )
        return f"{SUPABASE_URL}/storage/v1/object/public/{IMAGE_BUCKET}/{filename}"
    except Exception as e:
        print(f"  ⚠️  Image upload failed: {e}")
        return None


def get_og_image(url: str) -> str | None:
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


RSS_FEEDS = [
    # ── Indian Markets ──
    {"url": "https://economictimes.indiatimes.com/markets/rss.cms",                                    "category": "indian-markets"},
    {"url": "https://www.moneycontrol.com/rss/latestnews.xml",                                         "category": "indian-markets"},
    {"url": "https://www.thehindubusinessline.com/markets/?service=rss",                               "category": "indian-markets"},
    {"url": "https://www.business-standard.com/rss/markets-106.rss",                                   "category": "indian-markets"},
    {"url": "https://economictimes.indiatimes.com/markets/stocks/news/rss.cms",                        "category": "indian-markets"},
    {"url": "https://www.moneycontrol.com/rss/marketreports.xml",                                      "category": "indian-markets"},
    {"url": "https://www.livemint.com/rss/markets",                                                    "category": "indian-markets"},
    # ── US Markets ──
    {"url": "https://www.cnbc.com/id/10001147/device/rss/rss.html",                                    "category": "us-markets"},
    {"url": "https://feeds.content.dowjones.io/public/rss/mw_topstories",                              "category": "us-markets"},
    {"url": "https://www.cnbc.com/id/20910258/device/rss/rss.html",                                    "category": "us-markets"},
    {"url": "https://www.cnbc.com/id/15839069/device/rss/rss.html",                                    "category": "us-markets"},
    {"url": "https://www.cnbc.com/id/100003114/device/rss/rss.html",                                   "category": "us-markets"},
    {"url": "https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines",                       "category": "us-markets"},
    {"url": "https://feeds.bbci.co.uk/news/business/rss.xml",                                          "category": "us-markets"},
    # ── Global Economy ──
    {"url": "https://feeds.bbci.co.uk/news/business/rss.xml",                                          "category": "global-economy"},
    {"url": "https://www.cnbc.com/id/100003114/device/rss/rss.html",                                   "category": "global-economy"},
    {"url": "https://feeds.bbci.co.uk/news/world/rss.xml",                                             "category": "global-economy"},
    {"url": "https://www.theguardian.com/business/economics/rss",                                      "category": "global-economy"},
    {"url": "https://economictimes.indiatimes.com/news/international/business/rss.cms",                "category": "global-economy"},
    # ── Banking & Finance ──
    {"url": "https://www.business-standard.com/rss/finance-103.rss",                                   "category": "banking-finance"},
    {"url": "https://www.business-standard.com/rss/banking-105.rss",                                   "category": "banking-finance"},
    {"url": "https://economictimes.indiatimes.com/industry/banking/finance/rss.cms",                   "category": "banking-finance"},
    {"url": "https://www.moneycontrol.com/rss/banking.xml",                                            "category": "banking-finance"},
    {"url": "https://www.thehindubusinessline.com/money-and-banking/?service=rss",                     "category": "banking-finance"},
    {"url": "https://www.cnbc.com/id/10000664/device/rss/rss.html",                                    "category": "banking-finance"},
    {"url": "https://www.livemint.com/rss/industry",                                                   "category": "banking-finance"},
    # ── Macro & Policy ──
    {"url": "https://www.business-standard.com/rss/economy-policy-102.rss",                            "category": "macro-policy"},
    {"url": "https://economictimes.indiatimes.com/news/economy/rss.cms",                               "category": "macro-policy"},
    {"url": "https://www.thehindubusinessline.com/economy/?service=rss",                               "category": "macro-policy"},
    {"url": "https://economictimes.indiatimes.com/news/economy/policy/rss.cms",                        "category": "macro-policy"},
    {"url": "https://www.moneycontrol.com/rss/economy.xml",                                            "category": "macro-policy"},
    # ── Technology & IT ──
    {"url": "https://economictimes.indiatimes.com/tech/rss.cms",                                       "category": "technology-it"},
    {"url": "https://www.business-standard.com/rss/technology-108.rss",                                "category": "technology-it"},
    {"url": "https://www.thehindubusinessline.com/info-tech/?service=rss",                             "category": "technology-it"},
    {"url": "https://www.moneycontrol.com/rss/technology.xml",                                         "category": "technology-it"},
    {"url": "https://www.cnbc.com/id/19854910/device/rss/rss.html",                                    "category": "technology-it"},
    {"url": "https://www.livemint.com/rss/technology",                                                 "category": "technology-it"},
    # ── Pharma & Health ──
    {"url": "https://economictimes.indiatimes.com/industry/healthcare/biotech/pharmaceuticals/rss.cms","category": "pharma-health"},
    {"url": "https://www.business-standard.com/rss/healthcare-241.rss",                                "category": "pharma-health"},
    {"url": "https://www.thehindubusinessline.com/pharma/?service=rss",                                "category": "pharma-health"},
    {"url": "https://www.moneycontrol.com/rss/pharma.xml",                                             "category": "pharma-health"},
    {"url": "https://economictimes.indiatimes.com/industry/healthcare/biotech/rss.cms",                "category": "pharma-health"},
    {"url": "https://www.livemint.com/rss/science",                                                    "category": "pharma-health"},
    {"url": "https://feeds.bbci.co.uk/news/health/rss.xml",                                            "category": "pharma-health"},
    # ── Auto & EV ──
    {"url": "https://economictimes.indiatimes.com/industry/auto/rss.cms",                              "category": "auto-ev"},
    {"url": "https://www.business-standard.com/rss/automobile-103.rss",                                "category": "auto-ev"},
    {"url": "https://www.thehindubusinessline.com/auto/?service=rss",                                  "category": "auto-ev"},
    {"url": "https://www.moneycontrol.com/rss/automobile.xml",                                         "category": "auto-ev"},
    {"url": "https://economictimes.indiatimes.com/industry/auto/two-wheelers/rss.cms",                 "category": "auto-ev"},
    {"url": "https://www.livemint.com/rss/auto",                                                       "category": "auto-ev"},
    # ── Energy & Oil ──
    {"url": "https://economictimes.indiatimes.com/industry/energy/rss.cms",                            "category": "energy-oil"},
    {"url": "https://www.business-standard.com/rss/oil-gas-109.rss",                                   "category": "energy-oil"},
    {"url": "https://www.thehindubusinessline.com/economy/energy/?service=rss",                        "category": "energy-oil"},
    {"url": "https://www.cnbc.com/id/10000734/device/rss/rss.html",                                    "category": "energy-oil"},
    {"url": "https://economictimes.indiatimes.com/industry/energy/oil-gas/rss.cms",                    "category": "energy-oil"},
    # ── Metals & Mining ──
    {"url": "https://economictimes.indiatimes.com/industry/indl-goods/svs/metals-mining/rss.cms",      "category": "metals-mining"},
    {"url": "https://www.business-standard.com/rss/metals-mining-120.rss",                             "category": "metals-mining"},
    {"url": "https://www.thehindubusinessline.com/markets/commodities/?service=rss",                   "category": "metals-mining"},
    {"url": "https://www.moneycontrol.com/rss/commodities.xml",                                        "category": "metals-mining"},
    {"url": "https://economictimes.indiatimes.com/industry/indl-goods/svs/steel/rss.cms",              "category": "metals-mining"},
    # ── Infrastructure ──
    {"url": "https://economictimes.indiatimes.com/industry/indl-goods/svs/construction/rss.cms",       "category": "infrastructure"},
    {"url": "https://www.business-standard.com/rss/infrastructure-217.rss",                            "category": "infrastructure"},
    {"url": "https://economictimes.indiatimes.com/news/economy/infrastructure/rss.cms",                "category": "infrastructure"},
    {"url": "https://www.thehindubusinessline.com/economy/logistics/?service=rss",                     "category": "infrastructure"},
    {"url": "https://economictimes.indiatimes.com/industry/transportation/railways/rss.cms",            "category": "infrastructure"},
    {"url": "https://economictimes.indiatimes.com/industry/transportation/roadways/rss.cms",            "category": "infrastructure"},
    # ── FMCG & Consumer ──
    {"url": "https://economictimes.indiatimes.com/industry/cons-products/fmcg/rss.cms",                "category": "fmcg-consumer"},
    {"url": "https://www.business-standard.com/rss/consumer-104.rss",                                  "category": "fmcg-consumer"},
    {"url": "https://economictimes.indiatimes.com/industry/cons-products/rss.cms",                     "category": "fmcg-consumer"},
    {"url": "https://www.moneycontrol.com/rss/fmcg.xml",                                               "category": "fmcg-consumer"},
    {"url": "https://economictimes.indiatimes.com/industry/cons-products/food/rss.cms",                "category": "fmcg-consumer"},
    {"url": "https://www.thehindubusinessline.com/companies/?service=rss",                             "category": "fmcg-consumer"},
    {"url": "https://www.livemint.com/rss/companies",                                                  "category": "fmcg-consumer"},
    # ── Renewables ──
    {"url": "https://economictimes.indiatimes.com/industry/renewables/rss.cms",                        "category": "renewables"},
    {"url": "https://www.business-standard.com/rss/renewable-energy-193.rss",                          "category": "renewables"},
    {"url": "https://www.thehindubusinessline.com/economy/agri-business/green/?service=rss",           "category": "renewables"},
    {"url": "https://economictimes.indiatimes.com/industry/energy/power/rss.cms",                      "category": "renewables"},
    {"url": "https://www.livemint.com/rss/industry",                                                   "category": "renewables"},
    {"url": "https://economictimes.indiatimes.com/industry/energy/coal/rss.cms",                       "category": "renewables"},
    # ── Real Estate ──
    {"url": "https://economictimes.indiatimes.com/wealth/real-estate/rss.cms",                         "category": "real-estate"},
    {"url": "https://www.moneycontrol.com/rss/realestate.xml",                                         "category": "real-estate"},
    {"url": "https://www.livemint.com/rss/real-estate",                                                "category": "real-estate"},
    {"url": "https://economictimes.indiatimes.com/industry/services/property-/-cstruction/rss.cms",    "category": "real-estate"},
    {"url": "https://www.thehindubusinessline.com/real-estate/?service=rss",                           "category": "real-estate"},
    {"url": "https://www.business-standard.com/rss/real-estate-175.rss",                               "category": "real-estate"},
    # ── Telecom & Media ──
    {"url": "https://economictimes.indiatimes.com/industry/telecom/rss.cms",                           "category": "telecom-media"},
    {"url": "https://www.business-standard.com/rss/telecom-141.rss",                                   "category": "telecom-media"},
    {"url": "https://www.moneycontrol.com/rss/telecom.xml",                                            "category": "telecom-media"},
    {"url": "https://www.livemint.com/rss/technology",                                                 "category": "telecom-media"},
    {"url": "https://economictimes.indiatimes.com/industry/media/rss.cms",                             "category": "telecom-media"},
    {"url": "https://www.thehindubusinessline.com/info-tech/telecom/?service=rss",                     "category": "telecom-media"},
]


def delete_in_chunks(table, id_list):
    for i in range(0, len(id_list), 50):
        chunk = id_list[i:i + 50]
        supabase.table(table).delete().in_("id", chunk).execute()


def cleanup_old_articles():
    # ✅ Keep only today's articles — delete anything older than 24 hours
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    print(f"\n🧹 Cleaning up articles older than 24 hours...")
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
    """Load all existing article links into a set for fast O(1) duplicate checking"""
    result = supabase.table("raw_articles").select("link, title").execute()
    links  = {r["link"] for r in result.data if r.get("link")}
    titles = {r["title"][:60].lower().strip() for r in result.data if r.get("title")}
    return links, titles


def article_exists(link, existing_links):
    return link in existing_links


def similar_title_exists(title, existing_titles):
    return title[:60].lower().strip() in existing_titles


def save_article(data):
    return supabase.table("raw_articles").insert(data).execute()


def fetch_feed(feed_url):
    try:
        # Use Google Feedfetcher UA for ET and BS which block regular bots
        is_et = "economictimes" in feed_url or "business-standard" in feed_url
        headers = ET_HEADERS if is_et else HEADERS
        response = requests.get(feed_url, headers=headers, timeout=15)
        if response.status_code == 403 and not is_et:
            # Retry with ET headers
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


def is_today(entry):
    """Check if RSS entry was published today or yesterday (within 36 hours)"""
    published = getattr(entry, 'published_parsed', None) or getattr(entry, 'updated_parsed', None)
    if not published:
        return True  # No date = accept it
    try:
        pub_dt  = datetime(*published[:6], tzinfo=timezone.utc)
        cutoff  = datetime.now(timezone.utc) - timedelta(hours=36)
        return pub_dt >= cutoff
    except Exception:
        return True


def fetch_articles():
    cleanup_old_articles()

    # ✅ Load ALL existing links/titles once — much faster than per-article DB calls
    print("\n📋 Loading existing articles for dedup check...")
    existing_links, existing_titles = get_existing_links()
    print(f"  Found {len(existing_links)} existing articles in DB")

    total_saved = 0

    for feed_item in RSS_FEEDS:
        feed_url = feed_item["url"]
        category = feed_item["category"]

        print(f"\n📡 [{category}] Fetching: {feed_url}")
        feed = fetch_feed(feed_url)

        if not feed or not feed.entries:
            print("  ⚠️  No entries found")
            continue

        print(f"  ✅ Found {len(feed.entries)} articles")
        saved_this_feed = 0

        for entry in feed.entries[:FETCH_PER_FEED]:
            try:
                title = getattr(entry, 'title', 'No Title')
                link  = getattr(entry, 'link', None)

                if not link:
                    continue

                # ✅ Skip if not recent (older than 36 hours)
                if not is_today(entry):
                    continue

                # ✅ Fast in-memory duplicate check
                if article_exists(link, existing_links):
                    continue
                if similar_title_exists(title, existing_titles):
                    continue

                content = scrape_content(link)

                if len(content) < 100:
                    rss_summary = get_rss_summary(entry)
                    if len(rss_summary) >= 30:
                        content = rss_summary
                    else:
                        content = title

                raw_image_url = get_og_image(link) or get_image_from_entry(entry)
                image_url = None
                if raw_image_url:
                    image_url = upload_image_to_supabase(raw_image_url)
                    if not image_url:
                        image_url = raw_image_url

                article_data = {
                    "title":        title,
                    "source":       feed.feed.get('title', feed_url),
                    "link":         link,
                    "published_at": datetime.utcnow().isoformat(),
                    "content":      content,
                    "image_url":    image_url,
                    "category":     category,
                }

                save_article(article_data)

                # ✅ Add to in-memory sets so subsequent feeds don't re-add same article
                existing_links.add(link)
                existing_titles.add(title[:60].lower().strip())

                total_saved     += 1
                saved_this_feed += 1

            except Exception as e:
                print(f"  ❌ ERROR: {e}")

        print(f"  📊 Saved {saved_this_feed} from this feed")

    print(f"\n🎉 DONE. Total articles saved: {total_saved}")


if __name__ == "__main__":
    fetch_articles()