'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function AccountPage() {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      setLoading(false)
    }
    load()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', color: '#9a8e7e' }}>Email</span>
            <span style={{ fontSize: '14px', color: '#1a1410', fontWeight: '600' }}>{user?.email}</span>
          </div>
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