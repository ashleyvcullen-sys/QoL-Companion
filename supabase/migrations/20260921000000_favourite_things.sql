-- Favourite things: up to three activities an owner names as the ones their
-- pet loves, checked at every Overall Quality of Life Assessment.
--
-- pets.favourite_things            the current list, carried from one
--                                  assessment to the next.
-- general_qol_entries.favourite_things
--                                  that day's answers, as
--                                  [{ "thing": text, "answer": "usual" | "less"
--                                     | "none" | "no_chance" }].
--                                  "no_chance" is "didn't have the chance" and
--                                  is excluded from scoring, the same as "not
--                                  sure" elsewhere — a rainy day is not a lost
--                                  interest.
--                                  The words are stored with the answer so
--                                  renaming a favourite later does not rewrite
--                                  what was said about the old one.
--
-- Both nullable with nothing to back-fill: no list and no answers is the state
-- every existing pet and entry is already in. Existing row-level security on
-- both tables covers the new columns — no policy changes.
--
-- RUN THIS BEFORE SHIPPING the build that adds the Favourite Things page: the
-- assessment save writes favourite_things, and Postgres rejects the whole save
-- if the column does not exist.

alter table public.pets
  add column if not exists favourite_things text[];

alter table public.general_qol_entries
  add column if not exists favourite_things jsonb;
