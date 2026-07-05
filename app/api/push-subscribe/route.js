// app/api/push/subscribe/route.js

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export async function POST(req) {
  const subscription = await req.json();

  await supabase.from("push_subscriptions").upsert({
    endpoint:    subscription.endpoint,
    p256dh:      subscription.keys.p256dh,
    auth:        subscription.keys.auth,
    created_at:  new Date().toISOString(),
  });

  return Response.json({ success: true });
}