-- Monitoring for diagnosed conditions (cardiac, arthritis, kidney, ...).
--
-- ONE pair of tables for every condition, not a table per condition. The app
-- promises "and more", and a schema change per condition would make adding
-- one a deployment rather than a data edit. Which parameters a condition
-- has, what they're called and how they're scored all live in
-- src/lib/conditions.js; the database only stores which conditions a pet is
-- being monitored for, and the values logged against them.
--
-- Run this once in the Supabase Dashboard SQL Editor. See README.md.

-- Which conditions this pet is monitored for. A row here is what makes the
-- condition appear in the app at all.
create table if not exists public.pet_conditions (
  id            uuid primary key default gen_random_uuid(),
  pet_id        uuid not null references public.pets(id) on delete cascade,
  -- Matches a key in src/lib/conditions.js. Deliberately NOT a foreign key
  -- to a lookup table: the definitions are app code, versioned with the app,
  -- and a database enum would have to be migrated in lockstep with every
  -- new condition.
  condition_key text not null,
  diagnosed_on  date,
  notes         text,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (pet_id, condition_key)
);

create index if not exists pet_conditions_pet_idx
  on public.pet_conditions (pet_id);

-- Logged readings. `values` is jsonb keyed by parameter, the same approach
-- general_qol_entries.scores already uses — so a condition can gain or lose
-- a parameter without a migration, and old entries keep whatever they were
-- recorded with rather than being back-filled with invented data.
create table if not exists public.condition_entries (
  id            uuid primary key default gen_random_uuid(),
  pet_id        uuid not null references public.pets(id) on delete cascade,
  condition_key text not null,
  entry_date    date not null default current_date,
  values        jsonb not null default '{}'::jsonb,
  notes         text,
  created_at    timestamptz not null default now(),
  -- One entry per condition per pet per day, matching every other log in the
  -- app. Plain unique index, NOT partial — a partial one cannot be used for
  -- ON CONFLICT inference, which is the bug that broke medication dose
  -- logging earlier.
  unique (pet_id, condition_key, entry_date)
);

create index if not exists condition_entries_lookup_idx
  on public.condition_entries (pet_id, condition_key, entry_date desc);

alter table public.pet_conditions enable row level security;
alter table public.condition_entries enable row level security;

-- Four per-command policies each, mirroring general_qol_entries. Tables are
-- aliased so no column can bind to something other than intended — the bug
-- that silently denied every media upload.

create policy pet_conditions_select_own on public.pet_conditions for select
  using (exists (select 1 from public.pets p
                 where p.id = pet_conditions.pet_id and p.user_id = auth.uid()));

create policy pet_conditions_insert_own on public.pet_conditions for insert
  with check (exists (select 1 from public.pets p
                      where p.id = pet_conditions.pet_id and p.user_id = auth.uid()));

create policy pet_conditions_update_own on public.pet_conditions for update
  using (exists (select 1 from public.pets p
                 where p.id = pet_conditions.pet_id and p.user_id = auth.uid()));

create policy pet_conditions_delete_own on public.pet_conditions for delete
  using (exists (select 1 from public.pets p
                 where p.id = pet_conditions.pet_id and p.user_id = auth.uid()));

create policy condition_entries_select_own on public.condition_entries for select
  using (exists (select 1 from public.pets p
                 where p.id = condition_entries.pet_id and p.user_id = auth.uid()));

create policy condition_entries_insert_own on public.condition_entries for insert
  with check (exists (select 1 from public.pets p
                      where p.id = condition_entries.pet_id and p.user_id = auth.uid()));

create policy condition_entries_update_own on public.condition_entries for update
  using (exists (select 1 from public.pets p
                 where p.id = condition_entries.pet_id and p.user_id = auth.uid()));

create policy condition_entries_delete_own on public.condition_entries for delete
  using (exists (select 1 from public.pets p
                 where p.id = condition_entries.pet_id and p.user_id = auth.uid()));
