# send_push.py
import json
import os
from pywebpush import webpush, WebPushException
from supabase import create_client
from dotenv import load_dotenv
import anthropic
import random

load_dotenv()

supabase    = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
client      = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY")
VAPID_EMAIL       = "mailto:your@email.com"


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
    # Prefer banking/markets/macro for notification
    priority = ["banking-finance", "indian-markets", "macro-policy"]
    for cat in priority:
        for article in result.data:
            if article.get("category") == cat:
                return article["title"]
    return result.data[0]["title"] if result.data else None


def send_notifications():
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
            webpush(
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": {
                        "p256dh": sub["p256dh"],
                        "auth":   sub["auth"],
                    },
                },
                data=json.dumps({
                    "title": notif["title"],
                    "body":  notif["body"],
                    "url":   "https://financedigest.xyz",
                }),
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_EMAIL},
            )
            sent += 1
        except WebPushException as e:
            # Remove dead subscriptions
            if "410" in str(e) or "404" in str(e):
                supabase.table("push_subscriptions")\
                    .delete().eq("endpoint", sub["endpoint"]).execute()
            failed += 1

    print(f"✅ Sent: {sent} | Failed/cleaned: {failed}")


if __name__ == "__main__":
    send_notifications()