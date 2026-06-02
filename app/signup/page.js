'use client'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  async function handleSignup(e) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setTimeout(() => router.push('/pricing'), 2000)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F7F4EF',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'sans-serif',
      padding: '20px',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '20px',
        padding: '40px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 4px 40px rgba(0,0,0,0.08)',
        border: '1px solid #f0ede8',
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{
            fontSize: '28px', fontWeight: '700',
            color: '#1a1410', fontFamily: 'Georgia, serif',
            margin: '0 0 8px',
          }}>
            Finance <span style={{ color: '#C9A84C' }}>Digest</span>
          </h1>
          <p style={{ color: '#9a8e7e', fontSize: '14px', margin: 0 }}>
            Create your free account
          </p>
        </div>

        {/* Success */}
        {success && (
          <div style={{
            background: '#d4edda', border: '1px solid #28a745',
            borderRadius: '10px', padding: '16px',
            marginBottom: '20px', fontSize: '14px',
            color: '#155724', textAlign: 'center',
          }}>
            ✅ Account created! Redirecting to plans...
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: '#FFF3CD', border: '1px solid #ffc107',
            borderRadius: '10px', padding: '12px 16px',
            marginBottom: '20px', fontSize: '13px', color: '#856404',
          }}>
            {error}
          </div>
        )}

        {/* Form */}
        {!success && (
          <form onSubmit={handleSignup}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block', fontSize: '13px', fontWeight: '600',
                color: '#5a4f3e', marginBottom: '6px',
              }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                style={{
                  width: '100%', padding: '12px 14px',
                  border: '1px solid #e8e0d5', borderRadius: '10px',
                  fontSize: '14px', outline: 'none',
                  boxSizing: 'border-box', color: '#1a1410',
                  background: '#fafaf8',
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block', fontSize: '13px', fontWeight: '600',
                color: '#5a4f3e', marginBottom: '6px',
              }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="Min 6 characters"
                style={{
                  width: '100%', padding: '12px 14px',
                  border: '1px solid #e8e0d5', borderRadius: '10px',
                  fontSize: '14px', outline: 'none',
                  boxSizing: 'border-box', color: '#1a1410',
                  background: '#fafaf8',
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block', fontSize: '13px', fontWeight: '600',
                color: '#5a4f3e', marginBottom: '6px',
              }}>
                Confirm Password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                placeholder="••••••••"
                style={{
                  width: '100%', padding: '12px 14px',
                  border: '1px solid #e8e0d5', borderRadius: '10px',
                  fontSize: '14px', outline: 'none',
                  boxSizing: 'border-box', color: '#1a1410',
                  background: '#fafaf8',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '13px',
                background: loading ? '#d4b870' : '#C9A84C',
                color: '#fff', border: 'none', borderRadius: '10px',
                fontSize: '15px', fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {loading ? 'Creating account...' : 'Create Free Account'}
            </button>

            {/* Free plan note */}
            <p style={{
              textAlign: 'center', fontSize: '12px',
              color: '#b0a898', marginTop: '12px',
            }}>
              Free account — upgrade anytime from ₹99/month
            </p>
          </form>
        )}

        {/* Divider */}
        {!success && (
          <>
            <div style={{
              display: 'flex', alignItems: 'center',
              gap: '12px', margin: '24px 0',
            }}>
              <div style={{ flex: 1, height: '1px', background: '#ede8e0' }} />
              <span style={{ fontSize: '12px', color: '#b0a898' }}>already have an account?</span>
              <div style={{ flex: 1, height: '1px', background: '#ede8e0' }} />
            </div>

            <a href="/login" style={{
              display: 'block', textAlign: 'center',
              padding: '12px', border: '1px solid #e8e0d5',
              borderRadius: '10px', fontSize: '14px',
              fontWeight: '600', color: '#5a4f3e',
              textDecoration: 'none', transition: 'background 0.2s',
            }}>
              Sign In
            </a>

            <p style={{ textAlign: 'center', fontSize: '13px', color: '#b0a898', marginTop: '16px' }}>
              <a href="/" style={{ color: '#b0a898', textDecoration: 'none' }}>
                ← Back to Finance Digest
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  )
}