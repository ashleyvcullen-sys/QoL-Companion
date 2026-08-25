-- Allow "N times per month" as a medication frequency.
--
-- frequency_period was constrained to ('day', 'week') when the frequency mode
-- was added. Monthly courses are common enough in practice — a monthly
-- injection, a monthly worming or flea treatment, a long-acting arthritis
-- injection — that leaving them out forces an owner to record something that
-- is not what is happening.
--
-- The constraint is dropped and recreated rather than altered: Postgres has no
-- "alter check constraint", and a check constraint cannot be widened in place.
-- Recreating it validates every existing row against the new rule, which is
-- what we want — the new set is a superset of the old one, so nothing can fail.
--
-- Nothing to back-fill. Existing medications keep 'day' or 'week', and the
-- column stays nullable for medications not using frequency mode at all.
--
-- Run this once in the Supabase Dashboard SQL Editor. See README.md.

alter table public.medications
  drop constraint if exists medications_frequency_period_check;

alter table public.medications
  add constraint medications_frequency_period_check
  check (frequency_period is null or frequency_period in ('day', 'week', 'month'));
