'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../../lib/supabase'
import { REFERRAL, isAdmin } from '../../../lib/referralConfig'

const mono = 'var(--font-mono)'
const display = 'var(--font-display)'

function fmtDate(ts) {
  if (!ts) return '—'
  try {
    const d = new Date(ts)
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  } catch { return '—' }
}

export default function AdminReferralsPage() {
  const { user, loading } = useAuth()
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [err, setErr] = useState('')

  const flash = (m) => { setToast(m); clearTimeout(flash._t); flash._t = setTimeout(() => setToast(''), 2200) }

  const token = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }, [])

  const refresh = useCallback(async () => {
    try {
      const t = await token()
      const r = await fetch('/api/referrals/admin', { headers: t ? { authorization: `Bearer ${t}` } : {}, cache: 'no-store' })
      if (r.status === 403) { setErr('forbidden'); return }
      setData(await r.json())
    } catch { setErr('load-failed') }
  }, [token])

  useEffect(() => { if (!loading) refresh() }, [loading, refresh])

  async function act(body, msg) {
    setBusy(true)
    try {
      const t = await token()
      await fetch('/api/referrals/admin', { method: 'POST', headers: { 'content-type': 'application/json', ...(t ? { authorization: `Bearer ${t}` } : {}) }, body: JSON.stringify(body) })
      await refresh()
      if (msg) flash(msg)
    } catch { flash('Action failed') }
    setBusy(false)
  }

  const devMode = REFERRAL.ADMIN_USER_IDS.length === 0
  const allowed = devMode || (user && isAdmin(user.id))

  if (loading) return <Shell><p style={muted}>Loading…</p></Shell>
  if (!allowed || err === 'forbidden') return (
    <Shell>
      <h1 style={{ fontFamily: display, fontWeight: 600, fontSize: '22px', color: 'var(--head-ink)', margin: '0 0 8px' }}>Not authorised</h1>
      <p style={muted}>This page is limited to admins. <a href="/" style={{ color: 'var(--accent)' }}>Go home</a></p>
    </Shell>
  )
  if (!data) return <Shell><p style={muted}>Loading sign-ups…</p></Shell>

  const refs = data.referrals || []
  const pend = refs.filter(r => r.status === 'pending')
  const done = refs.filter(r => r.status === 'confirmed')
  const payouts = data.payouts || []
  const nameByCode = data.nameByCode || {}
  const refName = (code) => nameByCode[code] || code
  const f200 = payouts.filter(p => p.amount === REFERRAL.PAYOUT_200).length
  const f100 = payouts.filter(p => p.amount === REFERRAL.PAYOUT_100).length

  return (
    <Shell>
      {devMode && (
        <div style={{ fontFamily: mono, fontSize: '11.5px', color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 10%, transparent)', border: '1px solid var(--accent)', borderRadius: '10px', padding: '10px 12px', marginBottom: '16px', lineHeight: 1.5 }}>
          Dev mode — ADMIN_USER_IDS not set, so this page is open. In production it is restricted to the user IDs you list.
        </div>
      )}

      <div style={{ fontFamily: mono, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '7px' }}>Admin</div>
      <h1 style={{ fontFamily: display, fontWeight: 600, fontSize: '26px', letterSpacing: '-0.01em', color: 'var(--head-ink)', margin: '0 0 4px' }}>Sign-ups &amp; payouts</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0 0 16px' }}>A referral counts once the friend signs up and confirms their email (automatic). Reject only obvious fraud (junk emails).</p>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '18px' }}>
        <button disabled={busy} onClick={() => act({ action: 'finalise' }, 'Month finalised')} style={{ ...btn, background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }}>Finalise month</button>
        <button disabled={busy} onClick={refresh} style={{ ...btn, marginLeft: 'auto' }}>Refresh</button>
      </div>

      <div style={label}>Awaiting email confirmation · {pend.length}</div>
      <div style={card}>
        {pend.length === 0 ? <div style={{ ...muted, fontFamily: mono, fontSize: '12px', padding: '6px 0' }}>No sign-ups awaiting confirmation.</div> :
          pend.map(r => (
            <div key={r.referred_user_id} style={row}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--head-ink)' }}>{r.first_name || '—'} {r.email && <span style={{ fontFamily: mono, fontWeight: 400, fontSize: '12px', color: 'var(--text-secondary)' }}>· {r.email}</span>}</div>
                <div style={{ fontFamily: mono, fontSize: '11px', color: 'var(--text-muted)' }}>Invited by <b style={{ color: 'var(--text-secondary)' }}>{refName(r.referrer_code)}</b> ({r.referrer_code}) · {fmtDate(r.created_at)}</div>
              </div>
              <span style={pill}>awaiting email</span>
              <button disabled={busy} onClick={() => act({ action: 'reject', referred_user_id: r.referred_user_id }, 'Rejected')} style={{ ...btnSm, ...noBtn }}>Reject</button>
            </div>
          ))
        }
      </div>

      {done.length > 0 && (
        <>
          <div style={{ ...label, marginTop: '20px' }}>Confirmed sign-ups · {done.length}</div>
          <div style={card}>
            {done.map(r => (
              <div key={r.referred_user_id} style={row}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--head-ink)' }}>{r.first_name || '—'} {r.email && <span style={{ fontFamily: mono, fontWeight: 400, fontSize: '12px', color: 'var(--text-secondary)' }}>· {r.email}</span>}</div>
                  <div style={{ fontFamily: mono, fontSize: '11px', color: 'var(--text-muted)' }}>Invited by <b style={{ color: 'var(--text-secondary)' }}>{refName(r.referrer_code)}</b> ({r.referrer_code}) · signed up {fmtDate(r.created_at)}</div>
                </div>
                <span style={{ fontFamily: mono, fontSize: '11px', fontWeight: 600, color: 'var(--up)', background: 'var(--up-bg)', border: '1px solid var(--up)', borderRadius: '6px', padding: '3px 9px', whiteSpace: 'nowrap' }}>✓ {fmtDate(r.confirmed_at)}</span>
                <button disabled={busy} onClick={() => act({ action: 'reject', referred_user_id: r.referred_user_id }, 'Rejected')} style={{ ...btnSm, ...noBtn }}>Reject</button>
              </div>
            ))}
          </div>
        </>
      )}

      {payouts.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '22px 0 10px' }}>
            <span style={label}>Payouts · this month</span>
            <span style={{ ...muted, fontFamily: mono, fontSize: '11px', marginLeft: 'auto' }}>₹{REFERRAL.PAYOUT_200}: {f200}/{REFERRAL.SLOTS_200} · ₹{REFERRAL.PAYOUT_100}: {f100}/{REFERRAL.SLOTS_100}</span>
          </div>
          <div style={card}>
            {payouts.map(p => (
              <div key={p.referrer_code} style={row}>
                <div onClick={() => act({ action: 'mark-paid', month_key: p.month_key, referrer_code: p.referrer_code })} style={{ width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0, display: 'grid', placeItems: 'center', cursor: 'pointer', fontSize: '11px', color: 'var(--up)', border: `1.5px solid ${p.paid ? 'var(--up)' : 'var(--border-main)'}`, background: p.paid ? 'var(--up-bg)' : 'var(--bg-card)' }}>{p.paid ? '✓' : ''}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--head-ink)' }}>{p.name || p.referrer_code}</div>
                  <div style={{ fontFamily: mono, fontSize: '11px', color: 'var(--text-muted)' }}>{p.note}</div>
                </div>
                <span style={{ fontFamily: mono, fontWeight: 600, color: 'var(--head-ink)' }}>₹{p.amount}</span>
              </div>
            ))}
          </div>
          <p style={{ fontFamily: mono, fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px', lineHeight: 1.5 }}>Tap the box to mark paid. No bank or UPI data stored. First {REFERRAL.SLOTS_200} to {REFERRAL.THRESH_200} sign-ups → ₹{REFERRAL.PAYOUT_200}; first {REFERRAL.SLOTS_100} to {REFERRAL.THRESH_100} → ₹{REFERRAL.PAYOUT_100}. Not cumulative.</p>
        </>
      )}

      {toast && <div style={toastStyle}>{toast}</div>}
    </Shell>
  )
}

function Shell({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
      <header style={{ borderBottom: '1px solid var(--border-main)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ textDecoration: 'none' }}>
          <div style={{ fontFamily: display, fontWeight: 700, fontSize: '19px', color: 'var(--head-ink)', letterSpacing: '-0.01em' }}>Finance<span style={{ color: 'var(--accent)' }}>Digest</span></div>
        </a>
        <a href="/" style={{ fontFamily: mono, fontSize: '12px', color: 'var(--accent)', textDecoration: 'none' }}>← Back</a>
      </header>
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '26px 20px 60px' }}>{children}</div>
    </div>
  )
}

const muted = { color: 'var(--text-muted)', fontSize: '14px' }
const label = { fontFamily: mono, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }
const card = { background: 'var(--bg-card)', border: '1px solid var(--border-main)', borderRadius: '12px', padding: '16px' }
const row = { display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 0', borderBottom: '1px solid var(--border-main)' }
const pill = { fontFamily: mono, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', background: 'var(--bg-gist)', border: '1px solid var(--border-main)', borderRadius: '5px', padding: '2px 7px' }
const btn = { border: '1px solid var(--border-main)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: '12.5px', padding: '8px 13px', borderRadius: '9px', cursor: 'pointer' }
const btnSm = { ...btn, fontSize: '12px', padding: '7px 11px', flexShrink: 0 }
const noBtn = { background: 'var(--down-bg)', borderColor: 'var(--down)', color: 'var(--down)' }
const toastStyle = { position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%)', background: 'var(--head-ink)', color: 'var(--bg-card)', fontWeight: 600, fontSize: '13px', padding: '10px 18px', borderRadius: '999px', zIndex: 50 }
