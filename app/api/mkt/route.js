export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const market = searchParams.get('m') || 'indian'
    const table = market === 'indian' ? 'indian_market_summary' : 'us_market_summary'
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}?select=*&order=created_at.desc&limit=1`
    const key = process.env.SUPABASE_SERVICE_KEY

    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    })

    const json = await res.json()
    if (!Array.isArray(json) || json.length === 0) {
      return Response.json({ ok: false, error: 'no data' }, { status: 500 })
    }
    return Response.json({ ok: true, data: json[0] })
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 })
  }
}
