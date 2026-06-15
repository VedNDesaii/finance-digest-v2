'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [ready, setReady] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Supabase sets a session from the recovery link automatically
    supabase.auth.getSession().then(({ data: { session } }) => {
      setReady(!!session)
    })
  }, [])

  async function handleReset(e) {
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
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setTimeout(() => router.push('/'), 2000)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#F7F4EF', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', padding: '20px',
    }}>
      <div style={{
        background: '#fff', borderRadius: '20px', padding: '40px',
        width: '100%', maxWidth: '420px', boxShadow: '0 4px 40px rgba(0,0,0,0.08)', border: '1px solid #f0ede8',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#1a1410', fontFamily: 'Georgia, serif', margin: '0 0 8px' }}>
            Finance <span style={{ color: '#C9A84C' }}>Digest</span>
          </h1>
          <p style={{ color: '#9a8e7e', fontSize: '14px', margin: 0 }}>
            Set a new password
          </p>
        </div>

        {success && (
          <div style={{ background: '#d4edda', border: '1px solid #28a745', borderRadius: '10px', padding: '16px', marginBottom: '20px', fontSize: '14px', color: '#155724', textAlign: 'center' }}>
            ✅ Password updated! Redirecting...
          </div>
        )}

        {error && (
          <div style={{ background: '#FFF3CD', border: '1px solid #ffc107', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#856404' }}>
            {error}
          </div>
        )}

        {!ready && !success && (
          <div style={{ background: '#FFF3CD', border: '1px solid #ffc107', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#856404', textAlign: 'center' }}>
            Verifying reset link... If this persists, the link may have expired — request a new one.
          </div>
        )}

        {!success && (
          <form onSubmit={handleReset}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#5a4f3e', marginBottom: '6px' }}>
              New Password
            </label>
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="Min 6 characters"
                style={{
                  width: '100%', padding: '12px 44px 12px 14px', border: '1px solid #e8e0d5',
                  borderRadius: '10px', fontSize: '14px', outline: 'none',
                  boxSizing: 'border-box', color: '#1a1410', background: '#fafaf8',
                }}
              />
              <button type="button" onClick={() => setShowPassword(s => !s)} style={{
                position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px',
                color: '#b0a898', padding: '4px', lineHeight: 1,
              }} tabIndex={-1}>
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>

            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#5a4f3e', marginBottom: '6px' }}>
              Confirm New Password
            </label>
            <div style={{ position: 'relative', marginBottom: '24px' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                placeholder="••••••••"
                style={{
                  width: '100%', padding: '12px 44px 12px 14px', border: '1px solid #e8e0d5',
                  borderRadius: '10px', fontSize: '14px', outline: 'none',
                  boxSizing: 'border-box', color: '#1a1410', background: '#fafaf8',
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
              }}
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}

        <p style={{ textAlign: 'center', fontSize: '13px', color: '#b0a898', marginTop: '16px' }}>
          <a href="/" style={{ color: '#b0a898', textDecoration: 'none' }}>
            ← Back to Finance Digest
          </a>
        </p>
      </div>
    </div>
  )
}