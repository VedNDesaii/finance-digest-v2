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
  const [expanded, setExpanded] = useState(false)
  useEffect(() => setMounted(true), [])
  useEffect(() => { if (open) setExpanded(false) }, [open, article?.id])
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
  const simple = decodeEntities((article.simplified_article || '').trim())
  const picture = decodeEntities((article.detailed_article || '').trim())
  const impact = decodeEntities((article.market_impact || '').trim())
  const means = decodeEntities((article.what_this_means || '').trim())
  const glossary = Array.isArray(article.glossary) ? article.glossary : []
  const stat = (article.stat || '').trim()
  const statLbl = (article.stat_label || '').trim()
  const hasDepth = !!(picture || impact || means || glossary.length || stat)
  const impColor = s.cls === 'bull' ? 'var(--up)' : s.cls === 'bear' ? 'var(--down)' : 'var(--neutral)'
  const impBg = s.cls === 'bull' ? 'var(--up-bg)' : s.cls === 'bear' ? 'var(--down-bg)' : 'var(--bg-gist)'

  return createPortal((
    <div className="fd2" style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'var(--bg-page)', display: 'flex', flexDirection: 'column', animation: 'fd2SlideUp 0.3s ease', fontFamily: 'var(--font-ui)' }}>
      {/* header */}
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-main)', background: 'var(--bg-card)', flexShrink: 0 }}>
        <button onClick={onClose} aria-label="Back" style={{ width: '34px', height: '34px', borderRadius: '10px', border: '1px solid var(--border-main)', background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '17px', display: 'grid', placeItems: 'center' }}>‹</button>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>The brief · deep dive</span>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: 'var(--text-muted)' }}>{source}</span>
      </div>

      {/* body */}
      <div className="fd2-rbody" style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '18px 18px 44px' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <div className="fd2-chips">
            <span className="fd2-chip sec">{cat}</span>
            <span className={'fd2-chip ' + s.cls}>{s.lbl}</span>
          </div>
          <h1>{decodeEntities(article.title)}</h1>

          {why && <p className="fd2-rsub"><b>Why it matters</b>{why}</p>}

          <div className="fd2-rmeta">
            <span>{source}</span>{time && <span>{time} · IST</span>}<span>AI-assisted</span>
          </div>

          {/* Quick read (always visible) */}
          {simple && (
            <div className="fd2-simple">
              <div className="bh">In simple terms</div>
              <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.62, color: 'var(--text-primary)', whiteSpace: 'pre-line' }}>{simple}</p>
            </div>
          )}

          {/* Full analysis (revealed on tap) */}
          {hasDepth && !expanded && (
            <button className="fd2-expandbtn" onClick={() => setExpanded(true)}>
              Full analysis: numbers, market impact &amp; key terms →
            </button>
          )}

          {hasDepth && expanded && (
            <div style={{ animation: 'fd2FadeUp 0.25s ease' }}>
              {stat && (
                <div className="fd2-stat"><span className="num">{stat}</span>{statLbl && <span className="lb">{statLbl}</span>}</div>
              )}
              {picture && (
                <div className="fd2-blk">
                  <div className="bh">The full picture</div>
                  {fmtDetailed(picture).map((b, i) => (
                    <p key={i}>{b.label && <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{b.label}. </strong>}{b.body}</p>
                  ))}
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
            </div>
          )}

          <DoubtBox article={article} dark={dark} />
        </div>
      </div>

      <style>{`@keyframes fd2SlideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes fd2FadeUp { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }`}</style>
    </div>
  ), document.body)
}
