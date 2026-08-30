-- Server-side enforcement of the per-tier pet limit.
--
-- Client-side gating is a suggestion, not a control: anyone can open the
-- webview inspector, or talk to PostgREST directly with the anon key and the
-- user's own JWT. If the paid boundary is worth anything it has to be the
-- database that refuses, so this puts the limit in RLS and leaves the client
-- doing nothing more than presenting the same answer nicely.
--
-- NOTHING HERE DELETES ANYTHING. Pets beyond the limit stop being *readable*
-- and stay on disk untouched, so a lapsed subscription hides records and a
-- renewed one brings them straight back with no restore step and no support
-- ticket. That is a deliberate constraint on this whole design, not an
-- accident of it: there is no cascade added, no cleanup job, and no purge.
-- The only deletes in this system remain the two a person asks for —
-- delete-account (which uses the service role and so is unaffected by every
-- policy below) and the delete-pet button on the Home screen.
--
-- Run this once in the Supabase Dashboard SQL Editor. See README.md.
--
-- !! READ BEFORE RUNNING !!
-- This migration DROPS AND RECREATES every RLS policy on public.pets. The
-- pets table was created in the Dashboard rather than by a migration, so
-- this repo has no record of what its policies are called and cannot edit
-- them by name. Record what is there first:
--
--   select policyname, cmd, qual, with_check
--   from pg_policies where schemaname = 'public' and tablename = 'pets';
--
-- The four policies created below are intended to be the complete set. If
-- that query shows anything doing more than "the row belongs to auth.uid()",
-- stop and reconcile it by hand before running this.

-- ---------------------------------------------------------------------
-- 1. The entitlement, as the server understands it
-- ---------------------------------------------------------------------
--
-- Written only by the revenuecat-webhook Edge Function, using the service
-- role. The client may read its own row and nothing else — there is
-- deliberately no INSERT, UPDATE or DELETE policy, so those are denied for
-- anon and authenticated by default once RLS is on.

create table if not exists public.user_entitlements (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  tier       text        not null default 'free',
  pet_limit  int         not null default 1,
  expires_at timestamptz,
  updated_at timestamptz not null default now(),

  -- Idempotency and ordering, both of which RevenueCat forces on us.
  --
  -- It retries failed deliveries, so the same event can arrive twice; and
  -- retries mean delivery order is not send order, so a stale EXPIRATION can
  -- land *after* the RENEWAL that superseded it. Applying that blindly would
  -- downgrade a paying subscriber. The webhook writes both fields and
  -- refuses any event whose id it has already recorded or whose timestamp is
  -- older than the one stored.
  last_event_id text,
  last_event_at timestamptz,

  -- A limit below 1 would hide every pet the account has, including the one
  -- a free user is entitled to. Nothing should ever write that, so make the
  -- database the place it cannot be written.
  constraint user_entitlements_pet_limit_min check (pet_limit >= 1)
);

alter table public.user_entitlements enable row level security;

drop policy if exists user_entitlements_select_own on public.user_entitlements;
create policy user_entitlements_select_own on public.user_entitlements
  for select using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 2. How many pets this user may see
-- ---------------------------------------------------------------------
--
-- SECURITY DEFINER because this is called from inside the RLS policy on
-- pets. `set search_path` is not decoration on a definer function: without
-- it a caller can point `public` at their own schema and have this resolve
-- to their own user_entitlements.
--
-- coalesce(..., 1) is the whole point of the function and the easiest thing
-- to get wrong. A user with no entitlements row — which is every free user,
-- since the webhook only ever writes rows for subscribers — makes the inner
-- select return NO ROWS, and a scalar subquery over no rows is NULL, not 1.
-- `limit NULL` in visible_pet_ids below means LIMIT ALL. Without the
-- coalesce this function fails *open*: every free user sees every pet, which
-- is the exact opposite of what it exists to do.
--
-- The guard against uid <> auth.uid() stops one user probing another's
-- limit. It cannot be tightened to a hard error because the RLS policies
-- call it with auth.uid(), where it must succeed.
create or replace function public.pet_limit_for(uid uuid)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select case
              -- No expiry recorded, or it has passed: free.
              when e.expires_at is null or e.expires_at < now() then 1
              else greatest(e.pet_limit, 1)
            end
       from public.user_entitlements e
      where e.user_id = uid
        and uid = auth.uid()),
    1);
$$;

-- Counts what the account ACTUALLY has, not what it can see — the INSERT
-- policy needs the true number or a user already over their limit would
-- read back "1 visible pet" and be allowed to add more.
create or replace function public.pet_count_for(uid uuid)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select count(*)::int from public.pets p
      where p.user_id = uid and uid = auth.uid()),
    0);
$$;

-- ---------------------------------------------------------------------
-- 3. Which pets, specifically
-- ---------------------------------------------------------------------
--
-- Oldest first. On a downgrade the pet that stays visible is the one with
-- the longest history behind it, which for almost every account is the
-- animal they started tracking for in the first place. Keeping the newest
-- instead would hide exactly the records the owner cares most about.
--
-- `id asc` is not padding. Two pets added in the same import, or the same
-- second, can share a created_at, and `order by created_at` alone leaves
-- Postgres free to break that tie differently between calls — so the pet
-- that vanishes could change from one page load to the next. The id makes
-- the cut total and therefore repeatable.
--
-- SECURITY DEFINER is required, not preferred: this reads public.pets, and
-- it is called from public.pets' own SELECT policy. Without it Postgres
-- re-enters that policy to check the read and recurses until it errors.
create or replace function public.visible_pet_ids(uid uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id
    from public.pets p
   where p.user_id = uid
     and uid = auth.uid()
   order by p.created_at asc, p.id asc
   limit public.pet_limit_for(uid);
$$;

-- The policy sorts every one of the user's pets on each evaluation.
create index if not exists pets_user_created_idx
  on public.pets (user_id, created_at, id);

-- ---------------------------------------------------------------------
-- 4. The gate itself
-- ---------------------------------------------------------------------

alter table public.pets enable row level security;

do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
     where schemaname = 'public' and tablename = 'pets'
  loop
    execute format('drop policy %I on public.pets', pol.policyname);
    raise notice 'dropped existing pets policy: %', pol.policyname;
  end loop;
end $$;

create policy pets_select_visible on public.pets for select
  using (
    user_id = auth.uid()
    and id in (select public.visible_pet_ids(auth.uid()))
  );

-- Refuses the row rather than accepting a pet that would be invisible the
-- moment it was created. Note this makes the "Add a pet" control fail with
-- an RLS error for anyone at their limit — the client has to stop offering
-- it, which is a UI change, not a reason to loosen this.
create policy pets_insert_within_limit on public.pets for insert
  with check (
    user_id = auth.uid()
    and public.pet_count_for(auth.uid()) < public.pet_limit_for(auth.uid())
  );

create policy pets_update_own on public.pets for update
  using (
    user_id = auth.uid()
    and id in (select public.visible_pet_ids(auth.uid()))
  )
  with check (user_id = auth.uid());

-- Scoped to visible pets as well, so a hidden pet cannot be deleted — by the
-- app or by anyone hand-rolling a request. Deleting something the owner
-- cannot currently see is not a thing this app should permit.
create policy pets_delete_own on public.pets for delete
  using (
    user_id = auth.uid()
    and id in (select public.visible_pet_ids(auth.uid()))
  );

-- ---------------------------------------------------------------------
-- 5. The per-pet tables come along for free
-- ---------------------------------------------------------------------
--
-- bcs_entries, medications, medication_doses, pet_media, pet_conditions,
-- condition_entries and condition_events all gate on
-- `exists (select 1 from public.pets p where p.id = pet_id and p.user_id =
-- auth.uid())`. RLS applies inside a policy's own subqueries, so that
-- `select 1 from public.pets` is itself filtered by pets_select_visible, and
-- a hidden pet's rows stop being readable the moment the pet does. No change
-- to those policies is needed or made.
--
-- general_qol_entries and pain_log_entries were created in the Dashboard, so
-- this repo cannot see their policies. They key on pet_id and almost
-- certainly join pets the same way, in which case they inherit too. Confirm
-- rather than assume:
--
--   select tablename, policyname, qual from pg_policies
--   where schemaname = 'public'
--     and tablename in ('general_qol_entries', 'pain_log_entries');
--
-- If either one checks a user_id column directly instead of joining pets, it
-- will NOT inherit, and its select policy needs the same
-- `pet_id in (select public.visible_pet_ids(auth.uid()))` clause adding.
