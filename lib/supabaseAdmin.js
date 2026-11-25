// Server-ONLY Supabase client using the service-role key. Never import this in a
// client component — the service-role key bypasses RLS and must never reach the
// browser. Used only inside /api route handlers.
import { createClient } from '@supabase/supabase-js'

export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  // Reuse the project's existing server-side secret (sb_secret_… or a legacy
  // service_role JWT). Both bypass RLS; fall back to the older name just in case.
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service-role env vars are not set')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

// Verify the caller is an admin, from their Supabase access token (sent as a
// Bearer header by the admin page). Returns the user, or null if not allowed.
export async function requireAdmin(req) {
  const { REFERRAL } = await import('./referralConfig')
  const open = REFERRAL.ADMIN_USER_IDS.length === 0 && process.env.NODE_ENV !== 'production'
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return open ? { id: 'dev', dev: true } : null
  try {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const { data: { user } } = await anon.auth.getUser(token)
    if (user && (open || REFERRAL.ADMIN_USER_IDS.includes(user.id))) return user
  } catch { /* fall through */ }
  return open ? { id: 'dev', dev: true } : null
}
