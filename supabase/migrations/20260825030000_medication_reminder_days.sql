-- Which days a weekly or monthly medication should remind on.
--
-- A medication given twice a week has two days, and only the owner knows
-- which two — Monday and Thursday, say, because that is what the vet said or
-- what fits around work. Anchoring both to the day the course started would
-- put two reminders on the same weekday, which is worse than useless.
--
-- Meaning depends on frequency_period, which is why this is a plain integer
-- array rather than two columns:
--
--   'week'   weekdays, 0 = Sunday through 6 = Saturday (JavaScript's getDay)
--   'month'  days of the month, 1 to 28
--
-- Capped at 28 for monthly by the app, not by the database: a reminder set
-- for the 31st would not fire in February, April, June, September or
-- November, and an owner who set one would have no way of knowing it had
-- silently skipped five months of the year.
--
-- Null or empty means "no days chosen", and the app falls back to the day the
-- course started — the behaviour before this column existed.
--
-- Run this once in the Supabase Dashboard SQL Editor. See README.md.

alter table public.medications
  add column if not exists reminder_days integer[];
