"""Generate a daily 5-question, medium-difficulty finance quiz from the day's
published news and write it to public/daily-quiz.json (served statically, like
market-data.json). Runs once/day in the pipeline — costs ~1 cent.

Questions test whether the reader followed the actual news (who did what, what
a number was, what a policy means), NOT plain vocabulary. Each has 4 options,
one correct, and a one-line explanation.
"""
import os
import json
import anthropic
from supabase import create_client
from dotenv import load_dotenv

load_dotenv(override=True)

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
client   = anthropic.Anthropic(
    api_key=os.getenv("ANTHROPIC_API_KEY").strip(),
    timeout=90.0, max_retries=2,
)


def get_top_articles(limit: int = 14):
    """Pull the most recent published stories to base questions on."""
    r = (
        supabase.table("processed_articles")
        .select("title, simplified_article, category")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return r.data or []


def build_quiz(articles):
    news = "\n".join(
        f"- {a['title']}: {(a.get('simplified_article') or '')[:200]}"
        for a in articles
    )
    prompt = f"""You are a finance quizmaster for an Indian retail-investor news app.

Using ONLY the news below, write EXACTLY 5 multiple-choice questions that test
whether the reader actually followed today's news.

Difficulty: MEDIUM. Not trivia, not vocabulary. Ask about what happened, who did
it, a specific number/figure, or what a development means. Make the 3 wrong
options plausible (not obviously silly), so a guesser can't easily win.

Rules:
- Each question stands on its own (a reader who read the news can answer it).
- Exactly 4 options, exactly one correct.
- Keep questions and options concise.
- Add a one-line explanation of the correct answer.

Return ONLY valid JSON, no markdown:
{{"questions":[
  {{"q":"<question>","options":["A","B","C","D"],"answer":<index 0-3>,"explain":"<one line>"}}
]}}

NEWS:
{news}"""

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
    # keep only well-formed questions
    clean = [
        q for q in qs
        if isinstance(q.get("options"), list) and len(q["options"]) == 4
        and isinstance(q.get("answer"), int) and 0 <= q["answer"] <= 3
        and q.get("q")
    ][:5]
    return clean


if __name__ == "__main__":
    print("🧠 Generating daily quiz...")
    articles = get_top_articles()
    if len(articles) < 5:
        print(f"  ⚠️ Only {len(articles)} articles — skipping quiz generation.")
        raise SystemExit(0)
    try:
        questions = build_quiz(articles)
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
