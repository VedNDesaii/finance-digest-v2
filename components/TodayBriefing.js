'use client'
import { useEffect, useState } from 'react'
import DetailReader from './DetailReader'

// Friendly labels for the category chip — mirrors ArticleCard.
const CAT_LABEL = {
  'indian-markets': 'Indian Markets', 'us-markets': 'US Markets', 'global-economy': 'Global',
  'macro-policy': 'Economy & Policy', 'banking-finance': 'Deals & Banking',
  'investment-banking': 'Deals & Banking', 'technology-it': 'Technology',
  'pharma-health': 'Pharma', 'auto-ev': 'Auto & EV', 'energy-oil': 'Energy',
  'metals-mining': 'Metals', 'infrastructure': 'Infrastructure', 'fmcg-consumer': 'FMCG',
  'renewables': 'Renewables', 'real-estate': 'Real Estate', 'telecom-media': 'Telecom',
}

const mono = 'var(--font-mono)'

function sentInfo(article) {
  const s = (article.sentiment || '').toLowerCase()
  if (s === 'bullish') return { label: 'Positive', color: 'var(--up)',   bg: 'var(--up-bg)',   border: 'var(--border-accent)' }
  if (s === 'bearish') return { label: 'Negative', color: 'var(--down)', bg: 'var(--down-bg)', border: 'var(--border-accent)' }
  return { label: 'Neutral', color: 'var(--text-muted)', bg: 'transparent', border: 'var(--border-main)' }
}

function fmtTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })
  } catch { return '' }
}

function srcName(a) {
  return a.source?.split('|').pop()?.trim() || a.source || 'Finance Digest'
}

// One-line "why it matters" — first sentence of the investor take, word-capped.
function whyLine(a, maxWords = 30) {
  const t = (a.investor_take || '').replace(/\s*\n+\s*/g, ' ').trim()
  if (!t) return ''
  const first = (t.match(/[^.!?]+[.!?]+/) || [t])[0].trim()
  const words = first.split(/\s+/)
  return words.length > maxWords ? words.slice(0, maxWords).join(' ').replace(/[,;:]?$/, '') + '…' : first
}

// ── Small building blocks ──────────────────────────────────────────────────────

function SubLabel({ children, style }) {
  return (
    <div style={{ fontFamily: mono, fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: 'var(--text-muted)', margin: '26px 2px 6px', ...style }}>
      {children}
    </div>
  )
}

function Zone({ label, note, dim }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      margin: dim ? '38px 2px 18px' : '8px 2px 18px', paddingBottom: '9px',
      borderBottom: dim ? '1px solid var(--border-main)' : '2px solid var(--text-primary)',
    }}>
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800,
        fontSize: dim ? '15px' : '18px', letterSpacing: '-0.02em',
        color: dim ? 'var(--text-secondary)' : 'var(--text-primary)' }}>{label}</span>
      <span style={{ fontFamily: mono, fontSize: '10px', letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--text-muted)' }}>{note}</span>
    </div>
  )
}

function Chips({ article }) {
  const cat = CAT_LABEL[article.category] || 'Markets'
  const sen = sentInfo(article)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '7px' }}>
      <span style={{ fontFamily: mono, fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.05em',
        textTransform: 'uppercase', padding: '2px 7px', borderRadius: '6px',
        border: '1px solid var(--border-main)', color: 'var(--text-secondary)' }}>{cat}</span>
      <span style={{ fontFamily: mono, fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.05em',
        textTransform: 'uppercase', padding: '2px 7px', borderRadius: '6px',
        border: `1px solid ${sen.border}`, background: sen.bg, color: sen.color }}>{sen.label}</span>
    </div>
  )
}

function StoryRow({ article, index, dark, onOpen }) {
  const [open, setOpen] = useState(false)
  const why = whyLine(article)
  const time = fmtTime(article.created_at)

  function handleOpen() {
    setOpen(true)
    onOpen?.(article)
  }

  return (
    <>
      <div onClick={handleOpen} style={{
        display: 'flex', gap: '12px', padding: '17px 4px', cursor: 'pointer',
        alignItems: 'flex-start', borderBottom: '1px solid var(--border-main)',
      }}>
        {index != null && (
          <span style={{ fontFamily: mono, fontSize: '12px', fontWeight: 600, color: 'var(--accent)',
            paddingTop: '2px', minWidth: '16px' }}>{index}</span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Chips article={article} />
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '17px',
            lineHeight: 1.24, letterSpacing: '-0.01em', margin: 0, color: 'var(--text-primary)' }}>
            {article.title}
          </h3>
          {why && (
            <p style={{ margin: '7px 0 0', fontSize: '14px', lineHeight: 1.5, color: 'var(--text-secondary)' }}>
              <b style={{ color: 'var(--accent)', fontFamily: mono, fontSize: '10px', letterSpacing: '0.06em',
                textTransform: 'uppercase', fontWeight: 600, marginRight: '5px' }}>Why it matters</b>
              {why}
            </p>
          )}
          <div style={{ marginTop: '8px', fontFamily: mono, fontSize: '10px', letterSpacing: '0.03em',
            color: 'var(--text-muted)', display: 'flex', gap: '9px', alignItems: 'center' }}>
            <span>{srcName(article)}</span>{time && <><span>·</span><span>{time}</span></>}
          </div>
        </div>
      </div>
      <DetailReader article={article} dark={dark} open={open} onClose={() => setOpen(false)} />
    </>
  )
}

// ── Verdict hero ────────────────────────────────────────────────────────────────

function VerdictHero({ isMobile, onShare }) {
  const [d, setD] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch('/market-data.json', { cache: 'no-store' })
      .then(r => r.json())
      .then(json => { if (alive) setD(json.indian || null) })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const indices = (d?.indices && d.indices.length) ? d.indices : []
  const ups = indices.filter(i => i.up).length
  const verdict = d?.verdict || (indices.length ? (ups === indices.length ? 'up' : ups === 0 ? 'down' : 'mixed') : 'mixed')
  const V = verdict === 'up'
    ? { label: 'Up day · steady open', arrow: '▲', color: 'var(--up)', bg: 'var(--up-bg)' }
    : verdict === 'down'
      ? { label: 'Down day · cautious open', arrow: '▼', color: 'var(--down)', bg: 'var(--down-bg)' }
      : { label: 'Mixed · cautious open', arrow: '◑', color: 'var(--accent)', bg: 'var(--accent-light)' }

  const lead  = d?.lead || d?.headline || (loading ? 'Loading this morning’s brief…' : 'Your market brief updates after the next close.')
  const brief = d?.brief || ''
  const watch = d?.watch || ''
  const srcList = (d?.sources && d.sources.length) ? d.sources : ['ET', 'Mint', 'Bloomberg', 'Reuters', 'CNBC']

  return (
    <div style={{
      border: '1px solid var(--border-main)', borderRadius: '18px', padding: '18px',
      background: 'linear-gradient(180deg, var(--bg-card), var(--bg-page))', position: 'relative', overflow: 'hidden',
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontFamily: mono,
        fontWeight: 600, fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase',
        padding: '5px 11px', borderRadius: '20px', border: `1px solid ${V.color}`, background: V.bg, color: V.color }}>
        {V.arrow} {V.label}
      </span>
      <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: isMobile ? '22px' : '24px',
        lineHeight: 1.15, letterSpacing: '-0.02em', margin: '14px 0 8px', color: 'var(--text-primary)' }}>{lead}</h2>
      {brief && <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.55 }}>{brief}</p>}
      {watch && (
        <div style={{ marginTop: '14px', paddingTop: '13px', borderTop: '1px dashed var(--border-main)',
          fontSize: '13.5px', color: 'var(--text-secondary)' }}>
          <span style={{ fontFamily: mono, color: 'var(--accent)', fontSize: '11px', letterSpacing: '0.06em',
            textTransform: 'uppercase', marginRight: '6px' }}>Watch today</span>{watch}
        </div>
      )}
      <div style={{ marginTop: '11px', fontFamily: mono, fontSize: '9.5px', letterSpacing: '0.05em',
        textTransform: 'uppercase', color: 'var(--text-muted)' }}>
        Cross-checked across {srcList.slice(0, 5).join(' · ')}
      </div>
      <button onClick={() => onShare(lead)} style={{
        display: 'inline-flex', alignItems: 'center', gap: '7px', marginTop: '14px',
        background: 'var(--bg-gist)', color: 'var(--text-primary)', border: '1px solid var(--border-main)',
        borderRadius: '10px', padding: '9px 14px', fontFamily: mono, fontWeight: 600, fontSize: '11px',
        letterSpacing: '0.05em', textTransform: 'uppercase', cursor: 'pointer',
      }}>↗ Share this brief</button>
    </div>
  )
}

// ── Today briefing ──────────────────────────────────────────────────────────────

export default function TodayBriefing({ articles = [], dark, isMobile, onArticleView, onExploreSectors, predictionGame }) {
  const [toast, setToast] = useState('')

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 1900)
  }

  function shareBrief(lead) {
    const text = `📊 FinanceDigest — Morning brief\n${lead}\nfinancedigest.xyz`
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: 'FinanceDigest — Morning Brief', text }).catch(() => {})
    } else if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => showToast('Copied — paste into WhatsApp ✓'))
        .catch(() => showToast('Press ⌘/Ctrl+C to copy'))
    } else {
      showToast("Sharing isn't supported here")
    }
  }

  const five = articles.slice(0, 5)
  const more = articles.slice(5)

  // Unique sources swept this morning — real count from the briefing set.
  const sweptCount = new Set(articles.map(srcName)).size

  // "Today's term" — first glossary entry available across the top stories.
  let term = null
  for (const a of five) {
    const g = Array.isArray(a.glossary) ? a.glossary : []
    if (g.length) { term = { ...g[0], from: a.title }; break }
  }

  const todayNote = new Date().toLocaleDateString('en-IN', { weekday: 'short' }) + ' · morning'

  // Group "more" stories by category so the eye can skip.
  const moreGroups = []
  let lastCat = null
  more.forEach(a => {
    const label = CAT_LABEL[a.category] || 'Markets'
    if (label !== lastCat) { moreGroups.push({ label, items: [] }); lastCat = label }
    moreGroups[moreGroups.length - 1].items.push(a)
  })

  return (
    <div style={{ position: 'relative', fontFamily: 'var(--font-ui)' }}>
      <Zone label="The 5-minute brief" note={todayNote} />

      <VerdictHero isMobile={isMobile} onShare={shareBrief} />

      {five.length > 0 && (
        <>
          <SubLabel>5 things to know</SubLabel>
          <div>
            {five.map((a, i) => (
              <StoryRow key={a.id} article={a} index={i + 1} dark={dark} onOpen={onArticleView} />
            ))}
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '15px 16px',
            border: '1px solid var(--border-accent)', background: 'var(--up-bg)', borderRadius: '14px', margin: '18px 0 2px' }}>
            <span style={{ color: 'var(--up)', fontWeight: 800, fontSize: '17px', lineHeight: 1.35 }}>✓</span>
            <div>
              <b style={{ display: 'block', fontSize: '14.5px', color: 'var(--text-primary)' }}>
                That&apos;s your 5 minutes — you&apos;re caught up.
              </b>
              <span style={{ display: 'block', fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                Swept {sweptCount} source{sweptCount === 1 ? '' : 's'} this morning · nothing important missed.
              </span>
            </div>
          </div>
        </>
      )}

      <Zone label="More, if you have time" note="optional" dim />

      {term && (
        <>
          <SubLabel>Today&apos;s term</SubLabel>
          <div style={{ border: '1px solid var(--border-main)', borderRadius: '14px', padding: '13px 15px', background: 'var(--bg-card)' }}>
            <div style={{ fontFamily: mono, fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--accent)' }}>In today&apos;s news</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '16px', margin: '5px 0 3px', color: 'var(--text-primary)' }}>
              {term.word || term.term}
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{term.meaning || term.definition}</p>
          </div>
        </>
      )}

      {moreGroups.length > 0 && (
        <>
          <SubLabel>More top stories</SubLabel>
          <div>
            {moreGroups.map((grp, gi) => (
              <div key={gi}>
                <div style={{ fontFamily: mono, fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em',
                  textTransform: 'uppercase', color: 'var(--text-secondary)', margin: '18px 2px 2px',
                  paddingBottom: '7px', borderBottom: '1px solid var(--border-main)' }}>{grp.label}</div>
                {grp.items.map(a => (
                  <StoryRow key={a.id} article={a} dark={dark} onOpen={onArticleView} />
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {onExploreSectors && (
        <button onClick={onExploreSectors} style={{
          width: '100%', background: 'transparent', border: '1px solid var(--border-main)', color: 'var(--text-primary)',
          fontFamily: mono, fontWeight: 600, fontSize: '12px', letterSpacing: '0.05em', textTransform: 'uppercase',
          padding: '14px', borderRadius: '12px', margin: '22px 0 4px', cursor: 'pointer',
        }}>Explore all sectors →</button>
      )}

      {predictionGame && (
        <>
          <SubLabel>Form a view</SubLabel>
          {predictionGame}
        </>
      )}

      <div style={{ fontFamily: mono, fontSize: '10px', lineHeight: 1.6, color: 'var(--text-muted)',
        textAlign: 'center', padding: '18px 10px 6px', letterSpacing: '0.02em' }}>
        AI-assisted summaries, sourced from Mint, Economic Times, Business Standard, CNBC &amp; Reuters.
        Not investment advice. Verdict updates at 8:30 AM.
      </div>

      {toast && (
        <div style={{ position: 'fixed', left: '50%', bottom: '90px', transform: 'translateX(-50%)',
          background: 'var(--text-primary)', color: 'var(--bg-page)', fontFamily: mono, fontSize: '12px',
          fontWeight: 600, padding: '10px 16px', borderRadius: '10px', zIndex: 4000, maxWidth: '80%',
          textAlign: 'center' }}>{toast}</div>
      )}
    </div>
  )
}
