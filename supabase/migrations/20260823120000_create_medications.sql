-- Medications and dose logging.
--
-- Two tables rather than one: a medication is a standing instruction that
-- changes rarely, a dose is an event that happens several times a day.
-- Keeping them apart means editing a dose time doesn't rewrite history, and
-- the dose log stays a faithful record of what was actually given.
--
-- Run this once in the Supabase Dashboard SQL Editor. See README.md in this
-- folder for how to check what has already been applied.

create table if not exists public.medications (
  id          uuid primary key default gen_random_uuid(),
  pet_id      uuid not null references public.pets(id) on delete cascade,
  name        text not null,
  dose        text,
  -- Times of day as 'HH:MM' strings. An EMPTY array means as-needed (PRN) —
  -- common in palliative care, where pain relief is given on signs rather
  -- than a clock. Stored as text, not time, because these are wall-clock
  -- slots the owner reads, never instants to compare across timezones.
  times       text[] not null default '{}',
  notes       text,
  -- Courses end. Deactivating rather than deleting keeps the dose history
  -- intact and readable at the next vet visit.
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists medications_pet_id_idx
  on public.medications (pet_id);

create table if not exists public.medication_doses (
  id             uuid primary key default gen_random_uuid(),
  medication_id  uuid not null references public.medications(id) on delete cascade,
  dose_date      date not null default current_date,
  -- Which scheduled slot this dose satisfies ('HH:MM'), or NULL for an
  -- as-needed dose that answers to no slot.
  dose_time      text,
  given_at       timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

create index if not exists medication_doses_medication_date_idx
  on public.medication_doses (medication_id, dose_date);

-- One dose per scheduled slot per day, so ticking twice can't double-log —
-- but PARTIAL, so as-needed doses (dose_time null) can be logged as often as
-- they are actually given. A plain unique constraint would treat every NULL
-- as distinct anyway; being explicit documents the intent.
create unique index if not exists medication_doses_slot_idx
  on public.medication_doses (medication_id, dose_date, dose_time)
  where dose_time is not null;

alter table public.medications enable row level security;
alter table public.medication_doses enable row level security;

-- Four per-command policies, mirroring general_qol_entries and bcs_entries.
-- Medications reach the owner through pets; doses reach it through
-- medications, one join further out.

create policy medications_select_own on public.medications for select
  using (exists (select 1 from public.pets
                 where pets.id = medications.pet_id and pets.user_id = auth.uid()));

create policy medications_insert_own on public.medications for insert
  with check (exists (select 1 from public.pets
                      where pets.id = medications.pet_id and pets.user_id = auth.uid()));

create policy medications_update_own on public.medications for update
  using (exists (select 1 from public.pets
                 where pets.id = medications.pet_id and pets.user_id = auth.uid()));

create policy medications_delete_own on public.medications for delete
  using (exists (select 1 from public.pets
                 where pets.id = medications.pet_id and pets.user_id = auth.uid()));

create policy medication_doses_select_own on public.medication_doses for select
  using (exists (select 1 from public.medications m
                 join public.pets p on p.id = m.pet_id
                 where m.id = medication_doses.medication_id and p.user_id = auth.uid()));

create policy medication_doses_insert_own on public.medication_doses for insert
  with check (exists (select 1 from public.medications m
                      join public.pets p on p.id = m.pet_id
                      where m.id = medication_doses.medication_id and p.user_id = auth.uid()));

create policy medication_doses_update_own on public.medication_doses for update
  using (exists (select 1 from public.medications m
                 join public.pets p on p.id = m.pet_id
                 where m.id = medication_doses.medication_id and p.user_id = auth.uid()));

create policy medication_doses_delete_own on public.medication_doses for delete
  using (exists (select 1 from public.medications m
                 join public.pets p on p.id = m.pet_id
                 where m.id = medication_doses.medication_id and p.user_id = auth.uid()));
