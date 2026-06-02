export const dynamic = 'force-dynamic'
export async function POST(req) {
  return Response.json({ success: false, error: 'Subscriptions coming soon.' }, { status: 503 })
}
