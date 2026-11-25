import { NextResponse } from 'next/server'
import { supabaseAdmin, requireAdmin } from '../../../../lib/supabaseAdmin'
import { REFERRAL } from '../../../../lib/referralConfig'

export const dynamic = 'force-dynamic'

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function sameMonth(iso, d = new Date()) {
  const t = new Date(iso)
  return t.getFullYear() === d.getFullYear() && t.getMonth() === d.getMonth()
}
function endOfNextMonth(d = new Date()) {
  // last day of the month AFTER this one (Insider valid until then)
  const e = new Date(d.getFullYear(), d.getMonth() + 2, 0)
  return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`
}

async function namesFor(db, codes) {
  const list = codes.length ? codes : ['']
  const { data } = await db.from('profiles').select('referral_code, display_name').in('referral_code', list)
  const map = {}
  ;(data || []).forEach(p => { map[p.referral_code] = p.display_name || p.referral_code })
  return map
}

// GET — everything the admin dashboard needs
export async function GET(req) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const db = supabaseAdmin()
  const { data: referrals } = await db.from('referrals').select('*').order('created_at', { ascending: false })
  const { data: payouts } = await db.from('referral_payouts').select('*').eq('month_key', monthKey()).order('amount', { ascending: false })
  const codes = [...new Set((referrals || []).map(r => r.referrer_code))]
  const nameByCode = await namesFor(db, codes)
  // confirmed-this-month counts per code → the board
  const counts = {}
  ;(referrals || []).forEach(r => {
    if (r.status === 'confirmed' && r.confirmed_at && sameMonth(r.confirmed_at)) counts[r.referrer_code] = (counts[r.referrer_code] || 0) + 1
  })
  const board = Object.entries(counts).map(([code, verified]) => ({ code, name: nameByCode[code] || code, verified }))
    .sort((a, b) => b.verified - a.verified)
  return NextResponse.json({ referrals: referrals || [], payouts: payouts || [], nameByCode, board })
}

// POST — { action: 'reject' | 'finalise' | 'mark-paid', ... }
export async function POST(req) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const db = supabaseAdmin()
  const body = await req.json().catch(() => ({}))

  if (body.action === 'reject') {
    await db.from('referrals').update({ status: 'rejected' }).eq('referred_user_id', body.referred_user_id)
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'mark-paid') {
    const { data: row } = await db.from('referral_payouts').select('paid')
      .eq('month_key', body.month_key).eq('referrer_code', body.referrer_code).single()
    await db.from('referral_payouts').update({ paid: !row?.paid })
      .eq('month_key', body.month_key).eq('referrer_code', body.referrer_code)
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'finalise') {
    const mk = monthKey()
    const { data: refs } = await db.from('referrals').select('referrer_code, confirmed_at').eq('status', 'confirmed')
    const inMonth = (refs || []).filter(r => r.confirmed_at && sameMonth(r.confirmed_at))
    const byCode = {}
    inMonth.forEach(r => { (byCode[r.referrer_code] ||= []).push(new Date(r.confirmed_at).getTime()) })
    const stats = Object.entries(byCode).map(([code, arr]) => {
      arr.sort((a, b) => a - b)
      return { code, count: arr.length, reachedHigh: arr[REFERRAL.THRESH_200 - 1] || null, reachedLow: arr[REFERRAL.THRESH_100 - 1] || null }
    })
    const won = {}
    stats.filter(s => s.reachedHigh).sort((a, b) => a.reachedHigh - b.reachedHigh).slice(0, REFERRAL.SLOTS_200)
      .forEach((s, i) => { won[s.code] = { amount: REFERRAL.PAYOUT_200, note: `Reached ${REFERRAL.THRESH_200} · ₹${REFERRAL.PAYOUT_200} slot ${i + 1} of ${REFERRAL.SLOTS_200} · Insider` } })
    stats.filter(s => s.reachedLow && !won[s.code]).sort((a, b) => a.reachedLow - b.reachedLow).slice(0, REFERRAL.SLOTS_100)
      .forEach((s, i) => { won[s.code] = { amount: REFERRAL.PAYOUT_100, note: `Reached ${REFERRAL.THRESH_100} · ₹${REFERRAL.PAYOUT_100} slot ${i + 1} of ${REFERRAL.SLOTS_100} · Insider` } })
    const insiders = [...stats].sort((a, b) => b.count - a.count).slice(0, 10).map(s => s.code)
    const codes = [...new Set([...Object.keys(won), ...insiders])]
    const nameByCode = await namesFor(db, codes)
    const rows = Object.entries(won).map(([code, w]) => ({ month_key: mk, referrer_code: code, name: nameByCode[code] || code, amount: w.amount, note: w.note }))
    if (rows.length) await db.from('referral_payouts').upsert(rows, { onConflict: 'month_key,referrer_code' })
    if (insiders.length) await db.from('profiles').update({ insider_until: endOfNextMonth() }).in('referral_code', insiders)
    return NextResponse.json({ ok: true, payouts: rows.length })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
