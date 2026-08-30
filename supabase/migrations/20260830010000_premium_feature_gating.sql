-- Server-side enforcement of the premium feature boundary.
--
-- Companion to 20260830000000_subscription_pet_gating.sql, which does the
-- same job for how many pets an account may see. This one covers what an
-- account may do at all: medications, photos and video, disease-specific
-- monitoring, and body condition scores.
--
-- Same reasoning, same shape. A client-side check is a suggestion — the anon
-- key and the user's own JWT are enough to ask PostgREST directly — so the
-- database has to be the thing that refuses, with the app doing nothing more
-- than presenting that answer nicely and early.
--
-- ONE SOURCE OF TRUTH. public.has_premium() reads the same
-- public.user_entitlements row that pet_limit_for() reads and that the
-- client reads through EntitlementsContext. There is deliberately no second
-- notion of "is this user premium" anywhere — not a column on pets, not a
-- cached flag, not a RevenueCat lookup on the server.
--
-- NOTHING HERE DELETES ANYTHING, and no DELETE policy is touched. A lapsed
-- subscription makes medications, photos, conditions and body scores
-- unreadable; every row stays exactly where it is and returns intact on
-- resubscribe. The owner also keeps the ability to delete their own data
-- while unsubscribed, which is deliberate: losing access to a feature should
-- never mean losing the ability to remove what you put in it.
--
-- Run this once in the Supabase Dashboard SQL Editor. See README.md.
-- Run 20260830000000_subscription_pet_gating.sql FIRST — this depends on
-- public.user_entitlements existing.

-- ---------------------------------------------------------------------
-- 1. The check
-- ---------------------------------------------------------------------
--
-- SECURITY DEFINER for the same reason as pet_limit_for: it reads
-- user_entitlements from inside policies on other tables, and the calling
-- user has no direct read on anyone's row but their own. `set search_path`
-- is not decoration — without it a caller can point `public` at a schema of
-- their own and have this resolve to a table they control.
--
-- The expiry clause matches pet_limit_for() exactly, including the part that
-- surprises people: a row with a NULL expires_at is NOT premium. A manual
-- grant must carry an explicit 'infinity', as the other migration's header
-- spells out. Writing it the same way round in both functions is the point —
-- if the two ever disagree, a user sees features they cannot save into, or
-- saves into features they cannot see.
create or replace function public.has_premium(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select e.tier = 'premium'
        and e.expires_at is not null
        and e.expires_at >= now()
       from public.user_entitlements e
      where e.user_id = uid
        and uid = auth.uid()),
    false);
$$;

-- ---------------------------------------------------------------------
-- 2. Medications
-- ---------------------------------------------------------------------
--
-- Each policy keeps its original ownership test unchanged and gains the
-- premium clause. Dropped and recreated rather than altered because Postgres
-- has no way to amend a policy's expression in place.

drop policy if exists medications_select_own on public.medications;
create policy medications_select_own on public.medications for select
  using (
    public.has_premium(auth.uid())
    and exists (select 1 from public.pets
                where pets.id = medications.pet_id and pets.user_id = auth.uid())
  );

drop policy if exists medications_insert_own on public.medications;
create policy medications_insert_own on public.medications for insert
  with check (
    public.has_premium(auth.uid())
    and exists (select 1 from public.pets
                where pets.id = medications.pet_id and pets.user_id = auth.uid())
  );

drop policy if exists medications_update_own on public.medications;
create policy medications_update_own on public.medications for update
  using (
    public.has_premium(auth.uid())
    and exists (select 1 from public.pets
                where pets.id = medications.pet_id and pets.user_id = auth.uid())
  );

-- medication_doses hangs off medications, whose SELECT policy now carries
-- the premium clause — and RLS applies inside a policy's own subqueries, so
-- these inherit it through that join. Recreated anyway, explicitly, so that
-- reading this file tells you the whole rule rather than requiring you to
-- work it out from another table's policy.

drop policy if exists medication_doses_select_own on public.medication_doses;
create policy medication_doses_select_own on public.medication_doses for select
  using (
    public.has_premium(auth.uid())
    and exists (select 1 from public.medications m
                join public.pets p on p.id = m.pet_id
                where m.id = medication_doses.medication_id and p.user_id = auth.uid())
  );

drop policy if exists medication_doses_insert_own on public.medication_doses;
create policy medication_doses_insert_own on public.medication_doses for insert
  with check (
    public.has_premium(auth.uid())
    and exists (select 1 from public.medications m
                join public.pets p on p.id = m.pet_id
                where m.id = medication_doses.medication_id and p.user_id = auth.uid())
  );

drop policy if exists medication_doses_update_own on public.medication_doses;
create policy medication_doses_update_own on public.medication_doses for update
  using (
    public.has_premium(auth.uid())
    and exists (select 1 from public.medications m
                join public.pets p on p.id = m.pet_id
                where m.id = medication_doses.medication_id and p.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- 3. Photos and video
-- ---------------------------------------------------------------------

drop policy if exists pet_media_select_own on public.pet_media;
create policy pet_media_select_own on public.pet_media for select
  using (
    public.has_premium(auth.uid())
    and exists (select 1 from public.pets
                where pets.id = pet_media.pet_id and pets.user_id = auth.uid())
  );

drop policy if exists pet_media_insert_own on public.pet_media;
create policy pet_media_insert_own on public.pet_media for insert
  with check (
    public.has_premium(auth.uid())
    and exists (select 1 from public.pets
                where pets.id = pet_media.pet_id and pets.user_id = auth.uid())
  );

drop policy if exists pet_media_update_own on public.pet_media;
create policy pet_media_update_own on public.pet_media for update
  using (
    public.has_premium(auth.uid())
    and exists (select 1 from public.pets
                where pets.id = pet_media.pet_id and pets.user_id = auth.uid())
  );

-- The FILES, not just the rows describing them.
--
-- Hiding pet_media rows hides media from the app, because the app needs a
-- row to know an object's path. It does not hide the object from anyone who
-- already has the path — a URL kept from before a lapse would still resolve.
-- "Hidden means hidden" has to include the bytes, so the storage policies
-- take the same clause.
--
-- SELECT and INSERT only. The DELETE policy is left exactly as it is, so an
-- unsubscribed owner can still remove their own files.

drop policy if exists pet_media_objects_select on storage.objects;
create policy pet_media_objects_select on storage.objects for select
  using (
    bucket_id = 'pet-media'
    and public.has_premium(auth.uid())
    and exists (
      select 1 from public.pets p
      where p.id::text = (storage.foldername(objects.name))[1]
        and p.user_id = auth.uid()
    )
  );

drop policy if exists pet_media_objects_insert on storage.objects;
create policy pet_media_objects_insert on storage.objects for insert
  with check (
    bucket_id = 'pet-media'
    and public.has_premium(auth.uid())
    and exists (
      select 1 from public.pets p
      where p.id::text = (storage.foldername(objects.name))[1]
        and p.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- 4. Disease-specific monitoring
-- ---------------------------------------------------------------------

drop policy if exists pet_conditions_select_own on public.pet_conditions;
create policy pet_conditions_select_own on public.pet_conditions for select
  using (
    public.has_premium(auth.uid())
    and exists (select 1 from public.pets p
                where p.id = pet_conditions.pet_id and p.user_id = auth.uid())
  );

drop policy if exists pet_conditions_insert_own on public.pet_conditions;
create policy pet_conditions_insert_own on public.pet_conditions for insert
  with check (
    public.has_premium(auth.uid())
    and exists (select 1 from public.pets p
                where p.id = pet_conditions.pet_id and p.user_id = auth.uid())
  );

drop policy if exists pet_conditions_update_own on public.pet_conditions;
create policy pet_conditions_update_own on public.pet_conditions for update
  using (
    public.has_premium(auth.uid())
    and exists (select 1 from public.pets p
                where p.id = pet_conditions.pet_id and p.user_id = auth.uid())
  );

drop policy if exists condition_entries_select_own on public.condition_entries;
create policy condition_entries_select_own on public.condition_entries for select
  using (
    public.has_premium(auth.uid())
    and exists (select 1 from public.pets p
                where p.id = condition_entries.pet_id and p.user_id = auth.uid())
  );

drop policy if exists condition_entries_insert_own on public.condition_entries;
create policy condition_entries_insert_own on public.condition_entries for insert
  with check (
    public.has_premium(auth.uid())
    and exists (select 1 from public.pets p
                where p.id = condition_entries.pet_id and p.user_id = auth.uid())
  );

drop policy if exists condition_entries_update_own on public.condition_entries;
create policy condition_entries_update_own on public.condition_entries for update
  using (
    public.has_premium(auth.uid())
    and exists (select 1 from public.pets p
                where p.id = condition_entries.pet_id and p.user_id = auth.uid())
  );

drop policy if exists condition_events_select_own on public.condition_events;
create policy condition_events_select_own on public.condition_events for select
  using (
    public.has_premium(auth.uid())
    and exists (select 1 from public.pets p
                where p.id = condition_events.pet_id and p.user_id = auth.uid())
  );

drop policy if exists condition_events_insert_own on public.condition_events;
create policy condition_events_insert_own on public.condition_events for insert
  with check (
    public.has_premium(auth.uid())
    and exists (select 1 from public.pets p
                where p.id = condition_events.pet_id and p.user_id = auth.uid())
  );

drop policy if exists condition_events_update_own on public.condition_events;
create policy condition_events_update_own on public.condition_events for update
  using (
    public.has_premium(auth.uid())
    and exists (select 1 from public.pets p
                where p.id = condition_events.pet_id and p.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- 5. Body condition score
-- ---------------------------------------------------------------------

drop policy if exists bcs_select_own on public.bcs_entries;
create policy bcs_select_own on public.bcs_entries for select
  using (
    public.has_premium(auth.uid())
    and exists (select 1 from public.pets
                where pets.id = bcs_entries.pet_id and pets.user_id = auth.uid())
  );

drop policy if exists bcs_insert_own on public.bcs_entries;
create policy bcs_insert_own on public.bcs_entries for insert
  with check (
    public.has_premium(auth.uid())
    and exists (select 1 from public.pets
                where pets.id = bcs_entries.pet_id and pets.user_id = auth.uid())
  );

drop policy if exists bcs_update_own on public.bcs_entries;
create policy bcs_update_own on public.bcs_entries for update
  using (
    public.has_premium(auth.uid())
    and exists (select 1 from public.pets
                where pets.id = bcs_entries.pet_id and pets.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- Deliberately NOT gated
-- ---------------------------------------------------------------------
--
-- general_qol_entries and pain_log_entries stay free, and no policy on
-- either is touched here. The quality-of-life assessment, the BEAAAAPP pain
-- scoring, the overall score, the trends and the calendar are the reason the
-- app exists — and they are what somebody uses while deciding whether their
-- animal is suffering. That question does not get a paywall.
--
-- The vet PDF export is gated in the client only, on purpose. It composes
-- data the free tier is already entitled to read, so there is no row to
-- refuse and nothing a policy here could add.
