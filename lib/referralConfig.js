// Referral + leaderboard config. One place for every tunable value.
// (Env vars override the defaults; the fallbacks keep the local dev build working.)
export const REFERRAL = {
  // Monthly reward slots, first-come-first-serve. A "referral" = a friend who
  // signs up on FinanceDigest with your link AND confirms their email.
  SLOTS_200: 2,          // first 2 to reach THRESH_200 get PAYOUT_200
  SLOTS_100: 1,          // first 1 to reach THRESH_100 gets PAYOUT_100
  THRESH_200: 20,        // confirmed sign-ups needed for the ₹200 tier
  THRESH_100: 15,        // confirmed sign-ups needed for the ₹100 tier
  PAYOUT_200: 200,
  PAYOUT_100: 100,

  // IQ rewards (added on top of the existing IQ, never changing its calculation).
  REFERRAL_IQ: 10,       // per verified referral
  INSIDER_BONUS_IQ: 50,  // one-off, when the Insider badge is awarded

  // The WhatsApp community the /join page redirects to.
  WHATSAPP_INVITE_URL:
    process.env.NEXT_PUBLIC_WHATSAPP_INVITE_URL ||
    'https://chat.whatsapp.com/LJrLVfFGg2ADMZyO62Vq5p',

  // Comma-separated Supabase user IDs allowed into /admin/referrals.
  // Empty in local dev → the admin page runs in an unlocked "dev" mode (banner shown).
  ADMIN_USER_IDS: (process.env.NEXT_PUBLIC_ADMIN_USER_IDS || '')
    .split(',').map(s => s.trim()).filter(Boolean),
}

export function isAdmin(userId) {
  // Local dev with no list configured: allow, so the page is testable.
  if (REFERRAL.ADMIN_USER_IDS.length === 0) return true
  return !!userId && REFERRAL.ADMIN_USER_IDS.includes(userId)
}
