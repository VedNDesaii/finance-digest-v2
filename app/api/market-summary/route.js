import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const market = searchParams.get('market') || 'indian'
  const table = market === 'indian' ? 'indian_market_summary' : 'us_market_summary'

  const { data, error } = await supabase
    .from(table)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)

  if (error || !data || data.length === 0) {
    return Response.json({ error: 'Failed to fetch' }, { status: 500 })
  }
  return Response.json(data[0])
}
