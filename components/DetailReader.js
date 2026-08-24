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
function sentiment(a) {
  const s = (a.sentiment || '').toLowerCase()
  if (s === 'bullish') return { color: 'var(--up)',   label: 'Bullish' }
  if (s === 'bearish') return { color: 'var(--down)', label: 'Bearish' }
  return { color: 'var(--text-muted)', label: 'Neutral' }
}
// Split "**Label.** text\n\n**Label.** text" into {heading, body} blocks.
function labelledBlocks(raw) {
  return (raw || '').trim().split(/\n\n+/).filter(Boolean).map(p => {
    const m = p.trim().match(/^\*\*(.+?)\*\*\s*(.*)$/s)
    return m ? { heading: m[1].replace(/[.:]\s*$/, ''), body: m[2].trim() } : { heading: null, body: p.trim() }
  })
}

const Section = ({ title, children }) => (
  <div>
    <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)', margin: '0 0 9px', display: 'flex', alignItems: 'center', gap: '7px' }}>
      <span style={{ width: '13px', height: '2px', background: 'var(--accent)', borderRadius: '2px', display: 'inline-block' }} />
      {title}
    </h2>
    {children}
  </div>
)
const Para = ({ children }) => (
  <p style={{ fontSize: '14px', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 10px' }}>{children}</p>
)

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

  const source   = article.source?.split('|').pop()?.trim() || article.source || 'Finance Digest'
  const catLabel = CAT_LABEL[article.category] || 'Markets'
  const sen      = sentiment(article)
  const picture  = (article.detailed_article || '').trim()
  const impact   = (article.market_impact || '').trim()
  const meansYou = (article.what_this_means || '').trim()
  const simple   = (article.simplified_article || '').trim()
  const glossary = Array.isArray(article.glossary) ? article.glossary : []

  return createPortal((
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'var(--bg-page)', display: 'flex', flexDirection: 'column', animation: 'drSlideIn 0.25s ease', fontFamily: 'var(--font-ui)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '15px 16px', borderBottom: '1px solid var(--border-main)', background: 'var(--bg-card)', flexShrink: 0 }}>
        <button onClick={onClose} aria-label="Back" style={{ width: '34px', height: '34px', borderRadius: '10px', border: '1px solid var(--border-main)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '17px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)' }}>Full story</span>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>{source}</span>
      </div>

      {/* Body */}
      <div style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '18px 16px 48px' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-primary)', background: 'var(--bg-gist)', border: '1px solid var(--border-main)', borderRadius: '6px', padding: '4px 8px' }}>{catLabel}</span>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: sen.color }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: sen.color }}>{sen.label}</span>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: 'var(--text-muted)' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1.8s ease-in-out infinite' }} /> Live
            </span>
          </div>

          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '23px', lineHeight: 1.2, letterSpacing: '-0.01em', color: 'var(--text-primary)', margin: 0 }}>{article.title}</h1>

          {simple && (
            <div style={{ background: 'var(--bg-gist)', border: '1px solid var(--border-main)', borderLeft: '3px solid var(--accent)', borderRadius: '10px', padding: '13px 15px', fontSize: '15px', lineHeight: 1.55, color: 'var(--text-primary)', whiteSpace: 'pre-line' }}>
              {simple}
            </div>
          )}

          {picture ? (
            <Section title="The full picture">
              {labelledBlocks(picture).map((b, i) => (
                <p key={i} style={{ fontSize: '14px', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 10px' }}>
                  {b.heading && <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{b.heading}. </strong>}{b.body}
                </p>
              ))}
            </Section>
          ) : null}

          {impact && (
            <Section title="Market impact — what could happen">
              {impact.split(/\n\n+/).filter(Boolean).map((p, i) => <Para key={i}>{p}</Para>)}
            </Section>
          )}

          {meansYou && (
            <Section title="What this means for you"><Para>{meansYou}</Para></Section>
          )}

          {article.investor_take && (
            <Section title="Why it matters"><Para>{article.investor_take}</Para></Section>
          )}

          {glossary.length > 0 && (
            <Section title="Key terms">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {glossary.map((t, i) => (
                  <div key={i} style={{ background: 'var(--bg-gist)', border: '1px solid var(--border-main)', borderRadius: '8px', padding: '10px 12px' }}>
                    <b style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{t.word || t.term}</b>
                    <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '12.5px', marginTop: '3px', lineHeight: 1.5 }}>{t.meaning || t.definition}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <DoubtBox article={article} dark={dark} />

          <div style={{ borderTop: '1px solid var(--border-main)', paddingTop: '14px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>{source}</span><span>Finance Digest</span>
          </div>
        </div>
      </div>

      <style>{`@keyframes drSlideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }`}</style>
    </div>
  ), document.body)
}
