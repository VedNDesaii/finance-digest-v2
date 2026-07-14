import json
import os
import random
import resend
from pywebpush import webpush, WebPushException
from supabase import create_client
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone

load_dotenv()

supabase          = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "").strip()
VAPID_EMAIL       = "mailto:ved.desai636@gmail.com"
resend.api_key    = os.getenv("RESEND_API_KEY")

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

MARKET_SUMMARY_NOTIFICATIONS = [
    {"title": "📊 Market Summary is live",      "body": "Sensex, Nifty, sector performance — today's close explained simply."},
    {"title": "Markets just closed 🔔",         "body": "Here's what moved today and what to watch tomorrow."},
    {"title": "4 PM update is ready 📈",        "body": "Today's market close summary — 2 min read on Finance Digest."},
    {"title": "End of day market wrap 🗞️",      "body": "Winners, losers, FII activity — all simplified for you."},
    {"title": "Your market report is in 📉📈",  "body": "See how Sensex and Nifty closed today. Open Finance Digest."},
]

SPICY_REENGAGEMENT = [
    {"title": "You're missing out 👀",           "body": "Markets moved. News dropped. Everyone else already knows. Do you?"},
    {"title": "Your money called 📞",            "body": "It wants you to check what happened in the markets today."},
    {"title": "Bro where are you 😭",            "body": "Big things happened in the market. Finance Digest has the tea."},
    {"title": "Still sleeping on this? 😴",      "body": "Today's briefing is ready. Markets don't wait, but we did."},
    {"title": "Quick question 🤔",               "body": "Do you know what moved your portfolio today? Open up."},
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
    return result.data[0]["title"] if result.data else "Today's market briefing is ready"


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


def _broadcast_push(notif, label=""):
    subscriptions = supabase.table("push_subscriptions").select("*").execute()
    if not subscriptions.data:
        print(f"No push subscribers {label}")
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
    print(f"✅ Push {label} Sent: {sent} | Failed: {failed}")


def send_email_notifications(title, body):
    """Send email to all registered users."""
    users = supabase.table("profiles").select("email").execute()
    if not users.data:
        print("No users found for email")
        return

    emails = [u["email"] for u in users.data if u.get("email")]
    print(f"📧 Sending email to {len(emails)} users...")

    sent = failed = 0
    for email in emails:
        try:
            resend.Emails.send({
                "from": "Finance Digest <news@financedigest.xyz>",
                "to": email,
                "subject": title,
                "html": f"""
                <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 32px 20px; background: #F7F4EF;">
                    <div style="background: #1A1410; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
                        <h1 style="margin: 0; font-size: 28px; color: #C9A84C;">Finance <span style="color: #F0EBE3;">Digest</span></h1>
                        <p style="color: #9A8E7E; font-size: 12px; margin: 4px 0 0; letter-spacing: 0.1em;">THE NEWS. WITHOUT THE NOISE.</p>
                    </div>
                    <div style="background: #fff; padding: 28px; border-radius: 0 0 12px 12px; border: 1px solid #EDE8E0;">
                        <h2 style="color: #1A1410; font-size: 20px; margin: 0 0 12px;">{title}</h2>
                        <p style="color: #6B5E4E; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">{body}</p>
                        <a href="https://financedigest.xyz" style="display: inline-block; background: #C9A84C; color: #1A1410; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px;">
                            Read Today's Briefing →
                        </a>
                        <p style="color: #B8AFA3; font-size: 11px; margin-top: 24px; border-top: 1px solid #EDE8E0; padding-top: 16px;">
                            Finance Digest · Daily financial news simplified for everyone<br>
                            <a href="https://financedigest.xyz" style="color: #C9A84C;">financedigest.xyz</a>
                        </p>
                    </div>
                </div>
                """,
            })
            sent += 1
        except Exception as e:
            failed += 1
            print(f"  Failed for {email}: {e}")

    print(f"✅ Emails sent: {sent} | Failed: {failed}")


def send_notifications():
    """Morning briefing — push + email to all."""
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
    _broadcast_push(notif, label="[morning]")
    send_email_notifications(notif["title"], notif["body"])


def send_market_summary_notification():
    """4 PM market close — push + email."""
    notif = random.choice(MARKET_SUMMARY_NOTIFICATIONS)
    print(f"📊 Market summary: {notif['title']} — {notif['body']}")
    _broadcast_push(notif, label="[market-summary]")
    send_email_notifications(notif["title"], notif["body"])


def send_reengagement_notifications():
    """Nudge users who have not opened today."""
    ist_offset = timedelta(hours=5, minutes=30)
    now_ist = datetime.now(timezone.utc) + ist_offset
    today_midnight_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
    cutoff = (today_midnight_ist - ist_offset).isoformat()

    subs = supabase.table("push_subscriptions")\
        .select("*")\
        .lt("last_seen", cutoff)\
        .execute()

    if not subs.data:
        print("All subscribers have already visited today")
        return

    print(f"Found {len(subs.data)} inactive users")
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
    print(f"✅ Re-engagement sent: {sent} | Failed: {failed}")


if __name__ == "__main__":
    import sys
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"

    if mode == "morning":
        send_notifications()
    elif mode == "market":
        send_market_summary_notification()
    elif mode == "email":
        headline = get_top_headline()
        send_email_notifications("📰 Finance Digest Update", headline)
    elif mode == "reengagement":
        send_reengagement_notifications()
    else:
        send_notifications()
        send_reengagement_notifications()