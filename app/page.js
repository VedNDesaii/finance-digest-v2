'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import ArticleCard from '../components/ArticleCard'
import NewsReader from '../components/NewsReader'
import MyPortfolio from '../components/MyPortfolio'
import { useAuth } from '../hooks/useAuth'

const DESKTOP_NAV = [
  { type: 'label', text: 'GENERAL' },
  { id: 'headlines',       label: 'Major Headlines',  icon: '📰' },
  { id: 'quiz',            label: 'Daily Quiz',       icon: '🧠' },
  { type: 'label', text: 'MARKETS' },
  { id: 'indian-markets',  label: 'Indian Markets',   icon: '🇮🇳' },
  { id: 'us-markets',      label: 'US Markets',       icon: '🇺🇸' },
  { id: 'global-economy',  label: 'Global Economy',   icon: '🌐' },
  { type: 'label', text: 'POLICY' },
  { id: 'macro-policy',    label: 'Macro & Policy',   icon: '🏛️' },
  { id: 'banking-finance', label: 'Banking & Finance', icon: '🏦' },
  { type: 'label', text: 'SECTORS' },
  { id: 'technology-it',   label: 'Technology & IT',  icon: '💻' },
  { id: 'energy-oil',      label: 'Energy & Oil',     icon: '⛽' },
  { id: 'pharma-health',   label: 'Pharma & Health',  icon: '💊' },
  { id: 'auto-ev',         label: 'Auto & EV',        icon: '🚗' },
  { id: 'metals-mining',   label: 'Metals & Mining',  icon: '⚙️' },
  { id: 'real-estate',     label: 'Real Estate',      icon: '🏠' },
  { id: 'fmcg-consumer',   label: 'FMCG & Consumer',  icon: '🛒' },
  { type: 'label', text: 'MORE' },
  { id: 'portfolio',       label: 'My Portfolio',     icon: '💰' },
]

const BOTTOM_TABS = [
  { id: 'top',     icon: '📰', label: 'Top' },
  { id: 'markets', icon: '📈', label: 'Markets' },
  { id: 'sectors', icon: '🏭', label: 'Sectors' },
  { id: 'finance', icon: '🏦', label: 'Finance' },
  { id: 'more',    icon: '⋯',  label: 'More' },
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
  { id: 'real-estate',    label: 'Real Estate', icon: '🏠' },
  { id: 'fmcg-consumer',  label: 'FMCG',        icon: '🛒' },
]

const ALL_SECTIONS = [
  { id: 'headlines',       label: 'Major Headlines'   },
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
  { id: 'real-estate',     label: 'Real Estate'       },
  { id: 'fmcg-consumer',   label: 'FMCG & Consumer'   },
  { id: 'portfolio',       label: 'My Portfolio'      },
]

const SECTOR_IDS = [
  'technology-it','energy-oil','pharma-health','auto-ev','metals-mining',
  'renewables','real-estate','infrastructure','fmcg-consumer','telecom-media',
]

const SIDEBAR_W = 210

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
  if (['indian-markets','us-markets','global-economy'].includes(section)) return 'markets'
  if (SECTOR_IDS.includes(section)) return 'sectors'
  if (['banking-finance','macro-policy'].includes(section)) return 'finance'
  if (section === 'portfolio') return 'more'
  return 'top'
}

// ── Small components ──────────────────────────────────────────────────────────

function IndexChip({ label, data, dark, mobile }) {
  if (!data?.price) return null
  const up = parseFloat(data.change) >= 0
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: mobile ? '4px' : '6px',
      background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      borderRadius: '8px', padding: mobile ? '4px 8px' : '6px 12px',
      border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
    }}>
      <span style={{ fontSize: mobile ? '9px' : '10px', fontFamily: 'var(--font-ui)', fontWeight: '700',
        letterSpacing: '0.04em', textTransform: 'uppercase', color: dark ? '#6B6055' : '#9A8E7E' }}>
        {label}
      </span>
      <span style={{ fontSize: mobile ? '12px' : '13px', fontWeight: '700',
        fontFamily: 'var(--font-ui)', color: dark ? '#F0EBE3' : '#1A1410' }}>
        {data.price}
      </span>
      <span style={{ fontSize: mobile ? '10px' : '11px', fontWeight: '600',
        fontFamily: 'var(--font-ui)', color: up ? '#4ADE80' : '#F87171' }}>
        {up ? '▲' : '▼'} {Math.abs(data.pct)}%
      </span>
    </div>
  )
}

function IQChip({ iq, dark, mobile }) {
  const level = getIQLevel(iq)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '4px',
      background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      borderRadius: '8px', padding: mobile ? '4px 8px' : '5px 10px',
      border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
      flexShrink: 0,
    }}>
      <span style={{ fontSize: mobile ? '11px' : '12px' }}>🧠</span>
      <span style={{ fontSize: mobile ? '11px' : '12px', fontWeight: '700',
        color: level.color, fontFamily: 'var(--font-ui)' }}>
        {iq}
      </span>
    </div>
  )
}

function ThemeToggle({ dark, onToggle, mobile }) {
  return (
    <button onClick={onToggle} style={{
      display: 'flex', alignItems: 'center', gap: '5px',
      padding: mobile ? '5px 8px' : '6px 10px',
      borderRadius: '8px', border: 'none',
      background: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
      color: dark ? '#F0EBE3' : '#1A1410',
      cursor: 'pointer', flexShrink: 0,
    }}>
      <span style={{ fontSize: mobile ? '13px' : '14px' }}>{dark ? '☀️' : '🌙'}</span>
      <span style={{ fontSize: '11px', fontWeight: '600', fontFamily: 'var(--font-ui)',
        color: dark ? '#9A8E7E' : '#7A6B5A' }}>
        {dark ? 'Light' : 'Dark'}
      </span>
    </button>
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
        const tableName = isIndia ? 'indian_market_summary' : 'us_market_summary'
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        if (!error && data) setSummaryData(data)
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
    headline: 'Wall Street rebounded strongly — Nvidia\'s blowout earnings lifted the entire tech sector, and cooling inflation data gave the Fed one less reason to hike.',
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
            display: 'flex', alignItems: 'center', gap: '3px', transition: 'background 0.15s' }}>
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

// ── Yesterday's News Quiz (shown at bottom of headlines) ──────────────────────

function YesterdayQuiz({ dark, isMobile, addIQ, earnedBadges, awardBadge }) {
  const [quiz, setQuiz]       = useState([])
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const todayStr = new Date().toDateString()
    const saved = localStorage.getItem(`fd-yquiz-${todayStr}`)
    if (saved) setAnswers(JSON.parse(saved))
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

      // Build questions from glossary terms
      const allTerms = []
      articles.forEach(article => {
        const g = article.glossary
        if (Array.isArray(g)) {
          g.forEach(item => {
            if (item.term && item.definition && item.definition.length < 150)
              allTerms.push({ ...item, articleTitle: article.title })
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
        const wrongs  = seededShuffle(wrongPool.filter(t => t.term !== term.term), seed + i)
          .slice(0, 3).map(t => t.definition.slice(0, 100))
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
    localStorage.setItem(`fd-yquiz-${todayStr}`, JSON.stringify(updated))
    const correct = optIdx === quiz[qIdx]?.answer
    addIQ(correct ? 20 : 0, correct ? '+20 IQ! Correct! 🎉' : null)
    const totalQuizzes = parseInt(localStorage.getItem('fd-total-quizzes') || '0') + 1
    localStorage.setItem('fd-total-quizzes', totalQuizzes)
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

      {/* Header */}
      <div style={{ padding: '14px 18px', background: dark ? '#1e1a14' : '#1A1410',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>📋</span>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#C9A84C', letterSpacing: '0.1em', fontFamily: 'var(--font-ui)' }}>
              YESTERDAY'S NEWS QUIZ
            </div>
            <div style={{ fontSize: '10px', color: '#6B6055', fontFamily: 'var(--font-ui)', marginTop: '2px' }}>
              Based on yesterday's articles · +20 IQ per correct answer
            </div>
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

      {/* Questions */}
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
                  <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--accent)', fontFamily: 'var(--font-ui)',
                    background: dark ? 'rgba(201,168,76,0.1)' : 'rgba(201,168,76,0.12)',
                    padding: '1px 7px', borderRadius: '20px' }}>Q{qi + 1}</span>
                  {q.hint && (
                    <span style={{ fontSize: '10px', color: dark ? '#4A4438' : '#B8AFA3', fontFamily: 'var(--font-ui)',
                      fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                      from: {q.hint}
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: isMobile ? '13px' : '14px', fontWeight: '700',
                  color: dark ? '#F0EBE3' : '#1A1410', fontFamily: 'var(--font-display)' }}>
                  What does "{q.term}" mean?
                </p>
              </div>

              <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {q.options.map((opt, oi) => {
                  let bg     = 'transparent'
                  let border = dark ? '#2C2822' : '#EDE8E0'
                  let color  = dark ? '#D4C8BC' : '#4A4438'
                  let icon   = null

                  if (answered) {
                    if (oi === q.answer)                  { bg = 'rgba(22,163,74,0.1)';  border = '#16A34A'; color = '#16A34A'; icon = '✓' }
                    else if (oi === selected && !correct) { bg = 'rgba(239,68,68,0.08)'; border = '#EF4444'; color = '#EF4444'; icon = '✗' }
                  }

                  return (
                    <button key={oi} onClick={() => handleAnswer(qi, oi)} style={{
                      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                      padding: '9px 12px', borderRadius: '8px',
                      border: `1px solid ${border}`, background: bg, color,
                      cursor: answered ? 'default' : 'pointer',
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
            <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', fontFamily: 'var(--font-display)',
              color: totalCorrect >= 3 ? '#4ADE80' : '#C9A84C' }}>
              {totalCorrect >= 3 ? '🎉' : '📖'} {totalCorrect}/{quiz.length} correct · +{totalCorrect * 20} IQ earned
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: dark ? '#6B6055' : '#9A8E7E', fontFamily: 'var(--font-ui)' }}>
              {totalCorrect < quiz.length ? 'Read today\'s articles to do better tomorrow!' : 'Excellent! You\'re on top of the news.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Home() {
  const [articles, setArticles]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [activeSection, setActiveSection] = useState('headlines')
  const [sidebarOpen, setSidebarOpen]     = useState(false)
  const [currentIndex, setCurrentIndex]   = useState(0)
  const [fetchError, setFetchError]       = useState(null)
  const [dark, setDark]                   = useState(false)
  const [isMobile, setIsMobile]           = useState(false)
  const [sectionCounts, setSectionCounts] = useState({})
  const [mobileOverlay, setMobileOverlay] = useState(null)
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

  const { user, plan } = useAuth()
  const isPro   = true
  const isBasic = true
  const isFree  = false

  const activeMobileTab = getActiveMobileTab(activeSection)
  const afterClose      = isAfterMarketClose()
  const weekend         = isWeekend()

  useEffect(() => {
    const todayStr = new Date().toDateString()
    const lastVisit  = localStorage.getItem('fd-last-visit')
    const currStreak = parseInt(localStorage.getItem('fd-streak') || '0')
    if (lastVisit === todayStr) {
      setStreak(currStreak)
    } else {
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
      const isConsec  = lastVisit === yesterday.toDateString()
      const newStreak = isConsec ? currStreak + 1 : 1
      localStorage.setItem('fd-streak', newStreak)
      localStorage.setItem('fd-last-visit', todayStr)
      setStreak(newStreak)
    }
    const savedIQ = parseInt(localStorage.getItem('fd-iq') || '0')
    setIqScore(savedIQ)
    const savedBadges = JSON.parse(localStorage.getItem('fd-badges') || '[]')
    setEarnedBadges(savedBadges)
    const savedPred = localStorage.getItem(`fd-pred-${todayStr}`)
    if (savedPred) setPrediction(savedPred)
    const ist = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
    if (ist.getHours() < 9) awardBadge('earlybird', savedBadges)
  }, [])

  useEffect(() => {
    if (!prediction || !indices.nifty?.pct || predCorrect !== null) return
    if (!afterClose) return
    const niftyUp = parseFloat(indices.nifty.pct) >= 0
    const correct = (prediction === 'up' && niftyUp) || (prediction === 'down' && !niftyUp)
    setPredCorrect(correct)
    if (correct) {
      addIQ(30, '+30 IQ! Correct prediction 🎯')
      const predStreak = parseInt(localStorage.getItem('fd-pred-streak') || '0') + 1
      localStorage.setItem('fd-pred-streak', predStreak)
      if (predStreak >= 3) awardBadge('predict3', earnedBadges)
    } else {
      localStorage.setItem('fd-pred-streak', '0')
    }
  }, [indices, afterClose, prediction])

  useEffect(() => {
    if (streak >= 7)  awardBadge('streak7',  earnedBadges)
    if (streak >= 30) awardBadge('streak30', earnedBadges)
  }, [streak])

  function addIQ(points, msg) {
    setIqScore(prev => {
      const newScore = prev + points
      localStorage.setItem('fd-iq', newScore)
      if (newScore >= 500 && prev < 500) awardBadge('iq500', earnedBadges)
      return newScore
    })
    if (msg) {
      setShowPointPop(msg)
      setTimeout(() => setShowPointPop(null), 2500)
    }
  }

  function awardBadge(id, existing = earnedBadges) {
    if (existing.includes(id)) return
    const updated = [...existing, id]
    setEarnedBadges(updated)
    localStorage.setItem('fd-badges', JSON.stringify(updated))
  }

  function handlePrediction(dir) {
    if (prediction || afterClose || weekend) return
    const todayStr = new Date().toDateString()
    setPrediction(dir)
    localStorage.setItem(`fd-pred-${todayStr}`, dir)
  }

  function trackArticleRead() {
    const totalArticles = parseInt(localStorage.getItem('fd-articles-read') || '0') + 1
    localStorage.setItem('fd-articles-read', totalArticles)
    addIQ(5, null)
    if (totalArticles >= 50) awardBadge('articles50', earnedBadges)
  }

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => { if (!isMobile) setSidebarOpen(true) }, [isMobile])

  const isPortfolio = activeSection === 'portfolio'

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    const saved = localStorage.getItem('fd-theme')
    if (saved === 'dark') setDark(true)
  }, [])

  const toggleTheme = () => {
    setDark(d => {
      localStorage.setItem('fd-theme', !d ? 'dark' : 'light')
      return !d
    })
  }

  useEffect(() => {
    async function fetchCounts() {
      try {
        const { data } = await supabase.from('processed_articles').select('category, is_headline')
        if (!data) return
        const counts = {}
        let headlineCount = 0
        data.forEach(row => {
          const cat = row.category
          if (cat) counts[cat] = (counts[cat] || 0) + 1
          if (row.is_headline) headlineCount++
        })
        counts['headlines'] = headlineCount
        setSectionCounts(counts)
      } catch (e) { console.error('Count fetch failed', e) }
    }
    fetchCounts()
  }, [])

  useEffect(() => {
    if (!isPortfolio) fetchArticles(activeSection)
  }, [activeSection])

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
    setLoading(true); setCurrentIndex(0); setFetchError(null)
    try {
      let query = supabase
        .from('processed_articles').select('*')
        .order('created_at', { ascending: false })
        .limit(section === 'headlines' ? 20 : 12)
      if (section === 'headlines') query = query.eq('is_headline', true)
      else query = query.eq('category', section)
      const { data, error } = await query
      if (error) { setFetchError(error.message); setArticles([]) }
      else setArticles(data || [])
    } catch (e) {
      setFetchError(e.message); setArticles([])
    } finally { setLoading(false) }
  }

  function handleSectionClick(id) {
    setActiveSection(id); setMobileOverlay(null)
    if (isMobile) setSidebarOpen(false)
  }

  function handleMobileTabClick(tabId) {
    if (tabId === 'top') handleSectionClick('headlines')
    else if (tabId === 'finance') handleSectionClick('banking-finance')
    else setMobileOverlay(mobileOverlay === tabId ? null : tabId)
  }

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: isMobile ? 'short' : 'long',
    year: 'numeric', month: isMobile ? 'short' : 'long', day: 'numeric',
  })
  const activeSectionLabel = ALL_SECTIONS.find(s => s.id === activeSection)?.label || ''
  const iqLevel = getIQLevel(iqScore)

  const BadgeWall = ({ compact = false }) => (
    <div style={{ marginBottom: compact ? '8px' : '16px' }}>
      {!compact && <p style={{ fontSize: '9px', fontWeight: '700', letterSpacing: '0.1em',
        color: dark ? '#4A4438' : '#C4B9AE', margin: '12px 0 8px 12px', fontFamily: 'var(--font-ui)' }}>BADGES</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: compact ? '0' : '0 12px' }}>
        {ALL_BADGES.map(b => {
          const earned = earnedBadges.includes(b.id)
          return (
            <div key={b.id} title={`${b.name}: ${b.desc}`} style={{
              width: compact ? '30px' : '34px', height: compact ? '30px' : '34px',
              borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: compact ? '16px' : '18px',
              background: earned ? (dark ? 'rgba(201,168,76,0.15)' : 'rgba(201,168,76,0.12)') : (dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)'),
              border: `1px solid ${earned ? 'rgba(201,168,76,0.3)' : (dark ? '#2C2822' : '#EDE8E0')}`,
              filter: earned ? 'none' : 'grayscale(1) opacity(0.3)', cursor: 'help', transition: 'all 0.2s',
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

  // ── Fix: calculate header height accurately ──
  const hasNewsReader = !isPortfolio && articles.length > 0 && isPro
  const headerH = isMobile
    ? (hasNewsReader ? 148 : 92)
    : (hasNewsReader ? 112 : 76)

  const sidebarItemStyle = (id) => {
    const active = activeSection === id
    return {
      display: 'flex', alignItems: 'center', gap: '9px',
      width: '100%', textAlign: 'left', padding: '9px 12px', marginBottom: '1px',
      borderRadius: '9px', border: 'none',
      background: active ? (dark ? 'rgba(232,151,62,0.12)' : 'rgba(212,135,60,0.10)') : 'transparent',
      color: active ? (dark ? '#E8973E' : '#B86E22') : (dark ? '#7A6B5A' : '#6B5E4E'),
      fontSize: '13px', fontWeight: active ? '600' : '400',
      cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
      fontFamily: 'var(--font-ui)',
      borderLeft: active ? `2px solid ${dark ? '#E8973E' : '#D4873C'}` : '2px solid transparent',
      whiteSpace: 'nowrap',
    }
  }

  return (
    <div style={{ background: 'var(--bg-page)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>

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

      {isMobile && mobileOverlay && (
        <div onClick={() => setMobileOverlay(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          zIndex: 38, backdropFilter: 'blur(2px)',
        }} />
      )}

      {/* ── Desktop sidebar ── */}
      {!isMobile && sidebarOpen && (
        <aside style={{
          position: 'fixed', top: 0, left: 0, width: `${SIDEBAR_W}px`, height: '100vh',
          background: 'var(--bg-sidebar)', boxShadow: 'var(--shadow-sidebar)',
          zIndex: 30, overflowY: 'auto',
          transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1)',
        }}>
          <div style={{ padding: '20px 12px 40px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '16px', padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ height: '3px', borderRadius: '2px', marginBottom: '8px', background: 'linear-gradient(90deg, var(--accent), #F0A84A, var(--accent))' }} />
                <span style={{ fontSize: '15px', fontWeight: '700', letterSpacing: '-0.02em', fontFamily: 'var(--font-display)', color: dark ? '#F0EBE3' : '#1A1410' }}>
                  Finance <span style={{ color: 'var(--accent)' }}>Digest</span>
                </span>
              </div>
              <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: dark ? '#4A4438' : '#C4B9AE', fontSize: '18px', padding: '4px' }}>✕</button>
            </div>

            <div style={{ padding: '12px', marginBottom: '12px', borderRadius: '10px',
              background: dark ? 'rgba(201,168,76,0.08)' : 'rgba(201,168,76,0.06)',
              border: `1px solid ${dark ? 'rgba(201,168,76,0.2)' : 'rgba(201,168,76,0.15)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent)', fontFamily: 'var(--font-ui)' }}>🧠 Finance IQ</span>
                <span style={{ fontSize: '16px', fontWeight: '700', color: iqLevel.color, fontFamily: 'var(--font-ui)' }}>{iqScore}</span>
              </div>
              <p style={{ margin: '0 0 8px', fontSize: '10px', color: iqLevel.color, fontFamily: 'var(--font-ui)', fontWeight: '600' }}>{iqLevel.title}</p>
              <div style={{ height: '4px', borderRadius: '2px', background: dark ? '#2C2822' : '#EDE8E0', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '2px', background: 'linear-gradient(90deg, var(--accent), #F0A84A)', width: `${Math.min((iqScore % 500) / 5, 100)}%`, transition: 'width 0.5s ease' }} />
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '9px', color: dark ? '#4A4438' : '#C4B9AE', fontFamily: 'var(--font-ui)' }}>
                {streak > 0 && `🔥 ${streak} day streak  ·  `}{earnedBadges.length}/{ALL_BADGES.length} badges
              </p>
            </div>

            <BadgeWall compact={false} />

            {DESKTOP_NAV.map((item, i) => {
              if (item.type === 'label') return (
                <p key={i} style={{ fontSize: '9px', fontWeight: '700', letterSpacing: '0.1em', color: dark ? '#4A4438' : '#C4B9AE', margin: '12px 0 4px 12px', fontFamily: 'var(--font-ui)' }}>{item.text}</p>
              )
              const count  = sectionCounts[item.id]
              const active = activeSection === item.id
              return (
                <button key={item.id} onClick={() => handleSectionClick(item.id)} style={sidebarItemStyle(item.id)}>
                  <span style={{ fontSize: '14px', lineHeight: 1 }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {count > 0 && <Badge count={count} active={active} dark={dark} />}
                </button>
              )
            })}
          </div>
        </aside>
      )}

      {/* ── Header ── */}
      <header style={{
        position: 'fixed', top: 0,
        left: (!isMobile && sidebarOpen) ? `${SIDEBAR_W}px` : 0, right: 0,
        background: 'var(--bg-header)', boxShadow: 'var(--shadow-header)',
        zIndex: 20, transition: isMobile ? 'none' : 'left 0.28s cubic-bezier(0.4,0,0.2,1)',
      }}>
        <div style={{ height: '3px', background: 'linear-gradient(90deg, var(--accent), #F0A84A, var(--accent))' }} />

        {isMobile ? (
          <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h1 style={{ fontSize: '18px', fontWeight: '700', color: dark ? '#F0EBE3' : '#1A1410', margin: '0', letterSpacing: '-0.03em', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>
                Finance <span style={{ color: 'var(--accent)' }}>Digest</span>
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <IQChip iq={iqScore} dark={dark} mobile={true} />
                <ThemeToggle dark={dark} onToggle={toggleTheme} mobile={true} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <IndexChip label="SENSEX" data={indices.sensex} dark={dark} mobile={true} />
                <IndexChip label="NIFTY 50" data={indices.nifty} dark={dark} mobile={true} />
              </div>
              <span style={{ fontSize: '10px', fontWeight: '600', letterSpacing: '0.06em', color: 'var(--accent)', textTransform: 'uppercase', fontFamily: 'var(--font-ui)' }}>
                {activeSectionLabel}
              </span>
            </div>
          </div>
        ) : (
          <div style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
              <button onClick={() => setSidebarOpen(o => !o)} style={{ background: 'none', border: 'none', color: dark ? '#6B6055' : '#9A8E7E', fontSize: '20px', cursor: 'pointer', padding: '4px', lineHeight: 1, flexShrink: 0 }}>☰</button>
              <div>
                <h1 style={{ fontSize: '22px', fontWeight: '700', color: dark ? '#F0EBE3' : '#1A1410', margin: '0', letterSpacing: '-0.03em', fontFamily: 'var(--font-display)', lineHeight: 1.1 }}>
                  Finance <span style={{ color: 'var(--accent)' }}>Digest</span>
                </h1>
                <p style={{ fontSize: '10px', color: dark ? '#4A4438' : '#B8AFA3', margin: '2px 0 0', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                  {today}{activeSectionLabel && <span style={{ color: 'var(--accent)', marginLeft: '6px' }}>· {activeSectionLabel}</span>}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <IndexChip label="SENSEX" data={indices.sensex} dark={dark} mobile={false} />
              <IndexChip label="NIFTY 50" data={indices.nifty} dark={dark} mobile={false} />
              <IQChip iq={iqScore} dark={dark} mobile={false} />
              <ThemeToggle dark={dark} onToggle={toggleTheme} mobile={false} />
            </div>
          </div>
        )}

        {hasNewsReader && (
          <div style={{ borderTop: `1px solid ${dark ? '#2C2822' : '#EDE8E0'}`, background: dark ? '#111009' : '#FAFAF7' }}>
            <div style={{ padding: isMobile ? '8px 16px' : '9px 24px' }}>
              <NewsReader newsItems={articles} currentIndex={currentIndex} onIndexChange={setCurrentIndex} dark={dark} />
            </div>
          </div>
        )}
      </header>

      {/* ── Mobile bottom tabs ── */}
      {isMobile && (
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, height: '62px',
          background: dark ? '#1A1410' : '#fff',
          borderTop: `1px solid ${dark ? '#2C2822' : '#EDE8E0'}`,
          display: 'flex', alignItems: 'center', zIndex: 40,
          boxShadow: dark ? 'none' : '0 -4px 20px rgba(0,0,0,0.06)',
        }}>
          {BOTTOM_TABS.map(tab => {
            const isActive = activeMobileTab === tab.id || mobileOverlay === tab.id
            return (
              <button key={tab.id} onClick={() => handleMobileTabClick(tab.id)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', border: 'none', background: 'none', cursor: 'pointer', height: '100%', position: 'relative' }}>
                {isActive && <div style={{ position: 'absolute', top: '6px', width: '20px', height: '2px', background: '#C9A84C', borderRadius: '1px' }} />}
                <span style={{ fontSize: '22px', lineHeight: 1, filter: isActive ? 'none' : 'grayscale(0.3) opacity(0.7)', transform: isActive ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.15s' }}>{tab.icon}</span>
                <span style={{ fontSize: '10px', fontWeight: isActive ? '700' : '400', color: isActive ? '#C9A84C' : (dark ? '#6B6055' : '#9A8E7E'), fontFamily: 'var(--font-ui)' }}>{tab.label}</span>
              </button>
            )
          })}
        </nav>
      )}

      {/* ── Mobile overlays ── */}
      {isMobile && mobileOverlay === 'markets' && (
        <div style={{ position: 'fixed', bottom: '62px', left: 0, right: 0, background: dark ? '#1A1410' : '#fff', borderTop: `1px solid ${dark ? '#2C2822' : '#EDE8E0'}`, borderRadius: '20px 20px 0 0', padding: '16px', zIndex: 39, boxShadow: '0 -8px 32px rgba(0,0,0,0.12)', animation: 'slideUp 0.25s ease' }}>
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

      {isMobile && mobileOverlay === 'sectors' && (
        <div style={{ position: 'fixed', bottom: '62px', left: 0, right: 0, background: dark ? '#1A1410' : '#fff', borderTop: `1px solid ${dark ? '#2C2822' : '#EDE8E0'}`, borderRadius: '20px 20px 0 0', padding: '16px', zIndex: 39, boxShadow: '0 -8px 32px rgba(0,0,0,0.12)', animation: 'slideUp 0.25s ease' }}>
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

      {isMobile && mobileOverlay === 'more' && (
        <div style={{ position: 'fixed', bottom: '62px', left: 0, right: 0, background: dark ? '#1A1410' : '#fff', borderTop: `1px solid ${dark ? '#2C2822' : '#EDE8E0'}`, borderRadius: '20px 20px 0 0', padding: '16px', zIndex: 39, boxShadow: '0 -8px 32px rgba(0,0,0,0.12)', animation: 'slideUp 0.25s ease' }}>
          <div style={{ width: '36px', height: '3px', background: dark ? '#3A3028' : '#EDE8E0', borderRadius: '2px', margin: '0 auto 16px' }} />
          <div style={{ padding: '12px 14px', marginBottom: '12px', borderRadius: '12px', background: dark ? 'rgba(201,168,76,0.08)' : 'rgba(201,168,76,0.06)', border: `1px solid ${dark ? 'rgba(201,168,76,0.2)' : 'rgba(201,168,76,0.15)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--accent)', fontFamily: 'var(--font-ui)' }}>🧠 Finance IQ: {iqScore}</span>
              <span style={{ fontSize: '11px', color: iqLevel.color, fontFamily: 'var(--font-ui)', fontWeight: '600' }}>{iqLevel.title}</span>
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
        marginLeft: (!isMobile && sidebarOpen) ? `${SIDEBAR_W}px` : 0,
        paddingTop: `${headerH}px`, paddingBottom: isMobile ? '80px' : 0,
        transition: isMobile ? 'none' : 'margin-left 0.28s cubic-bezier(0.4,0,0.2,1)',
        minHeight: '100vh',
      }}>
        {isPortfolio ? (
          <MyPortfolio />
        ) : (
          <div style={{ maxWidth: '820px', margin: '0 auto', padding: isMobile ? '16px 14px 20px' : '32px 24px 72px' }}>

            {/* Market Summary Card */}
            {(activeSection === 'indian-markets' || activeSection === 'us-markets') && (
              <MarketSummaryCard market={activeSection} dark={dark} isMobile={isMobile} />
            )}

            {/* Daily Quiz section */}
            {activeSection === 'quiz' && (
              <YesterdayQuiz
                dark={dark} isMobile={isMobile}
                addIQ={addIQ} earnedBadges={earnedBadges} awardBadge={awardBadge}
              />
            )}

            {/* Prediction Game — headlines only */}
            {activeSection === 'headlines' && !loading && (
              <PredictionGame
                indices={indices} prediction={prediction} predCorrect={predCorrect}
                afterClose={afterClose} weekend={weekend} dark={dark}
                isMobile={isMobile} handlePrediction={handlePrediction}
              />
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
        @keyframes slideUp  { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes fadeIn   { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateX(-50%) translateY(10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes fadeOut  { from { opacity: 1; } to { opacity: 0; } }
      `}</style>
    </div>
  )
}