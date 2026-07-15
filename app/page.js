'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '../lib/supabase'
import ArticleCard from '../components/ArticleCard'
import NewsReader from '../components/NewsReader'
import { useAuth } from '../hooks/useAuth'
import WelcomeModal from '../components/WelcomeModal'
import { registerPushNotification, touchLastSeen } from '../lib/pushNotifications'

// Portfolio only renders on its own tab — load it on demand so the homepage
// doesn't ship its weight to every visitor (matters for memory-limited
// in-app browsers like Instagram's).
const MyPortfolio = dynamic(() => import('../components/MyPortfolio'), {
  ssr: false,
  loading: () => null,
})

// Safe storage — in-app browsers (Instagram, etc.) can block localStorage and
// throw on access. An unguarded throw in a mount effect collapses the page,
// which is why the site failed to load in Instagram's Android browser.
const safeLS = {
  getItem(key) {
    try { return typeof localStorage !== 'undefined' ? safeLS.getItem(key) : null }
    catch { return null }
  },
  setItem(key, val) {
    try { if (typeof localStorage !== 'undefined') safeLS.setItem(key, val) }
    catch { /* storage blocked — ignore */ }
  },
}

function safeParse(str, fallback) {
  try { return JSON.parse(str) } catch { return fallback }
}

const BOTTOM_TABS = [
  { id: 'top',       icon: '📰', label: 'Briefing' },
  { id: 'markets',   icon: '📈', label: 'Markets' },
  { id: 'sectors',   icon: '🏭', label: 'Sectors' },
  { id: 'portfolio', icon: '💰', label: 'Portfolio' },
]

const MARKETS_SECTIONS = [
  { id: 'indian-markets', label: 'Indian Markets', icon: '🇮🇳' },
  { id: 'us-markets',     label: 'US Markets',     icon: '🇺🇸' },
  { id: 'global-economy', label: 'Global Economy', icon: '🌐' },
]

const SECTORS_SECTIONS = [
  { id: 'technology-it',  label: 'Tech & IT',   icon: '💻' },
  { id: 'energy-oil',     label: 'Energy',      icon: '⛽' },
  { id: 'pharma-health',  label: 'Pharma',      icon: '💊' },
  { id: 'auto-ev',        label: 'Auto & EV',   icon: '🚗' },
  { id: 'metals-mining',  label: 'Metals',      icon: '⚙️' },
  { id: 'renewables',     label: 'Renewables',  icon: '☀️' },
  { id: 'real-estate',    label: 'Real Estate', icon: '🏠' },
  { id: 'infrastructure', label: 'Infra',       icon: '🔧' },
  { id: 'fmcg-consumer',  label: 'FMCG',        icon: '🛒' },
  { id: 'telecom-media',  label: 'Telecom',     icon: '📡' },
]

const ALL_SECTIONS = [
  { id: 'headlines',       label: 'Daily Briefing'   },
  { id: 'quiz',            label: 'Daily Quiz'        },
  { id: 'indian-markets',  label: 'Indian Markets'    },
  { id: 'us-markets',      label: 'US Markets'        },
  { id: 'global-economy',  label: 'Global Economy'    },
  { id: 'macro-policy',    label: 'Macro & Policy'    },
  { id: 'banking-finance', label: 'Banking & Finance' },
  { id: 'technology-it',   label: 'Technology & IT'   },
  { id: 'energy-oil',      label: 'Energy & Oil'      },
  { id: 'pharma-health',   label: 'Pharma & Health'   },
  { id: 'auto-ev',         label: 'Auto & EV'         },
  { id: 'metals-mining',   label: 'Metals & Mining'   },
  { id: 'renewables',      label: 'Renewables'        },
  { id: 'real-estate',     label: 'Real Estate'       },
  { id: 'infrastructure',  label: 'Infrastructure'    },
  { id: 'fmcg-consumer',   label: 'FMCG & Consumer'   },
  { id: 'telecom-media',   label: 'Telecom & Media'   },
  { id: 'portfolio',       label: 'My Portfolio'      },
]

const SECTOR_IDS = [
  'technology-it','energy-oil','pharma-health','auto-ev','metals-mining',
  'renewables','real-estate','infrastructure','fmcg-consumer','telecom-media',
]

const ALL_BADGES = [
  { id: 'streak7',    emoji: '🔥', name: 'On Fire',       desc: '7 day reading streak'           },
  { id: 'streak30',   emoji: '💎', name: 'Diamond',       desc: '30 day reading streak'          },
  { id: 'predict3',   emoji: '🎯', name: 'Sharp Eye',     desc: '3 correct predictions in a row' },
  { id: 'quiz10',     emoji: '🧠', name: 'Quiz Master',   desc: 'Answered 10 daily quizzes'      },
  { id: 'articles50', emoji: '📚', name: 'News Junkie',   desc: 'Read 50 articles'               },
  { id: 'iq500',      emoji: '🏆', name: 'Market Expert', desc: 'Reached 500 Finance IQ'         },
  { id: 'earlybird',  emoji: '🌅', name: 'Early Bird',    desc: 'Read before 9 AM'               },
]

function getIQLevel(iq) {
  if (iq >= 2500) return { title: 'Market Expert',      color: '#C9A84C' }
  if (iq >= 1000) return { title: 'Savvy Investor',     color: '#E8973E' }
  if (iq >= 500)  return { title: 'Finance Enthusiast', color: '#4ADE80' }
  if (iq >= 100)  return { title: 'Market Watcher',     color: '#60A5FA' }
  return                  { title: 'Curious Reader',    color: '#9A8E7E' }
}

function isAfterMarketClose() {
  const now  = new Date()
  const ist  = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const day  = ist.getDay()
  const mins = ist.getHours() * 60 + ist.getMinutes()
  if (day === 0 || day === 6) return true
  return mins >= 930
}

function isMarketOpen() {
  const now  = new Date()
  const ist  = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const day  = ist.getDay()
  const mins = ist.getHours() * 60 + ist.getMinutes()
  if (day === 0 || day === 6) return false
  return mins >= 555 && mins <= 930
}

function isWeekend() {
  const now = new Date()
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  return ist.getDay() === 0 || ist.getDay() === 6
}

function getActiveMobileTab(section) {
  if (section === 'headlines') return 'top'
  if (section === 'quiz') return 'top'
  if (['indian-markets','us-markets','global-economy','macro-policy','banking-finance'].includes(section)) return 'markets'
  if (SECTOR_IDS.includes(section)) return 'sectors'
  if (section === 'portfolio') return 'portfolio'
  return 'top'
}

// ── Small components ──────────────────────────────────────────────────────────

function IndexChip({ label, data, dark }) {
  if (!data?.price) return null
  const up = parseFloat(data.change) >= 0
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '5px',
      background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      borderRadius: '8px', padding: '4px 10px',
      border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
    }}>
      <span style={{ fontSize: '10px', fontFamily: 'var(--font-ui)', fontWeight: '700',
        letterSpacing: '0.04em', textTransform: 'uppercase', color: dark ? '#6B6055' : '#9A8E7E' }}>
        {label}
      </span>
      <span style={{ fontSize: '12px', fontWeight: '700', fontFamily: 'var(--font-ui)', color: dark ? '#F0EBE3' : '#1A1410' }}>
        {data.price}
      </span>
      <span style={{ fontSize: '11px', fontWeight: '600', fontFamily: 'var(--font-ui)', color: up ? '#4ADE80' : '#F87171' }}>
        {up ? '▲' : '▼'} {Math.abs(data.pct)}%
      </span>
    </div>
  )
}

function IQChip({ iq, dark }) {
  const level = getIQLevel(iq)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '4px',
      background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      borderRadius: '8px', padding: '4px 10px',
      border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
      flexShrink: 0,
    }}>
      <span style={{ fontSize: '12px' }}>🧠</span>
      <span style={{ fontSize: '12px', fontWeight: '700', color: level.color, fontFamily: 'var(--font-ui)' }}>{iq}</span>
    </div>
  )
}

function ThemeToggle({ dark, onToggle }) {
  return (
    <button onClick={onToggle} style={{
      display: 'flex', alignItems: 'center', gap: '5px',
      padding: '5px 10px', borderRadius: '8px', border: 'none',
      background: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
      color: dark ? '#F0EBE3' : '#1A1410', cursor: 'pointer', flexShrink: 0,
    }}>
      <span style={{ fontSize: '13px' }}>{dark ? '☀️' : '🌙'}</span>
      <span style={{ fontSize: '11px', fontWeight: '600', fontFamily: 'var(--font-ui)', color: dark ? '#9A8E7E' : '#7A6B5A' }}>
        {dark ? 'Light' : 'Dark'}
      </span>
    </button>
  )
}

function AccountButton({ dark, user }) {
  return (
    <a href={user ? '/account' : '/login'} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: '32px', height: '32px', borderRadius: '8px',
      background: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
      color: dark ? '#F0EBE3' : '#1A1410', cursor: 'pointer', flexShrink: 0,
      textDecoration: 'none', fontSize: '16px',
    }}>
      👤
    </a>
  )
}

function NotificationBell({ dark }) {
  const [status, setStatus] = useState('default')

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    // Reflect the real push subscription, not just the permission grant.
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (sub) {
          setStatus('subscribed')
          touchLastSeen().catch(() => {})
        } else if (Notification.permission === 'denied') {
          setStatus('denied')
        }
      })
      .catch(() => {})
  }, [])

  async function handleClick() {
    try {
      const ok = await registerPushNotification()
      if (ok) {
        setStatus('subscribed')
      } else if (Notification.permission === 'denied') {
        setStatus('denied')
      }
    } catch (e) {
      console.error('Bell error:', e)
    }
  }

  return (
    <button
      onClick={handleClick}
      title={status === 'subscribed' ? 'Notifications on' : 'Enable notifications'}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '32px', height: '32px', borderRadius: '8px', border: 'none',
        background: status === 'subscribed'
          ? (dark ? 'rgba(201,168,76,0.2)' : 'rgba(201,168,76,0.15)')
          : (dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'),
        cursor: 'pointer', fontSize: '15px', flexShrink: 0,
        transition: 'all 0.2s ease',
      }}>
      {status === 'subscribed' ? '🔔' : '🔔'}
    </button>
  )
}


function InstallBanner({ dark }) {
  const [show, setShow] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [info, setInfo] = useState({ icon: '📲', title: '', steps: [], device: '' })

  useEffect(() => {
    const ua = navigator.userAgent
    const isIOS        = /iphone|ipad|ipod/i.test(ua)
    const isAndroid    = /android/i.test(ua)
    const isChrome     = /chrome|crios/i.test(ua) && !/edg/i.test(ua)
    const isSafari     = /^((?!chrome|android).)*safari/i.test(ua)
    const isFirefox    = /firefox|fxios/i.test(ua)
    const isStandalone = window.navigator.standalone === true ||
                         window.matchMedia('(display-mode: standalone)').matches
    const notifGranted = 'Notification' in window && Notification.permission === 'granted'

    if (isStandalone || notifGranted) return

    if (isIOS && isSafari) {
      setInfo({ icon: '📲', device: 'iPhone', title: 'Add to Home Screen to get notifications', steps: [
        { num: '1', text: 'Tap the Share button', sub: '□↑ at the bottom of Safari' },
        { num: '2', text: 'Tap "Add to Home Screen"', sub: 'Scroll down if you do not see it'},
        { num: '3', text: 'Open Finance Digest from your Home Screen', sub: 'Then tap 🔔 to enable notifications' },
      ]})
      setShow(true)
    } else if (isIOS && isChrome) {
      setInfo({ icon: '📲', device: 'iPhone', title: 'Open in Safari to install', steps: [
        { num: '1', text: 'Open Safari', sub: 'This feature requires Safari on iPhone' },
        { num: '2', text: 'Go to financedigest.xyz', sub: 'Then tap Share □↑ → Add to Home Screen' },
        { num: '3', text: 'Open from Home Screen & tap 🔔', sub: 'To enable notifications' },
      ]})
      setShow(true)
    } else if (isAndroid && isChrome) {
      setInfo({ icon: '📲', device: 'Android', title: 'Add to Home Screen to get notifications', steps: [
        { num: '1', text: 'Tap the ⋮ menu', sub: 'Top right corner of Chrome' },
        { num: '2', text: 'Tap "Add to Home Screen" or "Install app"', sub: 'Then tap Install to confirm' },
        { num: '3', text: 'Open Finance Digest from your Home Screen', sub: 'Then tap 🔔 to enable notifications' },
      ]})
      setShow(true)
    } else if (isAndroid && isFirefox) {
      setInfo({ icon: '📲', device: 'Android', title: 'Install the app to get notifications', steps: [
        { num: '1', text: 'Tap the ⋮ menu', sub: 'Top right corner of Firefox' },
        { num: '2', text: 'Tap "Install"', sub: 'Then confirm installation' },
        { num: '3', text: 'Open Finance Digest from your Home Screen', sub: 'Then tap 🔔 to enable notifications' },
      ]})
      setShow(true)
    } else if (isAndroid) {
      setInfo({ icon: '📲', device: 'Android', title: 'Use Chrome to install the app', steps: [
        { num: '1', text: 'Open Chrome browser', sub: 'This works best in Chrome' },
        { num: '2', text: 'Go to financedigest.xyz', sub: 'Then tap ⋮ → Add to Home Screen' },
        { num: '3', text: 'Open from Home Screen & tap 🔔', sub: 'To enable notifications' },
      ]})
      setShow(true)
    }
  }, [])

  if (!show) return null

  const textPri   = dark ? '#F0EBE3' : '#1A1410'
  const textSec   = dark ? '#9A8E7E' : '#6B5E4E'
  const textMuted = dark ? '#6B6055' : '#B8AFA3'
  const borderCol = dark ? '#2C2822' : '#EDE8E0'
  const sheetBg   = dark ? '#1A1410' : '#FFFFFF'

  // Minimized pill
  if (minimized) return (
    <button onClick={() => setMinimized(false)} style={{
      position: 'fixed', bottom: '90px', right: '16px', zIndex: 50,
      background: 'linear-gradient(135deg, #C9A84C, #E8C97A)',
      border: 'none', borderRadius: '99px', padding: '10px 18px',
      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
      boxShadow: '0 4px 20px rgba(201,168,76,0.5)',
      animation: 'pillPulse 2s ease-in-out infinite',
    }}>
      <span style={{ fontSize: '16px' }}>🔔</span>
      <span style={{ fontSize: '13px', fontWeight: '700', color: '#1A1410', fontFamily: 'var(--font-ui)' }}>
        Enable Notifications
      </span>
      <style>{`@keyframes pillPulse { 0%,100% { box-shadow: 0 4px 20px rgba(201,168,76,0.5); } 50% { box-shadow: 0 4px 32px rgba(201,168,76,0.8); } }`}</style>
    </button>
  )

  // Full bottom sheet
  return (
    <>
      {/* Dim backdrop */}
      <div onClick={() => setMinimized(true)} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(2px)', zIndex: 48,
      }} />

      {/* Bottom sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: sheetBg, borderRadius: '24px 24px 0 0',
        zIndex: 49, padding: '0 0 40px',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.3)',
        animation: 'sheetUp 0.35s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
          <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: borderCol }} />
        </div>

        {/* Gold accent bar */}
        <div style={{ height: '2px', background: 'linear-gradient(90deg, #C9A84C, #E8C97A, #C9A84C)', margin: '0 24px 20px', borderRadius: '1px' }} />

        {/* Header */}
        <div style={{ padding: '0 24px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span style={{ fontSize: '28px' }}>🔔</span>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: textPri, fontFamily: 'var(--font-display)' }}>
                {info.title}
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: textMuted, fontFamily: 'var(--font-ui)' }}>
              Get breaking market news the moment it drops
            </p>
          </div>
          <button onClick={() => setMinimized(true)} style={{
            background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
            border: 'none', borderRadius: '8px', width: '32px', height: '32px',
            cursor: 'pointer', fontSize: '16px', color: textMuted,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>×</button>
        </div>

        {/* Steps */}
        <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {info.steps.map((step, i) => (
            <div key={i} style={{
              display: 'flex', gap: '14px', alignItems: 'flex-start',
              padding: '12px 14px', borderRadius: '12px',
              background: dark ? 'rgba(255,255,255,0.04)' : '#F7F4EF',
              border: `1px solid ${borderCol}`,
            }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #C9A84C, #E8C97A)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', fontWeight: '800', color: '#1A1410', fontFamily: 'var(--font-ui)',
              }}>{step.num}</div>
              <div>
                <p style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: '600', color: textPri, fontFamily: 'var(--font-ui)' }}>
                  {step.text}
                </p>
                <p style={{ margin: 0, fontSize: '12px', color: textMuted, fontFamily: 'var(--font-ui)' }}>
                  {step.sub}
                </p>
              </div>
            </div>
          ))}
        </div>

        <style>{`@keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
      </div>
    </>
  )
}

function Badge({ count, active, dark }) {
  if (!count && count !== 0) return null
  return (
    <span style={{
      fontSize: '10px', fontWeight: '700',
      background: active ? 'var(--accent)' : (dark ? 'rgba(232,151,62,0.15)' : 'rgba(212,135,60,0.12)'),
      color: active ? '#1A1410' : 'var(--accent)',
      padding: '2px 7px', borderRadius: '99px',
      fontFamily: 'var(--font-ui)', minWidth: '20px',
      textAlign: 'center', flexShrink: 0,
    }}>{count}</span>
  )
}

// ── MarketSummaryCard ─────────────────────────────────────────────────────────

function MarketSummaryCard({ market, dark, isMobile }) {
  const isIndia = market === 'indian-markets'
  const [collapsed, setCollapsed] = useState(false)
  const [summaryData, setSummaryData] = useState(null)
  const [loading, setLoading] = useState(true)

  const accentColor  = isIndia ? '#E8650A' : '#3B82F6'
  const accentLight  = isIndia
    ? (dark ? 'rgba(232,101,10,0.10)' : 'rgba(232,101,10,0.06)')
    : (dark ? 'rgba(59,130,246,0.10)' : 'rgba(59,130,246,0.06)')
  const accentBorder = isIndia
    ? (dark ? 'rgba(232,101,10,0.25)' : 'rgba(232,101,10,0.18)')
    : (dark ? 'rgba(59,130,246,0.25)' : 'rgba(59,130,246,0.18)')
  const gradientBar  = isIndia
    ? 'linear-gradient(90deg, #FF9933, #E8650A, #FF6B00)'
    : 'linear-gradient(90deg, #3B82F6, #6366F1, #8B5CF6)'

  useEffect(() => {
    async function fetchSummary() {
      setLoading(true)
      try {
        const res = await fetch('/market-data.json', { cache: 'no-store' })
        const json = await res.json()
        const data = isIndia ? json.indian : json.us
        if (data && Object.keys(data).length > 0) setSummaryData(data)
      } catch (e) {
        console.error('Market summary fetch failed', e)
      }
      setLoading(false)
    }
    fetchSummary()
  }, [market])

  const now = new Date()
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const istMins = ist.getHours() * 60 + ist.getMinutes()
  const istDay  = ist.getDay()
  const isWeekendNow = istDay === 0 || istDay === 6

  let marketStatus, statusColor, statusBg, statusBorder
  if (isIndia) {
    const open = !isWeekendNow && istMins >= 555 && istMins <= 930
    marketStatus  = open ? 'Live' : 'Closed'
    statusColor   = open ? '#16A34A' : '#DC2626'
    statusBg      = open ? (dark ? 'rgba(22,163,74,0.12)' : '#F0FDF4') : (dark ? 'rgba(220,38,38,0.12)' : '#FEF2F2')
    statusBorder  = open ? (dark ? 'rgba(22,163,74,0.3)' : '#BBF7D0') : (dark ? 'rgba(220,38,38,0.3)' : '#FECACA')
  } else {
    const usOpen = !isWeekendNow && (istMins >= 1170 || istMins <= 240)
    marketStatus  = usOpen ? 'Live' : 'Closed'
    statusColor   = usOpen ? '#16A34A' : '#DC2626'
    statusBg      = usOpen ? (dark ? 'rgba(22,163,74,0.12)' : '#F0FDF4') : (dark ? 'rgba(220,38,38,0.12)' : '#FEF2F2')
    statusBorder  = usOpen ? (dark ? 'rgba(22,163,74,0.3)' : '#BBF7D0') : (dark ? 'rgba(220,38,38,0.3)' : '#FECACA')
  }

  const cardBg    = dark ? '#1A1410' : '#FFFFFF'
  const borderCol = dark ? '#2C2822' : '#EDE8E0'
  const textPri   = dark ? '#F0EBE3' : '#1A1410'
  const textSec   = dark ? '#9A8E7E' : '#6B5E4E'
  const textMuted = dark ? '#4A4438' : '#B8AFA3'
  const tileBg    = dark ? 'rgba(255,255,255,0.03)' : '#FAFAF7'
  const barTrack  = dark ? '#2C2822' : '#F0EDE8'

  const fallback = isIndia ? {
    headline: 'Markets fell for a third session as FII selling continued — banking held up, but IT and auto stocks dragged Nifty below 24,700.',
    indices: [
      { label: 'Sensex',    value: '81,234', change: '▼ 312', pct: '−0.38%', up: false },
      { label: 'Nifty 50',  value: '24,678', change: '▼ 94',  pct: '−0.38%', up: false },
      { label: 'Bank Nifty',value: '52,110', change: '▲ 128', pct: '+0.25%',  up: true  },
    ],
    tiles: [
      { icon: '🌍', label: 'Global Cues',  value: 'Weak',           sub: 'US Futures −0.4%', subUp: false },
      { icon: '🏦', label: 'FII Activity', value: 'Sold ₹2,100 Cr', sub: '3rd day selling',  subUp: null  },
      { icon: '🛢',  label: 'Crude Oil',   value: '$84.2 / bbl',    sub: 'Up 1.2% today',    subUp: false },
    ],
    sectors: [
      { name: 'Banking', pct: 0.3  },
      { name: 'IT',      pct: -1.1 },
      { name: 'Auto',    pct: -0.8 },
      { name: 'FMCG',    pct: 0.2  },
    ],
    watch: 'RBI credit policy minutes release + US PCE inflation could set the mood for markets this week.',
    updatedAt: '5:00 PM IST',
  } : {
    headline: 'Wall Street rebounded strongly — Nvidia\'s blowout earnings lifted the entire tech sector.',
    indices: [
      { label: 'S&P 500',   value: '5,304',  change: '▲ 38',  pct: '+0.72%', up: true },
      { label: 'Nasdaq',    value: '16,780', change: '▲ 142', pct: '+0.85%', up: true },
      { label: 'Dow Jones', value: '39,112', change: '▲ 210', pct: '+0.54%', up: true },
    ],
    tiles: [
      { icon: '📈', label: 'Big Mover',  value: 'Nvidia +9%', sub: 'Record earnings',      subUp: true },
      { icon: '💰', label: 'Inflation',  value: 'CPI 3.1%',   sub: 'Better than expected', subUp: true },
      { icon: '🏛', label: '10yr Yield', value: '4.42%',      sub: 'Fell 6 bps',           subUp: true },
    ],
    sectors: [
      { name: 'Tech',       pct: 1.4  },
      { name: 'Energy',     pct: -0.5 },
      { name: 'Financials', pct: 0.7  },
      { name: 'Healthcare', pct: 0.3  },
    ],
    watch: 'Fed chair Powell speaks at 7:30 PM IST — markets will react sharply if he hints at rate cuts being delayed.',
    updatedAt: '11:30 PM IST',
  }

  const display = summaryData ? {
    headline:  summaryData.headline  || fallback.headline,
    indices:   summaryData.indices   || fallback.indices,
    tiles:     summaryData.tiles     || fallback.tiles,
    sectors:   summaryData.sectors   || fallback.sectors,
    watch:     summaryData.watch     || fallback.watch,
    updatedAt: summaryData.updated_at
      ? new Date(summaryData.updated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) + ' IST'
      : fallback.updatedAt,
  } : fallback

  const maxAbsPct = Math.max(...display.sectors.map(s => Math.abs(s.pct)), 0.1)

  return (
    <div style={{ background: cardBg, border: `1px solid ${borderCol}`, borderRadius: '16px',
      overflow: 'hidden', marginBottom: '24px',
      boxShadow: dark ? '0 2px 12px rgba(0,0,0,0.3)' : '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)' }}>

      <div style={{ height: '3px', background: gradientBar }} />

      <div style={{ padding: isMobile ? '13px 14px 10px' : '15px 18px 11px',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        borderBottom: `1px solid ${borderCol}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px', flexShrink: 0, background: accentLight, border: `1px solid ${accentBorder}` }}>
            {isIndia ? '🇮🇳' : '🇺🇸'}
          </div>
          <div>
            <div style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: '700', color: textPri, fontFamily: 'var(--font-display)', letterSpacing: '-0.2px' }}>
              {isIndia ? 'Indian Market Summary' : 'US Market Summary'}
            </div>
            <div style={{ fontSize: '11px', color: textMuted, fontFamily: 'var(--font-ui)', marginTop: '1px' }}>
              {isIndia ? 'NSE / BSE · 3:30 PM IST close' : 'NYSE / NASDAQ · 4:00 AM IST close'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <span style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.8px',
            textTransform: 'uppercase', padding: '3px 9px', borderRadius: '20px',
            fontFamily: 'var(--font-ui)', background: statusBg, color: statusColor,
            border: `1px solid ${statusBorder}`, display: 'flex', alignItems: 'center', gap: '4px' }}>
            {marketStatus === 'Live' && (
              <span style={{ width: '5px', height: '5px', borderRadius: '50%',
                background: '#16A34A', display: 'inline-block', animation: 'livePulse 1.5s infinite' }} />
            )}
            {marketStatus}
          </span>
          <button onClick={() => setCollapsed(c => !c)} style={{
            background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
            border: `1px solid ${borderCol}`, color: textMuted, borderRadius: '7px',
            padding: '4px 9px', fontSize: '11px', cursor: 'pointer',
            fontFamily: 'var(--font-ui)', fontWeight: '600',
            display: 'flex', alignItems: 'center', gap: '3px' }}>
            {collapsed ? '▼ Show' : '▲ Hide'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: `1px solid ${borderCol}` }}>
        {display.indices.map((idx, i) => (
          <div key={i} style={{ flex: 1, padding: isMobile ? '10px 10px' : '12px 14px',
            borderRight: i < display.indices.length - 1 ? `1px solid ${borderCol}` : 'none' }}>
            <div style={{ fontSize: '9px', fontWeight: '700', letterSpacing: '1.2px', textTransform: 'uppercase', color: textMuted, fontFamily: 'var(--font-ui)', marginBottom: '4px' }}>{idx.label}</div>
            <div style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: '700', color: textPri, fontFamily: 'var(--font-ui)', letterSpacing: '-0.5px', lineHeight: 1, marginBottom: '3px' }}>{loading ? '—' : idx.value}</div>
            <div style={{ fontSize: '11px', fontWeight: '600', fontFamily: 'var(--font-ui)', color: idx.up ? '#16A34A' : '#DC2626' }}>
              {loading ? '—' : <>{idx.change} <span style={{ opacity: 0.75 }}>({idx.pct})</span></>}
            </div>
          </div>
        ))}
      </div>

      {!collapsed && (
        <>
          <div style={{ padding: isMobile ? '12px 14px' : '14px 18px', borderBottom: `1px solid ${borderCol}`,
            borderLeft: `3px solid ${accentColor}`, background: accentLight }}>
            {loading
              ? <div style={{ height: '14px', background: dark ? '#2C2822' : '#EDE8E0', borderRadius: '4px', width: '80%' }} />
              : <p style={{ margin: 0, fontSize: isMobile ? '12px' : '13px', lineHeight: 1.65, color: textPri, fontStyle: 'italic', fontFamily: 'var(--font-display)' }}>{display.headline}</p>
            }
          </div>

          <div style={{ display: 'flex', borderBottom: `1px solid ${borderCol}` }}>
            {display.tiles.map((tile, i) => (
              <div key={i} style={{ flex: 1, padding: isMobile ? '10px 10px' : '12px 14px',
                borderRight: i < display.tiles.length - 1 ? `1px solid ${borderCol}` : 'none', background: tileBg }}>
                <div style={{ fontSize: '9px', fontWeight: '700', letterSpacing: '1.2px', textTransform: 'uppercase', color: textMuted, fontFamily: 'var(--font-ui)', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>{tile.icon}</span>{tile.label}
                </div>
                <div style={{ fontSize: isMobile ? '12px' : '13px', fontWeight: '700', color: textPri, fontFamily: 'var(--font-ui)', marginBottom: '2px' }}>{loading ? '—' : tile.value}</div>
                <div style={{ fontSize: '11px', fontFamily: 'var(--font-ui)', fontWeight: '600',
                  color: tile.subUp === true ? '#16A34A' : tile.subUp === false ? '#DC2626' : '#D97706' }}>
                  {loading ? '' : tile.sub}
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: isMobile ? '12px 14px' : '14px 18px', borderBottom: `1px solid ${borderCol}` }}>
            <div style={{ fontSize: '9px', fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase', color: textMuted, fontFamily: 'var(--font-ui)', marginBottom: '10px' }}>Sector Performance</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {display.sectors.map((sec, i) => {
                const isPos  = sec.pct >= 0
                const barPct = Math.round((Math.abs(sec.pct) / maxAbsPct) * 100)
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: isMobile ? '11px' : '12px', color: textSec, fontFamily: 'var(--font-ui)', width: isMobile ? '62px' : '72px', flexShrink: 0 }}>{sec.name}</span>
                    <div style={{ flex: 1, height: '5px', background: barTrack, borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: '99px', width: `${barPct}%`, background: isPos ? '#16A34A' : '#DC2626', transition: 'width 0.6s ease' }} />
                    </div>
                    <span style={{ fontSize: isMobile ? '11px' : '12px', fontWeight: '700', fontFamily: 'var(--font-ui)', width: '40px', textAlign: 'right', flexShrink: 0, color: isPos ? '#16A34A' : '#DC2626' }}>
                      {isPos ? '+' : ''}{sec.pct.toFixed(1)}%
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ padding: isMobile ? '11px 14px' : '12px 18px', borderBottom: `1px solid ${borderCol}`, display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <span style={{ fontSize: '15px', flexShrink: 0, marginTop: '1px' }}>👁</span>
            <p style={{ margin: 0, fontSize: isMobile ? '11px' : '12px', color: textSec, fontFamily: 'var(--font-ui)', lineHeight: 1.55 }}>
              <strong style={{ color: textPri }}>Watch {isIndia ? 'tomorrow' : 'tonight'}:</strong> {display.watch}
            </p>
          </div>

          <div style={{ padding: isMobile ? '9px 14px' : '10px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px', color: textMuted, fontFamily: 'var(--font-ui)', display: 'flex', alignItems: 'center', gap: '4px' }}>🕔 Last updated: {display.updatedAt}</span>
            <span style={{ fontSize: '10px', color: accentColor, fontWeight: '600', fontFamily: 'var(--font-ui)' }}>Finance Digest · AI Summary</span>
          </div>
        </>
      )}
      <style>{`@keyframes livePulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.7); } }`}</style>
    </div>
  )
}

// ── PredictionGame ────────────────────────────────────────────────────────────

function PredictionGame({ indices, prediction, predCorrect, afterClose, weekend, dark, isMobile, handlePrediction }) {
  const niftyPct    = parseFloat(indices.nifty?.pct || 0)
  const niftyWentUp = niftyPct >= 0

  if (weekend) return (
    <div style={{ borderRadius: '14px', marginBottom: '16px', overflow: 'hidden',
      border: `1px solid ${dark ? '#2C2822' : '#EDE8E0'}`, background: dark ? '#1A1410' : '#fff' }}>
      <div style={{ padding: '12px 16px', background: 'linear-gradient(90deg, #C9A84C, #E8C97A)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '16px' }}>🎯</span>
        <span style={{ fontSize: '11px', fontWeight: '700', color: '#1A1410', letterSpacing: '0.1em', fontFamily: 'var(--font-ui)' }}>MARKET PREDICTION</span>
      </div>
      <div style={{ padding: '16px', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '14px', color: dark ? '#6B6055' : '#9A8E7E', fontFamily: 'var(--font-ui)' }}>📅 Markets are closed on weekends. Come back Monday!</p>
      </div>
    </div>
  )

  return (
    <div style={{ borderRadius: '14px', marginBottom: '16px', overflow: 'hidden',
      border: `1px solid ${dark ? '#2C2822' : '#EDE8E0'}`, background: dark ? '#1A1410' : '#fff' }}>
      <div style={{ padding: '12px 16px', background: 'linear-gradient(90deg, #C9A84C, #E8C97A)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '16px' }}>🎯</span>
        <span style={{ fontSize: '11px', fontWeight: '700', color: '#1A1410', letterSpacing: '0.1em', fontFamily: 'var(--font-ui)' }}>DAILY MARKET PREDICTION</span>
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#1A1410', fontFamily: 'var(--font-ui)', opacity: 0.7 }}>+30 IQ if correct</span>
      </div>
      <div style={{ padding: '16px' }}>
        {!afterClose && !prediction && (
          <>
            <p style={{ margin: '0 0 14px', fontSize: isMobile ? '14px' : '15px', fontWeight: '600',
              color: dark ? '#F0EBE3' : '#1A1410', fontFamily: 'var(--font-display)', lineHeight: 1.4 }}>
              Will Nifty 50 close UP or DOWN today?
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => handlePrediction('up')} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.08)', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(74,222,128,0.18)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(74,222,128,0.08)'}>
                <div style={{ fontSize: '28px', marginBottom: '4px' }}>📈</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#4ADE80', fontFamily: 'var(--font-ui)' }}>UP</div>
              </button>
              <button onClick={() => handlePrediction('down')} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.08)', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.18)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(248,113,113,0.08)'}>
                <div style={{ fontSize: '28px', marginBottom: '4px' }}>📉</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#F87171', fontFamily: 'var(--font-ui)' }}>DOWN</div>
              </button>
            </div>
          </>
        )}
        {!afterClose && prediction && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>{prediction === 'up' ? '📈' : '📉'}</div>
            <p style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: '700', color: prediction === 'up' ? '#4ADE80' : '#F87171', fontFamily: 'var(--font-display)' }}>You predicted {prediction === 'up' ? 'UP' : 'DOWN'}!</p>
            <p style={{ margin: 0, fontSize: '12px', color: dark ? '#6B6055' : '#9A8E7E', fontFamily: 'var(--font-ui)' }}>⏰ Result revealed at 3:30 PM IST</p>
          </div>
        )}
        {afterClose && prediction && (
          <div style={{ textAlign: 'center', padding: '4px 0' }}>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>{predCorrect === null ? '⏳' : predCorrect ? '🎉' : '😅'}</div>
            <p style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: '700', fontFamily: 'var(--font-display)', color: predCorrect ? '#4ADE80' : '#F87171' }}>
              {predCorrect === null ? 'Checking result...' : predCorrect ? 'You got it right! +30 IQ' : 'Wrong this time!'}
            </p>
            <p style={{ margin: '0 0 10px', fontSize: '12px', color: dark ? '#6B6055' : '#9A8E7E', fontFamily: 'var(--font-ui)' }}>
              Nifty closed {niftyWentUp ? '▲' : '▼'} {Math.abs(niftyPct).toFixed(2)}% · You predicted {prediction === 'up' ? 'UP' : 'DOWN'}
            </p>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--accent)', fontFamily: 'var(--font-ui)', fontWeight: '600' }}>Come back tomorrow for a new prediction!</p>
          </div>
        )}
        {afterClose && !prediction && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <p style={{ margin: 0, fontSize: '14px', color: dark ? '#6B6055' : '#9A8E7E', fontFamily: 'var(--font-ui)' }}>Market has closed. Come back tomorrow to predict! 🌙</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Yesterday's News Quiz ──────────────────────────────────────────────────────

function YesterdayQuiz({ dark, isMobile, addIQ, earnedBadges, awardBadge }) {
  const [quiz, setQuiz]       = useState([])
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const todayStr = new Date().toDateString()
    const saved = safeLS.getItem(`fd-yquiz-${todayStr}`)
    if (saved) { const parsed = safeParse(saved, null); if (parsed) setAnswers(parsed) }
    fetchYesterdayQuiz()
  }, [])

  async function fetchYesterdayQuiz() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('processed_articles')
        .select('title, simplified_article, glossary, category')
        .not('glossary', 'is', null)
        .order('created_at', { ascending: false })
        .limit(40)
      let articles = data || []
      const allTerms = []
      articles.forEach(article => {
        const g = article.glossary
        if (Array.isArray(g)) {
          g.forEach(item => {
            if ((item.term || item.word) && (item.definition || item.meaning))
              allTerms.push({ term: item.term || item.word, definition: item.definition || item.meaning, articleTitle: article.title })
          })
        }
      })
      const unique = [...new Map(allTerms.map(t => [t.term.toLowerCase(), t])).values()]
      if (unique.length < 4) { setLoading(false); return }
      const seed = new Date().toDateString().split('').reduce((a, c) => a + c.charCodeAt(0), 0)
      function seededShuffle(arr, s) {
        const a = [...arr]
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor((Math.sin(s * (i + 1)) * 0.5 + 0.5) * (i + 1))
          ;[a[i], a[j]] = [a[j], a[i]]
        }
        return a
      }
      const shuffled  = seededShuffle(unique, seed)
      const selected  = shuffled.slice(0, Math.min(4, shuffled.length))
      const wrongPool = shuffled.slice(4)
      const questions = selected.map((term, i) => {
        const wrongs  = seededShuffle(wrongPool.filter(t => t.term !== term.term), seed + i).slice(0, 3).map(t => t.definition.slice(0, 100))
        const correct = term.definition.slice(0, 100)
        const opts    = seededShuffle([correct, ...wrongs], seed + i + 99)
        return { term: term.term, options: opts, answer: opts.indexOf(correct), hint: term.articleTitle }
      })
      setQuiz(questions)
    } catch (e) { console.error('Yesterday quiz failed', e) }
    setLoading(false)
  }

  function handleAnswer(qIdx, optIdx) {
    if (answers[qIdx] !== undefined) return
    const todayStr = new Date().toDateString()
    const updated  = { ...answers, [qIdx]: optIdx }
    setAnswers(updated)
    safeLS.setItem(`fd-yquiz-${todayStr}`, JSON.stringify(updated))
    const correct = optIdx === quiz[qIdx]?.answer
    addIQ(correct ? 20 : 0, correct ? '+20 IQ! Correct! 🎉' : null)
    const totalQuizzes = parseInt(safeLS.getItem('fd-total-quizzes') || '0') + 1
    safeLS.setItem('fd-total-quizzes', totalQuizzes)
    if (totalQuizzes >= 10) awardBadge('quiz10', earnedBadges)
  }

  if (loading) return (
    <div style={{ borderRadius: '14px', padding: '20px', textAlign: 'center', marginTop: '32px',
      border: `1px solid ${dark ? '#2C2822' : '#EDE8E0'}`, background: dark ? '#1A1410' : '#fff' }}>
      <p style={{ margin: 0, fontSize: '13px', color: dark ? '#6B6055' : '#9A8E7E', fontFamily: 'var(--font-ui)' }}>Loading quiz...</p>
    </div>
  )

  if (!quiz.length) return null

  const totalAnswered = Object.keys(answers).length
  const totalCorrect  = Object.entries(answers).filter(([qi, ai]) => parseInt(ai) === quiz[parseInt(qi)]?.answer).length

  return (
    <div style={{ marginTop: '32px', borderRadius: '16px', overflow: 'hidden',
      border: `1px solid ${dark ? '#2C2822' : '#EDE8E0'}`, background: dark ? '#1A1410' : '#fff' }}>
      <div style={{ padding: '14px 18px', background: dark ? '#1e1a14' : '#1A1410',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>📋</span>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#C9A84C', letterSpacing: '0.1em', fontFamily: 'var(--font-ui)' }}>YESTERDAY'S NEWS QUIZ</div>
            <div style={{ fontSize: '10px', color: '#6B6055', fontFamily: 'var(--font-ui)', marginTop: '2px' }}>Based on yesterday's articles · +20 IQ per correct answer</div>
          </div>
        </div>
        {totalAnswered > 0 && (
          <span style={{ fontSize: '12px', fontWeight: '700', fontFamily: 'var(--font-ui)',
            color: totalCorrect === totalAnswered ? '#4ADE80' : '#C9A84C',
            background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
            padding: '3px 10px', borderRadius: '20px' }}>
            {totalCorrect}/{totalAnswered} ✓
          </span>
        )}
      </div>
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {quiz.map((q, qi) => {
          const answered = answers[qi] !== undefined
          const selected = parseInt(answers[qi])
          const correct  = answered && selected === q.answer
          return (
            <div key={qi} style={{ borderRadius: '12px', overflow: 'hidden',
              border: `1px solid ${answered ? (correct ? 'rgba(22,163,74,0.25)' : 'rgba(239,68,68,0.2)') : (dark ? '#2C2822' : '#EDE8E0')}` }}>
              <div style={{ padding: '10px 14px', background: dark ? 'rgba(255,255,255,0.03)' : '#F7F4EF' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--accent)', fontFamily: 'var(--font-ui)', background: dark ? 'rgba(201,168,76,0.1)' : 'rgba(201,168,76,0.12)', padding: '1px 7px', borderRadius: '20px' }}>Q{qi + 1}</span>
                  {q.hint && <span style={{ fontSize: '10px', color: dark ? '#4A4438' : '#B8AFA3', fontFamily: 'var(--font-ui)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>from: {q.hint}</span>}
                </div>
                <p style={{ margin: 0, fontSize: isMobile ? '13px' : '14px', fontWeight: '700', color: dark ? '#F0EBE3' : '#1A1410', fontFamily: 'var(--font-display)' }}>What does "{q.term}" mean?</p>
              </div>
              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {q.options.map((opt, oi) => {
                  let bg = 'transparent', border = dark ? '#2C2822' : '#EDE8E0', color = dark ? '#D4C8BC' : '#4A4438', icon = null
                  if (answered) {
                    if (oi === q.answer)                  { bg = 'rgba(22,163,74,0.1)';  border = '#16A34A'; color = '#16A34A'; icon = '✓' }
                    else if (oi === selected && !correct) { bg = 'rgba(239,68,68,0.08)'; border = '#EF4444'; color = '#EF4444'; icon = '✗' }
                  }
                  return (
                    <button key={oi} onClick={() => handleAnswer(qi, oi)} style={{
                      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                      padding: '9px 12px', borderRadius: '8px', border: `1px solid ${border}`,
                      background: bg, color, cursor: answered ? 'default' : 'pointer',
                      fontFamily: 'var(--font-ui)', fontSize: '12px',
                      fontWeight: oi === q.answer && answered ? '600' : '400',
                      textAlign: 'left', transition: 'all 0.15s', gap: '8px',
                    }}>
                      <span style={{ flex: 1, lineHeight: 1.5 }}>{opt}</span>
                      {icon && <span style={{ fontWeight: '700', flexShrink: 0 }}>{icon}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
        {totalAnswered === quiz.length && (
          <div style={{ padding: '12px 16px', borderRadius: '10px', textAlign: 'center',
            background: totalCorrect >= 3 ? 'rgba(22,163,74,0.08)' : 'rgba(201,168,76,0.08)',
            border: `1px solid ${totalCorrect >= 3 ? 'rgba(22,163,74,0.2)' : 'rgba(201,168,76,0.2)'}` }}>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', fontFamily: 'var(--font-display)', color: totalCorrect >= 3 ? '#4ADE80' : '#C9A84C' }}>
              {totalCorrect >= 3 ? '🎉' : '📖'} {totalCorrect}/{quiz.length} correct · +{totalCorrect * 20} IQ earned
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: dark ? '#6B6055' : '#9A8E7E', fontFamily: 'var(--font-ui)' }}>
              {totalCorrect < quiz.length ? "Read today's articles to do better tomorrow!" : "Excellent! You're on top of the news."}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── NavTab component ──────────────────────────────────────────────────────────
function NavTab({ tab, isActive, isMobile, dark, onClick }) {
  const [hovered, setHovered] = useState(false)
  const expanded = isActive || hovered
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: expanded ? '7px' : '0px',
        border: 'none', cursor: 'pointer',
        height: '50px',
        minWidth: expanded ? '116px' : '56px',
        padding: expanded ? '0 20px' : '0 8px',
        borderRadius: '99px',
        background: isActive
          ? 'linear-gradient(135deg, #C9A84C, #E8C97A)'
          : hovered
            ? (dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)')
            : 'transparent',
        transition: 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        overflow: 'hidden',
      }}>
      <span style={{
        fontSize: '24px',
        lineHeight: 1,
        flexShrink: 0,
        opacity: 1,
        transition: 'all 0.3s ease',
      }}>{tab.icon}</span>
      <span style={{
        fontSize: '13px', fontWeight: '700',
        color: isActive ? '#1A1410' : (dark ? '#F0EBE3' : '#1A1410'),
        fontFamily: 'var(--font-ui)',
        whiteSpace: 'nowrap',
        maxWidth: expanded ? '80px' : '0px',
        opacity: expanded ? 1 : 0,
        overflow: 'hidden',
        transition: 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        letterSpacing: '-0.01em',
      }}>{tab.label}</span>
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Home() {
  const [articles, setArticles]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [activeSection, setActiveSection] = useState('headlines')
  const [currentIndex, setCurrentIndex]   = useState(0)
  const [fetchError, setFetchError]       = useState(null)
  const [dark, setDark]                   = useState(false)
  const [isMobile, setIsMobile]           = useState(false)
  const [sectionCounts, setSectionCounts] = useState({})
  const [overlay, setOverlay]             = useState(null)
  const [indices, setIndices]             = useState({
    sensex: { price: null, change: null, pct: null },
    nifty:  { price: null, change: null, pct: null },
  })
  const [streak, setStreak]             = useState(0)
  const [iqScore, setIqScore]           = useState(0)
  const [earnedBadges, setEarnedBadges] = useState([])
  const [prediction, setPrediction]     = useState(null)
  const [predCorrect, setPredCorrect]   = useState(null)
  const [showPointPop, setShowPointPop] = useState(null)
  const [navShrunk, setNavShrunk] = useState(false)
  const [navHovered, setNavHovered] = useState(false)

  const { user, plan } = useAuth()
  const isPro   = true
  const isBasic = true
  const isFree  = false

  const activeTab   = getActiveMobileTab(activeSection)
  const afterClose  = isAfterMarketClose()
  const weekend     = isWeekend()
  const isPortfolio = activeSection === 'portfolio'

  useEffect(() => {
    const todayStr   = new Date().toDateString()
    const lastVisit  = safeLS.getItem('fd-last-visit')
    const currStreak = parseInt(safeLS.getItem('fd-streak') || '0')
    if (lastVisit === todayStr) {
      setStreak(currStreak)
    } else {
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
      const isConsec  = lastVisit === yesterday.toDateString()
      const newStreak = isConsec ? currStreak + 1 : 1
      safeLS.setItem('fd-streak', newStreak)
      safeLS.setItem('fd-last-visit', todayStr)
      setStreak(newStreak)
    }
    const savedIQ     = parseInt(safeLS.getItem('fd-iq') || '0')
    const savedBadges = safeParse(safeLS.getItem('fd-badges') || '[]', [])
    const savedPred   = safeLS.getItem(`fd-pred-${todayStr}`)
    setIqScore(savedIQ)
    setEarnedBadges(savedBadges)
    if (savedPred) setPrediction(savedPred)
    const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
    if (ist.getHours() < 9) awardBadge('earlybird', savedBadges)

    // Ping last_seen for re-engagement tracking
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager?.getSubscription().then(sub => {
          if (sub) {
            fetch('/api/push-subscribe', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ endpoint: sub.endpoint })
            }).catch(() => {})
          }
        })
      }).catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!prediction || !indices.nifty?.pct || predCorrect !== null || !afterClose) return
    const niftyUp = parseFloat(indices.nifty.pct) >= 0
    const correct = (prediction === 'up' && niftyUp) || (prediction === 'down' && !niftyUp)
    setPredCorrect(correct)
    if (correct) {
      addIQ(30, '+30 IQ! Correct prediction 🎯')
      const predStreak = parseInt(safeLS.getItem('fd-pred-streak') || '0') + 1
      safeLS.setItem('fd-pred-streak', predStreak)
      if (predStreak >= 3) awardBadge('predict3', earnedBadges)
    } else {
      safeLS.setItem('fd-pred-streak', '0')
    }
  }, [indices, afterClose, prediction])

  useEffect(() => {
    if (streak >= 7)  awardBadge('streak7',  earnedBadges)
    if (streak >= 30) awardBadge('streak30', earnedBadges)
  }, [streak])

  function addIQ(points, msg) {
    setIqScore(prev => {
      const newScore = prev + points
      safeLS.setItem('fd-iq', newScore)
      if (newScore >= 500 && prev < 500) awardBadge('iq500', earnedBadges)
      return newScore
    })
    if (msg) { setShowPointPop(msg); setTimeout(() => setShowPointPop(null), 2500) }
  }

  function awardBadge(id, existing = earnedBadges) {
    if (existing.includes(id)) return
    const updated = [...existing, id]
    setEarnedBadges(updated)
    safeLS.setItem('fd-badges', JSON.stringify(updated))
  }

  function handlePrediction(dir) {
    if (prediction || afterClose || weekend) return
    const todayStr = new Date().toDateString()
    setPrediction(dir)
    safeLS.setItem(`fd-pred-${todayStr}`, dir)
  }

  function trackArticleRead() {
    const total = parseInt(safeLS.getItem('fd-articles-read') || '0') + 1
    safeLS.setItem('fd-articles-read', total)
    addIQ(5, null)
    if (total >= 50) awardBadge('articles50', earnedBadges)
  }

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    let lastY = 0
    const onScroll = () => {
      const y = window.scrollY
      if (y > lastY && y > 60) setNavShrunk(true)
      else if (y < lastY) setNavShrunk(false)
      lastY = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    const saved = safeLS.getItem('fd-theme')
    if (saved === 'dark') setDark(true)
  }, [])

  const toggleTheme = () => {
    setDark(d => { safeLS.setItem('fd-theme', !d ? 'dark' : 'light'); return !d })
  }

  useEffect(() => {
    async function fetchCounts() {
      try {
        const { data } = await supabase.from('processed_articles').select('category, is_headline')
        if (!data) return
        const counts = {}
        data.forEach(row => {
          if (row.category) {
            counts[row.category] = (counts[row.category] || 0) + 1
          }
        })
        counts['headlines'] = Math.min(data.length, 25)
        setSectionCounts(counts)
      } catch (e) { console.error('Count fetch failed', e) }
    }
    fetchCounts()
  }, [])

  useEffect(() => { if (!isPortfolio) fetchArticles(activeSection) }, [activeSection])

  useEffect(() => {
    async function fetchIndices() {
      try {
        const res  = await fetch('/api/indices')
        const data = await res.json()
        setIndices(data)
      } catch (e) { console.error('Index fetch failed', e) }
    }
    fetchIndices()
    const interval = setInterval(fetchIndices, isMarketOpen() ? 5000 : 60000)
    return () => clearInterval(interval)
  }, [])

  async function fetchArticles(section) {
    setLoading(true)
    setCurrentIndex(0)
    setFetchError(null)

    try {
      if (section === 'headlines') {
        const { data, error } = await supabase
          .from('processed_articles')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(300)

        if (error) throw error

        const categoryLimits = {
          'indian-markets': 3,
          'us-markets': 2,
          'global-economy': 2,
          'macro-policy': 2,
          'banking-finance': 2,
          'technology-it': 2,
          'pharma-health': 2,
          'auto-ev': 2,
          'energy-oil': 2,
          'metals-mining': 1,
          'renewables': 1,
          'real-estate': 1,
          'infrastructure': 1,
          'fmcg-consumer': 1,
          'telecom-media': 1,
        }

        const grouped = {}
        ;(data || []).forEach(article => {
          if (!article.category) return
          if (!grouped[article.category]) grouped[article.category] = []
          grouped[article.category].push(article)
        })

        let briefing = []
        Object.entries(categoryLimits).forEach(([category, limit]) => {
          if (grouped[category]) briefing.push(...grouped[category].slice(0, limit))
        })

        if (briefing.length < 25) {
          const usedIds = new Set(briefing.map(a => a.id))
          const remaining = (data || []).filter(article => !usedIds.has(article.id))
          briefing.push(...remaining.slice(0, 25 - briefing.length))
        }

        briefing = briefing
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, 25)

        setArticles(briefing)

      } else {
        const { data, error } = await supabase
          .from('processed_articles')
          .select('*')
          .eq('category', section)
          .order('created_at', { ascending: false })
          .limit(12)

        if (error) throw error
        setArticles(data || [])
      }

    } catch (e) {
      setFetchError(e.message)
      setArticles([])
    } finally {
      setLoading(false)
    }
  }

  function handleSectionClick(id) {
    setActiveSection(id)
    setOverlay(null)
  }

  function handleTabClick(tabId) {
    setNavShrunk(false)
    if (tabId === 'top')            handleSectionClick('headlines')
    else if (tabId === 'portfolio') handleSectionClick('portfolio')
    else setOverlay(overlay === tabId ? null : tabId)
  }

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const activeSectionLabel = ALL_SECTIONS.find(s => s.id === activeSection)?.label || ''
  const iqLevel = getIQLevel(iqScore)

  const hasNewsReader = !isPortfolio && articles.length > 0 && isPro
  const headerH = isMobile
    ? (hasNewsReader ? 130 : 72)
    : (hasNewsReader ? 100 : 64)

  const BadgeWall = ({ compact = false }) => (
    <div style={{ marginBottom: compact ? '8px' : '0' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {ALL_BADGES.map(b => {
          const earned = earnedBadges.includes(b.id)
          return (
            <div key={b.id} title={`${b.name}: ${b.desc}`} style={{
              width: '32px', height: '32px', borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
              background: earned ? (dark ? 'rgba(201,168,76,0.15)' : 'rgba(201,168,76,0.12)') : (dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)'),
              border: `1px solid ${earned ? 'rgba(201,168,76,0.3)' : (dark ? '#2C2822' : '#EDE8E0')}`,
              filter: earned ? 'none' : 'grayscale(1) opacity(0.3)', cursor: 'help',
            }}>{b.emoji}</div>
          )
        })}
      </div>
    </div>
  )

  const SkeletonCard = () => (
    <div style={{ background: 'var(--bg-card)', borderRadius: '18px', border: '1px solid var(--border-main)', overflow: 'hidden', padding: '24px' }}>
      <div className="skeleton" style={{ height: '180px', marginBottom: '20px', borderRadius: '12px' }} />
      <div className="skeleton" style={{ height: '18px', width: '85%', marginBottom: '10px' }} />
      <div className="skeleton" style={{ height: '18px', width: '70%', marginBottom: '20px' }} />
      <div className="skeleton" style={{ height: '60px', borderRadius: '10px' }} />
    </div>
  )

  const NAV_BAR_H = 62

  return (
    <div style={{ background: 'var(--bg-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>

      <WelcomeModal dark={dark} user={user} />
      <InstallBanner dark={dark} />

      {showPointPop && (
        <div style={{
          position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)',
          background: '#C9A84C', color: '#1A1410', padding: '8px 18px',
          borderRadius: '20px', fontSize: '13px', fontWeight: '700',
          fontFamily: 'var(--font-ui)', zIndex: 999,
          animation: 'fadeInUp 0.3s ease, fadeOut 0.3s ease 2.2s forwards',
          boxShadow: '0 4px 20px rgba(201,168,76,0.4)',
        }}>
          {showPointPop}
        </div>
      )}

      {overlay && (
        <div onClick={() => setOverlay(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          zIndex: 38, backdropFilter: 'blur(2px)',
        }} />
      )}

      {/* ── Header ── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        background: 'var(--bg-header)', boxShadow: 'var(--shadow-header)',
        zIndex: 20,
      }}>
        <div style={{ height: '3px', background: 'linear-gradient(90deg, var(--accent), #F0A84A, var(--accent))' }} />
        <div style={{ padding: isMobile ? '10px 16px' : '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div>
            <h1 style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '700', color: dark ? '#F0EBE3' : '#1A1410', margin: '0', letterSpacing: '-0.03em', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>
              Finance <span style={{ color: 'var(--accent)' }}>Digest</span>
            </h1>
            {!isMobile && (
              <p style={{ fontSize: '10px', color: dark ? '#4A4438' : '#B8AFA3', margin: '2px 0 0', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                {today}{activeSectionLabel && <span style={{ color: 'var(--accent)', marginLeft: '6px' }}>· {activeSectionLabel}</span>}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <IndexChip label="SENSEX" data={indices.sensex} dark={dark} />
            <IndexChip label="NIFTY" data={indices.nifty} dark={dark} />
            <IQChip iq={iqScore} dark={dark} />
            <NotificationBell dark={dark} />
            <ThemeToggle dark={dark} onToggle={toggleTheme} />
            <AccountButton dark={dark} user={user} />
          </div>
        </div>
        {hasNewsReader && (
          <div style={{ borderTop: `1px solid ${dark ? '#2C2822' : '#EDE8E0'}`, background: dark ? '#111009' : '#FAFAF7' }}>
            <div style={{ padding: isMobile ? '8px 16px' : '9px 24px' }}>
              <NewsReader newsItems={articles} currentIndex={currentIndex} onIndexChange={setCurrentIndex} dark={dark} />
            </div>
          </div>
        )}
      </header>

      {/* ── Floating Bottom Nav ── */}
      <nav
        onMouseEnter={() => setNavHovered(true)}
        onMouseLeave={() => setNavHovered(false)}
        onClick={() => setNavHovered(true)}
        style={{
          position: 'fixed',
          bottom: isMobile ? '16px' : '24px',
          left: '50%',
          transform: `translateX(-50%) scale(${navShrunk && !navHovered ? 0.93 : 1})`,
          transformOrigin: 'bottom center',
          opacity: 1,
          display: 'flex', alignItems: 'center',
          background: dark ? 'rgba(26,20,16,0.95)' : 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '99px',
          border: `1px solid ${dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'}`,
          boxShadow: dark
            ? '0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)'
            : '0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)',
          zIndex: 40,
          padding: '6px 8px',
          gap: '2px',
          transition: 'transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
        {BOTTOM_TABS.map(tab => {
          const isActive = activeTab === tab.id || overlay === tab.id
          return (
            <NavTab
              key={tab.id}
              tab={tab}
              isActive={isActive}
              isMobile={isMobile}
              dark={dark}
              onClick={() => handleTabClick(tab.id)}
            />
          )
        })}
      </nav>

      {/* ── Overlays ── */}
      {overlay === 'markets' && (
        <div style={{
          position: 'fixed',
          bottom: isMobile ? '96px' : '104px',
          left: '50%', transform: 'translateX(-50%)',
          width: isMobile ? 'calc(100% - 32px)' : '420px',
          maxWidth: '420px',
          background: dark ? '#1A1410' : '#fff',
          borderRadius: '20px',
          padding: '16px',
          zIndex: 39,
          boxShadow: '0 -8px 32px rgba(0,0,0,0.15)',
          border: `1px solid ${dark ? '#2C2822' : '#EDE8E0'}`,
          animation: 'slideUp 0.25s ease',
        }}>
          <div style={{ width: '36px', height: '3px', background: dark ? '#3A3028' : '#EDE8E0', borderRadius: '2px', margin: '0 auto 16px' }} />
          <p style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', color: dark ? '#4A4438' : '#C4B9AE', margin: '0 0 12px', fontFamily: 'var(--font-ui)' }}>MARKETS</p>
          {MARKETS_SECTIONS.map(s => (
            <button key={s.id} onClick={() => handleSectionClick(s.id)} style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '13px 14px', marginBottom: '4px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: activeSection === s.id ? (dark ? 'rgba(232,151,62,0.12)' : 'rgba(212,135,60,0.08)') : (dark ? 'rgba(255,255,255,0.03)' : '#FAFAF8'), textAlign: 'left' }}>
              <span style={{ fontSize: '22px' }}>{s.icon}</span>
              <span style={{ fontSize: '15px', fontWeight: activeSection === s.id ? '600' : '400', color: activeSection === s.id ? 'var(--accent)' : (dark ? '#D4C8BC' : '#1A1410'), fontFamily: 'var(--font-ui)' }}>{s.label}</span>
              {sectionCounts[s.id] > 0 && <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: '600', color: 'var(--accent)', fontFamily: 'var(--font-ui)' }}>{sectionCounts[s.id]}</span>}
            </button>
          ))}
          <p style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', color: dark ? '#4A4438' : '#C4B9AE', margin: '12px 0 8px', fontFamily: 'var(--font-ui)' }}>POLICY</p>
          {[{ id: 'macro-policy', label: 'Macro & Policy', icon: '🏛️' }, { id: 'banking-finance', label: 'Banking & Finance', icon: '🏦' }].map(s => (
            <button key={s.id} onClick={() => handleSectionClick(s.id)} style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '13px 14px', marginBottom: '4px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: activeSection === s.id ? (dark ? 'rgba(232,151,62,0.12)' : 'rgba(212,135,60,0.08)') : (dark ? 'rgba(255,255,255,0.03)' : '#FAFAF8'), textAlign: 'left' }}>
              <span style={{ fontSize: '22px' }}>{s.icon}</span>
              <span style={{ fontSize: '15px', fontWeight: activeSection === s.id ? '600' : '400', color: activeSection === s.id ? 'var(--accent)' : (dark ? '#D4C8BC' : '#1A1410'), fontFamily: 'var(--font-ui)' }}>{s.label}</span>
            </button>
          ))}
        </div>
      )}

      {overlay === 'sectors' && (
        <div style={{
          position: 'fixed',
          bottom: isMobile ? '96px' : '104px',
          left: '50%', transform: 'translateX(-50%)',
          width: isMobile ? 'calc(100% - 32px)' : '420px',
          maxWidth: '420px',
          background: dark ? '#1A1410' : '#fff',
          borderRadius: '20px',
          padding: '16px',
          zIndex: 39,
          boxShadow: '0 -8px 32px rgba(0,0,0,0.15)',
          border: `1px solid ${dark ? '#2C2822' : '#EDE8E0'}`,
          animation: 'slideUp 0.25s ease',
        }}>
          <div style={{ width: '36px', height: '3px', background: dark ? '#3A3028' : '#EDE8E0', borderRadius: '2px', margin: '0 auto 16px' }} />
          <p style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', color: dark ? '#4A4438' : '#C4B9AE', margin: '0 0 14px', fontFamily: 'var(--font-ui)' }}>SECTORS</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
            {SECTORS_SECTIONS.map(s => (
              <button key={s.id} onClick={() => handleSectionClick(s.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', padding: '12px 4px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: activeSection === s.id ? (dark ? 'rgba(232,151,62,0.15)' : 'rgba(212,135,60,0.10)') : (dark ? 'rgba(255,255,255,0.04)' : '#F7F4EF'), transition: 'background 0.15s' }}>
                <span style={{ fontSize: '24px' }}>{s.icon}</span>
                <span style={{ fontSize: '9px', fontWeight: activeSection === s.id ? '700' : '500', color: activeSection === s.id ? 'var(--accent)' : (dark ? '#9A8E7E' : '#6B5E4E'), fontFamily: 'var(--font-ui)', textAlign: 'center', lineHeight: 1.2 }}>{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {overlay === 'more' && (
        <div style={{
          position: 'fixed',
          bottom: isMobile ? '96px' : '104px',
          left: '50%', transform: 'translateX(-50%)',
          width: isMobile ? 'calc(100% - 32px)' : '420px',
          maxWidth: '420px',
          background: dark ? '#1A1410' : '#fff',
          borderRadius: '20px',
          padding: '16px',
          zIndex: 39,
          boxShadow: '0 -8px 32px rgba(0,0,0,0.15)',
          border: `1px solid ${dark ? '#2C2822' : '#EDE8E0'}`,
          animation: 'slideUp 0.25s ease',
        }}>
          <div style={{ width: '36px', height: '3px', background: dark ? '#3A3028' : '#EDE8E0', borderRadius: '2px', margin: '0 auto 16px' }} />
          <div style={{ padding: '12px 14px', marginBottom: '12px', borderRadius: '12px',
            background: dark ? 'rgba(201,168,76,0.08)' : 'rgba(201,168,76,0.06)',
            border: `1px solid ${dark ? 'rgba(201,168,76,0.2)' : 'rgba(201,168,76,0.15)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--accent)', fontFamily: 'var(--font-ui)' }}>🧠 Finance IQ: {iqScore}</span>
              <span style={{ fontSize: '11px', color: iqLevel.color, fontFamily: 'var(--font-ui)', fontWeight: '600' }}>{iqLevel.title}</span>
            </div>
            <div style={{ height: '4px', borderRadius: '2px', background: dark ? '#2C2822' : '#EDE8E0', overflow: 'hidden', marginBottom: '10px' }}>
              <div style={{ height: '100%', borderRadius: '2px', background: 'linear-gradient(90deg, var(--accent), #F0A84A)', width: `${Math.min((iqScore % 500) / 5, 100)}%`, transition: 'width 0.5s ease' }} />
            </div>
            <BadgeWall compact={true} />
          </div>
          <button onClick={() => handleSectionClick('portfolio')} style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '13px 14px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: activeSection === 'portfolio' ? (dark ? 'rgba(232,151,62,0.12)' : 'rgba(212,135,60,0.08)') : (dark ? 'rgba(255,255,255,0.03)' : '#FAFAF8'), textAlign: 'left' }}>
            <span style={{ fontSize: '22px' }}>💰</span>
            <span style={{ fontSize: '15px', fontWeight: '500', color: dark ? '#D4C8BC' : '#1A1410', fontFamily: 'var(--font-ui)' }}>My Portfolio</span>
          </button>
        </div>
      )}

      {/* ── Main Content ── */}
      <main style={{
        paddingTop: `${headerH}px`,
        paddingBottom: `${NAV_BAR_H + 40}px`,
        minHeight: '100vh',
      }}>
        {isPortfolio ? (
          <MyPortfolio />
        ) : (
          <div style={{ maxWidth: '820px', margin: '0 auto', padding: isMobile ? '16px 14px 20px' : '32px 24px 72px' }}>

            {(activeSection === 'indian-markets' || activeSection === 'us-markets') && (
              <MarketSummaryCard market={activeSection} dark={dark} isMobile={isMobile} />
            )}

            {activeSection === 'quiz' && (
              <YesterdayQuiz dark={dark} isMobile={isMobile} addIQ={addIQ} earnedBadges={earnedBadges} awardBadge={awardBadge} />
            )}

            {activeSection === 'headlines' && !loading && (
              <PredictionGame indices={indices} prediction={prediction} predCorrect={predCorrect} afterClose={afterClose} weekend={weekend} dark={dark} isMobile={isMobile} handlePrediction={handlePrediction} />
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ height: '1px', flex: 1, background: dark ? '#2C2822' : '#EDE8E0' }} />
              <span style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em', color: dark ? '#4A4438' : '#C4B9AE', textTransform: 'uppercase', fontFamily: 'var(--font-ui)' }}>
                {loading ? 'Loading…' : `${articles.length} Stories`}
              </span>
              <div style={{ height: '1px', flex: 1, background: dark ? '#2C2822' : '#EDE8E0' }} />
            </div>

            {fetchError && (
              <div style={{ background: dark ? '#2D1B00' : '#FFF3CD', border: `1px solid ${dark ? '#7C4A00' : '#FFC107'}`, borderRadius: '12px', padding: '14px 18px', marginBottom: '24px', fontSize: '13px', color: dark ? '#FFC107' : '#856404' }}>
                <strong>Error:</strong> {fetchError}
              </div>
            )}

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {[0,1,2].map(i => <SkeletonCard key={i} />)}
              </div>
            ) : articles.length === 0 && !fetchError ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>📭</div>
                <p style={{ fontSize: '15px', fontWeight: '500', color: dark ? '#6B6055' : '#9A8E7E' }}>No articles in this section yet.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '24px' }}>
                {articles.map((article, index) => (
                  <div key={article.id} id={`article-${index}`} className="article-enter"
                    style={{ animationDelay: `${Math.min(index * 0.05, 0.25)}s` }}
                    onClick={trackArticleRead}>
                    <ArticleCard article={article} dark={dark} isPro={isPro} isBasic={isBasic} />
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: `1px solid ${dark ? '#2C2822' : '#EDE8E0'}`, textAlign: 'center' }}>
              <p style={{ fontSize: '12px', color: dark ? '#3C3530' : '#C4B9AE', letterSpacing: '0.05em' }}>
                Finance Digest · Powered by AI · News simplified for everyone
              </p>
            </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes slideUp  { from { transform: translateX(-50%) translateY(20px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateX(-50%) translateY(10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes fadeOut  { from { opacity: 1; } to { opacity: 0; } }
      `}</style>
    </div>
  )
}