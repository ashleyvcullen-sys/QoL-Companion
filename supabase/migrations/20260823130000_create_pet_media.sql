-- Photos and short videos attached to a pet.
--
-- The FILE lives in Supabase Storage; this table is the index — caption,
-- date, who it belongs to. Keeping metadata in Postgres rather than leaning
-- on storage listings means the gallery can be sorted and filtered with a
-- normal query, and a caption doesn't require renaming an object.
--
-- Storage path convention is '<pet_id>/<uuid>.<ext>'. The pet id being the
-- FIRST path segment is load-bearing: the storage policies below authorise
-- by parsing it out of the object name, so anything written outside that
-- shape is unreachable by design.
--
-- Run this once in the Supabase Dashboard SQL Editor. See README.md in this
-- folder for how to check what has already been applied.

create table if not exists public.pet_media (
  id           uuid primary key default gen_random_uuid(),
  pet_id       uuid not null references public.pets(id) on delete cascade,
  storage_path text not null unique,
  media_type   text not null check (media_type in ('image', 'video')),
  caption      text,
  -- The day the photo is ABOUT, which is not always the day it was uploaded
  -- — an owner photographing a wound may add last week's picture later.
  taken_on     date not null default current_date,
  bytes        bigint,
  created_at   timestamptz not null default now()
);

create index if not exists pet_media_pet_taken_idx
  on public.pet_media (pet_id, taken_on desc);

alter table public.pet_media enable row level security;

create policy pet_media_select_own on public.pet_media for select
  using (exists (select 1 from public.pets
                 where pets.id = pet_media.pet_id and pets.user_id = auth.uid()));

create policy pet_media_insert_own on public.pet_media for insert
  with check (exists (select 1 from public.pets
                      where pets.id = pet_media.pet_id and pets.user_id = auth.uid()));

create policy pet_media_update_own on public.pet_media for update
  using (exists (select 1 from public.pets
                 where pets.id = pet_media.pet_id and pets.user_id = auth.uid()));

create policy pet_media_delete_own on public.pet_media for delete
  using (exists (select 1 from public.pets
                 where pets.id = pet_media.pet_id and pets.user_id = auth.uid()));

-- --- Storage -----------------------------------------------------------
--
-- PRIVATE bucket. Pet photos can show wounds, incontinence, a dying animal —
-- the sort of thing an owner would be distressed to find was publicly
-- addressable. The app reads them through short-lived signed URLs instead.

insert into storage.buckets (id, name, public)
values ('pet-media', 'pet-media', false)
on conflict (id) do nothing;

-- Authorise by parsing the pet id out of the first path segment and checking
-- the caller owns that pet. storage.foldername() returns the path split into
-- an array, so [1] is '<pet_id>' for a 'pet_id/file.jpg' object.
--
-- pets.id::text rather than casting the segment to uuid: a malformed path
-- would raise on the cast and abort the query, where a text comparison just
-- fails to match and denies access, which is the behaviour we want.

create policy pet_media_objects_select on storage.objects for select
  using (
    bucket_id = 'pet-media'
    and exists (
      select 1 from public.pets
      where pets.id::text = (storage.foldername(name))[1]
        and pets.user_id = auth.uid()
    )
  );

create policy pet_media_objects_insert on storage.objects for insert
  with check (
    bucket_id = 'pet-media'
    and exists (
      select 1 from public.pets
      where pets.id::text = (storage.foldername(name))[1]
        and pets.user_id = auth.uid()
    )
  );

create policy pet_media_objects_delete on storage.objects for delete
  using (
    bucket_id = 'pet-media'
    and exists (
      select 1 from public.pets
      where pets.id::text = (storage.foldername(name))[1]
        and pets.user_id = auth.uid()
    )
  );
