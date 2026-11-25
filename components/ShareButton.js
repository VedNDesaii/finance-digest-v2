'use client'
// Share button → opens a share sheet with Copy link, WhatsApp, X, Telegram,
// and Instagram / "More" (which route through the phone's native share sheet,
// since Instagram Story + WhatsApp Status have no web link).
import { useState } from 'react'

const mono = 'var(--font-mono)'

function Ico({ children, bg }) {
  return <span style={{ width: 46, height: 46, borderRadius: '50%', background: bg, color: '#fff', display: 'grid', placeItems: 'center' }}>{children}</span>
}
const WA = <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.5-.4M12 21.8a9.9 9.9 0 01-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.9 9.9 0 012.1 11.9C2.1 6.5 6.5 2 12 2a9.8 9.8 0 017 2.9 9.8 9.8 0 012.9 7c0 5.5-4.4 9.9-9.9 9.9m8.4-18.3A11.8 11.8 0 0012 0C5.5 0 .2 5.3.2 11.9c0 2.1.5 4.1 1.6 5.9L0 24l6.3-1.7a11.9 11.9 0 005.7 1.5c6.6 0 11.9-5.3 11.9-11.9a11.8 11.8 0 00-3.5-8.4"/></svg>
const IG = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5.5" /><circle cx="12" cy="12" r="4.2" /><circle cx="17.3" cy="6.7" r="1.2" fill="#fff" stroke="none" /></svg>
const XLogo = <svg width="19" height="19" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M18.9 2H22l-7.3 8.4L23.3 22h-6.8l-5.3-7-6.1 7H2l7.8-9L1.4 2h7l4.8 6.4L18.9 2Zm-2.4 18h1.9L7.6 4H5.6l10.9 16Z"/></svg>
const TG = <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M21.9 4.3 18.6 20c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-5 9.1-8.2c.4-.3-.1-.5-.6-.2L6.2 13 1.4 11.5c-1-.3-1-1 .2-1.5L20.6 2.8c.9-.3 1.6.2 1.3 1.5Z"/></svg>

export default function ShareButton({ url, title, compact }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const link = url || (typeof window !== 'undefined' ? window.location.href : '')
  const text = title || 'FinanceDigest'
  const enc = encodeURIComponent

  const openUrl = (u) => { try { window.open(u, '_blank', 'noopener,noreferrer') } catch {} ; setOpen(false) }
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1600) } catch {}
  }
  const native = async () => {
    try { if (navigator.share) { await navigator.share({ title: text, text, url: link }); setOpen(false); return } } catch { setOpen(false); return }
    copy() // desktop fallback
  }

  // Main trigger: on a phone, open the OS share menu directly (Instagram → Story,
  // WhatsApp → Status / send to someone, etc.). Only if the device has no native
  // share do we fall back to the custom sheet (copy link + web links on desktop).
  const onTrigger = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: text, text, url: link }); return }
      catch (e) { if (e && e.name === 'AbortError') return }   // user closed the sheet
    }
    setOpen(true)
  }

  const items = [
    { k: 'wa', label: 'WhatsApp', bg: '#25D366', icon: WA, act: () => openUrl(`https://wa.me/?text=${enc(text + '\n' + link)}`) },
    { k: 'ig', label: 'Instagram', bg: 'linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)', icon: IG, act: native },
    { k: 'x', label: 'X', bg: '#000', icon: XLogo, act: () => openUrl(`https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(link)}`) },
    { k: 'tg', label: 'Telegram', bg: '#2AABEE', icon: TG, act: () => openUrl(`https://t.me/share/url?url=${enc(link)}&text=${enc(text)}`) },
    { k: 'more', label: 'More', bg: 'var(--text-muted)', icon: <span style={{ fontSize: 22, fontWeight: 700, lineHeight: 0 }}>···</span>, act: native },
  ]

  return (
    <>
      <button onClick={onTrigger} aria-label="Share"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid var(--border-main)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: compact ? '12px' : '13px', padding: compact ? '7px 11px' : '9px 14px', borderRadius: '9px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" /></svg>
        Share
      </button>

      {open && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(10,8,5,.55)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 4000 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)', borderRadius: '18px 18px 0 0', width: '100%', maxWidth: 480, padding: '16px 16px 22px', animation: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, color: 'var(--head-ink)' }}>Share</span>
              <button onClick={() => setOpen(false)} aria-label="Close" style={{ border: 'none', background: 'var(--bg-gist)', color: 'var(--text-secondary)', width: 30, height: 30, borderRadius: 8, fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>

            {/* app row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 14 }}>
              {items.map(it => (
                <button key={it.k} onClick={it.act}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px 0' }}>
                  <Ico bg={it.bg}>{it.icon}</Ico>
                  <span style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--text-secondary)' }}>{it.label}</span>
                </button>
              ))}
            </div>

            {/* copy link row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-gist)', border: '1px solid var(--border-main)', borderRadius: 11, padding: '9px 10px 9px 13px' }}>
              <span style={{ flex: 1, minWidth: 0, fontFamily: mono, fontSize: 12.5, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.replace(/^https?:\/\//, '')}</span>
              <button onClick={copy} style={{ border: 'none', background: copied ? 'var(--up)' : 'var(--accent)', color: '#fff', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 13, padding: '8px 14px', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap' }}>{copied ? 'Copied ✓' : 'Copy link'}</button>
            </div>

            <p style={{ fontFamily: mono, fontSize: 10, color: 'var(--text-muted)', margin: '12px 2px 0', lineHeight: 1.5, textAlign: 'center' }}>
              For <b>Instagram Story</b> or <b>WhatsApp Status</b>, tap <b>Instagram</b> / <b>More</b> and pick it in your phone&rsquo;s share sheet.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
