export const dynamic = 'force-dynamic'
export async function POST(req) {
  return Response.json({ error: 'Subscriptions coming soon.' }, { status: 503 })
}
