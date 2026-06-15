'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const STORAGE_KEY = 'fd_welcome_seen'

export default function WelcomeModal({ dark, user }) {
  const [show, setShow] = useState(false)
  const [mode, setMode] = useState('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (user) return
    const seen = localStorage.getItem(STORAGE_KEY)
    if (!seen) setShow(true)
  }, [user])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, 'true')
    setShow(false)
  }

  async function handleSignup(e) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else {
      setSuccess(true)
      localStorage.setItem(STORAGE_KEY, 'true')
      setTimeout(() => setShow(false), 1800)
    }
  }

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else { localStorage.setItem(STORAGE_KEY, 'true'); setShow(false) }
  }

  if (!show) return null

  const cardBg      = dark ? '#1e1a15' : '#fff'
  const textPri     = dark ? '#F0EBE3' : '#1a1410'
  const textSec     = dark ? '#9a8e7e' : '#5a4f3e'
  const textMuted   = dark ? '#6b6055' : '#b0a898'
  const inputBg     = dark ? 'rgba(255,255,255,0.05)' : '#fafaf8'
  const inputBorder = dark ? 'rgba(255,255,255,0.1)' : '#e8e0d5'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', fontFamily: 'sans-serif',
      animation: 'fadeInModal 0.2s ease',
    }}>
      <div style={{
        background: cardBg, borderRadius: '20px', padding: '36px',
        width: '100%', maxWidth: '420px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        border: `1px solid ${inputBorder}`,
        position: 'relative', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <button onClick={dismiss} style={{
          position: 'absolute', top: '16px', right: '16px',
          background: 'none', border: 'none', cursor: 'pointer',
          color: textMuted, fontSize: '20px', lineHeight: 1, padding: '4px',
        }}>×</button>

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: textPri, fontFamily: 'Georgia, serif', margin: '0 0 8px' }}>
            Finance <span style={{ color: '#C9A84C' }}>Digest</span>
          </h1>
          <p style={{ color: textMuted, fontSize: '14px', margin: 0 }}>
            {mode === 'signup' ? 'Create your free account' : 'Sign in to your account'}
          </p>
        </div>

        {success && (
          <div style={{ background: '#d4edda', border: '1px solid #28a745', borderRadius: '10px', padding: '16px', marginBottom: '20px', fontSize: '14px', color: '#155724', textAlign: 'center' }}>
            ✅ Account created!
          </div>
        )}

        {error && (
          <div style={{ background: '#FFF3CD', border: '1px solid #ffc107', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#856404' }}>
            {error}
          </div>
        )}

        {!success && mode === 'signup' && (
          <form onSubmit={handleSignup}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: textSec, marginBottom: '6px' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com"
              style={{ width: '100%', padding: '12px 14px', border: `1px solid ${inputBorder}`, borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', color: textPri, background: inputBg, marginBottom: '16px' }} />

            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: textSec, marginBottom: '6px' }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Min 6 characters"
              style={{ width: '100%', padding: '12px 14px', border: `1px solid ${inputBorder}`, borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', color: textPri, background: inputBg, marginBottom: '16px' }} />

            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: textSec, marginBottom: '6px' }}>Confirm Password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="••••••••"
              style={{ width: '100%', padding: '12px 14px', border: `1px solid ${inputBorder}`, borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', color: textPri, background: inputBg, marginBottom: '24px' }} />

            <button type="submit" disabled={loading} style={{ width: '100%', padding: '13px', background: loading ? '#d4b870' : '#C9A84C', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Creating account...' : 'Create Free Account'}
            </button>

            <p style={{ textAlign: 'center', fontSize: '12px', color: textMuted, marginTop: '12px' }}>
              Free account — upgrade anytime from ₹99/month
            </p>
          </form>
        )}

        {!success && mode === 'login' && (
          <form onSubmit={handleLogin}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: textSec, marginBottom: '6px' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com"
              style={{ width: '100%', padding: '12px 14px', border: `1px solid ${inputBorder}`, borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', color: textPri, background: inputBg, marginBottom: '16px' }} />

            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: textSec, marginBottom: '6px' }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
              style={{ width: '100%', padding: '12px 14px', border: `1px solid ${inputBorder}`, borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', color: textPri, background: inputBg, marginBottom: '24px' }} />

            <button type="submit" disabled={loading} style={{ width: '100%', padding: '13px', background: loading ? '#d4b870' : '#C9A84C', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {!success && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
              <div style={{ flex: 1, height: '1px', background: inputBorder }} />
              <span style={{ fontSize: '12px', color: textMuted }}>
                {mode === 'signup' ? 'already have an account?' : "don't have an account?"}
              </span>
              <div style={{ flex: 1, height: '1px', background: inputBorder }} />
            </div>

            <button onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError('') }} style={{
              display: 'block', width: '100%', textAlign: 'center', padding: '12px',
              border: `1px solid ${inputBorder}`, borderRadius: '10px', fontSize: '14px',
              fontWeight: '600', color: textSec, background: 'none', cursor: 'pointer',
            }}>
              {mode === 'signup' ? 'Sign In' : 'Create Free Account'}
            </button>

            <button onClick={dismiss} style={{
              display: 'block', width: '100%', textAlign: 'center', marginTop: '14px',
              fontSize: '13px', color: textMuted, background: 'none', border: 'none', cursor: 'pointer',
              textDecoration: 'underline',
            }}>
              Continue as guest
            </button>
          </>
        )}
      </div>

      <style>{`@keyframes fadeInModal { from { opacity: 0 } to { opacity: 1 } }`}</style>
    </div>
  )
}
