export async function POST(req) {
  const { type, text, articleContext } = await req.json();

  if (type === "question") {
    
    // Check API key exists
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("ANTHROPIC_API_KEY is missing from .env.local");
      return Response.json({ result: "API key is missing. Please add ANTHROPIC_API_KEY to your .env.local file." });
    }

    try {
      const systemPrompt = `You are a friendly finance teacher talking to someone who knows nothing about finance.
They just heard a news article and asked a question out loud.
Rules:
- Answer in maximum 3 short simple sentences
- Use everyday language a 16 year old would understand
- Use the article as context to stay on topic, but expand beyond it using your own knowledge
- Never contradict facts stated in the article
- For factual questions (numbers, definitions, history, how things work), use web search to get the latest accurate data
- If the article gives a specific number or fact, use that exact figure
- Never say "I cannot answer", "the article doesn't say", or "I couldn't find" — always give a helpful answer
- Sound warm and conversational like a friend explaining`;

      const userMessage = `Article: ${articleContext ?? "No article context available"}\n\nQuestion: ${text}`;

      const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "web-search-2025-03-05",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 500,
          system: systemPrompt,
          tools: [
            {
              type: "web_search_20250305",
              name: "web_search",
            }
          ],
          messages: [
            { role: "user", content: userMessage }
          ],
        }),
      });

      const apiData = await apiRes.json();
      console.log("Claude full response:", JSON.stringify(apiData));

      if (apiData.error) {
        console.error("Claude API error:", apiData.error);
        return Response.json({ result: `There was an API error: ${apiData.error.message}` });
      }

      // Extract final text answer (may come after web_search tool use blocks)
      const answer = apiData.content
        ?.filter(block => block.type === "text")
        ?.map(block => block.text)
        ?.join(" ")
        ?.trim();

      if (!answer) {
        console.error("No answer in response:", apiData);
        return Response.json({ result: "I had trouble getting an answer. Please try again." });
      }

      return Response.json({ result: answer });

    } catch (e) {
      console.error("Fetch error:", e);
      return Response.json({ result: "There was a connection error. Please try again." });
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
        model: "claude-sonnet-4-6",
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

    console.log("Claude raw response:", rawText);

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