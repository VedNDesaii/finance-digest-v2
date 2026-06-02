'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

const PLANS = {
  basic: {
    name: 'Basic',
    monthly: 99,
    annual: 990,
    color: '#C9A84C',
    features: [
      '✅ All market sections',
      '✅ All 10 industry sections',
      '✅ Full story + Investor Take',
      '✅ Key Terms / Glossary',
      '✅ Listen (text to speech)',
      '✅ Dark mode',
      '✅ Up to 50 articles/day',
      '❌ AI Voice Agent',
      '❌ My Portfolio',
      '❌ Market Summary',
      '❌ Save articles',
    ],
  },
  pro: {
    name: 'Pro',
    monthly: 199,
    annual: 1990,
    color: '#1a1410',
    features: [
      '✅ Everything in Basic',
      '✅ AI Voice Agent (ask questions)',
      '✅ My Portfolio',
      '✅ Market Summary',
      '✅ Save articles',
      '✅ Unlimited articles',
      '✅ Priority access to new features',
    ],
  },
}

export default function PricingPage() {
  const [period, setPeriod]   = useState('monthly')
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState({})
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        setProfile(data)
      }
    }
    load()
  }, [])

  async function handleSubscribe(planKey) {
    if (!user) {
      router.push('/signup')
      return
    }

    setLoading(prev => ({ ...prev, [planKey]: true }))

    try {
      const res = await fetch('/api/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey, period }),
      })
      const data = await res.json()

      if (!data.subscriptionId) {
        alert('Something went wrong. Please try again.')
        setLoading(prev => ({ ...prev, [planKey]: false }))
        return
      }

      // Open Razorpay checkout
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        subscription_id: data.subscriptionId,
        name: 'Finance Digest',
        description: `${PLANS[planKey].name} Plan — ${period === 'monthly' ? 'Monthly' : 'Annual'}`,
        handler: async function (response) {
          // Verify payment
          const verifyRes = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_payment_id:   response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature:    response.razorpay_signature,
              plan:   planKey,
              period: period,
              userId: user.id,
            }),
          })
          const verifyData = await verifyRes.json()

          if (verifyData.success) {
            router.push('/account?success=true')
          } else {
            alert('Payment verification failed. Contact support.')
          }
        },
        prefill: { email: user.email },
        theme: { color: '#C9A84C' },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (e) {
      console.error(e)
      alert('Something went wrong. Please try again.')
    }

    setLoading(prev => ({ ...prev, [planKey]: false }))
  }

  const savings = (plan) => {
    const monthlyTotal = PLANS[plan].monthly * 12
    const annualPrice  = PLANS[plan].annual
    return monthlyTotal - annualPrice
  }

  return (
    <>
      {/* Load Razorpay script */}
      <script src="https://checkout.razorpay.com/v1/checkout.js" />

      <div style={{
        minHeight: '100vh', background: '#F7F4EF',
        fontFamily: 'sans-serif', padding: '40px 20px',
      }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <a href="/" style={{ textDecoration: 'none' }}>
            <h1 style={{
              fontSize: '32px', fontWeight: '700',
              color: '#1a1410', fontFamily: 'Georgia, serif', margin: '0 0 8px',
            }}>
              Finance <span style={{ color: '#C9A84C' }}>Digest</span>
            </h1>
          </a>
          <p style={{ fontSize: '18px', color: '#5a4f3e', margin: '0 0 8px' }}>
            Simple pricing. No hidden fees.
          </p>
          <p style={{ fontSize: '14px', color: '#9a8e7e', margin: 0 }}>
            Cancel anytime.
          </p>
        </div>

        {/* Period toggle */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '12px', marginBottom: '40px',
        }}>
          <span style={{
            fontSize: '14px', fontWeight: period === 'monthly' ? '700' : '400',
            color: period === 'monthly' ? '#1a1410' : '#9a8e7e',
          }}>Monthly</span>

          <div
            onClick={() => setPeriod(p => p === 'monthly' ? 'annual' : 'monthly')}
            style={{
              width: '52px', height: '28px', borderRadius: '14px',
              background: period === 'annual' ? '#C9A84C' : '#ddd8cf',
              cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
            }}
          >
            <div style={{
              position: 'absolute', top: '3px',
              left: period === 'annual' ? '27px' : '3px',
              width: '22px', height: '22px', borderRadius: '50%',
              background: '#fff', transition: 'left 0.2s',
              boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
            }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              fontSize: '14px', fontWeight: period === 'annual' ? '700' : '400',
              color: period === 'annual' ? '#1a1410' : '#9a8e7e',
            }}>Annual</span>
            <span style={{
              fontSize: '11px', fontWeight: '700',
              background: '#C9A84C', color: '#fff',
              padding: '2px 8px', borderRadius: '99px',
            }}>Save 2 months</span>
          </div>
        </div>

        {/* Plan cards */}
        <div style={{
          display: 'flex', gap: '24px', maxWidth: '800px',
          margin: '0 auto', flexWrap: 'wrap', justifyContent: 'center',
        }}>

          {/* Free card */}
          <div style={{
            background: '#fff', borderRadius: '20px',
            border: '1px solid #f0ede8', padding: '32px',
            width: '220px', flexShrink: 0,
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1a1410', margin: '0 0 4px' }}>Free</h2>
            <p style={{ fontSize: '13px', color: '#9a8e7e', margin: '0 0 20px' }}>Get started</p>
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#1a1410', marginBottom: '24px' }}>
              ₹0
              <span style={{ fontSize: '14px', fontWeight: '400', color: '#9a8e7e' }}>/mo</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
              {['✅ Major Headlines (3/day)', '✅ Quick Take only', '❌ Full story', '❌ Investor Take', '❌ Voice Agent'].map((f, i) => (
                <p key={i} style={{ fontSize: '13px', color: '#5a4f3e', margin: 0 }}>{f}</p>
              ))}
            </div>
            <a href="/" style={{
              display: 'block', textAlign: 'center', padding: '11px',
              border: '1px solid #e8e0d5', borderRadius: '10px',
              fontSize: '14px', fontWeight: '600', color: '#5a4f3e',
              textDecoration: 'none',
            }}>
              {profile?.plan === 'free' ? 'Current Plan' : 'Continue Free'}
            </a>
          </div>

          {/* Basic card */}
          <div style={{
            background: '#fff', borderRadius: '20px',
            border: '2px solid #C9A84C', padding: '32px',
            width: '220px', flexShrink: 0, position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: '-12px', left: '50%',
              transform: 'translateX(-50%)',
              background: '#C9A84C', color: '#fff',
              fontSize: '11px', fontWeight: '700',
              padding: '4px 14px', borderRadius: '99px',
            }}>POPULAR</div>

            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1a1410', margin: '0 0 4px' }}>Basic</h2>
            <p style={{ fontSize: '13px', color: '#9a8e7e', margin: '0 0 20px' }}>For regular readers</p>
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#1a1410', marginBottom: '4px' }}>
              ₹{period === 'monthly' ? PLANS.basic.monthly : Math.round(PLANS.basic.annual / 12)}
              <span style={{ fontSize: '14px', fontWeight: '400', color: '#9a8e7e' }}>/mo</span>
            </div>
            {period === 'annual' && (
              <p style={{ fontSize: '12px', color: '#C9A84C', fontWeight: '600', margin: '0 0 20px' }}>
                ₹{PLANS.basic.annual}/year · Save ₹{savings('basic')}
              </p>
            )}
            {period === 'monthly' && <div style={{ marginBottom: '20px' }} />}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
              {PLANS.basic.features.map((f, i) => (
                <p key={i} style={{ fontSize: '13px', color: '#5a4f3e', margin: 0 }}>{f}</p>
              ))}
            </div>

            <button
              onClick={() => handleSubscribe('basic')}
              disabled={loading.basic || profile?.plan === 'basic'}
              style={{
                width: '100%', padding: '12px',
                background: profile?.plan === 'basic' ? '#e8e0d5' : '#C9A84C',
                color: profile?.plan === 'basic' ? '#9a8e7e' : '#fff',
                border: 'none', borderRadius: '10px',
                fontSize: '14px', fontWeight: '700',
                cursor: profile?.plan === 'basic' ? 'default' : 'pointer',
              }}
            >
              {profile?.plan === 'basic' ? 'Current Plan' : loading.basic ? 'Processing...' : 'Get Basic'}
            </button>
          </div>

          {/* Pro card */}
          <div style={{
            background: '#1a1410', borderRadius: '20px',
            border: '2px solid #1a1410', padding: '32px',
            width: '220px', flexShrink: 0,
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#fff', margin: '0 0 4px' }}>Pro</h2>
            <p style={{ fontSize: '13px', color: '#9a8e7e', margin: '0 0 20px' }}>For serious investors</p>
            <div style={{ fontSize: '32px', fontWeight: '700', color: '#C9A84C', marginBottom: '4px' }}>
              ₹{period === 'monthly' ? PLANS.pro.monthly : Math.round(PLANS.pro.annual / 12)}
              <span style={{ fontSize: '14px', fontWeight: '400', color: '#9a8e7e' }}>/mo</span>
            </div>
            {period === 'annual' && (
              <p style={{ fontSize: '12px', color: '#C9A84C', fontWeight: '600', margin: '0 0 20px' }}>
                ₹{PLANS.pro.annual}/year · Save ₹{savings('pro')}
              </p>
            )}
            {period === 'monthly' && <div style={{ marginBottom: '20px' }} />}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
              {PLANS.pro.features.map((f, i) => (
                <p key={i} style={{ fontSize: '13px', color: '#c4b9ae', margin: 0 }}>{f}</p>
              ))}
            </div>

            <button
              onClick={() => handleSubscribe('pro')}
              disabled={loading.pro || profile?.plan === 'pro'}
              style={{
                width: '100%', padding: '12px',
                background: profile?.plan === 'pro' ? '#2a2018' : '#C9A84C',
                color: profile?.plan === 'pro' ? '#9a8e7e' : '#1a1410',
                border: 'none', borderRadius: '10px',
                fontSize: '14px', fontWeight: '700',
                cursor: profile?.plan === 'pro' ? 'default' : 'pointer',
              }}
            >
              {profile?.plan === 'pro' ? 'Current Plan' : loading.pro ? 'Processing...' : 'Get Pro'}
            </button>
          </div>
        </div>

        {/* Footer note */}
        <p style={{
          textAlign: 'center', fontSize: '13px',
          color: '#b0a898', marginTop: '40px',
        }}>
          Payments are processed securely by Razorpay.
          Cancel anytime from your account settings.
        </p>
      </div>
    </>
  )
}