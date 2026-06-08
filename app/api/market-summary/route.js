import { createClient } from '@supabase/supabase-js'

export async function GET(request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const { searchParams } = new URL(request.url)
  const market = searchParams.get('market') || 'indian'
  const table = market === 'indian' ? 'indian_market_summary' : 'us_market_summary'

  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)

  if (error || !data || data.length === 0) {
    return Response.json({ error: error?.message || 'No data' }, { status: 500 })
  }
  return Response.json(data[0])
}
