-- Which condition (or conditions) a medication is for.
--
-- Until now medications and conditions were unrelated: the app could tell an
-- owner what {name} was taking, but not that the metronidazole was for the
-- IBD and the meloxicam for the arthritis. That mattered most on the disease
-- pages, which had to list EVERY active medication with a line apologising
-- that it could not narrow them down.
--
-- An array rather than a single key, because one drug genuinely can treat two
-- things at once — steroids for an inflammatory gut and a sore joint is the
-- ordinary case, not the exotic one. Forcing a choice there would make the
-- owner file it wrongly and then see it in only half the places it belongs.
--
-- Values are condition keys as used in lib/conditions.js ('arthritis',
-- 'cardiac', 'gastrointestinal', …). Deliberately NOT a foreign key: the
-- conditions are defined in the app, not in the database, and a pet can be
-- prescribed something for a condition they are not tracking.
--
-- Null or empty means "not tied to a condition", which is a real answer — a
-- wormer or a supplement belongs to no diagnosis in particular.
--
-- Run this once in the Supabase Dashboard SQL Editor. See README.md.

alter table public.medications
  add column if not exists condition_keys text[];
