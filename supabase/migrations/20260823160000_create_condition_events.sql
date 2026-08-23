-- Events on a condition's timeline: an episode, a diagnosis, a medication
-- started or stopped.
--
-- Separate from condition_entries because they answer different questions.
-- An entry is "how were things on this day" and there is one per day. An
-- event is "this happened" — several can fall on one day, none on most, and
-- a day with an event usually has no reading at all.
--
-- The point of recording them is context on the charts. A breathing rate
-- climbing for a week means one thing on its own and something quite
-- different when a diuretic was stopped four days ago.
--
-- Run this once in the Supabase Dashboard SQL Editor. See README.md.

create table if not exists public.condition_events (
  id            uuid primary key default gen_random_uuid(),
  pet_id        uuid not null references public.pets(id) on delete cascade,
  condition_key text not null,
  event_date    date not null default current_date,
  -- Constrained rather than free text so the charts can style each kind
  -- differently and the list can be filtered. Adding a type is a migration,
  -- which is the right amount of friction for something the UI must know how
  -- to draw.
  event_type    text not null,
  -- Short label: the medication name, the diagnosis, what the episode was.
  title         text not null,
  notes         text,
  created_at    timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'condition_events_type_check') then
    alter table public.condition_events
      add constraint condition_events_type_check
      check (event_type in ('episode', 'diagnosis', 'medication_started', 'medication_stopped', 'other'));
  end if;
end $$;

create index if not exists condition_events_lookup_idx
  on public.condition_events (pet_id, condition_key, event_date desc);

alter table public.condition_events enable row level security;

create policy condition_events_select_own on public.condition_events for select
  using (exists (select 1 from public.pets p
                 where p.id = condition_events.pet_id and p.user_id = auth.uid()));

create policy condition_events_insert_own on public.condition_events for insert
  with check (exists (select 1 from public.pets p
                      where p.id = condition_events.pet_id and p.user_id = auth.uid()));

create policy condition_events_update_own on public.condition_events for update
  using (exists (select 1 from public.pets p
                 where p.id = condition_events.pet_id and p.user_id = auth.uid()));

create policy condition_events_delete_own on public.condition_events for delete
  using (exists (select 1 from public.pets p
                 where p.id = condition_events.pet_id and p.user_id = auth.uid()));
