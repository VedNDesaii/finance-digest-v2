-- ============================================================================
-- Referral + leaderboard backend for FinanceDigest
-- Review this, then run it once in the Supabase SQL editor.
-- Safe to re-run (idempotent). Does not touch existing auth or other tables
-- beyond ADDING columns to profiles.
-- ============================================================================

-- 1. profiles: referral fields -----------------------------------------------
alter table public.profiles add column if not exists referral_code text unique;
alter table public.profiles add column if not exists referred_by   text;
alter table public.profiles add column if not exists display_name  text;
alter table public.profiles add column if not exists insider_until date;

-- short, stable per-user code derived from the user id
create or replace function public.fd_code(uid uuid) returns text
  language sql immutable as $$ select upper(substr(md5(uid::text), 1, 6)) $$;

-- backfill codes for any existing profiles
update public.profiles set referral_code = public.fd_code(id) where referral_code is null;

-- 2. referrals: one row per referred sign-up ---------------------------------
create table if not exists public.referrals (
  referred_user_id uuid primary key references auth.users(id) on delete cascade,
  referrer_code text not null,
  email         text,
  first_name    text,
  status        text not null default 'pending'
                check (status in ('pending','confirmed','rejected')),
  created_at    timestamptz not null default now(),
  confirmed_at  timestamptz
);
create index if not exists referrals_by_referrer on public.referrals (referrer_code, status);

-- 3. monthly payouts ----------------------------------------------------------
create table if not exists public.referral_payouts (
  id            bigint generated always as identity primary key,
  month_key     text    not null,            -- e.g. '2026-11'
  referrer_code text    not null,
  name          text,
  amount        int     not null,            -- 200 or 100
  note          text,
  paid          boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (month_key, referrer_code)
);

-- 4. on sign-up: ensure a profile (+ code) and record the referral -----------
--    The referrer code travels in the sign-up's user metadata ('referred_by').
create or replace function public.handle_new_referral_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare ref text;
begin
  ref := nullif(new.raw_user_meta_data->>'referred_by', '');

  insert into public.profiles (id, referral_code, referred_by)
  values (new.id, public.fd_code(new.id), ref)
  on conflict (id) do update
    set referral_code = coalesce(public.profiles.referral_code, public.fd_code(new.id)),
        referred_by   = coalesce(public.profiles.referred_by, excluded.referred_by);

  -- only record if the code belongs to a real, different user (no self-referral)
  if ref is not null and exists (
       select 1 from public.profiles where referral_code = ref and id <> new.id) then
    insert into public.referrals (referred_user_id, referrer_code, email, first_name)
    values (new.id, ref, new.email, new.raw_user_meta_data->>'first_name')
    on conflict (referred_user_id) do nothing;
  end if;

  return new;
end $$;

drop trigger if exists on_auth_user_created_referral on auth.users;
create trigger on_auth_user_created_referral
  after insert on auth.users
  for each row execute function public.handle_new_referral_user();

-- 5. on email confirmation: the referral now counts --------------------------
create or replace function public.handle_referral_confirm() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update public.referrals
       set status = 'confirmed', confirmed_at = new.email_confirmed_at
     where referred_user_id = new.id and status = 'pending';
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_confirmed_referral on auth.users;
create trigger on_auth_user_confirmed_referral
  after update of email_confirmed_at on auth.users
  for each row execute function public.handle_referral_confirm();

-- 6. row-level security -------------------------------------------------------
--    Users read only referrals/payouts under their own code. All writes happen
--    server-side with the service-role key (which bypasses RLS).
alter table public.referrals enable row level security;
drop policy if exists "see own referrals" on public.referrals;
create policy "see own referrals" on public.referrals for select
  using (referrer_code = (select referral_code from public.profiles where id = auth.uid()));

alter table public.referral_payouts enable row level security;
drop policy if exists "see own payouts" on public.referral_payouts;
create policy "see own payouts" on public.referral_payouts for select
  using (referrer_code = (select referral_code from public.profiles where id = auth.uid()));

-- 7. public leaderboard view (names + counts only, never emails) --------------
create or replace view public.referral_leaderboard
  with (security_invoker = false) as
  select p.referral_code as code,
         coalesce(nullif(p.display_name, ''), 'Anonymous') as name,
         (p.insider_until is not null and p.insider_until >= current_date) as insider,
         count(r.referred_user_id) filter (
           where r.status = 'confirmed'
             and date_trunc('month', r.confirmed_at) = date_trunc('month', now())
         )::int as verified
  from public.profiles p
  left join public.referrals r on r.referrer_code = p.referral_code
  group by p.referral_code, p.display_name, p.insider_until;
grant select on public.referral_leaderboard to anon, authenticated;
