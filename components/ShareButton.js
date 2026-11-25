'use client'
// Share / copy the current article link. Uses the native share sheet on mobile,
// falls back to copying the URL on desktop.
import { useState } from 'react'

export default function ShareButton({ url, title, compact }) {
  const [copied, setCopied] = useState(false)

  async function share() {
    const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '')
    try {
      if (navigator.share) {
        await navigator.share({ title: title || 'FinanceDigest', url: shareUrl })
        return
      }
    } catch { /* user cancelled or unsupported — fall through to copy */ }
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch { /* ignore */ }
  }

  return (
    <button onClick={share} aria-label="Share this article"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        border: '1px solid var(--border-main)', background: 'var(--bg-card)', color: 'var(--text-primary)',
        fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: compact ? '12px' : '13px',
        padding: compact ? '7px 11px' : '9px 14px', borderRadius: '9px', cursor: 'pointer', whiteSpace: 'nowrap',
      }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
        <line x1="8.6" y1="13.5" x2="15.4" y2="17.5" /><line x1="15.4" y1="6.5" x2="8.6" y2="10.5" />
      </svg>
      {copied ? 'Link copied' : 'Share'}
    </button>
  )
}
