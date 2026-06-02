export async function POST(req) {
  const { ticker, name, exchange } = await req.json()

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'API key missing. Please add ANTHROPIC_API_KEY to your environment variables.' })
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `You are a financial news reporter. Your job is to explain stock news so clearly that ANYONE can understand it — whether they are 16 or 70, whether they invest daily or have never bought a stock in their life.

Search for the latest news about "${ticker}" (${name}, listed on ${exchange}) from the past 24-48 hours.

STRICT RULES:
- Only report real news you actually find: earnings, regulatory actions, management changes, big contracts, analyst calls with specific targets, court cases, or major events affecting this stock
- Never give buy/sell/hold advice
- Never make up or assume news — only report what you find
- If there is no significant news in the last 48 hours, set has_news to false
- Always include today's price and % change

HOW TO WRITE — the golden rule is: if your grandmother and your 16-year-old cousin can both read it and understand it, you've done it right.

For every news item:

HEADLINE (max 10 words):
- State the single most important fact. Be specific. Name who did what.
- Bad: "Company posts strong results" → Good: "Infosys Q4 profit rises 12% to ₹7,969 crore"

DETAIL (exactly 2 sentences):
- Sentence 1: What happened, when, and what is the exact number or fact?
- Sentence 2: Why does this matter to someone who owns this stock or is thinking about it?
- Write like you are explaining it to a family member at the dinner table. Simple words. Short sentences. Real numbers.
- Every finance term must be explained in plain words immediately after in brackets.
  Example: "The company's EPS (earnings per share — the profit made for each single stock) rose to ₹58."
  Example: "The RBI (India's central bank, which controls interest rates) kept rates unchanged."
- Never use vague language. "Rose significantly" → WRONG. "Rose 4.2% to ₹1,840" → RIGHT.
- Never use: "market participants", "headwinds", "going forward", "remain cautious", "amid uncertainty"

Return ONLY a valid JSON object. No markdown, no extra text.

{
  "has_news": true or false,
  "price_summary": "One plain sentence. Example: Infosys is trading at ₹1,840, up 2.1% today.",
  "news_items": [
    {
      "headline": "Specific fact in max 10 words",
      "detail": "Sentence 1: exactly what happened with real numbers. Sentence 2: what this means for someone holding or watching this stock, in plain everyday language.",
      "source": "Source name if found, else empty string",
      "type": "earnings" or "regulatory" or "management" or "analyst" or "macro" or "other"
    }
  ]
}

If has_news is false, news_items must be [].
Maximum 3 news items. Only include items with real factual detail — no filler.`
        }]
      })
    })

    const data = await res.json()
    const text = data.content?.filter(b => b.type === 'text').map(b => b.text).join('') || ''

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('No JSON found in response:', text)
      return Response.json({ error: 'Could not fetch news. Please try again.' })
    }

    return Response.json(JSON.parse(jsonMatch[0]))
  } catch (e) {
    console.error('Portfolio API error:', e)
    return Response.json({ error: 'Could not fetch news. Please try again.' })
  }
}