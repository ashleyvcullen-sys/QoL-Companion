-- When a medication was started, and when it was stopped.
--
-- The table has always known whether a course is `active`, but not WHEN it
-- began or ended — only `created_at`, which is when the row was typed in.
-- Those are different dates: an owner adding a medication their pet has been
-- on for six months would have the app believe it started today.
--
-- The dates exist to be drawn. The calendars on Trends and on each condition
-- page mark the day a medication started or stopped, so the question every
-- owner actually asks — "is this working?" — can be answered by looking at
-- the colours either side of the mark rather than by remembering.
--
-- Nullable on purpose. An owner who does not know when a long-standing
-- medication was started should leave it blank rather than guess, and a
-- medication still being given has no end date yet.
--
-- Back-fill: existing rows take the date the row was created, which is the
-- best available answer and is right for anything added as it was prescribed.
-- It runs only where started_on is null, so re-running changes nothing.
--
-- Run this once in the Supabase Dashboard SQL Editor. See README.md.

alter table public.medications
  add column if not exists started_on date,
  add column if not exists ended_on date;

update public.medications
   set started_on = created_at::date
 where started_on is null;

-- A course cannot end before it began.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'medications_dates_order_check') then
    alter table public.medications
      add constraint medications_dates_order_check
      check (ended_on is null or started_on is null or ended_on >= started_on);
  end if;
end $$;
