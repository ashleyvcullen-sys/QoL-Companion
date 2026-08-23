-- Adds optional body weight alongside the Body Condition Score.
--
-- BCS is a subjective fat-cover judgement; weight is an objective number.
-- Neither replaces the other — a pet can hold a steady BCS while losing
-- weight, which is exactly the pattern worth catching — so weight is stored
-- on the same row rather than in its own table, and stays nullable because
-- not every owner has scales.
--
-- Run this once in the Supabase Dashboard SQL Editor, AFTER
-- 20260823100000_create_bcs_entries.sql. No CLI/service-role credential is
-- wired into local tooling, so this repo tracks the migration text but can't
-- apply it.
--
-- Written to be re-runnable: both statements are guarded, so running it a
-- second time is a no-op rather than an error.

alter table public.bcs_entries
  add column if not exists weight_kg numeric(6, 2);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bcs_entries_weight_kg_check'
  ) then
    alter table public.bcs_entries
      add constraint bcs_entries_weight_kg_check
      check (weight_kg is null or (weight_kg > 0 and weight_kg < 500));
  end if;
end $$;
