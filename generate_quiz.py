"""Generate a daily 5-question, medium-difficulty FINANCE-KNOWLEDGE quiz and
write it to public/daily-quiz.json (served statically, like market-data.json).

Questions test evergreen finance/investing understanding — markets, mutual
funds, taxes, bonds, derivatives, personal finance, etc. — NOT the day's news.
A rotating topic mix keeps it varied day to day. Runs once/day, ~half a cent.
"""
import os
import json
from datetime import date
import anthropic
from dotenv import load_dotenv

load_dotenv(override=True)

client = anthropic.Anthropic(
    api_key=os.getenv("ANTHROPIC_API_KEY").strip(),
    timeout=90.0, max_retries=2,
)

# Rotate through these so the quiz covers different ground each day.
TOPICS = [
    "stock market basics (shares, indices, how prices move)",
    "mutual funds and SIPs",
    "bonds and how interest rates affect them",
    "income tax, capital gains tax, and GST in India",
    "banking, the RBI, and how monetary policy works",
    "inflation, GDP, and the broader economy",
    "derivatives — options and futures",
    "IPOs and the primary market",
    "financial ratios (P/E, ROE, debt-to-equity)",
    "personal finance, budgeting, and emergency funds",
    "insurance (term, health, ULIPs)",
    "gold, commodities, and safe-haven assets",
    "currency, forex, and the rupee",
    "risk, diversification, and asset allocation",
    "credit, loans, EMIs, and credit scores",
    "ETFs and index investing",
    "compounding and the time value of money",
    "market participants (FIIs, DIIs, retail, promoters)",
]


def todays_topics(n=5):
    """Deterministically pick n topics that rotate by day, so a given day is
    the same for every user but different from yesterday."""
    start = date.today().toordinal()
    return [TOPICS[(start + i) % len(TOPICS)] for i in range(n)]


def build_quiz(topics):
    topic_lines = "\n".join(f"  {i+1}. {t}" for i, t in enumerate(topics))
    prompt = f"""You are a finance quizmaster for an Indian retail-investor app.

Write EXACTLY 5 multiple-choice questions that test general finance and
investing UNDERSTANDING — one question for each of these topics, in order:
{topic_lines}

Difficulty: MEDIUM. Not definitions or trivia — test whether someone actually
understands the concept (e.g. what happens to bond prices when rates rise, how
an SIP averages cost, why diversification lowers risk). Make the 3 wrong
options plausible so a guesser can't easily win. Use simple language and
India-relevant examples where natural (₹, Nifty, RBI, SIP).

Rules:
- Exactly 4 options, exactly one correct.
- Keep questions and options concise.
- Add a one-line explanation of the correct answer.

Return ONLY valid JSON, no markdown:
{{"questions":[
  {{"q":"<question>","options":["A","B","C","D"],"answer":<index 0-3>,"explain":"<one line>"}}
]}}"""

    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1200,
        messages=[{"role": "user", "content": prompt}],
    )
    text = msg.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    data = json.loads(text)
    qs = data.get("questions", [])
    clean = [
        q for q in qs
        if isinstance(q.get("options"), list) and len(q["options"]) == 4
        and isinstance(q.get("answer"), int) and 0 <= q["answer"] <= 3
        and q.get("q")
    ][:5]
    return clean


if __name__ == "__main__":
    print("🧠 Generating daily finance quiz...")
    topics = todays_topics()
    try:
        questions = build_quiz(topics)
    except Exception as e:
        print(f"  ❌ Quiz generation failed: {e}")
        raise SystemExit(1)

    if len(questions) < 3:
        print(f"  ⚠️ Only got {len(questions)} valid questions — not overwriting.")
        raise SystemExit(0)

    os.makedirs("public", exist_ok=True)
    with open("public/daily-quiz.json", "w") as f:
        json.dump({"questions": questions}, f)
    print(f"  ✅ Wrote {len(questions)} questions to public/daily-quiz.json")
    for i, q in enumerate(questions, 1):
        print(f"   {i}. {q['q'][:70]}")
