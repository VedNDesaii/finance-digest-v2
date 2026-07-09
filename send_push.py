import json
import os
from pywebpush import webpush, WebPushException
from supabase import create_client
from dotenv import load_dotenv
import random
from datetime import datetime, timedelta, timezone

load_dotenv()

supabase          = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY").strip()
VAPID_EMAIL       = "mailto:ved.desai636@gmail.com"

SPICY_NOTIFICATIONS = [
    {"title": "Markets are having a moment 👀", "body": "Something big just happened and your portfolio might care. Open up."},
    {"title": "RBI just made a move 🏦",        "body": "Interest rates, your EMIs, your savings — all affected. 2 min read."},
    {"title": "Big news just dropped 📰",       "body": "The kind that moves stocks. Read before markets react."},
    {"title": "Your morning briefing is ready ☀️", "body": "Markets, economy, sectors — all simplified. Takes 2 min."},
    {"title": "Today's top story is spicy 🌶️", "body": "Open Finance Digest and see what everyone's talking about."},
    {"title": "Markets moved today 📈",         "body": "Find out what happened and what it means for you."},
    {"title": "Fresh news just in 🗞️",          "body": "Stay ahead — today's financial stories are ready for you."},
    {"title": "Don't miss this one 🔥",         "body": "Today's top financial story explained simply. Open up."},
]

SPICY_REENGAGEMENT = [
    {"title": "You're missing out 👀",           "body": "Markets moved. News dropped. Everyone else already knows. Do you?"},
    {"title": "Your money called 📞",            "body": "It wants you to check what happened in the markets today."},
    {"title": "Bro where are you 😭",            "body": "Big things happened in the market. Finance Digest has the tea."},
    {"title": "RBI, FIIs, results 🔥",           "body": "A lot happened while you were gone. 2 min to catch up."},
    {"title": "Still sleeping on this? 😴",      "body": "Today's briefing is ready. Markets don't wait, but we did."},
    {"title": "Quick question 🤔",               "body": "Do you know what moved your portfolio today? Open up."},
    {"title": "Your friends know 👥",            "body": "Everyone's talking about what just happened in the market. You?"},
    {"title": "Finance update loading… ⏳",      "body": "Just kidding, it's ready. Open Finance Digest."},
]

MARKET_SUMMARY_NOTIFICATIONS = [
    {"title": "📊 Market Summary is live",      "body": "Sensex, Nifty, sector performance — today's close explained simply."},
    {"title": "Markets just closed 🔔",         "body": "Here's what moved today and what to watch tomorrow."},
    {"title": "4 PM update is ready 📈",        "body": "Today's market close summary — 2 min read on Finance Digest."},
    {"title": "End of day market wrap 🗞️",      "body": "Winners, losers, FII activity — all simplified for you."},
    {"title": "Your market report is in 📉📈",  "body": "See how Sensex and Nifty closed today. Open Finance Digest."},
]


def get_top_headline():
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


def _broadcast(notif, label=""):
    subscriptions = supabase.table("push_subscriptions").select("*").execute()
    if not subscriptions.data:
        print(f"No subscribers found {label}")
        return
    sent = failed = 0
    for sub in subscriptions.data:
        try:
            _send_push(sub, notif["title"], notif["body"])
            sent += 1
        except WebPushException as e:
            if "410" in str(e) or "404" in str(e):
                supabase.table("push_subscriptions").delete().eq("endpoint", sub["endpoint"]).execute()
            failed += 1
    print(f"✅ {label} Sent: {sent} | Failed/cleaned: {failed}")


def send_notifications():
    """Morning briefing — send to all subscribers."""
    hour = datetime.now().hour
    if hour < 12:
        notif = {"title": "☀️ Morning Briefing is ready", "body": "Today's top market stories simplified. 2 min read."}
    elif hour < 16:
        notif = {"title": "📊 Market update is live", "body": "See what's moving the markets right now."}
    else:
        notif = random.choice(MARKET_SUMMARY_NOTIFICATIONS)

    if random.random() > 0.5:
        notif = random.choice(SPICY_NOTIFICATIONS)

    print(f"📲 Sending: {notif['title']} — {notif['body']}")
    _broadcast(notif, label="[morning]")


def send_market_summary_notification():
    """4 PM market close notification — send to all subscribers."""
    notif = random.choice(MARKET_SUMMARY_NOTIFICATIONS)
    print(f"📊 Market summary push: {notif['title']} — {notif['body']}")
    _broadcast(notif, label="[market-summary]")


def send_reengagement_notifications():
    """Nudge users who haven't opened in 24+ hours."""
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
    import sys
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"

    if mode == "morning":
        send_notifications()
    elif mode == "market":
        send_market_summary_notification()
    elif mode == "reengagement":
        send_reengagement_notifications()
    else:
        # Default: run all
        send_notifications()
        send_reengagement_notifications()