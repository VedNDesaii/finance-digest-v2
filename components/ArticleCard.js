'use client'
import { useState, useEffect } from 'react'
import DoubtBox from './DoubtBox'

export default function ArticleCard({ article, dark }) {
  const [showGlossary, setShowGlossary] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const raw = article.simplified_article || ''
  const parts = raw.split(/\n\n+/)
  const quickRead = parts[0]?.trim() || raw
  const readMore = parts.slice(1).join('\n\n').trim()
  const safeQuickRead = quickRead.length < 60 ? raw : quickRead
  const safeReadMore = quickRead.length < 60 ? '' : readMore

  // FIX: show full safeQuickRead instead of just first sentence
  const displayQuickRead =
    safeQuickRead && safeQuickRead !== 'undefined' && safeQuickRead.length > 20
      ? safeQuickRead
      : article.investor_take || article.title || 'Full summary currently processing.'

  const source = article.source?.split('|').pop()?.trim() || article.source

  /* ─── MOBILE ─── */
  if (isMobile) {
    return (
      <article style={{
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-card)',
        overflow: 'hidden',
        border: '1px solid var(--border-main)',
        boxShadow: 'var(--shadow-card)',
        fontFamily: 'var(--font-display)',
      }}>

        {article.image_url ? (
          <div style={{ position: 'relative', overflow: 'hidden', height: '180px' }}>
            <img loading="lazy" referrerPolicy="no-referrer"
              src={article.image_url} alt={article.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={e => e.target.src = 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=1200&auto=format&fit=crop'}
            />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '80px', background: 'linear-gradient(to top, rgba(26,20,16,0.6), transparent)' }} />
            <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', borderRadius: 'var(--radius-pill)', padding: '4px 12px', fontSize: '10px', fontFamily: 'var(--font-ui)', fontWeight: '600', letterSpacing: '0.08em', color: 'var(--accent-text)', textTransform: 'uppercase' }}>
              {source}
            </div>
          </div>
        ) : null}

        <div style={{ padding: '18px 18px 16px' }}>
          {!article.image_url && (
            <div style={{ display: 'inline-block', background: 'var(--accent-light)', borderRadius: 'var(--radius-pill)', padding: '4px 12px', fontSize: '10px', fontFamily: 'var(--font-ui)', fontWeight: '600', letterSpacing: '0.08em', color: 'var(--accent-text)', textTransform: 'uppercase', marginBottom: '12px' }}>
              {source}
            </div>
          )}

          <h2 style={{ fontSize: '17px', fontWeight: '700', lineHeight: '1.35', color: 'var(--text-primary)', margin: '0 0 12px', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
            {article.title}
          </h2>

          <div style={{ width: '32px', height: '3px', background: 'linear-gradient(90deg, var(--accent), var(--accent-dark))', borderRadius: '2px', marginBottom: '14px' }} />

          {/* Quick Take */}
          <div style={{ background: 'var(--bg-gist)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: '10px', borderLeft: '3px solid var(--accent)' }}>
            <p style={{ fontSize: '10px', fontFamily: 'var(--font-ui)', fontWeight: '700', letterSpacing: '0.1em', color: 'var(--accent)', textTransform: 'uppercase', margin: '0 0 6px' }}>⚡ Quick Take</p>
            <p style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--text-primary)', margin: '0', fontFamily: 'var(--font-display)' }}>
              {displayQuickRead}
            </p>
          </div>

          {/* Single "Read in detail" toggle — matches desktop */}
          {safeReadMore && (
            <div style={{ marginBottom: '10px' }}>
              <button onClick={() => setShowDetail(!showDetail)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: '600', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '5px', letterSpacing: '0.04em' }}>
                {showDetail ? '▲ Hide detail' : '▼ Read in detail'}
              </button>
              {showDetail && (
                <div style={{ marginTop: '10px', background: 'var(--bg-detail)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', borderLeft: '3px solid var(--border-main)', animation: 'fadeIn 0.2s ease' }}>
                  <p style={{ fontSize: '14px', lineHeight: '1.7', color: 'var(--text-secondary)', margin: '0', fontFamily: 'var(--font-display)' }}>{safeReadMore}</p>
                </div>
              )}
            </div>
          )}

          {/* Investor Take — always visible, like desktop */}
          {article.investor_take && (
            <div style={{ background: 'var(--investor-bg)', border: '1px solid rgba(22,163,74,0.15)', borderLeft: '3px solid var(--investor-border)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: '10px' }}>
              <p style={{ fontSize: '10px', fontFamily: 'var(--font-ui)', fontWeight: '700', letterSpacing: '0.1em', color: 'var(--investor-border)', textTransform: 'uppercase', margin: '0 0 6px' }}>📈 What This Means for Investors</p>
              <p style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--investor-text)', margin: '0', fontFamily: 'var(--font-display)' }}>{article.investor_take}</p>
            </div>
          )}

          {/* Glossary — same accordion style as desktop */}
          {article.glossary?.length > 0 && (
            <div style={{ border: '1px solid var(--border-main)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: '14px' }}>
              <button onClick={() => setShowGlossary(!showGlossary)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', background: showGlossary ? 'var(--accent-light)' : 'var(--bg-detail)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', transition: 'background 0.15s' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>📖 Key Terms ({article.glossary.length})</span>
                <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: '700' }}>{showGlossary ? '▲' : '▼'}</span>
              </button>
              {showGlossary && (
                <div>
                  {article.glossary.map((item, index) => (
                    <div key={index} style={{ padding: '10px 14px', borderTop: '1px solid var(--border-light)', background: index % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-detail)' }}>
                      <span style={{ fontFamily: 'var(--font-ui)', fontWeight: '700', color: 'var(--text-primary)', fontSize: '12px' }}>{item.word || item.term}</span>
                      <p style={{ fontFamily: 'var(--font-display)', color: 'var(--text-muted)', fontSize: '12px', margin: '3px 0 0', lineHeight: '1.5' }}>{item.meaning || item.definition}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DoubtBox article={article} dark={dark} />
        </div>
      </article>
    )
  }

  /* ─── DESKTOP ─── */
  return (
    <article style={{
      background: 'var(--bg-card)', borderRadius: 'var(--radius-card)',
      overflow: 'hidden', border: '1px solid var(--border-main)',
      boxShadow: 'var(--shadow-card)', fontFamily: 'var(--font-display)',
      transition: 'box-shadow 0.2s ease, transform 0.2s ease',
    }}
    onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-card)'; e.currentTarget.style.transform = 'translateY(0)' }}>

      {article.image_url && (
        <div style={{ position: 'relative', overflow: 'hidden', height: '220px' }}>
          <img loading="lazy" referrerPolicy="no-referrer"
            src={article.image_url} alt={article.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={e => e.target.src = 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=1200&auto=format&fit=crop'}
          />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '100px', background: 'linear-gradient(to top, rgba(26,20,16,0.6), transparent)' }} />
          <div style={{ position: 'absolute', top: '14px', left: '14px', background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(8px)', borderRadius: 'var(--radius-pill)', padding: '4px 12px', fontSize: '11px', fontFamily: 'var(--font-ui)', fontWeight: '600', letterSpacing: '0.08em', color: 'var(--accent-text)', textTransform: 'uppercase' }}>
            {source}
          </div>
        </div>
      )}

      <div style={{ padding: '24px 28px 22px' }}>
        {!article.image_url && (
          <div style={{ display: 'inline-block', background: 'var(--accent-light)', borderRadius: 'var(--radius-pill)', padding: '4px 12px', fontSize: '11px', fontFamily: 'var(--font-ui)', fontWeight: '600', letterSpacing: '0.08em', color: 'var(--accent-text)', textTransform: 'uppercase', marginBottom: '14px' }}>
            {source}
          </div>
        )}

        <h2 style={{ fontSize: '21px', fontWeight: '700', lineHeight: '1.35', color: 'var(--text-primary)', margin: '0 0 16px', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
          {article.title}
        </h2>

        <div style={{ width: '36px', height: '3px', background: 'linear-gradient(90deg, var(--accent), var(--accent-dark))', borderRadius: '2px', marginBottom: '18px' }} />

        {/* Quick Take — now shows full paragraph */}
        <div style={{ background: 'var(--bg-gist)', borderRadius: 'var(--radius-sm)', padding: '16px 18px', marginBottom: '12px', borderLeft: '3px solid var(--accent)' }}>
          <p style={{ fontSize: '11px', fontFamily: 'var(--font-ui)', fontWeight: '700', letterSpacing: '0.1em', color: 'var(--accent)', textTransform: 'uppercase', margin: '0 0 8px' }}>⚡ Quick Take</p>
          <p style={{ fontSize: '15px', lineHeight: '1.65', color: 'var(--text-primary)', margin: '0', fontFamily: 'var(--font-display)' }}>
            {displayQuickRead}
          </p>
        </div>

        {safeReadMore && (
          <div style={{ marginBottom: '12px' }}>
            <button onClick={() => setShowDetail(!showDetail)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: '600', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '5px', letterSpacing: '0.04em' }}>
              {showDetail ? '▲ Hide detail' : '▼ Read in detail'}
            </button>
            {showDetail && (
              <div style={{ marginTop: '10px', background: 'var(--bg-detail)', borderRadius: 'var(--radius-sm)', padding: '16px 18px', borderLeft: '3px solid var(--border-main)', animation: 'fadeIn 0.2s ease' }}>
                <p style={{ fontSize: '14px', lineHeight: '1.75', color: 'var(--text-secondary)', margin: '0', fontFamily: 'var(--font-display)' }}>{safeReadMore}</p>
              </div>
            )}
          </div>
        )}

        {article.investor_take && (
          <div style={{ background: 'var(--investor-bg)', border: '1px solid rgba(22,163,74,0.15)', borderLeft: '3px solid var(--investor-border)', borderRadius: 'var(--radius-sm)', padding: '16px 18px', marginBottom: '12px' }}>
            <p style={{ fontSize: '11px', fontFamily: 'var(--font-ui)', fontWeight: '700', letterSpacing: '0.1em', color: 'var(--investor-border)', textTransform: 'uppercase', margin: '0 0 8px' }}>📈 What This Means for Investors</p>
            <p style={{ fontSize: '14px', lineHeight: '1.65', color: 'var(--investor-text)', margin: '0', fontFamily: 'var(--font-display)' }}>{article.investor_take}</p>
          </div>
        )}

        {article.glossary?.length > 0 && (
          <div style={{ border: '1px solid var(--border-main)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: '16px' }}>
            <button onClick={() => setShowGlossary(!showGlossary)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: showGlossary ? 'var(--accent-light)' : 'var(--bg-detail)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', transition: 'background 0.15s' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>📖 Key Terms ({article.glossary.length})</span>
              <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: '700' }}>{showGlossary ? '▲' : '▼'}</span>
            </button>
            {showGlossary && (
              <div>
                {article.glossary.map((item, index) => (
                  <div key={index} style={{ padding: '11px 16px', borderTop: '1px solid var(--border-light)', background: index % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-detail)' }}>
                    <span style={{ fontFamily: 'var(--font-ui)', fontWeight: '700', color: 'var(--text-primary)', fontSize: '13px' }}>{item.word || item.term}</span>
                    <p style={{ fontFamily: 'var(--font-display)', color: 'var(--text-muted)', fontSize: '13px', margin: '3px 0 0', lineHeight: '1.5' }}>{item.meaning || item.definition}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DoubtBox article={article} dark={dark} />

      </div>

      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(-4px) } to { opacity:1; transform:translateY(0) } }`}</style>
    </article>
  )
}