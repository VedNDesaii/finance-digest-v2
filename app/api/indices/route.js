export async function GET() {
  try {
    const res  = await fetch(
      'https://query1.finance.yahoo.com/v7/finance/quote?symbols=%5EBSESN,%5ENSEI',
      { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 60 } }
    )
    const data = await res.json()
    const results = data?.quoteResponse?.result || []

    const parse = (r) => {
      if (!r) return { price: null, change: null, pct: null }
      const curr = r.regularMarketPrice
      const prev = r.regularMarketPreviousClose
      return {
        price:  curr.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
        change: (curr - prev).toFixed(2),
        pct:    (((curr - prev) / prev) * 100).toFixed(2),
      }
    }

    const sensex = results.find(r => r.symbol === '^BSESN')
    const nifty  = results.find(r => r.symbol === '^NSEI')

    return Response.json({ sensex: parse(sensex), nifty: parse(nifty) })
  } catch (e) {
    return Response.json({ sensex: {}, nifty: {} }, { status: 500 })
  }
}