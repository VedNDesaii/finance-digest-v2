import { createClient } from "@supabase/supabase-js";

export async function POST(req) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  try {
    const subscription = await req.json();
    await supabase.from("push_subscriptions").upsert({
      endpoint:   subscription.endpoint,
      p256dh:     subscription.keys.p256dh,
      auth:       subscription.keys.auth,
      created_at: new Date().toISOString(),
      last_seen:  new Date().toISOString(),
    });
    return Response.json({ success: true });
  } catch (e) {
    console.error("Push subscribe error:", e);
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PUT(req) {
  // Called on every app open to update last_seen
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  try {
    const { endpoint } = await req.json();
    if (!endpoint) return Response.json({ ok: true });
    await supabase.from("push_subscriptions")
      .update({ last_seen: new Date().toISOString() })
      .eq("endpoint", endpoint);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false });
  }
}