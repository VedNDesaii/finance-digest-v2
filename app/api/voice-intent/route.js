export async function POST(req) {
  const { type, text, articleContext } = await req.json();

  if (type === "question") {
    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ result: "API key is missing." });
    }

    try {
      const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 150,
          system: `You are a finance teacher answering a young reader's question about a news article.
Rules:
- Answer in exactly 2 short simple sentences maximum
- Use plain everyday language a 16-year-old understands
- Use the article context to stay relevant, expand with your own knowledge if needed
- Never say "I don't know" or "the article doesn't say" — always give a helpful answer
- Be warm and direct like a knowledgeable friend`,
          messages: [
            {
              role: "user",
              content: `Article context: ${articleContext ? articleContext.slice(0, 500) : "general finance question"}\n\nQuestion: ${text}`
            }
          ],
        }),
      });

      const apiData = await apiRes.json();

      if (apiData.error) {
        return Response.json({ result: "Something went wrong. Please try again." });
      }

      const answer = apiData.content
        ?.filter(block => block.type === "text")
        ?.map(block => block.text)
        ?.join(" ")
        ?.trim();

      return Response.json({ result: answer || "I had trouble getting an answer. Please try again." });

    } catch (e) {
      return Response.json({ result: "Connection error. Please try again." });
    }
  }

  if (type === "intent") {
    const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 100,
        system: `You are a voice command classifier for a news app. Return ONLY valid JSON, nothing else.

Format: {"intent":"VALUE","query":"VALUE"}

Intent values:
- "start" → start, begin, play, read, go
- "next" → next, skip, forward, another
- "previous" → back, previous, go back, last
- "pause" → stop, pause, quiet, wait, hold, enough
- "resume" → resume, continue, go on, keep going, unpause
- "question" → any question about the article
- "unknown" → anything else

For non-question intents set query to "".
For question intent set query to the question text.`,
        messages: [{ role: "user", content: text }],
      }),
    });

    const apiData = await apiRes.json();
    const rawText = apiData.content?.[0]?.text ?? '{"intent":"unknown","query":""}';

    try {
      const parsed = JSON.parse(rawText.trim());
      return Response.json(parsed);
    } catch {
      const lower = text.toLowerCase();
      let intent = "unknown";
      if (/(stop|pause|quiet|wait|enough|hold)/.test(lower)) intent = "pause";
      else if (/(next|skip|forward|another)/.test(lower)) intent = "next";
      else if (/(back|previous|before|last)/.test(lower)) intent = "previous";
      else if (/(resume|continue|go on|keep going|unpause)/.test(lower)) intent = "resume";
      else if (/(start|begin|play|read|go)/.test(lower)) intent = "start";
      return Response.json({ intent, query: "" });
    }
  }

  return Response.json({ intent: "unknown", query: "" });
}