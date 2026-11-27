// Live index quotes for the homepage strip + Markets tab — the SAME Yahoo chart
// source the tap-to-open chart uses (/api/chart), so the strip always matches it.
// Only bare symbols are sent to Yahoo — never any user data.
export const dynamic = 'force-dynamic'

const SYMBOLS = {
  nifty: '^NSEI',
  sensex: '^BSESN',
  banknifty: '^NSEBANK',
  sp500: '^GSPC',
  nasdaq: '^IXIC',
  dow: '^DJI',
}

async function quote(key) {
  const sym = SYMBOLS[key]
  if (!sym) return null
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1m&range=1d&includePrePost=false`
  const r = await fetch(url, { cache: 'no-store', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FinanceDigest/1.0)' } })
  if (!r.ok) return null
  const j = await r.json()
  const res = j?.chart?.result?.[0]
  const meta = res?.meta
  if (!meta) return null
  // Latest traded price: Yahoo's regularMarketPrice, else the last non-null 1m close.
  let price = meta.regularMarketPrice
  if (price == null) {
    const closes = res.indicators?.quote?.[0]?.close || []
    for (let i = closes.length - 1; i >= 0; i--) if (closes[i] != null) { price = closes[i]; break }
  }
  const prev = meta.chartPreviousClose ?? meta.previousClose
  if (price == null || prev == null) return null
  const change = price - prev
  return {
    price: +price.toFixed(2),
    prevClose: +prev.toFixed(2),
    change: +change.toFixed(2),
    pct: +((change / prev) * 100).toFixed(2),
    time: meta.regularMarketTime || null, // unix seconds of the last trade
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const keys = (searchParams.get('k') || 'nifty,sensex,banknifty,nasdaq,sp500')
      .split(',').map(s => s.trim().toLowerCase()).filter(k => SYMBOLS[k]).slice(0, 8)
    const results = await Promise.all(keys.map(k => quote(k).catch(() => null)))
    const out = {}
    keys.forEach((k, i) => { if (results[i]) out[k] = results[i] })
    return Response.json(
      { ok: Object.keys(out).length > 0, quotes: out, source: 'Yahoo Finance' },
      // short CDN cache so many visitors share one upstream call every ~20 s
      { headers: { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40' } }
    )
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 })
  }
}
