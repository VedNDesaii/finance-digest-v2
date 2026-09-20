'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
    setLoading(false)
  }

  const plan = profile?.plan || 'free'

  return {
    user,
    profile,
    loading,
    plan,
    isPro:   plan === 'pro',
    isBasic: plan === 'basic' || plan === 'pro',
    isFree:  plan === 'free',
  }
}

// Counts TRUE unique visitors per day. The id lives in localStorage, so it
// persists across sessions and days on the same browser — the same person
// visiting many times in a week is written once per day and counts once over
// any range (distinct visitor_id). Fires once per app load; the API upserts
// (visitor_id, day) so repeat visits the same day are a no-op.
export function useVisitorTracking() {
  useEffect(() => {
    try {
      let vid = localStorage.getItem('fd-visitor-id')
      if (!vid) {
        vid = (crypto?.randomUUID?.() || String(Date.now()) + Math.random().toString(36).slice(2))
        localStorage.setItem('fd-visitor-id', vid)
      }
      fetch('/api/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId: vid }),
      }).catch(() => {})
    } catch { /* private mode / no storage — skip silently */ }
  }, [])
}