from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv()

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

print("🗑️  Clearing all existing articles for fresh start...")
supabase.table("processed_articles").delete().gte("id", 0).execute()
supabase.table("raw_articles").delete().gte("id", 0).execute()
print("✅  Cleared\n")

print("📡 Fetching fresh news...")
os.system("python3 fetch_news.py")

print("\n⚙️  Processing articles...")
os.system("python3 process_articles.py")

print("\n✅  Pipeline complete — all sections refreshed with today's news")