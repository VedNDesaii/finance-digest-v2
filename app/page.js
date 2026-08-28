'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '../lib/supabase'
import ArticleCard from '../components/ArticleCard'
import SwipeDeck from '../components/SwipeDeck'
import Tutorial from '../components/Tutorial'
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
    try { return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null }
    catch { return null }
  },
  setItem(key, val) {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, val) }
    catch { /* storage blocked — ignore */ }
  },
}

function safeParse(str, fallback) {
  try { return JSON.parse(str) } catch { return fallback }
}

// Finance IQ points. Bump POINTS_VERSION to reset every user's score to 0 on
// their next visit (points live in localStorage, so there's no server wipe).
const POINTS_VERSION    = 'v2-2026-08'
const PREDICTION_POINTS = 30   // awarded once per day for a correct market prediction

const BOTTOM_TABS = [
  { id: 'top',       icon: '📰', label: 'Briefing' },
  { id: 'markets',   icon: '📈', label: 'Markets' },
  { id: 'sectors',   icon: '🏭', label: 'Sectors' },
  { id: 'quiz',      icon: '🧩', label: 'Quiz' },
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
  { id: 'macro-policy',    label: 'Macro, Tax & Budget' },
  { id: 'banking-finance', label: 'Banking & Finance' },
  { id: 'investment-banking', label: 'Investment Banking' },
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

// Finance Wordle — curated 5-letter finance terms (no trivial ones like STOCK/ASSET).
// Each carries an easy definition + a simple example for the post-round reveal.
const WORDLE_WORDS = [
  { word: 'YIELD', def: 'The annual return you earn on a bond or investment, shown as a %.', ex: 'A bond paying ₹7 a year on a ₹100 price has a 7% yield.' },
  { word: 'HEDGE', def: 'A trade taken to offset the risk of losing money on another investment.', ex: 'An exporter buys a dollar contract to hedge against the rupee rising.' },
  { word: 'ALPHA', def: 'The extra return a fund earns above its benchmark index.', ex: 'A fund up 15% when the Nifty rose 12% delivered 3% alpha.' },
  { word: 'DELTA', def: "How much an option's price moves for a ₹1 move in the underlying stock.", ex: 'A call with 0.5 delta gains ₹0.50 if the stock rises ₹1.' },
  { word: 'THETA', def: 'How much value an option loses each day just from time passing.', ex: 'Options lose theta fastest in their final week before expiry.' },
  { word: 'SWAPS', def: 'Contracts where two parties exchange cash flows, often fixed vs floating interest.', ex: 'A firm swaps its floating-rate loan for a fixed rate to lock costs.' },
  { word: 'BASIS', def: 'A basis point is 0.01%; used to quote small changes in rates.', ex: 'The RBI cut the repo rate by 25 basis points, i.e. 0.25%.' },
  { word: 'FLOAT', def: 'The portion of a company’s shares actually available to trade in the market.', ex: 'Most shares are promoter-held, so the free float is small.' },
  { word: 'SCRIP', def: 'Another word for a share or stock certificate.', ex: 'The exchange halted trading in the scrip after a sharp move.' },
  { word: 'DEMAT', def: 'An account that holds your shares in electronic form (India).', ex: 'You need a demat account to buy shares on the NSE.' },
  { word: 'USURY', def: 'Charging an unfairly or illegally high rate of interest.', ex: 'Regulators cracked down on apps accused of usury.' },
  { word: 'BASEL', def: 'Global rules setting how much capital a bank must hold as a safety buffer.', ex: 'Indian banks raised capital to meet Basel III norms.' },
  { word: 'MERGE', def: 'When two companies combine into a single company.', ex: 'The two lenders plan to merge to build scale.' },
  { word: 'AUDIT', def: 'An independent check of a company’s financial accounts.', ex: 'The auditor flagged issues in the firm’s annual audit.' },
  { word: 'STAKE', def: 'The share of ownership someone holds in a company.', ex: 'The founder sold a 5% stake to a private equity fund.' },
  { word: 'BONUS', def: 'Free extra shares given to existing shareholders.', ex: 'The company announced a 1:1 bonus, doubling your share count.' },
  { word: 'SPLIT', def: 'Dividing each share into more shares to lower the per-share price.', ex: 'A 1:5 split turns one ₹1,000 share into five ₹200 shares.' },
  { word: 'GILTS', def: 'Government bonds — among the safest debt you can hold.', ex: 'Funds moved into gilts when markets turned risky.' },
  { word: 'REPOS', def: 'Short-term loans where securities are sold and bought back later.', ex: 'Banks borrow overnight from the RBI through repos.' },
  { word: 'TENOR', def: 'The length of time until a loan or bond matures.', ex: 'A 10-year bond has a longer tenor than a 2-year one.' },
  { word: 'CARRY', def: 'Profit earned from holding a higher-yielding asset funded by a cheaper one.', ex: 'Traders borrow in low-rate yen to earn carry elsewhere.' },
  { word: 'PRIME', def: 'The benchmark rate banks charge their most creditworthy borrowers.', ex: 'Loan rates rose as the prime lending rate went up.' },
  { word: 'PENNY', def: 'A very low-priced, high-risk stock of a tiny company.', ex: 'Regulators warn against tips to buy penny stocks.' },
  { word: 'BLOCK', def: 'A single large trade of shares done between two parties.', ex: 'A fund exited via a ₹2,000 crore block deal.' },
  { word: 'DEBUT', def: 'A company’s first day of trading after its IPO.', ex: 'The stock made a strong debut, listing 30% above its issue price.' },
  { word: 'CHURN', def: 'Frequent buying and selling that racks up costs.', ex: 'High churn in a portfolio eats returns through fees.' },
  { word: 'ISSUE', def: 'When a company offers new shares or bonds to raise money.', ex: 'The firm raised ₹500 crore through a rights issue.' },
  { word: 'LEVER', def: 'Using borrowed money to amplify potential returns (and losses).', ex: 'High leverage boosts gains but magnifies losses if trades go wrong.' },
  { word: 'QUOTA', def: 'A fixed limit set on something, such as imports or exports.', ex: 'India set a quota on how much of a metal can be imported duty-free.' },
  { word: 'SHORT', def: 'Betting a stock will fall by selling borrowed shares first.', ex: 'Traders went short expecting the results to disappoint.' },
  { word: 'PIVOT', def: 'A notable change in a company’s or central bank’s strategy or stance.', ex: 'Markets rallied on hopes of a policy pivot to rate cuts.' },
  { word: 'SLUMP', def: 'A sharp, sustained fall in prices or activity.', ex: 'Auto sales are in a slump amid weak demand.' },
  { word: 'RALLY', def: 'A strong, sustained rise in prices.', ex: 'The Sensex staged a sharp rally after the budget.' },
  { word: 'INDEX', def: 'A basket of stocks that tracks how a market is doing.', ex: 'The Nifty 50 index tracks India’s 50 largest companies.' },
]

function getIQLevel(iq) {
  if (iq >= 2500) return { title: 'Market Expert',      color: 'var(--accent)' }
  if (iq >= 1000) return { title: 'Savvy Investor',     color: 'var(--accent)' }
  if (iq >= 500)  return { title: 'Finance Enthusiast', color: 'var(--up)' }
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
  if (section === 'quiz') return 'quiz'
  if (['indian-markets','us-markets','global-economy','macro-policy','banking-finance','investment-banking'].includes(section)) return 'markets'
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
        letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
        {label}
      </span>
      <span style={{ fontSize: '12px', fontWeight: '700', fontFamily: 'var(--font-ui)', color: 'var(--text-primary)' }}>
        {data.price}
      </span>
      <span style={{ fontSize: '11px', fontWeight: '600', fontFamily: 'var(--font-ui)', color: up ? 'var(--up)' : 'var(--down)' }}>
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
      color: 'var(--text-primary)', cursor: 'pointer', flexShrink: 0,
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
      color: 'var(--text-primary)', cursor: 'pointer', flexShrink: 0,
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
          ? (dark ? 'rgba(255,75,43,0.2)' : 'rgba(255,75,43,0.15)')
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

  const textPri   = 'var(--text-primary)'
  const textSec   = dark ? '#9A8E7E' : '#6B5E4E'
  const textMuted = 'var(--text-muted)'
  const borderCol = 'var(--border-main)'
  const sheetBg   = 'var(--bg-card)'

  // Minimized pill
  if (minimized) return (
    <button onClick={() => setMinimized(false)} style={{
      position: 'fixed', bottom: '90px', right: '16px', zIndex: 50,
      background: 'var(--accent)',
      border: 'none', borderRadius: '99px', padding: '10px 18px',
      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
      boxShadow: '0 4px 20px rgba(255,75,43,0.5)',
      animation: 'pillPulse 2s ease-in-out infinite',
    }}>
      <span style={{ fontSize: '16px' }}>🔔</span>
      <span style={{ fontSize: '13px', fontWeight: '700', color: '#1A1410', fontFamily: 'var(--font-ui)' }}>
        Enable Notifications
      </span>
      <style>{`@keyframes pillPulse { 0%,100% { box-shadow: 0 4px 20px rgba(255,75,43,0.5); } 50% { box-shadow: 0 4px 32px rgba(255,75,43,0.8); } }`}</style>
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
        <div style={{ height: '2px', background: 'var(--accent)', margin: '0 24px 20px', borderRadius: '1px' }} />

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
            background: 'var(--bg-gist)',
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
              background: 'var(--bg-gist)',
              border: `1px solid ${borderCol}`,
            }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                background: 'var(--accent)',
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
      background: active ? 'var(--accent)' : (dark ? 'rgba(255,75,43,0.15)' : 'rgba(232,67,31,0.12)'),
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
  const [showReport, setShowReport] = useState(false)
  const [summaryData, setSummaryData] = useState(null)
  const [loading, setLoading] = useState(true)

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
  const weekend = ist.getDay() === 0 || ist.getDay() === 6
  const open = isIndia
    ? (!weekend && istMins >= 555 && istMins <= 930)
    : (!weekend && (istMins >= 1170 || istMins <= 240))

  const FB = {
    indices: (isIndia ? ['Sensex', 'Nifty 50', 'Bank Nifty'] : ['S&P 500', 'Nasdaq', 'Dow Jones'])
      .map(label => ({ label, value: '—', pct: '', up: true })),
    sectors: [], tiles: [], lead: 'Market summary updates after the next close.', watch: '',
  }
  const d = summaryData || {}
  const indices   = (d.indices && d.indices.length) ? d.indices : FB.indices
  const sectors   = (d.sectors && d.sectors.length) ? d.sectors : FB.sectors
  const tiles     = d.tiles || FB.tiles
  const lead      = d.lead || d.headline || FB.lead
  const brief     = d.brief || ''
  const narrative = d.narrative || ''
  const watch     = d.watch || FB.watch
  const updatedAt = d.updated_at
    ? new Date(d.updated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) + ' IST'
    : '—'

  const ups = indices.filter(i => i.up).length
  const verdict = d.verdict || (ups === indices.length ? 'up' : ups === 0 ? 'down' : 'mixed')
  const V = verdict === 'up'
    ? { label: 'Up day', color: 'var(--up)', arrow: '▲' }
    : verdict === 'down'
      ? { label: 'Down day', color: 'var(--down)', arrow: '▼' }
      : { label: 'Mixed day', color: 'var(--text-muted)', arrow: '◆' }
  const secColor = pct => (pct >= 0 ? 'var(--up)' : 'var(--down)')
  const mono = 'var(--font-mono)'
  const Label = ({ children }) => (<div style={{ fontFamily: mono, fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '9px' }}>{children}</div>)

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)', borderRadius: '16px', overflow: 'hidden', marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '15px 16px 0' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: mono, fontWeight: 600, fontSize: '11px', letterSpacing: '0.05em', textTransform: 'uppercase', padding: '5px 10px', borderRadius: '20px', color: V.color, background: 'var(--bg-gist)', border: '1px solid var(--border-main)' }}>{V.arrow} {V.label}</span>
        <span style={{ fontFamily: mono, fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{isIndia ? 'Indian markets' : 'US markets'}</span>
        <span style={{ marginLeft: 'auto', fontFamily: mono, fontSize: '10px', color: 'var(--text-muted)', border: '1px solid var(--border-main)', borderRadius: '6px', padding: '3px 8px' }}>{open ? 'Live' : 'Closed'}</span>
      </div>

      <div style={{ padding: '12px 16px 6px', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: isMobile ? '17px' : '19px', lineHeight: 1.3, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>{loading ? 'Loading market summary…' : lead}</div>
      {brief && <div style={{ padding: '0 16px 14px', fontSize: '13.5px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>{brief}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', borderTop: '1px solid var(--border-main)', borderBottom: '1px solid var(--border-main)' }}>
        {indices.map((idx, i) => (
          <div key={i} style={{ padding: '11px 12px', borderLeft: i ? '1px solid var(--border-main)' : 'none' }}>
            <div style={{ fontFamily: mono, fontSize: '9.5px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>{idx.label}</div>
            <div style={{ fontFamily: mono, fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)', margin: '3px 0 1px' }}>{loading ? '—' : idx.value}</div>
            <div style={{ fontFamily: mono, fontSize: '10.5px', color: idx.up ? 'var(--up)' : 'var(--down)' }}>{idx.pct}</div>
          </div>
        ))}
      </div>

      {sectors.length > 0 && (
        <div style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: '7px 14px', borderBottom: '1px solid var(--border-main)' }}>
          {sectors.slice(0, 5).map((s, i) => (
            <span key={i} style={{ fontFamily: mono, fontSize: '11.5px', color: 'var(--text-secondary)' }}><b style={{ color: 'var(--text-primary)' }}>{s.name}</b> <span style={{ color: secColor(s.pct) }}>{s.pct >= 0 ? '+' : ''}{s.pct}%</span></span>
          ))}
          <span style={{ fontFamily: mono, fontSize: '9px', color: 'var(--up)', border: '1px solid var(--border-accent)', borderRadius: '4px', padding: '2px 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>real NSE data</span>
        </div>
      )}

      {watch && (
        <div style={{ padding: '11px 16px', fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '9px', background: 'var(--accent-light)' }}>
          <b style={{ color: 'var(--accent)', fontFamily: mono, fontSize: '9.5px', letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0 }}>Watch</b><span>{watch}</span>
        </div>
      )}

      <button onClick={() => setShowReport(true)} style={{ width: '100%', border: 'none', background: 'var(--accent)', color: '#fff', fontFamily: mono, fontWeight: 600, fontSize: '11.5px', letterSpacing: '0.04em', textTransform: 'uppercase', padding: '13px', cursor: 'pointer' }}>Full market report →</button>

      {showReport && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'var(--bg-page)', display: 'flex', flexDirection: 'column', animation: 'mrSlideIn 0.25s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '15px 16px', borderBottom: '1px solid var(--border-main)', background: 'var(--bg-card)', flexShrink: 0 }}>
            <button onClick={() => setShowReport(false)} aria-label="Back" style={{ width: '32px', height: '32px', borderRadius: '9px', border: '1px solid var(--border-main)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '16px' }}>‹</button>
            <span style={{ fontFamily: mono, fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)' }}>Full market report</span>
            <span style={{ marginLeft: 'auto', fontFamily: mono, fontSize: '10.5px', color: 'var(--text-muted)' }}>{isIndia ? 'India' : 'US'} · {updatedAt}</span>
          </div>
          <div style={{ overflowY: 'auto', padding: '18px 16px 44px' }}>
            <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '21px', lineHeight: 1.25, color: 'var(--text-primary)', margin: 0 }}>{lead}</h1>
              {narrative && (<div><Label>The day in full</Label>{narrative.split(/\n\n+/).map((p, i) => <p key={i} style={{ fontSize: '14px', lineHeight: 1.65, color: 'var(--text-secondary)', margin: '0 0 10px' }}>{p}</p>)}</div>)}
              <div><Label>Index by index</Label>{indices.map((idx, i) => (<div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: i < indices.length - 1 ? '1px solid var(--border-main)' : 'none' }}><span style={{ fontFamily: mono, fontSize: '13px', color: 'var(--text-primary)' }}>{idx.label}</span><span style={{ fontFamily: mono, fontSize: '12.5px', color: idx.up ? 'var(--up)' : 'var(--down)' }}>{idx.value} · {idx.pct}</span></div>))}</div>
              {sectors.length > 0 && (<div><Label>Sector scorecard</Label><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>{sectors.map((s, i) => (<div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: mono, fontSize: '12px', background: 'var(--bg-gist)', border: '1px solid var(--border-main)', borderRadius: '8px', padding: '8px 10px' }}><span style={{ color: 'var(--text-secondary)' }}>{s.name}</span><span style={{ color: secColor(s.pct) }}>{s.pct >= 0 ? '+' : ''}{s.pct}%</span></div>))}</div></div>)}
              {tiles.length > 0 && (<div><Label>Why today</Label><div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>{tiles.map((t, i) => (<div key={i} style={{ display: 'flex', gap: '10px' }}><span style={{ fontSize: '15px' }}>{t.icon}</span><div><b style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{t.label}: {t.value}</b><span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px', lineHeight: 1.5 }}>{t.sub}</span></div></div>))}</div></div>)}
              {watch && (<div><Label>What to watch</Label><p style={{ fontSize: '14px', lineHeight: 1.65, color: 'var(--text-secondary)', margin: 0 }}>{watch}</p></div>)}
            </div>
          </div>
          <style>{`@keyframes mrSlideIn { from { transform: translateY(100%) } to { transform: translateY(0) } }`}</style>
        </div>
      )}
    </div>
  )
}


// ── PredictionGame ────────────────────────────────────────────────────────────

function PredictionGame({ indices, prediction, predCorrect, afterClose, weekend, dark, isMobile, handlePrediction }) {
  const niftyPct    = parseFloat(indices.nifty?.pct || 0)
  const niftyWentUp = niftyPct >= 0

  if (weekend) return (
    <div style={{ borderRadius: '14px', marginBottom: '16px', overflow: 'hidden',
      border: `1px solid var(--border-main)`, background: 'var(--bg-card)' }}>
      <div style={{ padding: '12px 16px', background: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '16px' }}>🎯</span>
        <span style={{ fontSize: '11px', fontWeight: '700', color: '#1A1410', letterSpacing: '0.1em', fontFamily: 'var(--font-ui)' }}>MARKET PREDICTION</span>
      </div>
      <div style={{ padding: '16px', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>📅 Markets are closed on weekends. Come back Monday!</p>
      </div>
    </div>
  )

  return (
    <div style={{ borderRadius: '14px', marginBottom: '16px', overflow: 'hidden',
      border: `1px solid var(--border-main)`, background: 'var(--bg-card)' }}>
      <div style={{ padding: '12px 16px', background: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '16px' }}>🎯</span>
        <span style={{ fontSize: '11px', fontWeight: '700', color: '#1A1410', letterSpacing: '0.1em', fontFamily: 'var(--font-ui)' }}>DAILY MARKET PREDICTION</span>
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#1A1410', fontFamily: 'var(--font-ui)', opacity: 0.7 }}>+30 IQ if correct</span>
      </div>
      <div style={{ padding: '16px' }}>
        {!afterClose && !prediction && (
          <>
            <p style={{ margin: '0 0 14px', fontSize: isMobile ? '14px' : '15px', fontWeight: '600',
              color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.4 }}>
              Will Nifty 50 close UP or DOWN today?
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => handlePrediction('up')} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.08)', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(74,222,128,0.18)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(74,222,128,0.08)'}>
                <div style={{ fontSize: '28px', marginBottom: '4px' }}>📈</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--up)', fontFamily: 'var(--font-ui)' }}>UP</div>
              </button>
              <button onClick={() => handlePrediction('down')} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.08)', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.18)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(248,113,113,0.08)'}>
                <div style={{ fontSize: '28px', marginBottom: '4px' }}>📉</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--down)', fontFamily: 'var(--font-ui)' }}>DOWN</div>
              </button>
            </div>
          </>
        )}
        {!afterClose && prediction && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>{prediction === 'up' ? '📈' : '📉'}</div>
            <p style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: '700', color: prediction === 'up' ? 'var(--up)' : 'var(--down)', fontFamily: 'var(--font-display)' }}>You predicted {prediction === 'up' ? 'UP' : 'DOWN'}!</p>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>⏰ Result revealed at 3:30 PM IST</p>
          </div>
        )}
        {afterClose && prediction && (
          <div style={{ textAlign: 'center', padding: '4px 0' }}>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>{predCorrect === null ? '⏳' : predCorrect ? '🎉' : '😅'}</div>
            <p style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: '700', fontFamily: 'var(--font-display)', color: predCorrect ? 'var(--up)' : 'var(--down)' }}>
              {predCorrect === null ? 'Checking result...' : predCorrect ? 'You got it right! +30 IQ' : 'Wrong this time!'}
            </p>
            <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
              Nifty closed {niftyWentUp ? '▲' : '▼'} {Math.abs(niftyPct).toFixed(2)}% · You predicted {prediction === 'up' ? 'UP' : 'DOWN'}
            </p>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--accent)', fontFamily: 'var(--font-ui)', fontWeight: '600' }}>Come back tomorrow for a new prediction!</p>
          </div>
        )}
        {afterClose && !prediction && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>Market has closed. Come back tomorrow to predict! 🌙</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Yesterday's News Quiz ──────────────────────────────────────────────────────

// ── FinanceWordle ─────────────────────────────────────────────────────────────
function FinanceWordle({ dark, isMobile, addIQ }) {
  const dayIndex = Math.floor(Date.now() / 86400000) % WORDLE_WORDS.length
  const entry    = WORDLE_WORDS[dayIndex]
  const answer   = entry.word
  const todayStr = new Date().toDateString()
  const storeKey = `fd-wordle-${todayStr}`

  const [guesses, setGuesses] = useState([])
  const [current, setCurrent] = useState('')
  const [done, setDone]       = useState(null)      // 'won' | 'lost' | null
  const [news, setNews]       = useState(undefined) // undefined=not fetched, null=none, obj=found

  useEffect(() => {
    const saved = safeParse(safeLS.getItem(storeKey) || 'null', null)
    if (saved && Array.isArray(saved.guesses)) { setGuesses(saved.guesses); setDone(saved.done || null) }
  }, [])

  useEffect(() => {
    if (!done || news !== undefined) return
    ;(async () => {
      try {
        const w = answer.toLowerCase()
        const { data } = await supabase
          .from('processed_articles')
          .select('title, category')
          .or(`title.ilike.%${w}%,simplified_article.ilike.%${w}%`)
          .order('created_at', { ascending: false })
          .limit(1)
        setNews(data && data[0] ? data[0] : null)
      } catch { setNews(null) }
    })()
  }, [done])

  function evaluate(guess) {
    const res = Array(5).fill('absent')
    const ans = answer.split('')
    for (let i = 0; i < 5; i++) if (guess[i] === ans[i]) { res[i] = 'correct'; ans[i] = null }
    for (let i = 0; i < 5; i++) {
      if (res[i] === 'correct') continue
      const j = ans.indexOf(guess[i])
      if (j !== -1) { res[i] = 'present'; ans[j] = null }
    }
    return res
  }

  function submit() {
    if (done || current.length !== 5) return
    const guess   = current.toUpperCase()
    const next    = [...guesses, guess]
    const won     = guess === answer
    const lost    = !won && next.length >= 6
    const newDone = won ? 'won' : lost ? 'lost' : null
    setGuesses(next); setCurrent('')
    if (newDone) setDone(newDone)
    safeLS.setItem(storeKey, JSON.stringify({ guesses: next, done: newDone }))
    if (won && !safeLS.getItem(`fd-wordle-solved-${todayStr}`)) {
      safeLS.setItem(`fd-wordle-solved-${todayStr}`, '1')
      addIQ(10, '+10 IQ! Solved the Wordle 🟩')
    }
  }

  function press(k) {
    if (done) return
    if (k === 'ENTER') return submit()
    if (k === 'BACK')  return setCurrent(c => c.slice(0, -1))
    if (/^[A-Z]$/.test(k) && current.length < 5) setCurrent(c => c + k)
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Enter') press('ENTER')
      else if (e.key === 'Backspace') press('BACK')
      else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toUpperCase())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const rank = { correct: 3, present: 2, absent: 1 }
  const keyStatus = {}
  guesses.forEach(g => {
    const ev = evaluate(g)
    g.split('').forEach((ch, i) => { if ((rank[ev[i]] || 0) > (rank[keyStatus[ch]] || 0)) keyStatus[ch] = ev[i] })
  })

  const COLORS = { correct: '#22A05B', present: 'var(--accent)', absent: dark ? '#3A3028' : '#B8AFA3', empty: 'var(--border-main)' }

  const rows = []
  for (let r = 0; r < 6; r++) {
    const guess = guesses[r]
    const ev    = guess ? evaluate(guess) : null
    const chars = guess ? guess.split('') : (r === guesses.length ? current.padEnd(5).split('') : Array(5).fill(''))
    rows.push(
      <div key={r} style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
        {chars.map((c, i) => {
          const filled = c && c !== ' '
          const bg     = ev ? COLORS[ev[i]] : 'transparent'
          const border = ev ? bg : (filled ? (dark ? '#5A4F3E' : '#9A8E7E') : COLORS.empty)
          return (
            <div key={i} style={{
              width: isMobile ? '46px' : '52px', height: isMobile ? '46px' : '52px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '8px', border: `2px solid ${border}`, background: bg,
              fontSize: '22px', fontWeight: '700', textTransform: 'uppercase',
              color: ev ? '#fff' : ('var(--text-primary)'), fontFamily: 'var(--font-display)',
            }}>{filled ? c : ''}</div>
          )
        })}
      </div>
    )
  }

  const KEYS = [['Q','W','E','R','T','Y','U','I','O','P'], ['A','S','D','F','G','H','J','K','L'], ['ENTER','Z','X','C','V','B','N','M','BACK']]

  return (
    <div style={{ borderRadius: '14px', padding: isMobile ? '16px' : '20px', marginTop: '20px',
      border: `1px solid var(--border-main)`, background: 'var(--bg-card)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <span style={{ fontSize: '20px' }}>🟩</span>
        <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>Finance Wordle</span>
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--accent)', fontWeight: '600', fontFamily: 'var(--font-ui)' }}>+10 IQ if solved</span>
      </div>
      <p style={{ margin: '0 0 14px', fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>Guess today’s 5-letter finance word in 6 tries.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>{rows}</div>

      {!done && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {KEYS.map((row, ri) => (
            <div key={ri} style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
              {row.map(k => {
                const wide = k === 'ENTER' || k === 'BACK'
                const st   = keyStatus[k]
                return (
                  <button key={k} onClick={() => press(k)} style={{
                    flex: wide ? '1.5' : '1', minWidth: 0, padding: isMobile ? '13px 0' : '15px 0',
                    borderRadius: '6px', border: 'none', cursor: 'pointer',
                    background: st ? COLORS[st] : (dark ? '#2C2822' : '#F0EBE3'),
                    color: st ? '#fff' : ('var(--text-primary)'),
                    fontSize: wide ? '10px' : '14px', fontWeight: '700', fontFamily: 'var(--font-ui)',
                  }}>{k === 'BACK' ? '⌫' : k}</button>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {done && (
        <div style={{ marginTop: '4px', padding: '14px', borderRadius: '10px',
          background: dark ? 'rgba(255,75,43,0.08)' : 'rgba(255,75,43,0.1)',
          borderLeft: `3px solid ${done === 'won' ? COLORS.correct : 'var(--accent)'}` }}>
          <p style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: '700', color: done === 'won' ? COLORS.correct : ('var(--text-primary)'), fontFamily: 'var(--font-display)' }}>
            {done === 'won' ? 'Solved it! 🎉 +10 IQ' : `The word was ${answer}`}
          </p>
          <p style={{ margin: '0 0 6px', fontSize: '14px', lineHeight: 1.5, color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
            <b style={{ color: 'var(--accent)' }}>{answer}</b> — {entry.def}
          </p>
          <p style={{ margin: '0 0 6px', fontSize: '13px', lineHeight: 1.5, color: dark ? '#9A8E7E' : '#6B5E4E', fontFamily: 'var(--font-ui)' }}>
            <b>Example:</b> {entry.ex}
          </p>
          <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: dark ? '#9A8E7E' : '#6B5E4E', fontFamily: 'var(--font-ui)' }}>
            <b>In the news:</b> {news === undefined ? 'Looking for a related story…' : news ? `“${news.title}”` : 'Commonly appears in market and policy news — watch for it.'}
          </p>
          <p style={{ margin: '10px 0 0', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>Come back tomorrow for a new word!</p>
        </div>
      )}
    </div>
  )
}


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
      // Medium-difficulty questions generated daily from the news by the
      // pipeline (generate_quiz.py -> public/daily-quiz.json).
      const res  = await fetch('/daily-quiz.json', { cache: 'no-store' })
      const data = await res.json()
      setQuiz(Array.isArray(data.questions) ? data.questions.slice(0, 5) : [])
    } catch (e) { console.error('Quiz load failed', e) }
    setLoading(false)
  }

  function handleAnswer(qIdx, optIdx) {
    if (answers[qIdx] !== undefined) return
    const todayStr = new Date().toDateString()
    const updated  = { ...answers, [qIdx]: optIdx }
    setAnswers(updated)
    safeLS.setItem(`fd-yquiz-${todayStr}`, JSON.stringify(updated))
    const correct = optIdx === quiz[qIdx]?.answer
    addIQ(correct ? 10 : 0, correct ? '+10 IQ! Correct! 🎉' : null)
    const totalQuizzes = parseInt(safeLS.getItem('fd-total-quizzes') || '0') + 1
    safeLS.setItem('fd-total-quizzes', totalQuizzes)
    if (totalQuizzes >= 10) awardBadge('quiz10', earnedBadges)
  }

  if (loading) return (
    <div style={{ borderRadius: '14px', padding: '20px', textAlign: 'center', marginTop: '32px',
      border: `1px solid var(--border-main)`, background: 'var(--bg-card)' }}>
      <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>Loading quiz...</p>
    </div>
  )

  if (!quiz.length) return null

  const totalAnswered = Object.keys(answers).length
  const totalCorrect  = Object.entries(answers).filter(([qi, ai]) => parseInt(ai) === quiz[parseInt(qi)]?.answer).length

  return (
    <div style={{ marginTop: '32px', borderRadius: '16px', overflow: 'hidden',
      border: `1px solid var(--border-main)`, background: 'var(--bg-card)' }}>
      <div style={{ padding: '14px 18px', background: dark ? '#1e1a14' : '#1A1410',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>📋</span>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent)', letterSpacing: '0.1em', fontFamily: 'var(--font-ui)' }}>DAILY FINANCE QUIZ</div>
            <div style={{ fontSize: '10px', color: '#6B6055', fontFamily: 'var(--font-ui)', marginTop: '2px' }}>5 finance questions · +10 IQ per correct answer</div>
          </div>
        </div>
        {totalAnswered > 0 && (
          <span style={{ fontSize: '12px', fontWeight: '700', fontFamily: 'var(--font-ui)',
            color: totalCorrect === totalAnswered ? 'var(--up)' : 'var(--accent)',
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
              border: `1px solid ${answered ? (correct ? 'rgba(22,163,74,0.25)' : 'rgba(239,68,68,0.2)') : ('var(--border-main)')}` }}>
              <div style={{ padding: '10px 14px', background: 'var(--bg-gist)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--accent)', fontFamily: 'var(--font-ui)', background: dark ? 'rgba(255,75,43,0.1)' : 'rgba(255,75,43,0.12)', padding: '1px 7px', borderRadius: '20px' }}>Q{qi + 1}</span>
                </div>
                <p style={{ margin: 0, fontSize: isMobile ? '13px' : '14px', fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{q.q}</p>
              </div>
              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {q.options.map((opt, oi) => {
                  let bg = 'transparent', border = 'var(--border-main)', color = 'var(--text-secondary)', icon = null
                  if (answered) {
                    if (oi === q.answer)                  { bg = 'rgba(22,163,74,0.1)';  border = 'var(--up)'; color = 'var(--up)'; icon = '✓' }
                    else if (oi === selected && !correct) { bg = 'rgba(239,68,68,0.08)'; border = 'var(--down)'; color = 'var(--down)'; icon = '✗' }
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
                {answered && q.explain && (
                  <p style={{ margin: '4px 2px 0', fontSize: '11px', lineHeight: 1.5, color: dark ? '#9A8E7E' : '#6B5E4E', fontFamily: 'var(--font-ui)' }}>
                    <b style={{ color: 'var(--accent)' }}>Why:</b> {q.explain}
                  </p>
                )}
              </div>
            </div>
          )
        })}
        {totalAnswered === quiz.length && (
          <div style={{ padding: '12px 16px', borderRadius: '10px', textAlign: 'center',
            background: totalCorrect >= 3 ? 'rgba(22,163,74,0.08)' : 'rgba(255,75,43,0.08)',
            border: `1px solid ${totalCorrect >= 3 ? 'rgba(22,163,74,0.2)' : 'rgba(255,75,43,0.2)'}` }}>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', fontFamily: 'var(--font-display)', color: totalCorrect >= 3 ? 'var(--up)' : 'var(--accent)' }}>
              {totalCorrect >= 3 ? '🎉' : '📖'} {totalCorrect}/{quiz.length} correct · +{totalCorrect * 10} IQ earned
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
              {totalCorrect < quiz.length ? "Come back tomorrow for 5 new finance questions!" : "Excellent! Your finance fundamentals are sharp."}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── NavTab component ──────────────────────────────────────────────────────────
// Line icons for the nav (from the approved prototype), keyed by tab id.
const _sv = { viewBox: '0 0 24 24', width: 22, height: 22, fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }
const NAV_ICONS = {
  top:       (<svg {..._sv}><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>),
  markets:   (<svg {..._sv}><path d="M3 17l6-6 4 4 8-8" /><path d="M17 7h4v4" /></svg>),
  sectors:   (<svg {..._sv}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>),
  quiz:      (<svg {..._sv}><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" /></svg>),
  portfolio: (<svg {..._sv}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>),
}

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
          ? 'var(--accent)'
          : hovered
            ? (dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)')
            : 'transparent',
        transition: 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        overflow: 'hidden',
      }}>
      <span style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        lineHeight: 1, flexShrink: 0,
        color: isActive ? '#fff' : 'var(--text-primary)',
        transition: 'color 0.3s ease',
      }}>{NAV_ICONS[tab.id] || tab.icon}</span>
      <span style={{
        fontSize: '11px', fontWeight: '600',
        color: isActive ? '#fff' : 'var(--text-primary)',
        fontFamily: 'var(--font-mono)', textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        maxWidth: expanded ? '92px' : '0px',
        opacity: expanded ? 1 : 0, overflow: 'hidden',
        transition: 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        letterSpacing: '0.04em',
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
  const [dark, setDark]                   = useState(true)  // True Black default
  const [showTutorial, setShowTutorial]   = useState(false)
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

  const { user, plan, loading: authLoading } = useAuth()
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
    // One-time points reset for all users when POINTS_VERSION changes.
    if (safeLS.getItem('fd-points-version') !== POINTS_VERSION) {
      safeLS.setItem('fd-iq', '0')
      safeLS.setItem('fd-pred-streak', '0')
      safeLS.setItem('fd-points-version', POINTS_VERSION)
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
    const todayStr   = new Date().toDateString()
    const settledKey = `fd-pred-settled-${todayStr}`
    const niftyUp    = parseFloat(indices.nifty.pct) >= 0
    const correct    = (prediction === 'up' && niftyUp) || (prediction === 'down' && !niftyUp)
    setPredCorrect(correct)
    // Settle exactly once per day — without this, every reload after close
    // re-awarded the points. Show the result on later visits, don't re-award.
    if (safeLS.getItem(settledKey)) return
    safeLS.setItem(settledKey, correct ? 'correct' : 'wrong')
    if (correct) {
      addIQ(PREDICTION_POINTS, `+${PREDICTION_POINTS} IQ! Correct prediction 🎯`)
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
    // Reading no longer awards Finance IQ — points come from predictions and quizzes.
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
    if (saved === 'light') setDark(false)
  }, [])

  // One-time "what's new" tutorial — shows once, then never again.
  useEffect(() => {
    if (safeLS.getItem('fd-tutorial-v1') === 'done') return
    const t = setTimeout(() => setShowTutorial(true), 700)
    return () => clearTimeout(t)
  }, [])

  const dismissTutorial = () => { safeLS.setItem('fd-tutorial-v1', 'done'); setShowTutorial(false) }

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
        const { data, error } = await Promise.race([
          supabase
            .from('processed_articles')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(300),
          new Promise((_, rej) => setTimeout(() => rej(new Error('Request timed out — check your connection and retry.')), 15000)),
        ])

        if (error) throw error

        const categoryLimits = {
          'indian-markets': 3,
          'us-markets': 2,
          'global-economy': 2,
          'macro-policy': 2,
          'banking-finance': 2,
          'investment-banking': 2,
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
        // "Investment Banking" is a combined view: it also pulls in
        // banking-finance articles so the section stays full.
        const isCombinedIB = section === 'investment-banking'
        let q = supabase.from('processed_articles').select('*')
        q = isCombinedIB
          ? q.in('category', ['investment-banking', 'banking-finance'])
          : q.eq('category', section)
        const { data, error } = await Promise.race([
          q.order('created_at', { ascending: false }).limit(isCombinedIB ? 24 : 12),
          new Promise((_, rej) => setTimeout(() => rej(new Error('Request timed out — check your connection and retry.')), 15000)),
        ])

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
    else if (tabId === 'quiz')      handleSectionClick('quiz')
    else setOverlay(overlay === tabId ? null : tabId)
  }

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const activeSectionLabel = ALL_SECTIONS.find(s => s.id === activeSection)?.label || ''
  const iqLevel = getIQLevel(iqScore)

  const headerH = isMobile ? 72 : 64

  const BadgeWall = ({ compact = false }) => (
    <div style={{ marginBottom: compact ? '8px' : '0' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {ALL_BADGES.map(b => {
          const earned = earnedBadges.includes(b.id)
          return (
            <div key={b.id} title={`${b.name}: ${b.desc}`} style={{
              width: '32px', height: '32px', borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
              background: earned ? (dark ? 'rgba(255,75,43,0.15)' : 'rgba(255,75,43,0.12)') : (dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)'),
              border: `1px solid ${earned ? 'rgba(255,75,43,0.3)' : ('var(--border-main)')}`,
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

      <WelcomeModal dark={dark} user={user} authLoading={authLoading} />
      {showTutorial && <Tutorial onClose={dismissTutorial} />}
      <InstallBanner dark={dark} />

      {showPointPop && (
        <div style={{
          position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--accent)', color: '#1A1410', padding: '8px 18px',
          borderRadius: '20px', fontSize: '13px', fontWeight: '700',
          fontFamily: 'var(--font-ui)', zIndex: 999,
          animation: 'fadeInUp 0.3s ease, fadeOut 0.3s ease 2.2s forwards',
          boxShadow: '0 4px 20px rgba(255,75,43,0.4)',
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
        <div style={{ height: '3px', background: 'linear-gradient(90deg, var(--accent), var(--accent-dark), var(--accent))' }} />
        <div style={{ padding: isMobile ? '10px 16px' : '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div>
            <h1 style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '700', color: 'var(--text-primary)', margin: '0', letterSpacing: '-0.03em', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>
              Finance <span style={{ color: 'var(--accent)' }}>Digest</span>
            </h1>
            {!isMobile && (
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '2px 0 0', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
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
          background: dark ? 'rgba(18,18,18,0.95)' : 'rgba(255,255,255,0.95)',
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
          background: 'var(--bg-card)',
          borderRadius: '20px',
          padding: '16px',
          zIndex: 39,
          boxShadow: '0 -8px 32px rgba(0,0,0,0.15)',
          border: `1px solid var(--border-main)`,
          animation: 'slideUp 0.25s ease',
        }}>
          <div style={{ width: '36px', height: '3px', background: dark ? '#3A3028' : '#EDE8E0', borderRadius: '2px', margin: '0 auto 16px' }} />
          <p style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', color: 'var(--text-muted)', margin: '0 0 12px', fontFamily: 'var(--font-ui)' }}>MARKETS</p>
          {MARKETS_SECTIONS.map(s => (
            <button key={s.id} onClick={() => handleSectionClick(s.id)} style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '13px 14px', marginBottom: '4px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: activeSection === s.id ? (dark ? 'rgba(255,75,43,0.12)' : 'rgba(232,67,31,0.08)') : (dark ? 'rgba(255,255,255,0.03)' : '#FAFAF8'), textAlign: 'left' }}>
              <span style={{ fontSize: '22px' }}>{s.icon}</span>
              <span style={{ fontSize: '15px', fontWeight: activeSection === s.id ? '600' : '400', color: activeSection === s.id ? 'var(--accent)' : ('var(--text-primary)'), fontFamily: 'var(--font-ui)' }}>{s.label}</span>
              {sectionCounts[s.id] > 0 && <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: '600', color: 'var(--accent)', fontFamily: 'var(--font-ui)' }}>{sectionCounts[s.id]}</span>}
            </button>
          ))}
          <p style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', color: 'var(--text-muted)', margin: '12px 0 8px', fontFamily: 'var(--font-ui)' }}>FINANCE & POLICY</p>
          {[{ id: 'macro-policy', label: 'Macro, Tax & Budget', icon: '🏛️' }, { id: 'investment-banking', label: 'Investment Banking', icon: '💼' }].map(s => (
            <button key={s.id} onClick={() => handleSectionClick(s.id)} style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '13px 14px', marginBottom: '4px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: activeSection === s.id ? (dark ? 'rgba(255,75,43,0.12)' : 'rgba(232,67,31,0.08)') : (dark ? 'rgba(255,255,255,0.03)' : '#FAFAF8'), textAlign: 'left' }}>
              <span style={{ fontSize: '22px' }}>{s.icon}</span>
              <span style={{ fontSize: '15px', fontWeight: activeSection === s.id ? '600' : '400', color: activeSection === s.id ? 'var(--accent)' : ('var(--text-primary)'), fontFamily: 'var(--font-ui)' }}>{s.label}</span>
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
          background: 'var(--bg-card)',
          borderRadius: '20px',
          padding: '16px',
          zIndex: 39,
          boxShadow: '0 -8px 32px rgba(0,0,0,0.15)',
          border: `1px solid var(--border-main)`,
          animation: 'slideUp 0.25s ease',
        }}>
          <div style={{ width: '36px', height: '3px', background: dark ? '#3A3028' : '#EDE8E0', borderRadius: '2px', margin: '0 auto 16px' }} />
          <p style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.1em', color: 'var(--text-muted)', margin: '0 0 14px', fontFamily: 'var(--font-ui)' }}>SECTORS</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
            {SECTORS_SECTIONS.map(s => (
              <button key={s.id} onClick={() => handleSectionClick(s.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', padding: '12px 4px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: activeSection === s.id ? (dark ? 'rgba(255,75,43,0.15)' : 'rgba(232,67,31,0.10)') : ('var(--bg-gist)'), transition: 'background 0.15s' }}>
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
          background: 'var(--bg-card)',
          borderRadius: '20px',
          padding: '16px',
          zIndex: 39,
          boxShadow: '0 -8px 32px rgba(0,0,0,0.15)',
          border: `1px solid var(--border-main)`,
          animation: 'slideUp 0.25s ease',
        }}>
          <div style={{ width: '36px', height: '3px', background: dark ? '#3A3028' : '#EDE8E0', borderRadius: '2px', margin: '0 auto 16px' }} />
          <div style={{ padding: '12px 14px', marginBottom: '12px', borderRadius: '12px',
            background: dark ? 'rgba(255,75,43,0.08)' : 'rgba(255,75,43,0.06)',
            border: `1px solid ${dark ? 'rgba(255,75,43,0.2)' : 'rgba(255,75,43,0.15)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--accent)', fontFamily: 'var(--font-ui)' }}>🧠 Finance IQ: {iqScore}</span>
              <span style={{ fontSize: '11px', color: iqLevel.color, fontFamily: 'var(--font-ui)', fontWeight: '600' }}>{iqLevel.title}</span>
            </div>
            <div style={{ height: '4px', borderRadius: '2px', background: 'var(--border-main)', overflow: 'hidden', marginBottom: '10px' }}>
              <div style={{ height: '100%', borderRadius: '2px', background: 'linear-gradient(90deg, var(--accent), var(--accent-dark))', width: `${Math.min((iqScore % 500) / 5, 100)}%`, transition: 'width 0.5s ease' }} />
            </div>
            <BadgeWall compact={true} />
          </div>
          <button onClick={() => handleSectionClick('quiz')} style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '13px 14px', marginBottom: '8px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: activeSection === 'quiz' ? (dark ? 'rgba(255,75,43,0.12)' : 'rgba(232,67,31,0.08)') : (dark ? 'rgba(255,255,255,0.03)' : '#FAFAF8'), textAlign: 'left' }}>
            <span style={{ fontSize: '22px' }}>🧩</span>
            <span style={{ fontSize: '15px', fontWeight: '500', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>Quiz &amp; Wordle</span>
          </button>
          <button onClick={() => handleSectionClick('portfolio')} style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '13px 14px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: activeSection === 'portfolio' ? (dark ? 'rgba(255,75,43,0.12)' : 'rgba(232,67,31,0.08)') : (dark ? 'rgba(255,255,255,0.03)' : '#FAFAF8'), textAlign: 'left' }}>
            <span style={{ fontSize: '22px' }}>💰</span>
            <span style={{ fontSize: '15px', fontWeight: '500', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>My Portfolio</span>
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
              <>
                <YesterdayQuiz dark={dark} isMobile={isMobile} addIQ={addIQ} earnedBadges={earnedBadges} awardBadge={awardBadge} />
                <FinanceWordle dark={dark} isMobile={isMobile} addIQ={addIQ} />
              </>
            )}

            {activeSection === 'headlines' && !loading && (
              <PredictionGame indices={indices} prediction={prediction} predCorrect={predCorrect} afterClose={afterClose} weekend={weekend} dark={dark} isMobile={isMobile} handlePrediction={handlePrediction} />
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ height: '1px', flex: 1, background: 'var(--border-main)' }} />
              <span style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-ui)' }}>
                {loading ? 'Loading…' : `${articles.length} Stories`}
              </span>
              <div style={{ height: '1px', flex: 1, background: 'var(--border-main)' }} />
            </div>

            {fetchError && (
              <div style={{ background: dark ? '#2D1B00' : '#FFF3CD', border: `1px solid ${dark ? '#7C4A00' : '#FFC107'}`, borderRadius: '12px', padding: '14px 18px', marginBottom: '24px', fontSize: '13px', color: dark ? '#FFC107' : '#856404', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <span><strong>Couldn't load:</strong> {fetchError}</span>
                <button onClick={() => window.location.reload()}
                  style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  Retry
                </button>
              </div>
            )}

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {[0,1,2].map(i => <SkeletonCard key={i} />)}
              </div>
            ) : articles.length === 0 && !fetchError ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>📭</div>
                <p style={{ fontSize: '15px', fontWeight: '500', color: 'var(--text-muted)' }}>No articles in this section yet.</p>
              </div>
            ) : (
              <SwipeDeck articles={articles} dark={dark} isPro={isPro} isBasic={isBasic}
                isMobile={isMobile} onArticleView={trackArticleRead} />
            )}

            <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: `1px solid var(--border-main)`, textAlign: 'center' }}>
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