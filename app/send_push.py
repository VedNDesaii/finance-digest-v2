import json
import os
from pywebpush import webpush, WebPushException
from supabase import create_client
from dotenv import load_dotenv
import anthropic
import random
from datetime import datetime, timedelta, timezone

load_dotenv()

supabase          = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
client            = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY")
VAPID_EMAIL       = "mailto:ved.desai636@gmail.com"

SPICY_REENGAGEMENT = [
    {"title": "You're missing out 👀", "body": "Markets moved. News dropped. Everyone else already knows. Do you?"},
    {"title": "Your money called 📞",  "body": "It wants you to check what happened in the markets today."},
    {"title": "Bro where are you 😭",  "body": "Big things happened in the market. Finance Digest has the tea."},
    {"title": "RBI, FIIs, results 🔥", "body": "A lot happened while you were gone. 2 min to catch up."},
    {"title": "Still sleeping on this? 😴", "body": "Today's briefing is ready. Markets don't wait, but we did."},
    {"title": "Quick question 🤔",     "body": "Do you know what moved your portfolio today? Open up."},
    {"title": "Your friends know 👥",  "body": "Everyone's talking about what just happened in the market. You?"},
    {"title": "Finance update loading… ⏳", "body": "Just kidding, it's ready. Open Finance Digest."},
]


def generate_spicy_notification(top_headline):
    """Ask Haiku to write a fun, spicy push notification."""
    prompt = f"""You write push notifications for Finance Digest — 
a financial news app for young Indians.
Write a short, punchy, fun notification to get someone to open the app.
Style: spicy, cheeky, a little dramatic. Like a friend texting you breaking news.
Use 1-2 emojis max. No corporate language.
Today's top story: {top_headline}
Return ONLY JSON:
{{"title": "short title under 50 chars", "body": "body under 100 chars"}}
Examples of the tone we want:
- Title: "Markets are having a moment 👀"
- Body: "Something big just happened and your portfolio might care. Open up."
- Title: "RBI just made a move 🏦"
- Body: "Interest rates, your EMIs, your savings — all affected. 2 min read."
- Title: "This CEO just walked out 😳"
- Body: "Major bank drama. The kind that moves stocks. Read before markets open."
"""
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=150,
        messages=[{"role": "user", "content": prompt}]
    )
    text = message.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"): text = text[4:]
        text = text.strip()
    return json.loads(text)


def get_top_headline():
    """Get today's most important article title."""
    result = (
        supabase.table("processed_articles")
        .select("title, category")
        .order("created_at", desc=True)
        .limit(20)
        .execute()
    )
    priority = ["banking-finance", "indian-markets", "macro-policy"]
    for cat in priority:
        for article in result.data:
            if article.get("category") == cat:
                return article["title"]
    return result.data[0]["title"] if result.data else None


def _send_push(sub, title, body):
    """Send a single push notification. Returns True on success."""
    webpush(
        subscription_info={
            "endpoint": sub["endpoint"],
            "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
        },
        data=json.dumps({
            "title": title,
            "body":  body,
            "url":   "https://financedigest.xyz",
        }),
        vapid_private_key=VAPID_PRIVATE_KEY,
        vapid_claims={"sub": VAPID_EMAIL},
    )
    return True


def send_notifications():
    """Send AI-generated spicy notification to ALL subscribers."""
    headline = get_top_headline()
    if not headline:
        print("No headline found, skipping notifications")
        return

    notif = generate_spicy_notification(headline)
    print(f"📲 Sending: {notif['title']} — {notif['body']}")

    subscriptions = supabase.table("push_subscriptions").select("*").execute()
    sent = failed = 0

    for sub in subscriptions.data:
        try:
            _send_push(sub, notif["title"], notif["body"])
            sent += 1
        except WebPushException as e:
            if "410" in str(e) or "404" in str(e):
                supabase.table("push_subscriptions").delete().eq("endpoint", sub["endpoint"]).execute()
            failed += 1

    print(f"✅ Sent: {sent} | Failed/cleaned: {failed}")


def send_reengagement_notifications():
    """Send spicy nudge to users who haven't opened the app in 24+ hours."""
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()

    subs = supabase.table("push_subscriptions")\
        .select("*")\
        .lt("last_seen", cutoff)\
        .execute()

    if not subs.data:
        print("No inactive users to nudge")
        return

    print(f"Found {len(subs.data)} inactive users — sending re-engagement push")

    sent = failed = 0
    for sub in subs.data:
        notif = random.choice(SPICY_REENGAGEMENT)
        try:
            _send_push(sub, notif["title"], notif["body"])
            sent += 1
        except WebPushException as e:
            if "410" in str(e) or "404" in str(e):
                supabase.table("push_subscriptions").delete().eq("endpoint", sub["endpoint"]).execute()
            failed += 1

    print(f"✅ Re-engagement sent: {sent} | Failed/cleaned: {failed}")


if __name__ == "__main__":
    send_notifications()
    send_reengagement_notifications()