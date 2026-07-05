import { createClient } from "@supabase/supabase-js";

export async function POST(req) {
  // Create client inside function so it runs at request time, not build time
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
    });

    return Response.json({ success: true });
  } catch (e) {
    console.error("Push subscribe error:", e);
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}