import { createClient } from "@supabase/supabase-js";

// Records one row per unique visitor per IST calendar day in `site_visits`.
// The (visitor_id, day) primary key + ignoreDuplicates makes repeat visits the
// same day a no-op, so weekly-unique = count(distinct visitor_id) over 7 days.
export async function POST(req) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );
  try {
    const { visitorId } = await req.json();
    if (!visitorId || typeof visitorId !== "string") {
      return Response.json({ ok: true });
    }
    // IST calendar day (UTC + 5:30), as YYYY-MM-DD.
    const day = new Date(Date.now() + 5.5 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
    await supabase
      .from("site_visits")
      .upsert(
        { visitor_id: visitorId.slice(0, 64), day },
        { onConflict: "visitor_id,day", ignoreDuplicates: true }
      );
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false });
  }
}
