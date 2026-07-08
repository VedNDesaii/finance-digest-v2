'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const STORAGE_KEY = 'fd_welcome_seen'

export default function WelcomeModal({ dark, user }) {
  const [show, setShow] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [mode, setMode] = useState('signup') // 'signup' | 'login' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  useEffect(() => {
    if (user) return // logged-in users never see this

    const standalone = window.navigator.standalone === true ||
                       window.matchMedia('(display-mode: standalone)').matches
    setIsStandalone(standalone)

    const seen = localStorage.getItem(STORAGE_KEY)
    // In standalone mode — always show until logged in (compulsory)
    // In browser mode — show once, dismissable
    if (standalone || !seen) setShow(true)
  }, [user])

  function dismiss() {
    // Compulsory in standalone mode — cannot dismiss without logging in
    if (isStandalone) return
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

  async function handleForgotPassword(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) { setError(error.message); setLoading(false) }
    else { setResetSent(true); setLoading(false) }
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
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', fontFamily: 'sans-serif',
    }}>
      <div style={{
        background: cardBg, borderRadius: '20px', padding: '36px',
        width: '100%', maxWidth: '420px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        border: `1px solid ${inputBorder}`,
        position: 'relative', maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Only show close button in browser mode (not standalone) */}
        {!isStandalone && mode !== 'forgot' && (
          <button onClick={dismiss} style={{
            position: 'absolute', top: '16px', right: '16px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: textMuted, fontSize: '20px', lineHeight: 1, padding: '4px',
          }}>×</button>
        )}

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: textPri, fontFamily: 'Georgia, serif', margin: '0 0 6px' }}>
            Finance <span style={{ color: '#C9A84C' }}>Digest</span>
          </h1>
          {isStandalone && (
            <p style={{ color: '#C9A84C', fontSize: '11px', fontWeight: '600', letterSpacing: '0.05em', margin: '0 0 4px', textTransform: 'uppercase' }}>
              Welcome to the app
            </p>
          )}
          <p style={{ color: textMuted, fontSize: '14px', margin: 0 }}>
            {mode === 'signup' ? 'Create your free account' : mode === 'login' ? 'Sign in to your account' : 'Reset your password'}
          </p>
        </div>

        {/* Standalone mode message */}
        {isStandalone && !success && (
          <div style={{
            background: dark ? 'rgba(201,168,76,0.08)' : 'rgba(201,168,76,0.06)',
            border: '1px solid rgba(201,168,76,0.3)',
            borderRadius: '10px', padding: '10px 14px', marginBottom: '20px',
            fontSize: '12px', color: textSec, textAlign: 'center', lineHeight: 1.5,
          }}>
            Sign up or log in to access Finance Digest and enable notifications 🔔
          </div>
        )}

        {success && (
          <div style={{ background: '#d4edda', border: '1px solid #28a745', borderRadius: '10px', padding: '16px', marginBottom: '20px', fontSize: '14px', color: '#155724', textAlign: 'center' }}>
            ✅ {mode === 'signup' ? 'Account created!' : 'Check your email for a reset link.'}
          </div>
        )}

        {error && (
          <div style={{ background: '#FFF3CD', border: '1px solid #ffc107', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#856404' }}>
            {error}
          </div>
        )}

        {/* Signup form */}
        {!success && mode === 'signup' && (
          <form onSubmit={handleSignup}>
            <FieldLabel text="Email" textSec={textSec} />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com"
              style={inputStyle(inputBg, inputBorder, textPri)} />

            <FieldLabel text="Password" textSec={textSec} />
            <PasswordField value={password} onChange={setPassword} show={showPassword} setShow={setShowPassword}
              placeholder="Min 6 characters" inputBg={inputBg} inputBorder={inputBorder} textPri={textPri} textMuted={textMuted} />

            <FieldLabel text="Confirm Password" textSec={textSec} />
            <PasswordField value={confirm} onChange={setConfirm} show={showPassword} setShow={setShowPassword}
              placeholder="••••••••" inputBg={inputBg} inputBorder={inputBorder} textPri={textPri} textMuted={textMuted} marginBottom="24px" />

            <button type="submit" disabled={loading} style={submitStyle(loading)}>
              {loading ? 'Creating account...' : 'Create Free Account'}
            </button>
          </form>
        )}

        {/* Login form */}
        {!success && mode === 'login' && (
          <form onSubmit={handleLogin}>
            <FieldLabel text="Email" textSec={textSec} />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com"
              style={inputStyle(inputBg, inputBorder, textPri)} />

            <FieldLabel text="Password" textSec={textSec} />
            <PasswordField value={password} onChange={setPassword} show={showPassword} setShow={setShowPassword}
              placeholder="••••••••" inputBg={inputBg} inputBorder={inputBorder} textPri={textPri} textMuted={textMuted} marginBottom="10px" />

            <button type="button" onClick={() => { setMode('forgot'); setError(''); setResetSent(false) }} style={{
              display: 'block', textAlign: 'right', width: '100%', marginBottom: '14px',
              fontSize: '12px', color: textMuted, background: 'none', border: 'none', cursor: 'pointer',
              textDecoration: 'underline', padding: 0,
            }}>
              Forgot password?
            </button>

            <button type="submit" disabled={loading} style={submitStyle(loading)}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {/* Forgot password */}
        {mode === 'forgot' && (
          <>
            {resetSent ? (
              <div style={{ background: '#d4edda', border: '1px solid #28a745', borderRadius: '10px', padding: '16px', marginBottom: '20px', fontSize: '14px', color: '#155724', textAlign: 'center' }}>
                ✅ Check your email for a password reset link.
              </div>
            ) : (
              <form onSubmit={handleForgotPassword}>
                <p style={{ fontSize: '13px', color: textMuted, margin: '0 0 16px' }}>
                  Enter your email and we'll send you a link to reset your password.
                </p>
                <FieldLabel text="Email" textSec={textSec} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com"
                  style={{ ...inputStyle(inputBg, inputBorder, textPri), marginBottom: '24px' }} />
                <button type="submit" disabled={loading} style={submitStyle(loading)}>
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
            )}
            <button onClick={() => { setMode('login'); setError(''); setResetSent(false) }} style={{
              display: 'block', width: '100%', textAlign: 'center', marginTop: '16px',
              fontSize: '13px', color: textMuted, background: 'none', border: 'none', cursor: 'pointer',
              textDecoration: 'underline',
            }}>
              ← Back to sign in
            </button>
          </>
        )}

        {/* Toggle signup/login + guest option */}
        {!success && mode !== 'forgot' && (
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

            {/* Only show "Continue as guest" in browser mode, not standalone */}
            {!isStandalone && (
              <button onClick={dismiss} style={{
                display: 'block', width: '100%', textAlign: 'center', marginTop: '14px',
                fontSize: '13px', color: textMuted, background: 'none', border: 'none', cursor: 'pointer',
                textDecoration: 'underline',
              }}>
                Continue as guest
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function FieldLabel({ text, textSec }) {
  return (
    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: textSec, marginBottom: '6px' }}>
      {text}
    </label>
  )
}

function PasswordField({ value, onChange, show, setShow, placeholder, inputBg, inputBorder, textPri, textMuted, marginBottom = '16px' }) {
  return (
    <div style={{ position: 'relative', marginBottom }}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        required
        placeholder={placeholder}
        style={{
          width: '100%', padding: '12px 44px 12px 14px', border: `1px solid ${inputBorder}`,
          borderRadius: '10px', fontSize: '14px', outline: 'none',
          boxSizing: 'border-box', color: textPri, background: inputBg,
        }}
      />
      <button type="button" onClick={() => setShow(s => !s)} style={{
        position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
        background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px',
        color: textMuted, padding: '4px', lineHeight: 1,
      }} tabIndex={-1}>
        {show ? '🙈' : '👁️'}
      </button>
    </div>
  )
}

function inputStyle(bg, border, color) {
  return {
    width: '100%', padding: '12px 14px', border: `1px solid ${border}`,
    borderRadius: '10px', fontSize: '14px', outline: 'none',
    boxSizing: 'border-box', color, background: bg, marginBottom: '16px',
  }
}

function submitStyle(loading) {
  return {
    width: '100%', padding: '13px',
    background: loading ? '#d4b870' : '#C9A84C',
    color: '#fff', border: 'none', borderRadius: '10px',
    fontSize: '15px', fontWeight: '700',
    cursor: loading ? 'not-allowed' : 'pointer',
  }
}