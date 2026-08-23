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

-- IMPORTANT: confirm this matches the policy already on
-- general_qol_entries before running — see the note in the commit message.
-- Check with:
--   select tablename, policyname, cmd, qual, with_check
--   from pg_policies
--   where schemaname = 'public' and tablename = 'general_qol_entries';
-- If the existing policy differs, mirror that one instead of this.
create policy "Users manage BCS for their own pets"
  on public.bcs_entries for all
  using (
    exists (
      select 1 from public.pets
      where pets.id = bcs_entries.pet_id
        and pets.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.pets
      where pets.id = bcs_entries.pet_id
        and pets.user_id = auth.uid()
    )
  );
