-- Body Condition Score entries — the standard 9-point veterinary scale,
-- tracked per pet over time. Deliberately separate from
-- general_qol_entries: BCS is its own clinical measure on a non-linear
-- scale (4-5 ideal, both extremes bad) and does not feed the QoL score.
--
-- Run this once in the Supabase Dashboard SQL Editor. No CLI/service-role
-- credential is wired into local tooling, so this repo tracks the migration
-- text but can't apply it.

create table if not exists public.bcs_entries (
  id          uuid primary key default gen_random_uuid(),
  pet_id      uuid not null references public.pets(id) on delete cascade,
  entry_date  date not null default current_date,
  score       smallint not null check (score between 1 and 9),
  notes       text,
  created_at  timestamptz not null default now(),
  -- One score per pet per day, matching general_qol_entries. Supports the
  -- app's upsert(..., { onConflict: 'pet_id,entry_date' }).
  unique (pet_id, entry_date)
);

create index if not exists bcs_entries_pet_id_entry_date_idx
  on public.bcs_entries (pet_id, entry_date);

alter table public.bcs_entries enable row level security;

-- Four per-command policies, mirroring general_qol_entries exactly (verified
-- against pg_policies on 23 Aug 2026). An earlier draft used a single
-- `for all` policy — functionally equivalent, but it did not match the
-- pattern used everywhere else, which makes the access rules harder to audit
-- side by side. The ownership test is identical in all four: the row's pet
-- must belong to the calling user.
--
-- INSERT and UPDATE are both required: the app writes via upsert, which is
-- INSERT ... ON CONFLICT DO UPDATE and is checked against both.

create policy bcs_select_own on public.bcs_entries for select
  using (
    exists (
      select 1 from public.pets
      where pets.id = bcs_entries.pet_id and pets.user_id = auth.uid()
    )
  );

create policy bcs_insert_own on public.bcs_entries for insert
  with check (
    exists (
      select 1 from public.pets
      where pets.id = bcs_entries.pet_id and pets.user_id = auth.uid()
    )
  );

create policy bcs_update_own on public.bcs_entries for update
  using (
    exists (
      select 1 from public.pets
      where pets.id = bcs_entries.pet_id and pets.user_id = auth.uid()
    )
  );

create policy bcs_delete_own on public.bcs_entries for delete
  using (
    exists (
      select 1 from public.pets
      where pets.id = bcs_entries.pet_id and pets.user_id = auth.uid()
    )
  );
