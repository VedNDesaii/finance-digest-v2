'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { REFERRAL } from '../../lib/referralConfig'

const mono = 'var(--font-mono)'
const display = 'var(--font-display)'

function WAIcon({ size = 18, color = 'currentColor' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.5-.4M12 21.8a9.9 9.9 0 01-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.9 9.9 0 012.1 11.9C2.1 6.5 6.5 2 12 2a9.8 9.8 0 017 2.9 9.8 9.8 0 012.9 7c0 5.5-4.4 9.9-9.9 9.9m8.4-18.3A11.8 11.8 0 0012 0C5.5 0 .2 5.3.2 11.9c0 2.1.5 4.1 1.6 5.9L0 24l6.3-1.7a11.9 11.9 0 005.7 1.5c6.6 0 11.9-5.3 11.9-11.9a11.8 11.8 0 00-3.5-8.4"/></svg>
}

export default function JoinPage() {
  const [ref, setRef] = useState(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    try { setRef(new URLSearchParams(window.location.search).get('ref')) } catch { /* ignore */ }
  }, [])

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) { setErr('Enter your first name.'); return }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setErr('Enter a valid email.'); return }
    if (pw.length < 6) { setErr('Password must be at least 6 characters.'); return }
    setErr(''); setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password: pw,
        options: {
          data: { referred_by: ref || '', first_name: name.trim() },
          emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/leaderboard` : undefined,
        },
      })
      if (error) { setErr(error.message); setLoading(false); return }
      setSent(true)
    } catch {
      setErr('Something went wrong — please try again.')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>
        <a href="/" style={{ textDecoration: 'none' }}>
          <div style={{ fontFamily: display, fontWeight: 700, fontSize: '22px', color: 'var(--head-ink)', letterSpacing: '-0.01em', marginBottom: '18px' }}>
            Finance<span style={{ color: 'var(--accent)' }}>Digest</span>
          </div>
        </a>

        {!sent ? (
          <div style={card}>
            <div style={eyebrow}>You&rsquo;re invited{ref ? <> · ref <b style={{ color: 'var(--text-secondary)' }}>{ref}</b></> : null}</div>
            <h1 style={{ fontFamily: display, fontWeight: 600, fontSize: '24px', lineHeight: 1.15, letterSpacing: '-0.01em', color: 'var(--head-ink)', margin: '0 0 6px' }}>India&rsquo;s markets, in five minutes a day.</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', lineHeight: 1.5, margin: '0 0 16px' }}>To count toward your friend&rsquo;s reward, do <b>both</b>:</p>

            <a href={REFERRAL.WHATSAPP_INVITE_URL} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', background: 'var(--bg-gist)', border: '1px solid var(--border-main)', borderRadius: '11px', padding: '12px 14px', marginBottom: '10px' }}>
              <span style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#25D366', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}><WAIcon size={16} color="#fff" /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 600, fontSize: '14px', color: 'var(--head-ink)' }}>1 · Join the WhatsApp community</span>
                <span style={{ fontFamily: mono, fontSize: '11px', color: 'var(--text-muted)' }}>Daily brief + market close</span>
              </span>
              <span style={{ fontFamily: mono, fontSize: '11px', color: 'var(--accent)' }}>Open →</span>
            </a>

            <form onSubmit={submit} style={{ background: 'var(--bg-gist)', border: '1px solid var(--border-main)', borderRadius: '11px', padding: '14px' }}>
              <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--head-ink)', marginBottom: '10px' }}>2 · Create your free account</div>
              <input value={name} onChange={e => { setName(e.target.value); setErr('') }} placeholder="First name" autoComplete="off" style={input} />
              <input value={email} onChange={e => { setEmail(e.target.value); setErr('') }} placeholder="you@email.com" type="email" autoComplete="off" style={{ ...input, marginTop: '8px' }} />
              <input value={pw} onChange={e => { setPw(e.target.value); setErr('') }} placeholder="Password (min 6)" type="password" style={{ ...input, marginTop: '8px' }} />
              {err && <div style={{ color: 'var(--down)', fontSize: '12.5px', fontWeight: 600, marginTop: '6px' }}>{err}</div>}
              <button type="submit" disabled={loading} style={{ width: '100%', marginTop: '12px', height: '44px', border: 'none', borderRadius: '10px', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: '14.5px', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1 }}>{loading ? 'Creating…' : 'Create account & continue'}</button>
            </form>
            <p style={{ fontFamily: mono, fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '12px', lineHeight: 1.5 }}>Your friend earns the referral only after you confirm your email.</p>
          </div>
        ) : (
          <div style={{ ...card, textAlign: 'center' }}>
            <div style={{ fontSize: '34px', marginBottom: '6px' }}>📩</div>
            <h1 style={{ fontFamily: display, fontWeight: 600, fontSize: '21px', color: 'var(--head-ink)', margin: '0 0 8px' }}>Check your email</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', lineHeight: 1.5, margin: '0 0 18px' }}>We sent a confirmation link to <b style={{ color: 'var(--head-ink)' }}>{email}</b>. Click it to activate your account — that&rsquo;s when your friend&rsquo;s referral counts.</p>
            <a href={REFERRAL.WHATSAPP_INVITE_URL} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: '#25D366', color: '#fff', fontWeight: 700, fontSize: '14px', padding: '11px 18px', borderRadius: '10px', textDecoration: 'none' }}><WAIcon size={16} color="#fff" /> Open the WhatsApp community</a>
            <p style={{ fontFamily: mono, fontSize: '11px', color: 'var(--text-muted)', marginTop: '14px' }}>Don&rsquo;t forget step 1 — join the community too.</p>
          </div>
        )}
      </div>
    </div>
  )
}

const card = { background: 'var(--bg-card)', border: '1px solid var(--border-main)', borderRadius: '16px', padding: '24px' }
const eyebrow = { fontFamily: mono, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '8px' }
const input = { width: '100%', border: '1px solid var(--border-main)', background: 'var(--bg-card)', borderRadius: '9px', padding: '11px 12px', fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-primary)', boxSizing: 'border-box' }
