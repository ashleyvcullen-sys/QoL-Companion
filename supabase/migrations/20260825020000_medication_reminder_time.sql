-- A time of day to remind, for medications scheduled by frequency.
--
-- Reminders used to be limited to medications given at set clock times, on
-- the reasoning that the app should not invent a time nobody prescribed. That
-- reasoning was right about the app inventing one and wrong about the
-- conclusion: the owner can say when they want reminding. "Twice a day,
-- remind me at 8am" is their choice, not the app's guess.
--
-- Kept separate from `times`, which means something different: those are the
-- prescribed clock times a dose is due at, and each one gets its own tick box
-- and its own reminder. This is one time of day at which to raise the whole
-- period's doses, and exists only when schedule_mode = 'frequency'.
--
-- Nullable: a frequency medication with reminders off has no reminder time,
-- and neither does one on set times or given as needed.
--
-- Run this once in the Supabase Dashboard SQL Editor. See README.md.

alter table public.medications
  add column if not exists reminder_time text;
