'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function AccountPage() {
  const [user, setUser]             = useState(null)
  const [profile, setProfile]       = useState(null)
  const [subscription, setSub]      = useState(null)
  const [loading, setLoading]       = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setProfile(profile)

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      setSub(sub)
      setLoading(false)
    }
    load()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  async function handleCancel() {
    if (!confirm('Are you sure you want to cancel your subscription? You will be downgraded to the free plan.')) return
    setCancelling(true)

    try {
      const res = await fetch('/api/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId: subscription.razorpay_subscription_id,
          userId: user.id,
        }),
      })
      const data = await res.json()

      if (data.success) {
        setProfile(prev => ({ ...prev, plan: 'free' }))
        setSub(null)
        alert('Subscription cancelled. You have been moved to the free plan.')
      } else {
        alert('Something went wrong. Please contact support.')
      }
    } catch (e) {
      alert('Something went wrong. Please try again.')
    }

    setCancelling(false)
  }

  const PLAN_LABELS = {
    free:  { label: 'Free',  color: '#9a8e7e', bg: '#f0ede8' },
    basic: { label: 'Basic', color: '#8B6914', bg: '#FDF6E7' },
    pro:   { label: 'Pro',   color: '#fff',    bg: '#1a1410' },
  }

  const planInfo = PLAN_LABELS[profile?.plan] || PLAN_LABELS.free

  if (loading) return (
    <div style={{
      minHeight: '100vh', background: '#F7F4EF',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'sans-serif',
    }}>
      <p style={{ color: '#9a8e7e' }}>Loading...</p>
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh', background: '#F7F4EF',
      fontFamily: 'sans-serif', padding: '40px 20px',
    }}>
      <div style={{ maxWidth: '520px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <a href="/" style={{ textDecoration: 'none' }}>
            <h1 style={{
              fontSize: '28px', fontWeight: '700',
              color: '#1a1410', fontFamily: 'Georgia, serif', margin: '0 0 4px',
            }}>
              Finance <span style={{ color: '#C9A84C' }}>Digest</span>
            </h1>
          </a>
          <p style={{ color: '#9a8e7e', fontSize: '14px', margin: 0 }}>My Account</p>
        </div>

        {/* Success banner */}
        {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('success') && (
          <div style={{
            background: '#d4edda', border: '1px solid #28a745',
            borderRadius: '12px', padding: '16px 20px',
            marginBottom: '24px', fontSize: '14px', color: '#155724',
          }}>
            ✅ Payment successful! Your plan has been activated.
          </div>
        )}

        {/* Profile card */}
        <div style={{
          background: '#fff', borderRadius: '20px',
          border: '1px solid #f0ede8', padding: '28px',
          marginBottom: '20px',
          boxShadow: '0 2px 20px rgba(0,0,0,0.05)',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1a1410', margin: '0 0 20px' }}>
            Account Details
          </h2>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '14px', color: '#9a8e7e' }}>Email</span>
            <span style={{ fontSize: '14px', color: '#1a1410', fontWeight: '600' }}>{user?.email}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', color: '#9a8e7e' }}>Current Plan</span>
            <span style={{
              fontSize: '13px', fontWeight: '700',
              background: planInfo.bg, color: planInfo.color,
              padding: '4px 14px', borderRadius: '99px',
            }}>
              {planInfo.label}
            </span>
          </div>

          {subscription && (
            <div style={{
              marginTop: '16px', paddingTop: '16px',
              borderTop: '1px solid #f0ede8',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: '14px', color: '#9a8e7e' }}>Billing</span>
              <span style={{ fontSize: '14px', color: '#1a1410', fontWeight: '600', textTransform: 'capitalize' }}>
                {subscription.period}
              </span>
            </div>
          )}
        </div>

        {/* Plan actions */}
        <div style={{
          background: '#fff', borderRadius: '20px',
          border: '1px solid #f0ede8', padding: '28px',
          marginBottom: '20px',
          boxShadow: '0 2px 20px rgba(0,0,0,0.05)',
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#1a1410', margin: '0 0 20px' }}>
            Manage Plan
          </h2>

          {profile?.plan === 'free' ? (
            <div>
              <p style={{ fontSize: '14px', color: '#9a8e7e', margin: '0 0 16px' }}>
                You are on the free plan. Upgrade to unlock all features.
              </p>
              <a href="/pricing" style={{
                display: 'block', textAlign: 'center',
                padding: '13px', background: '#C9A84C',
                color: '#fff', borderRadius: '10px',
                fontSize: '14px', fontWeight: '700',
                textDecoration: 'none',
              }}>
                View Plans →
              </a>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: '14px', color: '#9a8e7e', margin: '0 0 16px' }}>
                Your {profile?.plan} plan is active.
                {profile?.plan === 'basic' && ' Upgrade to Pro to unlock AI Voice Agent and Portfolio.'}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {profile?.plan === 'basic' && (
                  <a href="/pricing" style={{
                    display: 'block', textAlign: 'center',
                    padding: '12px', background: '#C9A84C',
                    color: '#fff', borderRadius: '10px',
                    fontSize: '14px', fontWeight: '700',
                    textDecoration: 'none',
                  }}>
                    Upgrade to Pro →
                  </a>
                )}

                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  style={{
                    width: '100%', padding: '12px',
                    background: 'none', border: '1px solid #f0ede8',
                    borderRadius: '10px', fontSize: '14px',
                    color: '#e53e3e', fontWeight: '600',
                    cursor: cancelling ? 'not-allowed' : 'pointer',
                  }}
                >
                  {cancelling ? 'Cancelling...' : 'Cancel Subscription'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{
            width: '100%', padding: '13px',
            background: '#fff', border: '1px solid #f0ede8',
            borderRadius: '10px', fontSize: '14px',
            color: '#9a8e7e', fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 2px 20px rgba(0,0,0,0.05)',
          }}
        >
          Sign Out
        </button>

        <p style={{ textAlign: 'center', fontSize: '13px', color: '#b0a898', marginTop: '20px' }}>
          <a href="/" style={{ color: '#b0a898', textDecoration: 'none' }}>← Back to Finance Digest</a>
        </p>
      </div>
    </div>
  )
}