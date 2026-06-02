'use client'
import { useState, useEffect, useRef } from 'react'

const STOCK_LIST = [
  { ticker: 'RELIANCE',   name: 'Reliance Industries',           exchange: 'NSE' },
  { ticker: 'TCS',        name: 'Tata Consultancy Services',     exchange: 'NSE' },
  { ticker: 'HDFCBANK',   name: 'HDFC Bank',                     exchange: 'NSE' },
  { ticker: 'INFY',       name: 'Infosys',                       exchange: 'NSE' },
  { ticker: 'ICICIBANK',  name: 'ICICI Bank',                    exchange: 'NSE' },
  { ticker: 'HINDUNILVR', name: 'Hindustan Unilever',            exchange: 'NSE' },
  { ticker: 'ITC',        name: 'ITC Limited',                   exchange: 'NSE' },
  { ticker: 'SBIN',       name: 'State Bank of India',           exchange: 'NSE' },
  { ticker: 'BHARTIARTL', name: 'Bharti Airtel',                 exchange: 'NSE' },
  { ticker: 'KOTAKBANK',  name: 'Kotak Mahindra Bank',           exchange: 'NSE' },
  { ticker: 'LT',         name: 'Larsen & Toubro',               exchange: 'NSE' },
  { ticker: 'HCLTECH',    name: 'HCL Technologies',              exchange: 'NSE' },
  { ticker: 'ASIANPAINT', name: 'Asian Paints',                  exchange: 'NSE' },
  { ticker: 'AXISBANK',   name: 'Axis Bank',                     exchange: 'NSE' },
  { ticker: 'MARUTI',     name: 'Maruti Suzuki',                 exchange: 'NSE' },
  { ticker: 'SUNPHARMA',  name: 'Sun Pharmaceutical',            exchange: 'NSE' },
  { ticker: 'TITAN',      name: 'Titan Company',                 exchange: 'NSE' },
  { ticker: 'BAJFINANCE', name: 'Bajaj Finance',                 exchange: 'NSE' },
  { ticker: 'WIPRO',      name: 'Wipro',                         exchange: 'NSE' },
  { ticker: 'ULTRACEMCO', name: 'UltraTech Cement',              exchange: 'NSE' },
  { ticker: 'NESTLEIND',  name: 'Nestle India',                  exchange: 'NSE' },
  { ticker: 'POWERGRID',  name: 'Power Grid Corporation',        exchange: 'NSE' },
  { ticker: 'NTPC',       name: 'NTPC Limited',                  exchange: 'NSE' },
  { ticker: 'ONGC',       name: 'Oil & Natural Gas Corp',        exchange: 'NSE' },
  { ticker: 'TATAMOTORS', name: 'Tata Motors',                   exchange: 'NSE' },
  { ticker: 'TATASTEEL',  name: 'Tata Steel',                    exchange: 'NSE' },
  { ticker: 'ADANIENT',   name: 'Adani Enterprises',             exchange: 'NSE' },
  { ticker: 'ADANIPORTS', name: 'Adani Ports & SEZ',             exchange: 'NSE' },
  { ticker: 'JSWSTEEL',   name: 'JSW Steel',                     exchange: 'NSE' },
  { ticker: 'TECHM',      name: 'Tech Mahindra',                 exchange: 'NSE' },
  { ticker: 'DRREDDY',    name: "Dr. Reddy's Laboratories",      exchange: 'NSE' },
  { ticker: 'BAJAJFINSV', name: 'Bajaj Finserv',                 exchange: 'NSE' },
  { ticker: 'DIVISLAB',   name: "Divi's Laboratories",           exchange: 'NSE' },
  { ticker: 'CIPLA',      name: 'Cipla',                         exchange: 'NSE' },
  { ticker: 'EICHERMOT',  name: 'Eicher Motors',                 exchange: 'NSE' },
  { ticker: 'GRASIM',     name: 'Grasim Industries',             exchange: 'NSE' },
  { ticker: 'BPCL',       name: 'Bharat Petroleum',              exchange: 'NSE' },
  { ticker: 'COALINDIA',  name: 'Coal India',                    exchange: 'NSE' },
  { ticker: 'HINDALCO',   name: 'Hindalco Industries',           exchange: 'NSE' },
  { ticker: 'INDUSINDBK', name: 'IndusInd Bank',                 exchange: 'NSE' },
  { ticker: 'M&M',        name: 'Mahindra & Mahindra',           exchange: 'NSE' },
  { ticker: 'ZOMATO',     name: 'Zomato',                        exchange: 'NSE' },
  { ticker: 'IRCTC',      name: 'Indian Railway Catering',       exchange: 'NSE' },
  { ticker: 'AAPL',       name: 'Apple Inc.',                    exchange: 'NASDAQ' },
  { ticker: 'MSFT',       name: 'Microsoft Corporation',         exchange: 'NASDAQ' },
  { ticker: 'GOOGL',      name: 'Alphabet (Google)',             exchange: 'NASDAQ' },
  { ticker: 'AMZN',       name: 'Amazon.com',                    exchange: 'NASDAQ' },
  { ticker: 'NVDA',       name: 'NVIDIA Corporation',            exchange: 'NASDAQ' },
  { ticker: 'META',       name: 'Meta Platforms',                exchange: 'NASDAQ' },
  { ticker: 'TSLA',       name: 'Tesla Inc.',                    exchange: 'NASDAQ' },
  { ticker: 'NFLX',       name: 'Netflix Inc.',                  exchange: 'NASDAQ' },
  { ticker: 'JPM',        name: 'JPMorgan Chase',                exchange: 'NYSE' },
  { ticker: 'V',          name: 'Visa Inc.',                     exchange: 'NYSE' },
  { ticker: 'BAC',        name: 'Bank of America',               exchange: 'NYSE' },
  { ticker: 'UBER',       name: 'Uber Technologies',             exchange: 'NYSE' },
]

const NEWS_TYPE_BADGE = {
  earnings:   { label: 'Earnings',   color: '#C9A84C', bg: 'rgba(201,168,76,0.12)'  },
  regulatory: { label: 'Regulatory', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)'  },
  management: { label: 'Management', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  analyst:    { label: 'Analyst',    color: '#34d399', bg: 'rgba(52,211,153,0.12)'  },
  macro:      { label: 'Macro',      color: '#fb923c', bg: 'rgba(251,146,60,0.12)'  },
  other:      { label: 'News',       color: '#9a8e7e', bg: 'rgba(154,142,126,0.12)' },
}

// ── helpers ──────────────────────────────────────────────────────────────────
function fmtPrice(p, currency) {
  if (!p) return '—'
  const sym = currency === 'INR' ? '₹' : '$'
  return `${sym}${Number(p).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

function fmtPct(p) {
  const n = parseFloat(p)
  if (isNaN(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

// ── StockSearch ───────────────────────────────────────────────────────────────
function StockSearch({ onSelect, onCancel, existingStocks }) {
  const [query, setQuery]           = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const results = query.length === 0 ? [] : STOCK_LIST.filter(s =>
    !existingStocks.includes(s.ticker) &&
    (s.ticker.toLowerCase().includes(query.toLowerCase()) ||
      s.name.toLowerCase().includes(query.toLowerCase()))
  ).slice(0, 8)

  function handleKey(e) {
    if (e.key === 'ArrowDown')  { setHighlighted(h => Math.min(h + 1, results.length - 1)); e.preventDefault() }
    if (e.key === 'ArrowUp')    { setHighlighted(h => Math.max(h - 1, 0)); e.preventDefault() }
    if (e.key === 'Enter' && results[highlighted]) { onSelect(results[highlighted]); e.preventDefault() }
    if (e.key === 'Escape') onCancel()
  }

  return (
    <div style={{ animation: 'fadeIn 0.15s ease' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        background: '#1e1a15', border: '1px solid rgba(201,168,76,0.4)',
        borderRadius: results.length > 0 ? '12px 12px 0 0' : '12px',
        padding: '11px 14px',
      }}>
        <span style={{ color: '#6b6055', fontSize: '14px' }}>🔍</span>
        <input ref={inputRef} value={query}
          onChange={e => { setQuery(e.target.value); setHighlighted(0) }}
          onKeyDown={handleKey}
          placeholder="Search by name or ticker..."
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontFamily: 'sans-serif', fontSize: '14px' }}
        />
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: '#9a8e7e', fontFamily: 'sans-serif', fontSize: '13px', cursor: 'pointer', padding: 0 }}>Cancel</button>
      </div>

      {results.length > 0 && (
        <div style={{ background: '#1e1a15', border: '1px solid rgba(201,168,76,0.4)', borderTop: '1px solid rgba(255,255,255,0.04)', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
          {results.map((s, i) => (
            <div key={s.ticker} onClick={() => onSelect(s)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '11px 14px', cursor: 'pointer',
              background: i === highlighted ? 'rgba(201,168,76,0.1)' : 'transparent',
              borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
            }} onMouseEnter={() => setHighlighted(i)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800', color: '#C9A84C', fontFamily: 'sans-serif', flexShrink: 0 }}>
                  {s.ticker.slice(0, 2)}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#fff', fontFamily: 'sans-serif' }}>{s.ticker}</p>
                  <p style={{ margin: 0, fontSize: '11px', color: '#6b6055', fontFamily: 'sans-serif' }}>{s.name}</p>
                </div>
              </div>
              <span style={{ fontSize: '10px', color: '#9a8e7e', fontFamily: 'sans-serif', background: 'rgba(255,255,255,0.06)', padding: '2px 7px', borderRadius: '6px', fontWeight: '600' }}>{s.exchange}</span>
            </div>
          ))}
        </div>
      )}

      {query.length > 0 && results.length === 0 && (
        <div style={{ background: '#1e1a15', border: '1px solid rgba(201,168,76,0.2)', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '14px', textAlign: 'center', color: '#6b6055', fontFamily: 'sans-serif', fontSize: '13px' }}>
          No results for "{query}"
        </div>
      )}
    </div>
  )
}

// ── BuyDetailsForm ────────────────────────────────────────────────────────────
function BuyDetailsForm({ stock, onConfirm, onSkip }) {
  const [buyPrice, setBuyPrice]   = useState('')
  const [quantity, setQuantity]   = useState('')

  return (
    <div style={{
      background: '#1e1a15', border: '1px solid rgba(201,168,76,0.3)',
      borderRadius: '14px', padding: '20px', animation: 'fadeIn 0.2s ease',
    }}>
      <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: '700', color: '#fff', fontFamily: 'sans-serif' }}>
        Added <span style={{ color: '#C9A84C' }}>{stock.ticker}</span>
      </p>
      <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#6b6055', fontFamily: 'sans-serif' }}>
        Add buy details to track your returns vs Nifty 50 (optional)
      </p>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '10px', fontWeight: '700', color: '#9a8e7e', fontFamily: 'sans-serif', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>
            BUY PRICE ({stock.exchange === 'NSE' ? '₹' : '$'})
          </label>
          <input
            type="number" value={buyPrice}
            onChange={e => setBuyPrice(e.target.value)}
            placeholder={stock.exchange === 'NSE' ? 'e.g. 2450' : 'e.g. 185'}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px', padding: '8px 12px', color: '#fff',
              fontFamily: 'sans-serif', fontSize: '14px', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '10px', fontWeight: '700', color: '#9a8e7e', fontFamily: 'sans-serif', letterSpacing: '0.08em', display: 'block', marginBottom: '6px' }}>
            QUANTITY
          </label>
          <input
            type="number" value={quantity}
            onChange={e => setQuantity(e.target.value)}
            placeholder="e.g. 10"
            style={{
              width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px', padding: '8px 12px', color: '#fff',
              fontFamily: 'sans-serif', fontSize: '14px', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={() => onConfirm(buyPrice ? parseFloat(buyPrice) : null, quantity ? parseFloat(quantity) : null)} style={{
          flex: 1, padding: '9px', borderRadius: '8px', border: 'none',
          background: '#C9A84C', color: '#1A1410', fontFamily: 'sans-serif',
          fontSize: '13px', fontWeight: '700', cursor: 'pointer',
        }}>
          {buyPrice ? 'Save & Track' : 'Add Without Price'}
        </button>
        <button onClick={onSkip} style={{
          padding: '9px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
          background: 'transparent', color: '#9a8e7e', fontFamily: 'sans-serif',
          fontSize: '13px', cursor: 'pointer',
        }}>
          Skip
        </button>
      </div>
    </div>
  )
}

// ── NiftyBanner ───────────────────────────────────────────────────────────────
function NiftyBanner({ stocks, priceData }) {
  const trackedStocks = stocks.filter(s => s.buyPrice && s.quantity && priceData[s.ticker])

  if (trackedStocks.length === 0) {
    return (
      <div style={{
        background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)',
        borderRadius: '14px', padding: '16px 20px', marginBottom: '20px',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <span style={{ fontSize: '24px' }}>📊</span>
        <div>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#C9A84C', fontFamily: 'sans-serif' }}>
            Track your returns vs Nifty 50
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#6b6055', fontFamily: 'sans-serif' }}>
            Add buy price & quantity to any stock to see how you compare
          </p>
        </div>
      </div>
    )
  }

  // Calculate portfolio totals
  let totalInvested = 0
  let totalCurrent  = 0

  trackedStocks.forEach(s => {
    const pd = priceData[s.ticker]
    if (!pd?.price) return
    totalInvested += s.buyPrice * s.quantity
    totalCurrent  += pd.price * s.quantity
  })

  const portfolioReturn = totalInvested > 0
    ? ((totalCurrent - totalInvested) / totalInvested) * 100
    : 0

  // Get Nifty return from indices API
  const niftyPct = priceData['NIFTY']?.changePct ?? null
  const diff     = niftyPct !== null ? portfolioReturn - parseFloat(niftyPct) : null

  const isWinning = diff !== null && diff > 0
  const currency  = trackedStocks[0]?.exchange === 'NSE' ? '₹' : '$'
  const pnl       = totalCurrent - totalInvested

  return (
    <div style={{
      background: isWinning ? 'rgba(22,163,74,0.08)' : 'rgba(248,113,113,0.06)',
      border: `1px solid ${isWinning ? 'rgba(22,163,74,0.25)' : 'rgba(248,113,113,0.2)'}`,
      borderRadius: '14px', padding: '20px', marginBottom: '20px',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <p style={{ margin: '0 0 2px', fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', color: '#6b6055', fontFamily: 'sans-serif', textTransform: 'uppercase' }}>
            Portfolio Value
          </p>
          <p style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#fff', fontFamily: 'sans-serif' }}>
            {currency}{totalCurrent.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#6b6055', fontFamily: 'sans-serif' }}>
            Invested: {currency}{totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: '0 0 2px', fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', color: '#6b6055', fontFamily: 'sans-serif', textTransform: 'uppercase' }}>
            Total Return
          </p>
          <p style={{ margin: 0, fontSize: '22px', fontWeight: '700', fontFamily: 'sans-serif',
            color: portfolioReturn >= 0 ? '#4ADE80' : '#F87171' }}>
            {portfolioReturn >= 0 ? '+' : ''}{portfolioReturn.toFixed(2)}%
          </p>
          <p style={{ margin: '3px 0 0', fontSize: '12px', fontFamily: 'sans-serif',
            color: pnl >= 0 ? '#4ADE80' : '#F87171' }}>
            {pnl >= 0 ? '+' : ''}{currency}{Math.abs(pnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {/* Nifty comparison */}
      {diff !== null && (
        <div style={{
          background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span style={{ fontSize: '20px' }}>{isWinning ? '🎉' : '📉'}</span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', fontFamily: 'sans-serif',
              color: isWinning ? '#4ADE80' : '#F87171' }}>
              {isWinning
                ? `Beating Nifty 50 by ${Math.abs(diff).toFixed(2)}%`
                : `Underperforming Nifty 50 by ${Math.abs(diff).toFixed(2)}%`}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#6b6055', fontFamily: 'sans-serif' }}>
              Your return: {portfolioReturn >= 0 ? '+' : ''}{portfolioReturn.toFixed(2)}% · Nifty 50: {parseFloat(niftyPct) >= 0 ? '+' : ''}{parseFloat(niftyPct).toFixed(2)}%
            </p>
          </div>
        </div>
      )}

      <p style={{ margin: '10px 0 0', fontSize: '10px', color: '#4a3f35', fontFamily: 'sans-serif', textAlign: 'center' }}>
        {trackedStocks.length} of {stocks.length} stocks tracked · Based on overall returns since buy price
      </p>
    </div>
  )
}

// ── StockCard ─────────────────────────────────────────────────────────────────
function StockCard({ stock, onRemove, forceRefresh, priceData }) {
  const [news, setNews]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const fetchedAt = useRef(null)

  useEffect(() => { if (forceRefresh) fetchNews(true) }, [forceRefresh])

  async function fetchNews(force = false) {
    if (news && !force) {
      const age = Date.now() - fetchedAt.current
      if (age < 24 * 60 * 60 * 1000) { setExpanded(e => !e); return }
    }
    setLoading(true); setExpanded(true); setNews(null)
    try {
      const res = await fetch('/api/portfolio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: stock.ticker, name: stock.name, exchange: stock.exchange }),
      })
      const data = await res.json()
      fetchedAt.current = Date.now()
      setNews(data.error ? { error: data.error } : data)
    } catch (e) { setNews({ error: 'Could not fetch news.' }) }
    setLoading(false)
  }

  const pd        = priceData?.[stock.ticker]
  const hasBuy    = stock.buyPrice && stock.quantity
  const pnl       = hasBuy && pd?.price ? (pd.price - stock.buyPrice) * stock.quantity : null
  const pnlPct    = hasBuy && pd?.price ? ((pd.price - stock.buyPrice) / stock.buyPrice) * 100 : null
  const currency  = stock.exchange === 'NSE' ? '₹' : '$'

  return (
    <div style={{
      background: '#1e1a15', border: '1px solid rgba(201,168,76,0.12)',
      borderRadius: '14px', overflow: 'hidden', transition: 'border-color 0.2s',
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(201,168,76,0.35)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(201,168,76,0.12)'}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', cursor: 'pointer' }}
        onClick={() => fetchNews(false)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(201,168,76,0.25), rgba(201,168,76,0.08))', border: '1px solid rgba(201,168,76,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800', color: '#C9A84C', fontFamily: 'sans-serif', flexShrink: 0 }}>
            {stock.ticker.slice(0, 2)}
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#fff', fontFamily: 'sans-serif' }}>{stock.ticker}</p>
            <p style={{ margin: 0, fontSize: '11px', color: '#6b6055', fontFamily: 'sans-serif', marginTop: '2px' }}>{stock.name} · {stock.exchange}</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Live price + P&L */}
          {pd?.price && (
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#fff', fontFamily: 'sans-serif' }}>
                {fmtPrice(pd.price, pd.currency)}
              </p>
              <p style={{ margin: 0, fontSize: '11px', fontFamily: 'sans-serif',
                color: parseFloat(pd.changePct) >= 0 ? '#4ADE80' : '#F87171' }}>
                {fmtPct(pd.changePct)} today
              </p>
            </div>
          )}
          {pnl !== null && (
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: '700', fontFamily: 'sans-serif',
                color: pnl >= 0 ? '#4ADE80' : '#F87171' }}>
                {pnl >= 0 ? '+' : ''}{currency}{Math.abs(pnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <p style={{ margin: 0, fontSize: '10px', color: '#6b6055', fontFamily: 'sans-serif' }}>
                {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}% return
              </p>
            </div>
          )}

          {loading
            ? <div style={{ width: '18px', height: '18px', border: '2px solid rgba(201,168,76,0.2)', borderTop: '2px solid #C9A84C', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            : <span style={{ color: '#9a8e7e', fontSize: '12px', transform: expanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
          }
          <button onClick={e => { e.stopPropagation(); fetchNews(true) }} style={{ background: 'none', border: 'none', color: '#9a8e7e', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: 0 }}
            onMouseEnter={e => e.target.style.color = '#C9A84C'}
            onMouseLeave={e => e.target.style.color = '#9a8e7e'}>↻</button>
          <button onClick={e => { e.stopPropagation(); onRemove() }} style={{ background: 'none', border: 'none', color: '#9a8e7e', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: 0 }}
            onMouseEnter={e => e.target.style.color = '#f87171'}
            onMouseLeave={e => e.target.style.color = '#9a8e7e'}>×</button>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '18px 20px 20px', animation: 'fadeIn 0.2s ease' }}>
          {news?.error ? (
            <p style={{ color: '#f87171', fontFamily: 'sans-serif', fontSize: '13px', margin: 0 }}>{news.error}</p>
          ) : news ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {news.price_summary && (
                <p style={{ margin: 0, fontSize: '13px', color: '#C9A84C', fontFamily: 'sans-serif', fontWeight: '600' }}>
                  {news.price_summary}
                </p>
              )}
              {!news.has_news || news.news_items?.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <p style={{ fontSize: '22px', margin: '0 0 8px' }}>📭</p>
                  <p style={{ color: '#6b6055', fontFamily: 'sans-serif', fontSize: '13px', margin: 0 }}>
                    No significant news for {stock.ticker} in the last 24 hours.
                  </p>
                </div>
              ) : (
                news.news_items.map((item, i) => {
                  const badge = NEWS_TYPE_BADGE[item.type] || NEWS_TYPE_BADGE.other
                  return (
                    <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '14px 16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', color: badge.color, background: badge.bg, padding: '2px 8px', borderRadius: '20px', fontFamily: 'sans-serif' }}>
                          {badge.label}
                        </span>
                        {item.source && <span style={{ fontSize: '10px', color: '#4a3f35', fontFamily: 'sans-serif' }}>{item.source}</span>}
                      </div>
                      <p style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: '600', color: '#e8ddd0', fontFamily: 'sans-serif', lineHeight: '1.4' }}>{item.headline}</p>
                      <p style={{ margin: 0, fontSize: '12px', color: '#9a8e7e', fontFamily: 'sans-serif', lineHeight: '1.6' }}>{item.detail}</p>
                    </div>
                  )
                })
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MyPortfolio() {
  const [stocks, setStocks]             = useState([])
  const [searching, setSearching]       = useState(false)
  const [pendingStock, setPendingStock] = useState(null)
  const [refreshKey, setRefreshKey]     = useState(0)
  const [refreshing, setRefreshing]     = useState(false)
  const [priceData, setPriceData]       = useState({})

  useEffect(() => {
    const saved = localStorage.getItem('fd_portfolio')
    if (saved) {
      const parsed = JSON.parse(saved)
      setStocks(parsed)
      fetchAllPrices(parsed)
    }
  }, [])

  async function fetchAllPrices(stockList) {
    // Fetch Nifty 50 from indices API
    try {
      const res  = await fetch('/api/indices')
      const data = await res.json()
      setPriceData(prev => ({
        ...prev,
        NIFTY: { changePct: data?.nifty?.pct, price: data?.nifty?.price },
      }))
    } catch (e) {}

    // Fetch each stock price
    for (const s of stockList) {
      try {
        const res  = await fetch('/api/stock-price', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker: s.ticker, exchange: s.exchange }),
        })
        const data = await res.json()
        if (!data.error) {
          setPriceData(prev => ({ ...prev, [s.ticker]: data }))
        }
      } catch (e) {}
    }
  }

  function saveStocks(updated) {
    setStocks(updated)
    localStorage.setItem('fd_portfolio', JSON.stringify(updated))
  }

  function handleSearchSelect(s) {
    setSearching(false)
    setPendingStock(s)
  }

  function confirmAdd(buyPrice, quantity) {
    if (!pendingStock) return
    const entry = { ...pendingStock, buyPrice, quantity }
    const updated = [...stocks, entry]
    saveStocks(updated)
    fetchAllPrices([entry])
    setPendingStock(null)
  }

  function removeStock(ticker) {
    saveStocks(stocks.filter(x => x.ticker !== ticker))
    setPriceData(prev => { const n = { ...prev }; delete n[ticker]; return n })
  }

  async function refreshAll() {
    setRefreshing(true)
    setRefreshKey(k => k + 1)
    await fetchAllPrices(stocks)
    await new Promise(r => setTimeout(r, 500))
    setRefreshing(false)
  }

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', padding: '32px 24px 64px' }}>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes fadeIn  { from { opacity: 0; transform: translateY(-6px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#fff', fontFamily: "'Georgia', serif", letterSpacing: '-0.02em' }}>
            My <span style={{ color: '#C9A84C' }}>Portfolio</span>
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {stocks.length > 0 && (
              <button onClick={refreshAll} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)',
                borderRadius: '20px', padding: '5px 12px', cursor: 'pointer',
                color: '#C9A84C', fontFamily: 'sans-serif', fontSize: '12px', fontWeight: '600',
              }}>
                <span style={{ display: 'inline-block', animation: refreshing ? 'spin 0.7s linear infinite' : 'none', fontSize: '14px' }}>↻</span>
                Refresh All
              </button>
            )}
            <span style={{ fontSize: '11px', color: '#6b6055', fontFamily: 'sans-serif', background: 'rgba(201,168,76,0.1)', padding: '3px 10px', borderRadius: '20px', border: '1px solid rgba(201,168,76,0.15)' }}>
              {stocks.length} {stocks.length === 1 ? 'stock' : 'stocks'}
            </span>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: '12px', color: '#6b6055', fontFamily: 'sans-serif' }}>
          Track your holdings and see how you compare to Nifty 50
        </p>
      </div>

      <div style={{ height: '1px', background: 'linear-gradient(90deg, #C9A84C44, transparent)', marginBottom: '20px' }} />

      {/* Nifty comparison banner */}
      <NiftyBanner stocks={stocks} priceData={priceData} />

      {/* Stock list */}
      {stocks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
          {stocks.map(s => (
            <StockCard
              key={s.ticker} stock={s}
              onRemove={() => removeStock(s.ticker)}
              forceRefresh={refreshKey > 0 ? refreshKey : null}
              priceData={priceData}
            />
          ))}
        </div>
      )}

      {/* Buy details form */}
      {pendingStock && (
        <div style={{ marginBottom: '12px' }}>
          <BuyDetailsForm
            stock={pendingStock}
            onConfirm={confirmAdd}
            onSkip={() => { confirmAdd(null, null) }}
          />
        </div>
      )}

      {/* Search */}
      {searching ? (
        <StockSearch onSelect={handleSearchSelect} onCancel={() => setSearching(false)} existingStocks={stocks.map(s => s.ticker)} />
      ) : !pendingStock && (
        <button onClick={() => setSearching(true)} style={{
          display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
          padding: '12px 16px', background: 'transparent',
          border: '1px dashed rgba(201,168,76,0.25)', borderRadius: '12px',
          cursor: 'pointer', color: '#9a8e7e', fontFamily: 'sans-serif', fontSize: '13px',
          transition: 'all 0.2s',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.5)'; e.currentTarget.style.color = '#C9A84C'; e.currentTarget.style.background = 'rgba(201,168,76,0.05)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.25)'; e.currentTarget.style.color = '#9a8e7e'; e.currentTarget.style.background = 'transparent' }}
        >
          <span style={{ fontSize: '18px', lineHeight: 1 }}>+</span>
          <span>Add a stock</span>
        </button>
      )}

      <p style={{ fontSize: '11px', color: '#4a3f35', fontFamily: 'sans-serif', textAlign: 'center', marginTop: '24px' }}>
        Prices from Yahoo Finance · Not financial advice
      </p>
    </div>
  )
}