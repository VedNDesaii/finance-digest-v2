'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const POINTS = [
  { icon: '👆', title: 'Swipe to browse', text: 'Swipe cards left or right (or use the arrows) to move through the day\'s news.' },
  { icon: '📖', title: 'Read in full', text: 'Tap "Read in full" on any card for the deep dive — the full story, market impact and what it means for you.' },
  { icon: '📊', title: 'New market summary', text: 'The Markets tab now opens with the day\'s verdict at a glance, and a full report one tap away.' },
]

export default function Tutorial({ onClose }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [onClose])
  if (!mounted) return null

  return createPortal((
    <div style={{
      position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(0,0,0,0.72)',
      backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', animation: 'tutFade 0.25s ease', fontFamily: 'var(--font-ui)',
    }}>
      <div style={{
        width: '100%', maxWidth: '380px', background: 'var(--bg-card)',
        border: '1px solid var(--border-main)', borderRadius: '20px', overflow: 'hidden',
        boxShadow: 'var(--shadow-float)', animation: 'tutRise 0.35s cubic-bezier(0.34,1.4,0.64,1)',
      }}>
        {/* animated swipe demo */}
        <div style={{
          position: 'relative', height: '150px', background: 'var(--bg-gist)',
          borderBottom: '1px solid var(--border-main)', overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ position: 'absolute', width: '108px', height: '96px', borderRadius: '14px',
            background: 'var(--bg-card)', border: '1px solid var(--border-main)',
            transform: 'translateY(10px) scale(0.94)', opacity: 0.5 }} />
          <div style={{ position: 'absolute', width: '108px', height: '96px', borderRadius: '14px',
            background: 'var(--bg-card)', border: '1px solid var(--border-accent)',
            boxShadow: 'var(--shadow-card)', animation: 'tutSwipe 2.6s ease-in-out infinite',
            display: 'flex', flexDirection: 'column', padding: '12px', gap: '7px' }}>
            <div style={{ width: '38px', height: '6px', borderRadius: '3px', background: 'var(--accent)' }} />
            <div style={{ width: '82%', height: '7px', borderRadius: '3px', background: 'var(--text-muted)', opacity: 0.5 }} />
            <div style={{ width: '60%', height: '7px', borderRadius: '3px', background: 'var(--text-muted)', opacity: 0.35 }} />
          </div>
          <span style={{ position: 'absolute', fontSize: '26px', animation: 'tutFinger 2.6s ease-in-out infinite', pointerEvents: 'none' }}>👆</span>
        </div>

        <div style={{ padding: '18px 18px 20px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '4px' }}>What's new</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '22px', letterSpacing: '-0.01em', color: 'var(--text-primary)', margin: '0 0 16px' }}>A fresh Finance Digest</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '13px', marginBottom: '20px' }}>
            {POINTS.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '20px', flexShrink: 0, lineHeight: 1.2 }}>{p.icon}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{p.title}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: '1px' }}>{p.text}</div>
                </div>
              </div>
            ))}
          </div>

          <button onClick={onClose} style={{
            width: '100%', border: 'none', borderRadius: '12px', padding: '14px',
            background: 'var(--accent)', color: '#fff', cursor: 'pointer',
            fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '13px',
            letterSpacing: '0.03em', textTransform: 'uppercase',
          }}>Got it — start reading</button>
        </div>
      </div>

      <style>{`
        @keyframes tutFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes tutRise { from { transform: translateY(24px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes tutSwipe {
          0%, 20%   { transform: translateX(0) rotate(0deg); opacity: 1 }
          42%       { transform: translateX(-96px) rotate(-11deg); opacity: 0 }
          43%       { transform: translateX(96px) rotate(11deg); opacity: 0 }
          64%, 100% { transform: translateX(0) rotate(0deg); opacity: 1 }
        }
        @keyframes tutFinger {
          0%, 18%   { transform: translate(34px, 8px); }
          42%       { transform: translate(-58px, 8px); }
          43%, 100% { transform: translate(34px, 8px); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="tutSwipe"], [style*="tutFinger"] { animation: none !important; }
        }
      `}</style>
    </div>
  ), document.body)
}
