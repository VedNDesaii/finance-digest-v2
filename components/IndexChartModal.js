'use client'
// Tap-to-open near-live candlestick chart for an index / gold / FX pair.
// Live data from /api/chart (Yahoo), polled every 45s while open. Own theme.
import { useEffect, useRef, useState, useCallback } from 'react'
import { createChart } from 'lightweight-charts'

const mono = 'var(--font-mono)'
const display = 'var(--font-display)'

const TFS = [['1m', '1m'], ['5m', '5m'], ['15m', '15m'], ['60m', '1h'], ['1d', '1D']]
const POLL_MS = 45000

function cssVar(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return v || fallback
  } catch { return fallback }
}
function fmt(n) { return n == null ? '—' : Math.round(n).toLocaleString('en-IN') }

export default function IndexChartModal({ item, reason, onClose }) {
  // item: { key, name, tag, symbol }
  const chartElRef = useRef(null)
  const chartRef = useRef(null)
  const candleRef = useRef(null)
  const volRef = useRef(null)
  const barsRef = useRef([])
  const pollRef = useRef(null)
  const [tf, setTf] = useState('15m')
  const [legend, setLegend] = useState(null)   // {open,high,low,close}
  const [updatedAt, setUpdatedAt] = useState(null)
  const [status, setStatus] = useState('loading')  // loading | ok | error

  const setLegendFrom = useCallback((b) => { if (b) setLegend(b) }, [])

  // (re)build the chart shell
  const buildChart = useCallback(() => {
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null }
    const el = chartElRef.current
    if (!el) return
    const up = cssVar('--up', '#0B7A4B'), dn = cssVar('--down', '#C0392B')
    const txt = cssVar('--text-muted', '#8A8377'), grid = cssVar('--border-main', '#E4E2DB')
    const chart = createChart(el, {
      width: el.clientWidth, height: 320,
      layout: { background: { type: 'solid', color: 'transparent' }, textColor: txt, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10 },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      rightPriceScale: { borderColor: grid },
      timeScale: { borderColor: grid, timeVisible: true, secondsVisible: false },
      crosshair: { mode: 1 },
    })
    const candle = chart.addCandlestickSeries({ upColor: up, downColor: dn, wickUpColor: up, wickDownColor: dn, borderVisible: false })
    const vol = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: '' })
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } })
    chart.subscribeCrosshairMove((p) => {
      const bar = (p && p.seriesData && candleRef.current) ? p.seriesData.get(candleRef.current) : null
      setLegendFrom(bar || barsRef.current[barsRef.current.length - 1])
    })
    chartRef.current = chart; candleRef.current = candle; volRef.current = vol
  }, [setLegendFrom])

  // fetch + draw data for the current timeframe
  const loadData = useCallback(async (interval) => {
    try {
      const r = await fetch(`/api/chart?symbol=${encodeURIComponent(item.key || item.symbol)}&interval=${interval}`, { cache: 'no-store' })
      const j = await r.json()
      if (!j.ok || !j.bars?.length) { setStatus('error'); return }
      const up = cssVar('--up', '#0B7A4B'), dn = cssVar('--down', '#C0392B')
      barsRef.current = j.bars
      candleRef.current?.setData(j.bars)
      volRef.current?.setData((j.vols || []).map(v => ({ time: v.time, value: v.value, color: v.up ? up : dn })))
      // mark the day's high/low on intraday views
      if (interval !== '1d' && j.bars.length > 2) {
        const lo = j.bars.reduce((a, b) => b.low < a.low ? b : a)
        const hi = j.bars.reduce((a, b) => b.high > a.high ? b : a)
        candleRef.current?.setMarkers([
          { time: lo.time, position: 'belowBar', color: dn, shape: 'arrowUp', text: 'Low ' + fmt(lo.low) },
          { time: hi.time, position: 'aboveBar', color: up, shape: 'arrowDown', text: 'High ' + fmt(hi.high) },
        ])
      } else { candleRef.current?.setMarkers([]) }
      chartRef.current?.timeScale().fitContent()
      setLegend(j.bars[j.bars.length - 1])
      setUpdatedAt(new Date())
      setStatus('ok')
    } catch { setStatus('error') }
  }, [item])

  // open: build chart, load, start polling
  useEffect(() => {
    if (!item) return
    buildChart()
    loadData(tf)
    pollRef.current = setInterval(() => loadData(tf), POLL_MS)
    const onResize = () => chartRef.current?.applyOptions({ width: chartElRef.current?.clientWidth || 320 })
    window.addEventListener('resize', onResize)
    return () => {
      clearInterval(pollRef.current)
      window.removeEventListener('resize', onResize)
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item])

  // timeframe change: reload + restart poll
  useEffect(() => {
    if (!item || !chartRef.current) return
    setStatus('loading')
    loadData(tf)
    clearInterval(pollRef.current)
    pollRef.current = setInterval(() => loadData(tf), POLL_MS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tf])

  if (!item) return null
  const chg = legend ? legend.close - legend.open : 0
  const pct = legend && legend.open ? (chg / legend.open * 100) : 0
  const cls = chg >= 0 ? 'var(--up)' : 'var(--down)'

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,8,5,.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)', borderRadius: '18px 18px 0 0', width: '100%', maxWidth: 620, maxHeight: '94vh', overflow: 'auto', padding: '16px 14px 22px' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
          <div>
            <span style={{ fontFamily: display, fontWeight: 600, fontSize: 20, color: 'var(--head-ink)' }}>{item.name}</span>
            {item.tag && <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--text-muted)', marginLeft: 7 }}>{item.tag}</span>}
          </div>
          <button onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'var(--bg-gist)', color: 'var(--text-secondary)', width: 30, height: 30, borderRadius: 8, fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        {/* live bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '2px 2px 10px', fontFamily: mono, fontSize: 10.5, color: 'var(--text-muted)' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: status === 'ok' ? '#e03b3b' : 'var(--text-muted)', display: 'inline-block' }} />
          <b style={{ color: status === 'ok' ? 'var(--up)' : 'var(--text-muted)', fontWeight: 600 }}>{status === 'error' ? 'DATA UNAVAILABLE' : 'LIVE'}</b>
          {updatedAt && status === 'ok' && <span>· updated {updatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>}
          <span style={{ marginLeft: 'auto', fontFamily: mono, fontSize: 9 }}>Source: Yahoo Finance</span>
        </div>

        {/* timeframe buttons */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', margin: '0 2px 8px' }}>
          {TFS.map(([val, lbl]) => (
            <button key={val} onClick={() => setTf(val)}
              style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, padding: '6px 12px', borderRadius: 7, cursor: 'pointer',
                border: '1px solid ' + (tf === val ? 'var(--accent)' : 'var(--border-main)'),
                background: tf === val ? 'var(--accent)' : 'var(--bg-card)', color: tf === val ? '#fff' : 'var(--text-secondary)' }}>{lbl}</button>
          ))}
        </div>

        {/* chart + legend */}
        <div style={{ position: 'relative' }}>
          {legend && (
            <div style={{ position: 'absolute', left: 10, top: 8, zIndex: 3, fontFamily: mono, fontSize: 11, color: 'var(--text-secondary)', pointerEvents: 'none', background: 'linear-gradient(90deg,var(--bg-card) 72%,transparent)', padding: '3px 10px 3px 2px', borderRadius: 6 }}>
              <span style={{ color: 'var(--head-ink)', fontWeight: 600 }}>{item.name}</span>{'  '}
              O {fmt(legend.open)}  H {fmt(legend.high)}  L {fmt(legend.low)}  C {fmt(legend.close)}{'  '}
              <span style={{ color: cls }}>{chg >= 0 ? '+' : ''}{pct.toFixed(2)}%</span>
            </div>
          )}
          <div ref={chartElRef} style={{ width: '100%', height: 320 }} />
        </div>

        {/* per-index reasoning (from the pipeline, if present) */}
        {reason && (reason.steps?.length || reason.drivers?.length) ? (
          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 2px 12px' }}>
              <span style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>The day so far</span>
              {reason.updated && <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 600, color: 'var(--up)', background: 'var(--up-bg)', padding: '3px 9px', borderRadius: 20 }}>Updated {reason.updated}</span>}
            </div>
            {reason.steps?.length ? reason.steps.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: 14 }}>
                <div style={{ flexShrink: 0, width: 52, textAlign: 'right' }}>
                  <div style={{ fontFamily: mono, fontSize: 12.5, fontWeight: 600, color: s.done === false ? 'var(--text-muted)' : 'var(--text-primary)' }}>{s.t}</div>
                  {s.ampm && <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--text-muted)' }}>{s.ampm}</div>}
                </div>
                <span style={{ flexShrink: 0, width: 11, height: 11, borderRadius: '50%', marginTop: 3, border: '2px solid var(--bg-card)', background: s.dir === 'up' ? 'var(--up)' : s.dir === 'down' ? 'var(--down)' : 'var(--text-muted)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--head-ink)' }}>{s.what}</span>
                    {s.badge && <span style={{ fontFamily: mono, fontSize: 11.5, fontWeight: 600, padding: '2px 8px', borderRadius: 5, background: s.dir === 'up' ? 'var(--up-bg)' : s.dir === 'down' ? 'var(--down-bg)' : 'var(--bg-gist)', color: s.dir === 'up' ? 'var(--up)' : s.dir === 'down' ? 'var(--down)' : 'var(--text-secondary)' }}>{s.badge}</span>}
                  </div>
                  {s.why && <div style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--text-primary)', marginTop: 6 }}><span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Why: </span><span dangerouslySetInnerHTML={{ __html: s.why }} /></div>}
                </div>
              </div>
            )) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                {reason.drivers.map((d, i) => (
                  <li key={i} style={{ display: 'flex', gap: 9, fontSize: 14.5, lineHeight: 1.55, color: 'var(--text-primary)' }}>
                    <span style={{ flexShrink: 0, width: 6, height: 6, borderRadius: '50%', marginTop: 8, background: 'var(--up)' }} />
                    <span dangerouslySetInnerHTML={{ __html: d }} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
