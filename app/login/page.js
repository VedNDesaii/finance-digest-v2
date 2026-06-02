'use client'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
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
            Sign in to your account
          </p>
        </div>

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
        <form onSubmit={handleLogin}>
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

          <div style={{ marginBottom: '24px' }}>
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
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Divider */}
        <div style={{
          display: 'flex', alignItems: 'center',
          gap: '12px', margin: '24px 0',
        }}>
          <div style={{ flex: 1, height: '1px', background: '#ede8e0' }} />
          <span style={{ fontSize: '12px', color: '#b0a898' }}>or</span>
          <div style={{ flex: 1, height: '1px', background: '#ede8e0' }} />
        </div>

        {/* Sign up link */}
        <p style={{ textAlign: 'center', fontSize: '14px', color: '#9a8e7e', margin: 0 }}>
          Don't have an account?{' '}
          <a href="/signup" style={{ color: '#C9A84C', fontWeight: '600', textDecoration: 'none' }}>
            Sign up free
          </a>
        </p>

        {/* Back to app */}
        <p style={{ textAlign: 'center', fontSize: '13px', color: '#b0a898', marginTop: '16px' }}>
          <a href="/" style={{ color: '#b0a898', textDecoration: 'none' }}>
            ← Back to Finance Digest
          </a>
        </p>
      </div>
    </div>
  )
}