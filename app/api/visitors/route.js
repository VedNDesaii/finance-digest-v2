import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// POST — heartbeat from a visitor (called every ~30s)
export async function POST(req) {
  const { sessionId } = await req.json()

  if (!sessionId) {
    return Response.json({ error: 'Missing sessionId' }, { status: 400 })
  }

  try {
    await supabase
      .from('page_views')
      .upsert(
        { session_id: sessionId, last_seen: new Date().toISOString() },
        { onConflict: 'session_id' }
      )

    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}

// GET — return stats (currently online + total ever)
export async function GET() {
  try {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()

    const { count: activeCount, error: activeError } = await supabase
      .from('page_views')
      .select('*', { count: 'exact', head: true })
      .gte('last_seen', twoMinutesAgo)

    const { count: totalCount, error: totalError } = await supabase
      .from('page_views')
      .select('*', { count: 'exact', head: true })

    if (activeError || totalError) {
      return Response.json({ error: (activeError || totalError).message }, { status: 500 })
    }

    return Response.json({
      activeNow: activeCount || 0,
      totalEver: totalCount || 0,
    })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}