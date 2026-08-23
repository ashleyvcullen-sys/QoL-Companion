-- Lets a medication be scheduled by FREQUENCY ("twice a day", "once a
-- week") rather than only by clock time.
--
-- Vets prescribe frequency, not times — "BID" is twice daily, and the owner
-- decides when. Forcing clock times made people invent a precision the
-- prescription never had.
--
-- Three modes, made explicit rather than inferred from whether `times` is
-- empty, because "no times because it's as-needed" and "no times because
-- it's twice daily whenever suits" are different things that were about to
-- be represented identically.
--
-- Run this once in the Supabase Dashboard SQL Editor. See README.md.

alter table public.medications
  add column if not exists schedule_mode text not null default 'times',
  add column if not exists frequency_count smallint,
  add column if not exists frequency_period text,
  -- Separate from schedule_mode on purpose: someone may want to record
  -- doses against fixed times without being notified at each one. Defaults
  -- true so an existing timed medication keeps reminding.
  add column if not exists reminders_enabled boolean not null default true;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'medications_schedule_mode_check') then
    alter table public.medications
      add constraint medications_schedule_mode_check
      check (schedule_mode in ('times', 'frequency', 'as_needed'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'medications_frequency_period_check') then
    alter table public.medications
      add constraint medications_frequency_period_check
      check (frequency_period is null or frequency_period in ('day', 'week'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'medications_frequency_count_check') then
    alter table public.medications
      add constraint medications_frequency_count_check
      check (frequency_count is null or (frequency_count >= 1 and frequency_count <= 12));
  end if;
end $$;

-- Backfill: anything already saved with no times was an as-needed
-- medication, and the 'times' default above would silently mislabel it.
update public.medications
set schedule_mode = case
  when times is null or array_length(times, 1) is null then 'as_needed'
  else 'times'
end
where schedule_mode = 'times'
  and (times is null or array_length(times, 1) is null);
