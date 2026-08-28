'use client'
import { useState } from 'react'
import DetailReader from './DetailReader'

// Friendly labels for the category badge.
const CAT_LABEL = {
  'indian-markets': 'Indian Markets', 'us-markets': 'US Markets', 'global-economy': 'Global',
  'macro-policy': 'Economy & Policy', 'banking-finance': 'Deals & Banking',
  'investment-banking': 'Deals & Banking', 'technology-it': 'Technology',
  'pharma-health': 'Pharma', 'auto-ev': 'Auto & EV', 'energy-oil': 'Energy',
  'metals-mining': 'Metals', 'infrastructure': 'Infrastructure', 'fmcg-consumer': 'FMCG',
  'renewables': 'Renewables', 'real-estate': 'Real Estate', 'telecom-media': 'Telecom',
}

// Trim the card blurb to a true ~30-second read: first 1–2 sentences, word-capped.
function cardBlurb(text, maxWords = 34) {
  const t = (text || '').replace(/\s*\n+\s*/g, ' ').trim()
  if (!t) return ''
  const sentences = t.match(/[^.!?]+[.!?]+/g) || [t]
  let out = sentences.slice(0, 2).join(' ').trim()
  const words = out.split(/\s+/)
  if (words.length > maxWords) out = words.slice(0, maxWords).join(' ').replace(/[,;:]?$/, '') + '…'
  return out
}

// sentiment → colour token + label
function sentiment(article) {
  const s = (article.sentiment || '').toLowerCase()
  if (s === 'bullish') return { color: 'var(--up)',   label: 'Bullish'  }
  if (s === 'bearish') return { color: 'var(--down)', label: 'Bearish'  }
  return { color: 'var(--text-muted)', label: 'Neutral' }
}

export default function ArticleCard({ article, dark }) {
  const [showReader, setShowReader] = useState(false)

  const source   = article.source?.split('|').pop()?.trim() || article.source || 'Finance Digest'
  const catLabel = CAT_LABEL[article.category] || 'Markets'
  const sen      = sentiment(article)
  const diff     = article.difficulty || ''
  const stat     = article.stat || ''
  const statLbl  = article.stat_label || ''

  // 30-second card summary: a trimmed blurb (full text lives in Read in full).
  const summary = cardBlurb(article.simplified_article || article.investor_take || '')

  return (
    <article style={{
      background: 'var(--bg-card)', borderRadius: 'var(--radius-card)', overflow: 'hidden',
      border: '1px solid var(--border-main)', boxShadow: 'var(--shadow-card)',
      display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-ui)', height: '100%',
    }}>
      {/* Image */}
      <div style={{ position: 'relative', flex: 'none', height: '168px', overflow: 'hidden', background: 'var(--bg-gist)' }}>
        {article.image_url ? (
          <img loading="lazy" referrerPolicy="no-referrer" alt={article.title}
            src={`https://wsrv.nl/?url=ssl:${article.image_url.replace(/^https?:\/\//, '')}&w=800&output=webp&q=80`}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={e => {
              // if the CDN proxy fails, try the origin once, then give up
              if (!e.target.dataset.fellBack) { e.target.dataset.fellBack = '1'; e.target.src = article.image_url }
              else { e.target.style.display = 'none' }
            }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '30px', letterSpacing: '-0.02em' }}>
            {catLabel}
          </div>
        )}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '54px', background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)' }} />
        <span style={{
          position: 'absolute', top: '12px', left: '12px', fontFamily: 'var(--font-mono)',
          fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase',
          background: 'rgba(0,0,0,0.55)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '6px', padding: '4px 8px', backdropFilter: 'blur(4px)',
        }}>{source}</span>
      </div>

      {/* Body */}
      <div style={{ padding: '15px 17px 16px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-primary)', background: 'var(--bg-gist)', border: '1px solid var(--border-main)', borderRadius: '6px', padding: '4px 8px' }}>{catLabel}</span>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: sen.color }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: sen.color }}>{sen.label}</span>
          {diff && <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '9.5px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', border: '1px solid var(--border-main)', borderRadius: '20px', padding: '3px 9px' }}>● {diff}</span>}
        </div>

        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '19px', lineHeight: 1.22, letterSpacing: '-0.01em', color: 'var(--accent)', margin: '0 0 9px' }}>
          {article.title}
        </h2>

        <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0, flex: 1, minHeight: 0, overflow: 'auto', whiteSpace: 'pre-line' }}>
          {summary}
        </p>

        {stat && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', margin: '13px 0', paddingTop: '13px', borderTop: '1px solid var(--border-main)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '23px', color: sen.color }}>{stat}</span>
            {statLbl && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{statLbl}</span>}
          </div>
        )}

        <button onClick={(e) => { e.stopPropagation(); setShowReader(true) }} style={{
          marginTop: stat ? 0 : '13px', width: '100%', border: 'none', borderRadius: '12px', padding: '13px',
          fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '12px', letterSpacing: '0.04em',
          textTransform: 'uppercase', cursor: 'pointer', background: 'var(--text-primary)', color: 'var(--bg-page)',
        }}>Read in full →</button>
      </div>

      <DetailReader article={article} dark={dark} open={showReader} onClose={() => setShowReader(false)} />
    </article>
  )
}
