'use client'
// Gold, commodities & FX — live tickers for the Market section.
// Each card fetches its own latest price from /api/chart (Yahoo) and is tappable
// to open the full near-live chart via onOpen().
import { useEffect, useState } from 'react'

const mono = 'var(--font-mono)'
const ITEMS = [
  { key: 'gold', name: 'Gold', tag: 'COMEX · $/oz', unit: '$' },
  { key: 'usdinr', name: 'USD / INR', tag: 'FX', unit: '' },
  { key: 'eurinr', name: 'EUR / INR', tag: 'FX', unit: '' },
  { key: 'brent', name: 'Brent crude', tag: '$/bbl', unit: '$' },
]

function Spark({ bars, up }) {
  if (!bars || bars.length < 2) return <svg width="100%" height="20" />
  const xs = bars.map(b => b.close)
  const min = Math.min(...xs), max = Math.max(...xs), rng = (max - min) || 1
  const n = xs.length
  const pts = xs.map((v, i) => `${(i / (n - 1) * 120).toFixed(1)},${(18 - (v - min) / rng * 16).toFixed(1)}`).join(' ')
  return (
    <svg width="100%" height="20" viewBox="0 0 120 20" preserveAspectRatio="none">
      <polyline points={pts} stroke={up ? 'var(--up)' : 'var(--down)'} strokeWidth="1.6" fill="none" strokeLinejoin="round" />
    </svg>
  )
}

export default function GoldFxStrip({ onOpen, isMobile }) {
  const [data, setData] = useState({})

  useEffect(() => {
    let ok = true
    ITEMS.forEach(it => {
      fetch(`/api/chart?symbol=${it.key}&interval=5m`, { cache: 'no-store' })
        .then(r => r.json())
        .then(j => {
          if (!ok || !j.ok) return
          const price = j.price
          const prev = j.prevClose
          const pct = (price != null && prev) ? ((price - prev) / prev * 100) : null
          setData(d => ({ ...d, [it.key]: { price, pct, up: (pct ?? 0) >= 0, bars: (j.bars || []).slice(-40) } }))
        })
        .catch(() => {})
    })
    return () => { ok = false }
  }, [])

  const fmtVal = (it, v) => {
    if (v == null) return '—'
    const n = v >= 1000 ? Math.round(v).toLocaleString('en-IN') : v.toFixed(2)
    return (it.unit || '') + n
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '9px' }}>
      {ITEMS.map(it => {
        const d = data[it.key] || {}
        return (
          <div key={it.key} onClick={() => onOpen({ key: it.key, name: it.name, tag: it.tag })}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)', borderRadius: '12px', padding: '11px 12px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontFamily: mono, fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{it.name}</span>
              <span style={{ fontFamily: mono, fontSize: '11px', fontWeight: 600, color: d.pct == null ? 'var(--text-muted)' : d.up ? 'var(--up)' : 'var(--down)' }}>
                {d.pct == null ? '' : (d.up ? '+' : '') + d.pct.toFixed(2) + '%'}
              </span>
            </div>
            <div style={{ fontFamily: mono, fontWeight: 600, fontSize: '15px', color: 'var(--head-ink)', margin: '3px 0 6px' }}>{fmtVal(it, d.price)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1 }}><Spark bars={d.bars} up={d.up} /></div>
              <span style={{ fontFamily: mono, fontSize: '9px', color: 'var(--accent)', whiteSpace: 'nowrap' }}>Chart →</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
