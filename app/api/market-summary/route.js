export const runtime = 'edge'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const market = searchParams.get('market') || 'indian'
  const table = market === 'indian' ? 'indian_market_summary' : 'us_market_summary'

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?select=*&order=created_at.desc&limit=1`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  )

  const data = await res.json()

  if (!res.ok || !data || data.length === 0) {
    return Response.json({ error: 'Failed to fetch market data' }, { status: 500 })
  }

  return Response.json(data[0])
}
