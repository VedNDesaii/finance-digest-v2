'use client'
import { useState, useEffect } from 'react'

export default function AdminStatsPage() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 15000)
    return () => clearInterval(interval)
  }, [])

  async function fetchStats() {
    try {
      const res = await fetch('/api/visitors')
      const data = await res.json()
      if (data.error) setError(data.error)
      else setStats(data)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#1A1410', display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif',
    }}>
      <div style={{
        background: '#1e1a15', border: '1px solid rgba(201,168,76,0.2)',
        borderRadius: '20px', padding: '40px', minWidth: '320px', textAlign: 'center',
      }}>
        <h1 style={{ color: '#C9A84C', fontSize: '20px', margin: '0 0 24px', fontFamily: 'Georgia, serif' }}>
          Finance Digest · Visitor Stats
        </h1>

        {error && <p style={{ color: '#F87171', fontSize: '13px' }}>{error}</p>}

        {stats && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <p style={{ color: '#6b6055', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 6px' }}>
                Currently Viewing
              </p>
              <p style={{ color: '#4ADE80', fontSize: '36px', fontWeight: '700', margin: 0 }}>
                {stats.activeNow}
              </p>
            </div>
            <div>
              <p style={{ color: '#6b6055', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 6px' }}>
                Total Visits Ever
              </p>
              <p style={{ color: '#fff', fontSize: '28px', fontWeight: '700', margin: 0 }}>
                {stats.totalEver}
              </p>
            </div>
          </div>
        )}

        <p style={{ color: '#4a3f35', fontSize: '11px', marginTop: '24px' }}>
          Auto-refreshes every 15s
        </p>
      </div>
    </div>
  )
}