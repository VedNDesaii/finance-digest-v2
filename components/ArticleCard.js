'use client'
import { useState, useEffect } from 'react'
import TTSPlayer from './TTSPlayer'

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
  const firstSentence = safeQuickRead.split(/(?<=[.!?])\s+/)[0]?.trim() || safeQuickRead
  const displayQuickRead =
  firstSentence &&
  firstSentence !== 'undefined' &&
  firstSentence.length > 20
    ? firstSentence
    : article.investor_take ||
      article.title ||
      'Full summary currently processing.'
  const source = article.source?.split('|').pop()?.trim() || article.source

  /* ─── MOBILE — Option A: Full image top, immersive ─── */
  if (isMobile) {
    return (
      <article style={{
        background: 'var(--bg-card)',
        borderRadius: '14px',
        overflow: 'hidden',
        border: '1px solid var(--border-main)',
        fontFamily: 'var(--font-ui)',
      }}>

        {/* Full image top */}
        {article.image_url ? (
          <div style={{ position: 'relative', height: '180px', overflow: 'hidden' }}>
            <img
  loading="lazy"
  referrerPolicy="no-referrer"
              src={article.image_url}
              alt={article.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={e => e.target.parentElement.style.display = 'none'}
            />
            {/* Dark gradient overlay at bottom */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: '80px',
              background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
            }} />
            {/* Source badge over image */}
            <div style={{
              position: 'absolute', top: '10px', left: '10px',
              background: 'rgba(201,168,76,0.92)',
              borderRadius: '20px', padding: '3px 10px',
              fontSize: '9px', fontFamily: 'var(--font-ui)',
              fontWeight: '700', letterSpacing: '0.1em',
              color: '#fff', textTransform: 'uppercase',
            }}>
              {source}
            </div>
          </div>
        ) : (
          <div style={{
            background: 'linear-gradient(135deg, #1a1410, #2a1f10)',
            padding: '14px 14px 10px',
          }}>
            <div style={{
              display: 'inline-block',
              background: 'rgba(201,168,76,0.2)',
              borderRadius: '20px', padding: '3px 10px',
              fontSize: '9px', fontFamily: 'var(--font-ui)',
              fontWeight: '700', letterSpacing: '0.1em',
              color: '#C9A84C', textTransform: 'uppercase',
            }}>
              {source}
            </div>
          </div>
        )}

        {/* Title */}
        <div style={{ padding: '14px 14px 0' }}>
          <h2 style={{
            fontSize: '16px', fontWeight: '700', lineHeight: '1.4',
            color: 'var(--text-primary)', margin: '0 0 12px',
            fontFamily: 'var(--font-display)', letterSpacing: '-0.01em',
          }}>
            {article.title}
          </h2>

          {/* Gold divider */}
          <div style={{
            width: '32px', height: '2px',
            background: 'linear-gradient(90deg, #C9A84C, #E8C97A)',
            borderRadius: '2px', marginBottom: '12px',
          }} />

          {/* Quick Take */}
          <div style={{
            background: 'var(--bg-gist)',
            borderLeft: '3px solid var(--accent)',
            borderRadius: '0 8px 8px 0',
            padding: '10px 12px', marginBottom: '12px',
          }}>
            <p style={{
              fontSize: '10px', fontFamily: 'var(--font-ui)', fontWeight: '700',
              letterSpacing: '0.1em', color: 'var(--accent)',
              textTransform: 'uppercase', margin: '0 0 5px',
            }}>⚡ Quick Take</p>
            <p style={{
              fontSize: '13px', lineHeight: '1.55',
              color: 'var(--text-primary)', margin: '0',
              fontFamily: 'var(--font-display)',
            }}>
              {displayQuickRead}
            </p>
          </div>
        </div>

        {/* Expand toggle */}
        <div style={{ borderTop: '1px solid var(--border-light)' }}>
          <button
            onClick={() => setShowDetail(!showDetail)}
            style={{
              width: '100%', background: 'none', border: 'none',
              cursor: 'pointer', padding: '10px 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              color: 'var(--accent)', fontFamily: 'var(--font-ui)',
              fontSize: '11px', fontWeight: '600', letterSpacing: '0.04em',
            }}>
            <span>{showDetail ? '▲ Show less' : '▼ Full story & investor take'}</span>
          </button>

          {showDetail && (
            <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

              {/* Full story */}
              {safeReadMore && (
                <div style={{
                  background: 'var(--bg-detail)', borderRadius: '8px',
                  padding: '12px 14px', borderLeft: '2px solid var(--border-main)',
                }}>
                  <p style={{
                    fontSize: '10px', fontFamily: 'var(--font-ui)', fontWeight: '700',
                    letterSpacing: '0.1em', color: 'var(--text-muted)',
                    textTransform: 'uppercase', margin: '0 0 6px',
                  }}>📰 Full Story</p>
                  <p style={{
                    fontSize: '13px', lineHeight: '1.65',
                    color: 'var(--text-secondary)', margin: '0',
                    fontFamily: 'var(--font-display)',
                  }}>
                    {safeReadMore}
                  </p>
                </div>
              )}

              {/* Investor Take */}
              {article.investor_take && (
                <div style={{
                  background: 'var(--investor-bg)', borderRadius: '8px',
                  padding: '12px 14px', borderLeft: '2px solid var(--investor-border)',
                }}>
                  <p style={{
                    fontSize: '10px', fontFamily: 'var(--font-ui)', fontWeight: '700',
                    letterSpacing: '0.08em', color: 'var(--investor-border)',
                    textTransform: 'uppercase', margin: '0 0 6px',
                  }}>📈 Investor Take</p>
                  <p style={{
                    fontSize: '13px', lineHeight: '1.6',
                    color: 'var(--investor-text)', margin: '0',
                    fontFamily: 'var(--font-display)',
                  }}>
                    {article.investor_take}
                  </p>
                </div>
              )}

              {/* Key Terms */}
              {article.glossary?.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowGlossary(!showGlossary)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', fontFamily: 'var(--font-ui)',
                      fontSize: '11px', fontWeight: '600', padding: '0',
                      display: 'flex', alignItems: 'center', gap: '4px',
                    }}>
                    📖 Key Terms ({article.glossary.length}) {showGlossary ? '▲' : '▼'}
                  </button>
                  {showGlossary && (
                    <div style={{ marginTop: '8px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-light)' }}>
                      {article.glossary.map((item, i) => (
                        <div key={i} style={{
                          padding: '8px 12px',
                          borderTop: i > 0 ? '1px solid var(--border-light)' : 'none',
                          background: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-detail)',
                        }}>
                          <span style={{ fontFamily: 'var(--font-ui)', fontWeight: '700', color: 'var(--text-primary)', fontSize: '12px' }}>{item.word} — </span>
                          <span style={{ fontFamily: 'var(--font-ui)', color: 'var(--text-muted)', fontSize: '12px' }}>{item.meaning}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={{ paddingTop: '4px' }}>
                <TTSPlayer article={article} />
              </div>
            </div>
          )}
        </div>
      </article>
    )
  }

  /* ─── DESKTOP — Option A: Full image top, editorial ─── */
  return (
    <article style={{
      background: 'var(--bg-card)',
      borderRadius: 'var(--radius-card)',
      overflow: 'hidden',
      border: '1px solid var(--border-main)',
      boxShadow: 'var(--shadow-card)',
      fontFamily: 'var(--font-display)',
      transition: 'box-shadow 0.2s ease, transform 0.2s ease',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)'
      e.currentTarget.style.transform = 'translateY(-1px)'
    }}
    onMouseLeave={e => {
      e.currentTarget.style.boxShadow = 'var(--shadow-card)'
      e.currentTarget.style.transform = 'translateY(0)'
    }}>

      {/* Full image top */}
      {article.image_url && (
        <div style={{ position: 'relative', overflow: 'hidden', height: '220px' }}>
          <img
  loading="lazy"
  referrerPolicy="no-referrer"
            src={article.image_url}
            alt={article.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={(e) => {
  e.target.src =
    'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?q=80&w=1200&auto=format&fit=crop'
}}
          />
          {/* Gradient overlay */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: '100px',
            background: 'linear-gradient(to top, rgba(26,20,16,0.6), transparent)',
          }} />
          <div style={{
            position: 'absolute', top: '14px', left: '14px',
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(8px)',
            borderRadius: 'var(--radius-pill)', padding: '4px 12px',
            fontSize: '11px', fontFamily: 'var(--font-ui)',
            fontWeight: '600', letterSpacing: '0.08em',
            color: 'var(--accent-text)', textTransform: 'uppercase',
          }}>
            {source}
          </div>
        </div>
      )}

      <div style={{ padding: '24px 28px 22px' }}>

        {!article.image_url && (
          <div style={{
            display: 'inline-block', background: 'var(--accent-light)',
            borderRadius: 'var(--radius-pill)', padding: '4px 12px',
            fontSize: '11px', fontFamily: 'var(--font-ui)',
            fontWeight: '600', letterSpacing: '0.08em',
            color: 'var(--accent-text)', textTransform: 'uppercase', marginBottom: '14px',
          }}>
            {source}
          </div>
        )}

        <h2 style={{
          fontSize: '21px', fontWeight: '700', lineHeight: '1.35',
          color: 'var(--text-primary)', margin: '0 0 16px',
          fontFamily: 'var(--font-display)', letterSpacing: '-0.02em',
        }}>
          {article.title}
        </h2>

        <div style={{
          width: '36px', height: '3px',
          background: 'linear-gradient(90deg, var(--accent), var(--accent-dark))',
          borderRadius: '2px', marginBottom: '18px',
        }} />

        {/* Quick Take */}
        <div style={{
          background: 'var(--bg-gist)', borderRadius: 'var(--radius-sm)',
          padding: '16px 18px', marginBottom: '12px',
          borderLeft: '3px solid var(--accent)',
        }}>
          <p style={{
            fontSize: '11px', fontFamily: 'var(--font-ui)', fontWeight: '700',
            letterSpacing: '0.1em', color: 'var(--accent)',
            textTransform: 'uppercase', margin: '0 0 8px',
          }}>⚡ Quick Take</p>
          <p style={{
            fontSize: '15px', lineHeight: '1.65',
            color: 'var(--text-primary)', margin: '0',
            fontFamily: 'var(--font-display)',
          }}>
            {displayQuickRead}
          </p>
        </div>

        {/* Read in detail */}
        {safeReadMore && (
          <div style={{ marginBottom: '12px' }}>
            <button onClick={() => setShowDetail(!showDetail)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--accent)', fontFamily: 'var(--font-ui)',
              fontSize: '12px', fontWeight: '600', padding: '4px 0',
              display: 'flex', alignItems: 'center', gap: '5px',
              letterSpacing: '0.04em',
            }}>
              {showDetail ? '▲ Hide detail' : '▼ Read in detail'}
            </button>
            {showDetail && (
              <div style={{
                marginTop: '10px', background: 'var(--bg-detail)',
                borderRadius: 'var(--radius-sm)', padding: '16px 18px',
                borderLeft: '3px solid var(--border-main)',
                animation: 'fadeIn 0.2s ease',
              }}>
                <p style={{
                  fontSize: '14px', lineHeight: '1.75',
                  color: 'var(--text-secondary)', margin: '0',
                  fontFamily: 'var(--font-display)',
                }}>
                  {safeReadMore}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Investor Take */}
        {article.investor_take && (
          <div style={{
            background: 'var(--investor-bg)',
            border: '1px solid rgba(22,163,74,0.15)',
            borderLeft: '3px solid var(--investor-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '16px 18px', marginBottom: '12px',
          }}>
            <p style={{
              fontSize: '11px', fontFamily: 'var(--font-ui)', fontWeight: '700',
              letterSpacing: '0.1em', color: 'var(--investor-border)',
              textTransform: 'uppercase', margin: '0 0 8px',
            }}>📈 What This Means for Investors</p>
            <p style={{
              fontSize: '14px', lineHeight: '1.65',
              color: 'var(--investor-text)', margin: '0',
              fontFamily: 'var(--font-display)',
            }}>
              {article.investor_take}
            </p>
          </div>
        )}

        {/* Key Terms */}
        {article.glossary?.length > 0 && (
          <div style={{
            border: '1px solid var(--border-main)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden', marginBottom: '16px',
          }}>
            <button onClick={() => setShowGlossary(!showGlossary)} style={{
              width: '100%', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', padding: '12px 16px',
              background: showGlossary ? 'var(--accent-light)' : 'var(--bg-detail)',
              border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)',
              transition: 'background 0.15s',
            }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                📖 Key Terms ({article.glossary.length})
              </span>
              <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: '700' }}>
                {showGlossary ? '▲' : '▼'}
              </span>
            </button>
            {showGlossary && (
              <div>
                {article.glossary.map((item, index) => (
                  <div key={index} style={{
                    padding: '11px 16px',
                    borderTop: '1px solid var(--border-light)',
                    background: index % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-detail)',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-ui)', fontWeight: '700',
                      color: 'var(--text-primary)', fontSize: '13px',
                    }}>
                      {item.word}
                    </span>
                    <p style={{
                      fontFamily: 'var(--font-display)', color: 'var(--text-muted)',
                      fontSize: '13px', margin: '3px 0 0', lineHeight: '1.5',
                    }}>
                      {item.meaning}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <TTSPlayer article={article} />
        <div style={{ marginTop: '12px' }} />
      </div>

      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(-4px) } to { opacity:1; transform:translateY(0) } }`}</style>
    </article>
  )
}