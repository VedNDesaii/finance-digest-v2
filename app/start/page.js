import { createClient } from '@supabase/supabase-js'

// Lightweight, server-rendered entry page for the Instagram bio link.
// It ships almost no JavaScript, so it loads reliably even in memory-limited
// in-app browsers (Instagram/Facebook on Android) where the full client app
// crashes. Followers get real headlines here, and a button that opens the
// full site — escaping to Chrome on Android where the in-app browser can't
// handle the app.

export const revalidate = 600 // cache for 10 minutes

async function getHeadlines() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
    const { data } = await supabase
      .from('processed_articles')
      .select('title, source, category, created_at')
      .order('created_at', { ascending: false })
      .limit(6)
    return data || []
  } catch {
    return []
  }
}

export const metadata = {
  title: 'Finance Digest — Today’s Briefing',
  description: 'The news. Without the noise. Daily financial news simplified.',
}

export default async function StartPage() {
  const headlines = await getHeadlines()

  const C = {
    bg: '#F7F4EF', ink: '#1A1410', gold: '#C9A84C',
    cream: '#F0EBE3', muted: '#6B5E4E', faint: '#9A8E7E', line: '#EDE8E0',
  }

  return (
    <main style={{
      fontFamily: 'Georgia, "Times New Roman", serif',
      background: C.bg, minHeight: '100vh', margin: 0,
      padding: '0 0 40px', color: C.ink,
    }}>
      {/* Brand bar — a div, not <header>, to avoid the global header override */}
      <div style={{ background: C.ink, padding: '28px 20px', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 30, color: C.gold, letterSpacing: '0.01em' }}>
          Finance <span style={{ color: C.cream }}>Digest</span>
        </h1>
        <p style={{ color: C.faint, fontSize: 12, margin: '6px 0 0', letterSpacing: '0.12em' }}>
          THE NEWS. WITHOUT THE NOISE.
        </p>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 20px' }}>
        {/* Primary CTA */}
        <a
          id="fd-open"
          href="https://financedigest.xyz/"
          style={{
            display: 'block', textAlign: 'center', margin: '26px 0 8px',
            background: C.gold, color: C.ink, padding: '15px 24px',
            borderRadius: 10, textDecoration: 'none', fontWeight: 'bold', fontSize: 17,
          }}
        >
          Open Finance Digest →
        </a>
        <p id="fd-hint" style={{ textAlign: 'center', color: C.faint, fontSize: 12, margin: '0 0 26px' }}>
          Best experienced in your browser
        </p>

        {/* Today's headlines — real content, so followers get value here */}
        {headlines.length > 0 && (
          <section>
            <h2 style={{
              fontSize: 13, letterSpacing: '0.1em', color: C.faint,
              textTransform: 'uppercase', margin: '0 0 4px',
              borderBottom: `1px solid ${C.line}`, paddingBottom: 10,
            }}>
              Today’s Top Stories
            </h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {headlines.map((h, i) => (
                <li key={i} style={{ padding: '16px 0', borderBottom: `1px solid ${C.line}` }}>
                  <a href="https://financedigest.xyz/" style={{ textDecoration: 'none', color: C.ink }}>
                    <div style={{ fontSize: 16, lineHeight: 1.4, fontWeight: 'bold' }}>{h.title}</div>
                    {h.source && (
                      <div style={{ fontSize: 12, color: C.faint, marginTop: 6 }}>{h.source}</div>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p style={{ textAlign: 'center', color: C.faint, fontSize: 11, marginTop: 30 }}>
          <a href="https://financedigest.xyz/" style={{ color: C.gold, textDecoration: 'none' }}>
            financedigest.xyz
          </a>{' '}· Daily financial news simplified
        </p>
      </div>

      {/*
        Tiny, safe script (a few bytes — not the megabyte that crashes the app).
        On Android in-app browsers, rewrite the button to a Chrome intent so it
        opens the full site in a real browser that can handle it. Everyone else
        keeps the normal https link.
      */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function () {
              try {
                var ua = navigator.userAgent || '';
                var inApp = /Instagram|FBAN|FBAV|FB_IAB|Line\\/|Snapchat|Pinterest/i.test(ua);
                var android = /Android/i.test(ua);
                if (inApp && android) {
                  var btn = document.getElementById('fd-open');
                  var hint = document.getElementById('fd-hint');
                  if (btn) btn.setAttribute('href',
                    'intent://financedigest.xyz/#Intent;scheme=https;package=com.android.chrome;end');
                  if (hint) hint.textContent = 'Opens in Chrome for the full experience';
                }
              } catch (e) {}
            })();
          `,
        }}
      />
    </main>
  )
}
