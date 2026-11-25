'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { isAdmin } from '../../lib/referralConfig'

const mono = 'var(--font-mono)'
const display = 'var(--font-display)'

export default function LeaderboardPage() {
  const { user, loading } = useAuth()
  const [rows, setRows] = useState([])        // top-10 for the board
  const [me, setMe] = useState(null)          // { code, name, verified, rank, insider }
  const [nameInput, setNameInput] = useState('')
  const [copied, setCopied] = useState(false)
  const nameSeeded = useRef(false)   // only seed the name field once, so a live refetch can't clobber typing

  // Load the board + the signed-in user's own standing. Called on mount, on a
  // gentle poll, on tab-focus, and whenever a referral row changes (Supabase Realtime).
  const loadAll = useCallback(async () => {
    const { data } = await supabase.from('referral_leaderboard').select('*').order('verified', { ascending: false }).limit(100)
    const all = data || []
    setRows(all.filter(r => r.verified > 0).slice(0, 10))
    if (user) {
      const { data: prof } = await supabase.from('profiles').select('referral_code, display_name, insider_until').eq('id', user.id).single()
      if (prof) {
        const withCounts = all.filter(r => r.verified > 0)
        const row = all.find(r => r.code === prof.referral_code)
        const rank = row && row.verified > 0 ? withCounts.findIndex(r => r.code === prof.referral_code) + 1 : null
        setMe({
          code: prof.referral_code,
          name: prof.display_name || '',
          verified: row ? row.verified : 0,
          rank,
          insider: !!prof.insider_until && new Date(prof.insider_until) >= new Date(),
        })
        if (!nameSeeded.current) { setNameInput(prof.display_name || ''); nameSeeded.current = true }
      }
    }
  }, [user])

  useEffect(() => {
    loadAll()
    // Push updates when a referral is created/confirmed (needs Realtime enabled on
    // the `referrals` table in Supabase — one toggle). Even without it, the board
    // stays fresh via the 20s poll and a refetch whenever the tab regains focus.
    const channel = supabase
      .channel('referrals-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'referrals' }, () => loadAll())
      .subscribe()
    const poll = setInterval(loadAll, 20000)
    const onVisible = () => { if (document.visibilityState === 'visible') loadAll() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [loadAll])

  async function saveName(v) {
    setNameInput(v)
    if (!user) return
    await supabase.from('profiles').update({ display_name: v.trim() || null }).eq('id', user.id)
    setMe(m => (m ? { ...m, name: v.trim() } : m))
  }

  const link = me ? `financedigest.xyz/join?ref=${me.code}` : ''
  const inviteName = me && me.name ? me.name : null
  const shareMsg = `${inviteName ? inviteName + ' here. ' : ''}I've been following FinanceDigest to keep up with India's markets — it breaks down the day's biggest stories in plain English, in about 5 minutes.\n\nI'm inviting you to our WhatsApp community, where you get the morning brief and the market close every day. Join with my link:\nhttps://${link}`
  const shareUrl = 'https://wa.me/?text=' + encodeURIComponent(shareMsg)

  function copy() {
    try { navigator.clipboard.writeText('https://' + link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) }) } catch {}
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
      <header style={{ borderBottom: '1px solid var(--border-main)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ textDecoration: 'none' }}>
          <div style={{ fontFamily: display, fontWeight: 700, fontSize: '19px', color: 'var(--head-ink)', letterSpacing: '-0.01em' }}>Finance<span style={{ color: 'var(--accent)' }}>Digest</span></div>
        </a>
        <a href="/" style={{ fontFamily: mono, fontSize: '12px', color: 'var(--accent)', textDecoration: 'none' }}>← Back</a>
      </header>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '26px 20px 60px' }}>
        <div style={{ fontFamily: mono, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '7px' }}>Refer &amp; earn</div>
        <h1 style={{ fontFamily: display, fontWeight: 600, fontSize: '28px', letterSpacing: '-0.01em', color: 'var(--head-ink)', margin: '0 0 4px' }}>Invite friends, climb the board</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0 0 16px' }}>Share your link. Each friend who signs up <b>and</b> joins the community counts: first 2 to 20 sign-ups win ₹200, first to 15 wins ₹100. The board updates live; cash winners lock in at month-end.</p>

        {loading ? (
          <div style={{ ...cardS, fontFamily: mono, fontSize: '12px', color: 'var(--text-muted)' }}>Loading…</div>
        ) : !user ? (
          <div style={cardS}>
            <div style={{ fontFamily: display, fontWeight: 600, fontSize: '18px', color: 'var(--head-ink)', marginBottom: '6px' }}>Sign in to get your referral link</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', lineHeight: 1.5, margin: '0 0 14px' }}>Create a free account or sign in to get your personal link, track verified sign-ups, and earn the monthly rewards.</p>
            <a href="/login" style={{ display: 'inline-block', background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: '14px', padding: '11px 18px', borderRadius: '10px', textDecoration: 'none' }}>Sign in</a>
          </div>
        ) : me ? (
          <div style={cardS}>
            <div style={lbl}>Display name (shown on the board)</div>
            <input value={nameInput} onChange={e => saveName(e.target.value)} placeholder="e.g. Aarav S."
              style={{ width: '100%', border: '1px solid var(--border-main)', background: 'var(--bg-gist)', borderRadius: '10px', padding: '11px 12px', fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--text-primary)', boxSizing: 'border-box', marginBottom: '14px' }} />

            <div style={lbl}>Your referral link</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0, fontFamily: mono, fontSize: '13px', color: 'var(--head-ink)', background: 'var(--bg-gist)', border: '1px solid var(--border-main)', borderRadius: '9px', padding: '11px 12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link}</div>
              <button onClick={copy} style={{ border: '1px solid var(--border-main)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: '13px', padding: '10px 14px', borderRadius: '9px', cursor: 'pointer' }}>{copied ? 'Copied ✓' : 'Copy'}</button>
              <a href={shareUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#25D366', color: '#fff', fontWeight: 600, fontSize: '13px', padding: '10px 14px', borderRadius: '9px', textDecoration: 'none' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.5-.4M12 21.8a9.9 9.9 0 01-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.9 9.9 0 012.1 11.9C2.1 6.5 6.5 2 12 2a9.8 9.8 0 017 2.9 9.8 9.8 0 012.9 7c0 5.5-4.4 9.9-9.9 9.9m8.4-18.3A11.8 11.8 0 0012 0C5.5 0 .2 5.3.2 11.9c0 2.1.5 4.1 1.6 5.9L0 24l6.3-1.7a11.9 11.9 0 005.7 1.5c6.6 0 11.9-5.3 11.9-11.9a11.8 11.8 0 00-3.5-8.4"/></svg>Share
              </a>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '16px' }}>
              <div style={tile}><div style={tileK}>Verified · this month</div><div style={tileV}>{me.verified}</div></div>
              <div style={tile}><div style={tileK}>Your rank · this month</div><div style={tileV}>{me.rank ? '#' + me.rank : '—'}</div></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
              {me.insider
                ? <span style={{ fontFamily: mono, fontSize: '10px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#B8860B', background: '#FBF2DC', border: '1px solid #B8860B', borderRadius: '6px', padding: '3px 8px' }}>★ Insider</span>
                : <span style={{ fontFamily: mono, fontSize: '11px', color: 'var(--text-muted)' }}>No Insider badge yet</span>}
              {isAdmin(user.id) && <a href="/admin/referrals" style={{ marginLeft: 'auto', fontFamily: mono, fontSize: '11.5px', fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>🔒 Admin →</a>}
            </div>
          </div>
        ) : (
          <div style={{ ...cardS, fontFamily: mono, fontSize: '12px', color: 'var(--text-muted)' }}>Setting up your referral link…</div>
        )}

        <div style={{ fontFamily: mono, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '7px' }}>Top referrers</div>
        <h2 style={{ fontFamily: display, fontWeight: 600, fontSize: '24px', letterSpacing: '-0.01em', color: 'var(--head-ink)', margin: '0 0 12px' }}>The board</h2>
        <div style={{ display: 'inline-block', marginBottom: '14px' }}>
          <span style={{ fontFamily: mono, fontSize: '12px', fontWeight: 600, letterSpacing: '0.04em', padding: '7px 14px', borderRadius: '8px', background: 'var(--accent)', color: '#fff' }}>This month</span>
        </div>

        {rows.length === 0 ? (
          <p style={{ fontFamily: mono, fontSize: '13px', color: 'var(--text-muted)', padding: '20px 2px' }}>No verified sign-ups yet this month.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr>{['#', 'Member', 'Verified'].map((h, i) => (
                <th key={i} style={{ fontFamily: mono, fontSize: '10px', letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: i === 2 ? 'right' : 'left', padding: '9px 10px', borderBottom: '1px solid var(--border-main)' }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {rows.map((u, i) => {
                const mine = me && u.code === me.code
                return (
                  <tr key={u.code} style={{ background: mine ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent' }}>
                    <td style={{ fontFamily: mono, fontWeight: 600, color: i < 3 ? 'var(--accent)' : 'var(--text-muted)', padding: '11px 10px', borderBottom: '1px solid var(--border-main)', width: '30px' }}>{i + 1}</td>
                    <td style={{ padding: '11px 10px', borderBottom: '1px solid var(--border-main)' }}>
                      <span style={{ fontWeight: 600, color: 'var(--head-ink)' }}>{u.name}</span>
                      {u.insider && <span style={{ marginLeft: '7px', fontFamily: mono, fontSize: '10px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#B8860B', background: '#FBF2DC', border: '1px solid #B8860B', borderRadius: '6px', padding: '2px 7px' }}>★ Insider</span>}
                    </td>
                    <td style={{ fontFamily: mono, fontWeight: 600, color: 'var(--head-ink)', textAlign: 'right', padding: '11px 10px', borderBottom: '1px solid var(--border-main)', fontVariantNumeric: 'tabular-nums' }}>{u.verified}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <p style={{ fontFamily: mono, fontSize: '11px', color: 'var(--text-muted)', marginTop: '14px', lineHeight: 1.5 }}>Calendar month, IST · verified sign-ups only · emails never shown.</p>
      </div>
    </div>
  )
}

const cardS = { background: 'var(--bg-card)', border: '1px solid var(--border-main)', borderRadius: '14px', padding: '18px', marginBottom: '34px' }
const lbl = { fontFamily: mono, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }
const tile = { background: 'var(--bg-gist)', border: '1px solid var(--border-main)', borderRadius: '10px', padding: '12px 14px' }
const tileK = { fontFamily: mono, fontSize: '10px', letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const tileV = { fontFamily: mono, fontWeight: 600, fontSize: '23px', color: 'var(--head-ink)' }
