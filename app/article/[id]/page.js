// Shareable, server-rendered article page: /article/<id>
// Server component so link previews (WhatsApp, X, etc.) get real Open Graph tags
// and the page loads instantly without JS. Data comes from Supabase (public read).
import { notFound } from 'next/navigation'
import ShareButton from '../../../components/ShareButton'

const BASE = 'https://financedigest.xyz'

const CAT_LABEL = {
  'indian-markets': 'Indian Markets', 'us-markets': 'US Markets', 'global-economy': 'Global',
  'macro-policy': 'Economy & Policy', 'banking-finance': 'Deals & Banking',
  'investment-banking': 'Deals & Banking', 'technology-it': 'Technology',
  'pharma-health': 'Pharma', 'auto-ev': 'Auto & EV', 'energy-oil': 'Energy',
  'metals-mining': 'Metals', 'infrastructure': 'Infrastructure', 'fmcg-consumer': 'FMCG',
  'renewables': 'Renewables', 'real-estate': 'Real Estate', 'telecom-media': 'Telecom', 'crypto': 'Crypto',
}

function decodeEntities(str) {
  return (str || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&rsquo;/g, '’').replace(/&lsquo;/g, '‘').replace(/&nbsp;/g, ' ')
}
function fmtDetailed(raw) {
  return (raw || '').trim().split(/\n\n+/).filter(Boolean).map(p => {
    const m = p.trim().match(/^\*\*(.+?)\*\*\s*(.*)$/s)
    return m ? { label: m[1].replace(/[.:]\s*$/, ''), body: m[2].trim() } : { label: null, body: p.trim() }
  })
}
function excerpt(a) {
  const t = decodeEntities(a.investor_take || a.simplified_article || a.detailed_article || '')
  return t.length > 180 ? t.slice(0, 177).trimEnd() + '…' : t
}

async function getArticle(id) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key || !/^\d+$/.test(String(id))) return null
  try {
    const r = await fetch(`${url}/rest/v1/processed_articles?id=eq.${id}&select=*&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      next: { revalidate: 300 },   // cache 5 min
    })
    if (!r.ok) return null
    const j = await r.json()
    return Array.isArray(j) && j.length ? j[0] : null
  } catch { return null }
}

export async function generateMetadata({ params }) {
  const { id } = await params
  const a = await getArticle(id)
  if (!a) return { title: 'Article · FinanceDigest' }
  const title = decodeEntities(a.headline || a.title)
  const desc = excerpt(a)
  const img = a.image_url || `${BASE}/og-default.png`
  const u = `${BASE}/article/${id}`
  return {
    title: `${title} · FinanceDigest`,
    description: desc,
    alternates: { canonical: u },
    openGraph: { title, description: desc, url: u, siteName: 'FinanceDigest', type: 'article', images: img ? [{ url: img }] : [] },
    twitter: { card: 'summary_large_image', title, description: desc, images: img ? [img] : [] },
  }
}

const mono = 'var(--font-mono)'

export default async function ArticlePage({ params }) {
  const { id } = await params
  const a = await getArticle(id)
  if (!a) notFound()

  const title = decodeEntities(a.headline || a.title)
  const cat = CAT_LABEL[a.category] || 'Markets'
  const source = ((a.source || '').split('|').pop() || '').trim() || 'FinanceDigest'
  const s = (a.sentiment || '').toLowerCase()
  const sentiLbl = s === 'bullish' ? 'Positive' : s === 'bearish' ? 'Negative' : 'Neutral'
  const sentiColor = s === 'bullish' ? 'var(--up)' : s === 'bearish' ? 'var(--down)' : 'var(--text-muted)'
  const sentiBg = s === 'bullish' ? 'var(--up-bg)' : s === 'bearish' ? 'var(--down-bg)' : 'var(--bg-gist)'
  const dateStr = (() => { try { return new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) } catch { return '' } })()
  const background = decodeEntities((a.background || '').trim())
  const picture = decodeEntities((a.detailed_article || a.simplified_article || '').trim())
  const impact = decodeEntities((a.market_impact || '').trim())
  const means = decodeEntities((a.what_this_means || '').trim())
  const keyNumbers = (Array.isArray(a.key_numbers) ? a.key_numbers : []).slice(0, 4)
  const glossary = Array.isArray(a.glossary) ? a.glossary : []
  const shareUrl = `${BASE}/article/${id}`

  const Block = ({ head, children }) => (
    <section style={{ margin: '0 0 22px' }}>
      <div style={{ fontFamily: mono, fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '9px' }}>{head}</div>
      {children}
    </section>
  )
  const Para = ({ children }) => <p style={{ margin: '0 0 11px', fontSize: '15.5px', lineHeight: 1.7, color: 'var(--text-primary)' }}>{children}</p>

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-primary)', fontFamily: 'var(--font-ui)' }}>
      {/* top bar */}
      <header style={{ borderBottom: '1px solid var(--border-main)', background: 'var(--bg-card)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '680px', margin: '0 auto', padding: '13px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a href="/" style={{ textDecoration: 'none', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '19px', color: 'var(--head-ink)', letterSpacing: '-0.01em' }}>
            Finance<span style={{ color: 'var(--accent)' }}>Digest</span>
          </a>
          <div style={{ marginLeft: 'auto' }}><ShareButton url={shareUrl} title={title} compact /></div>
        </div>
      </header>

      <article style={{ maxWidth: '680px', margin: '0 auto', padding: '24px 18px 60px' }}>
        <div style={{ display: 'flex', gap: '7px', marginBottom: '14px' }}>
          <span style={{ fontFamily: mono, fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--accent)', background: 'var(--bg-gist)', border: '1px solid var(--border-main)', borderRadius: '6px', padding: '3px 9px' }}>{cat}</span>
          <span style={{ fontFamily: mono, fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: sentiColor, background: sentiBg, border: '1px solid var(--border-main)', borderRadius: '6px', padding: '3px 9px' }}>{sentiLbl}</span>
        </div>

        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '28px', lineHeight: 1.2, letterSpacing: '-0.01em', color: 'var(--head-ink)', margin: '0 0 10px' }}>{title}</h1>
        <div style={{ fontFamily: mono, fontSize: '11.5px', color: 'var(--text-muted)', display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '18px' }}>
          <span>{source}</span>{dateStr && <span>· {dateStr}</span>}<span>· AI-assisted</span>
        </div>

        {a.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.image_url} alt="" style={{ width: '100%', borderRadius: '14px', border: '1px solid var(--border-main)', marginBottom: '20px', display: 'block' }} />
        )}

        {keyNumbers.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(keyNumbers.length, 2)}, 1fr)`, gap: '9px', marginBottom: '22px' }}>
            {keyNumbers.map((k, i) => {
              const d = (k.dir || '').toLowerCase()
              const dc = d === 'up' ? 'var(--up)' : d === 'down' ? 'var(--down)' : 'var(--text-secondary)'
              const arrow = d === 'up' ? '▲ ' : d === 'down' ? '▼ ' : ''
              return (
                <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)', borderRadius: '11px', padding: '11px 13px' }}>
                  <div style={{ fontFamily: mono, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>{decodeEntities(k.label || '')}</div>
                  <div style={{ fontFamily: mono, fontWeight: 600, fontSize: '17px', color: 'var(--head-ink)', margin: '3px 0 1px' }}>{decodeEntities(k.value || '')}</div>
                  {k.change && <div style={{ fontFamily: mono, fontSize: '11.5px', color: dc }}>{arrow}{decodeEntities(k.change)}</div>}
                </div>
              )
            })}
          </div>
        )}

        {background && (
          <div style={{ margin: '0 0 22px', padding: '12px 15px', background: 'var(--bg-gist)', border: '1px solid var(--border-main)', borderLeft: '3px solid var(--accent)', borderRadius: '0 12px 12px 0' }}>
            <div style={{ fontFamily: mono, fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '5px' }}>Catch up</div>
            <p style={{ margin: 0, fontSize: '14.5px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>{background}</p>
          </div>
        )}

        {picture && (
          <Block head="The full picture">
            {fmtDetailed(picture).map((b, i) => (
              <Para key={i}>{b.label && <strong style={{ fontWeight: 600 }}>{b.label}. </strong>}{b.body}</Para>
            ))}
          </Block>
        )}

        {impact && (
          <Block head="Market impact">
            {impact.split(/\n\n+/).filter(Boolean).map((p, i) => <Para key={i}>{decodeEntities(p)}</Para>)}
          </Block>
        )}

        {means && (
          <Block head="What this means for you">
            {means.split(/\n\n+/).filter(Boolean).map((p, i) => <Para key={i}>{decodeEntities(p)}</Para>)}
          </Block>
        )}

        {glossary.length > 0 && (
          <Block head="Jargon, explained">
            <div style={{ display: 'grid', gap: '9px' }}>
              {glossary.slice(0, 6).map((g, i) => (
                <div key={i} style={{ background: 'var(--bg-gist)', border: '1px solid var(--border-main)', borderRadius: '10px', padding: '10px 12px' }}>
                  <b style={{ fontSize: '13.5px', color: 'var(--head-ink)' }}>{decodeEntities(g.term || g.word || '')}</b>
                  <span style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.5 }}>{decodeEntities(g.definition || g.meaning || '')}</span>
                </div>
              ))}
            </div>
          </Block>
        )}

        {/* footer CTA */}
        <div style={{ marginTop: '14px', padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border-main)', borderRadius: '14px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>India&rsquo;s markets, in five minutes a day.</div>
          <div style={{ display: 'flex', gap: '9px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/" style={{ background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: '14px', padding: '10px 18px', borderRadius: '10px', textDecoration: 'none' }}>Open FinanceDigest →</a>
            <ShareButton url={shareUrl} title={title} />
          </div>
        </div>
      </article>
    </div>
  )
}
