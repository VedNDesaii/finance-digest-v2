// Live OHLC proxy for the tap-to-open candlestick charts.
// Pulls intraday/daily bars from Yahoo's free public chart endpoint (no key),
// server-side so the browser never calls Yahoo directly. Near-live: the client
// polls this every ~30-60s while a chart is open.
//
// Only a bare symbol is ever sent to Yahoo — never any user data.
export const dynamic = 'force-dynamic'

// Friendly keys → Yahoo symbols. Indices, gold, FX and crude all share this route.
const SYMBOLS = {
  nifty: '^NSEI',
  sensex: '^BSESN',
  banknifty: '^NSEBANK',
  sp500: '^GSPC',
  nasdaq: '^IXIC',
  dow: '^DJI',
  gold: 'GC=F',        // COMEX gold (USD/oz)
  silver: 'SI=F',
  usdinr: 'INR=X',
  eurinr: 'EURINR=X',
  gbpinr: 'GBPINR=X',
  brent: 'BZ=F',       // Brent crude (USD/bbl)
  crude: 'CL=F',
}

// Interval → a sensible Yahoo range so the chart has enough bars.
const RANGE_FOR = { '1m': '1d', '5m': '5d', '15m': '1mo', '30m': '1mo', '60m': '3mo', '1d': '1y' }

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const keyOrSym = (searchParams.get('symbol') || 'nifty').toLowerCase()
    const interval = searchParams.get('interval') || '15m'
    const sym = SYMBOLS[keyOrSym] || searchParams.get('symbol') || '^NSEI'
    const range = searchParams.get('range') || RANGE_FOR[interval] || '5d'

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=${interval}&range=${range}&includePrePost=false`
    const r = await fetch(url, {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FinanceDigest/1.0)' },
    })
    if (!r.ok) return Response.json({ ok: false, error: `yahoo ${r.status}` }, { status: 502 })
    const j = await r.json()
    const res = j?.chart?.result?.[0]
    if (!res) return Response.json({ ok: false, error: 'no data' }, { status: 502 })

    const ts = res.timestamp || []
    const q = res.indicators?.quote?.[0] || {}
    const bars = []
    const vols = []
    for (let i = 0; i < ts.length; i++) {
      const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i]
      if (o == null || c == null || h == null || l == null) continue
      bars.push({ time: ts[i], open: +o.toFixed(2), high: +h.toFixed(2), low: +l.toFixed(2), close: +c.toFixed(2) })
      vols.push({ time: ts[i], value: Math.round(q.volume?.[i] || 0), up: c >= o })
    }
    const meta = res.meta || {}
    return Response.json({
      ok: true,
      symbol: sym,
      bars,
      vols,
      price: meta.regularMarketPrice ?? (bars.length ? bars[bars.length - 1].close : null),
      prevClose: meta.chartPreviousClose ?? meta.previousClose ?? null,
      currency: meta.currency || '',
      source: 'Yahoo Finance',
    })
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 })
  }
}
