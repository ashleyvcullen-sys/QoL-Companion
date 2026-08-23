-- Multi-pet support: remove the one-pet-per-account restriction.
--
-- `pets_user_id_unique` enforced a single pet row per user_id at the
-- database level. With multi-pet support, a user can have many pets, all
-- still scoped to them by user_id (RLS policies on user_id are unaffected —
-- this only removes the *uniqueness* requirement, not the ownership link).
--
-- Run this once in the Supabase Dashboard SQL Editor. No CLI/service-role
-- credential is wired into local tooling, so this repo tracks the migration
-- text but can't apply it.

alter table public.pets
  drop constraint if exists pets_user_id_unique;

-- Belt-and-braces: if the restriction was created as a bare unique index
-- rather than a table constraint, the statement above is a no-op and this
-- one removes it instead. (Dropping a constraint also drops its backing
-- index, so running both is safe either way.)
drop index if exists public.pets_user_id_unique;
