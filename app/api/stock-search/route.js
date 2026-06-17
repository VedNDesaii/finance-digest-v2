export async function POST(req) {
  const { query } = await req.json();

  if (!query || query.trim().length < 1) {
    return Response.json({ results: [] });
  }

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=15&newsCount=0`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
    });

    if (!res.ok) {
      return Response.json({ results: [], error: `Search failed: ${res.status}` });
    }

    const data = await res.json();
    const quotes = data?.quotes || [];

    const results = quotes
      .filter(q => q.symbol && (q.quoteType === "EQUITY" || q.quoteType === "ETF"))
      .map(q => {
        let exchange = "OTHER";
        if (q.symbol.endsWith(".NS")) exchange = "NSE";
        else if (q.symbol.endsWith(".BO")) exchange = "BSE";
        else if (q.exchange === "NMS" || q.exchange === "NGM" || q.exchange === "NCM") exchange = "NASDAQ";
        else if (q.exchange === "NYQ") exchange = "NYSE";
        else exchange = q.exchange || "OTHER";

        return {
          ticker: q.symbol,
          name: q.longname || q.shortname || q.symbol,
          exchange,
        };
      })
      .slice(0, 10);

    return Response.json({ results });
  } catch (e) {
    return Response.json({ results: [], error: "Search request failed." });
  }
}
