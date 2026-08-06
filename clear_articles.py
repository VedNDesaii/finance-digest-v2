"""Delete ALL articles from the website (raw + published). Destructive — the
site will show nothing until the pipeline repopulates it. Run this, then run
the pipeline (fetch -> process) to rebuild fresh. `./run.sh --clear` does both.
"""
import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv(override=True)
sb = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))


def clear(table):
    rows = sb.table(table).select("id").execute().data or []
    ids  = [r["id"] for r in rows]
    for i in range(0, len(ids), 100):
        sb.table(table).delete().in_("id", ids[i:i + 100]).execute()
    print(f"  🗑️  Deleted {len(ids)} rows from {table}")


if __name__ == "__main__":
    print("🧹 Clearing all articles from the website...")
    clear("processed_articles")   # published (what the site shows)
    clear("raw_articles")         # staging
    print("✅ All articles cleared. Run the pipeline to rebuild.")
