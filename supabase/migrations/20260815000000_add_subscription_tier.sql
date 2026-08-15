-- Structural groundwork for future paid features. No billing logic yet —
-- every account defaults to 'free' and the app currently ignores this
-- column entirely (see src/lib/entitlements.js).
--
-- Run this once in the Supabase Dashboard SQL Editor (Project > SQL Editor).
-- There is no service-role key or CLI wired into local tooling, so this
-- repo can only track the migration text, not apply it directly.

alter table public.pets
  add column if not exists subscription_tier text not null default 'free';
