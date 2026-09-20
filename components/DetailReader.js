'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import DoubtBox from './DoubtBox'

const CAT_LABEL = {
  'indian-markets': 'Indian Markets', 'us-markets': 'US Markets', 'global-economy': 'Global',
  'macro-policy': 'Economy & Policy', 'banking-finance': 'Deals & Banking',
  'investment-banking': 'Deals & Banking', 'technology-it': 'Technology',
  'pharma-health': 'Pharma', 'auto-ev': 'Auto & EV', 'energy-oil': 'Energy',
  'metals-mining': 'Metals', 'infrastructure': 'Infrastructure', 'fmcg-consumer': 'FMCG',
  'renewables': 'Renewables', 'real-estate': 'Real Estate', 'telecom-media': 'Telecom',
}
// Impact wording — plain, not trader jargon.
function senti(a) {
  const s = (a.sentiment || '').toLowerCase()
  if (s === 'bullish') return { cls: 'bull', lbl: 'Positive' }
  if (s === 'bearish') return { cls: 'bear', lbl: 'Negative' }
  return { cls: 'neutral', lbl: 'Neutral' }
}
// Feed-sourced text can arrive HTML-encoded; decode for display.
function decodeEntities(str) {
  return (str || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&rsquo;/g, '’').replace(/&lsquo;/g, '‘').replace(/&nbsp;/g, ' ')
}
// Split "**Label.** text\n\n**Label.** text" into {label, body} blocks.
function fmtDetailed(raw) {
  return (raw || '').trim().split(/\n\n+/).filter(Boolean).map(p => {
    const m = p.trim().match(/^\*\*(.+?)\*\*\s*(.*)$/s)
    return m ? { label: m[1].replace(/[.:]\s*$/, ''), body: m[2].trim() } : { label: null, body: p.trim() }
  })
}

export default function DetailReader({ article, dark, open, onClose }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [open, onClose])

  if (!open || !mounted) return null

  const source = ((article.source || '').split('|').pop() || '').trim() || 'Finance Digest'
  const cat = CAT_LABEL[article.category] || 'Markets'
  const s = senti(article)
  const time = (() => { try { return new Date(article.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) } catch { return '' } })()
  const why = decodeEntities((article.investor_take || '').trim())
  const picture = decodeEntities((article.detailed_article || '').trim())
  const impact = decodeEntities((article.market_impact || '').trim())
  const means = decodeEntities((article.what_this_means || '').trim())
  const glossary = Array.isArray(article.glossary) ? article.glossary : []
  const concepts = Array.isArray(article.concepts) ? article.concepts : []
  const stat = (article.stat || '').trim()
  const statLbl = (article.stat_label || '').trim()
  const keyNumbers = (Array.isArray(article.key_numbers) ? article.key_numbers : []).slice(0, 4)
  const howItWorks = Array.isArray(article.how_it_works) ? article.how_it_works : []
  const impColor = s.cls === 'bull' ? 'var(--up)' : s.cls === 'bear' ? 'var(--down)' : 'var(--neutral)'
  const impBg = s.cls === 'bull' ? 'var(--up-bg)' : s.cls === 'bear' ? 'var(--down-bg)' : 'var(--bg-gist)'

  return createPortal((
    <div className="fd2" style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'var(--bg-page)', display: 'flex', flexDirection: 'column', animation: 'fd2SlideUp 0.3s ease', fontFamily: 'var(--font-ui)' }}>
      {/* header */}
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-main)', background: 'var(--bg-card)', flexShrink: 0 }}>
        <button onClick={onClose} aria-label="Back" style={{ width: '34px', height: '34px', borderRadius: '10px', border: '1px solid var(--border-main)', background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '17px', display: 'grid', placeItems: 'center' }}>‹</button>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 600 }}>Full analysis</span>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: 'var(--text-muted)' }}>{source}</span>
      </div>

      {/* body — opens straight to the full analysis (no second click) */}
      <div className="fd2-rbody" style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '18px 18px 44px' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <div className="fd2-chips">
            <span className="fd2-chip sec">{cat}</span>
            <span className={'fd2-chip ' + s.cls}>{s.lbl}</span>
          </div>
          <h1>{decodeEntities(article.headline || article.title)}</h1>

          <div className="fd2-rmeta">
            <span>{source}</span>{time && <span>{time} · IST</span>}<span>AI-assisted</span>
          </div>

          {stat && keyNumbers.length === 0 && (
            <div className="fd2-stat"><span className="num">{stat}</span>{statLbl && <span className="lb">{statLbl}</span>}</div>
          )}

          {keyNumbers.length > 0 && (
            <div className="fd2-keynums">
              {keyNumbers.map((k, i) => {
                const d = (k.dir || '').toLowerCase()
                const dc = d === 'up' ? 'up' : d === 'down' ? 'down' : ''
                const arrow = d === 'up' ? '▲' : d === 'down' ? '▼' : ''
                return (
                  <div className="kn" key={i}>
                    <div className="kl">{decodeEntities(k.label || '')}</div>
                    <div className="kv">{decodeEntities(k.value || '')}</div>
                    {k.change && <div className={'kc ' + dc}>{arrow ? arrow + ' ' : ''}{decodeEntities(k.change)}</div>}
                  </div>
                )
              })}
            </div>
          )}

          {picture && (
            <div className="fd2-blk">
              <div className="bh">The full picture</div>
              {fmtDetailed(picture).map((b, i) => (
                <p key={i}>{b.label && <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{b.label}. </strong>}{b.body}</p>
              ))}
            </div>
          )}

          {howItWorks.length > 0 && (
            <div className="fd2-how">
              <div className="bh">How it works</div>
              <ol>
                {howItWorks.map((step, i) => (
                  <li key={i}><span className="n">{i + 1}</span><p>{decodeEntities(typeof step === 'string' ? step : (step.text || step.step || ''))}</p></li>
                ))}
              </ol>
            </div>
          )}

          {impact && (
            <div className="fd2-blk">
              <div className="bh">Market impact — what could happen <span className="impact" style={{ color: impColor, background: impBg }}>{s.lbl}</span></div>
              {impact.split(/\n\n+/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
            </div>
          )}

          {means && (
            <div className="fd2-blk"><div className="bh">What this means for you</div><p>{means}</p></div>
          )}

          {glossary.length > 0 && (
            <div className="fd2-gloss">
              <div className="bh">Key terms</div>
              {glossary.map((g, i) => (
                <div className="gl" key={i}><b>{decodeEntities(g.word || g.term)}</b><span>{decodeEntities(g.meaning || g.definition)}</span></div>
              ))}
            </div>
          )}

          {concepts.length > 0 && (
            <div className="fd2-concepts">
              <div className="bh">Concepts explained</div>
              {concepts.map((c, i) => {
                const use = decodeEntities(c.in_news || c.usage || c.example || c.applied || '')
                return (
                  <div className="cc" key={i}>
                    <b>{decodeEntities(c.name || c.concept || c.word || '')}</b>
                    <p>{decodeEntities(c.explanation || c.meaning || c.definition || '')}</p>
                    {use && <p className="use"><span className="ul">In this news</span>{use}</p>}
                  </div>
                )
              })}
            </div>
          )}

          <DoubtBox article={article} dark={dark} />
        </div>
      </div>

      <style>{`@keyframes fd2SlideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }`}</style>
    </div>
  ), document.body)
}
