-- The pet's own profile photo.
--
-- Two things: a column on pets holding the storage path, and a private
-- bucket of its own to hold the file.
--
-- WHY A SEPARATE BUCKET, and not the 'pet-media' one that already exists:
--
--   * 20260830010000_premium_feature_gating.sql puts has_premium() on the
--     'pet-media' storage policies. A profile photo is an identity element —
--     it is how an owner tells Milo's card from Bella's — and identity must
--     not sit behind the paywall. Putting it in the gated bucket would mean a
--     lapsed subscription silently loses the faces on its own home screen.
--   * A profile photo is not part of the animal's clinical record. It must
--     not appear in the photo journal, in an export, or in a report handed to
--     a vet among the pictures of wounds and swellings. Separate buckets make
--     that structural rather than a filter somebody has to remember.
--
-- Private, like 'pet-media', and for the same reason: nothing about a sick
-- animal should be publicly addressable. The app reads it through a
-- one-hour signed URL.
--
-- Authorisation is by ownership only — no entitlement check — and follows the
-- same '<pet_id>/…' path convention, parsed out of the object name with
-- storage.foldername(). Note the aliases: pets has a `name` column of its
-- own, and an unqualified `name` in these policies binds to the PET's name
-- rather than the storage object's, which silently denies every upload. That
-- exact bug is on the record in 20260823130000_create_pet_media.sql.
--
-- Existing row-level security on pets covers the new column: an owner can
-- already update their own pet row and nobody else's, which is the rule this
-- needs. No policy changes there.
--
-- RUN THIS BEFORE SHIPPING the build that adds the profile photo: setting one
-- writes pets.photo_path, and Postgres rejects the whole update if the column
-- does not exist.

alter table public.pets
  add column if not exists photo_path text;

insert into storage.buckets (id, name, public)
values ('pet-photos', 'pet-photos', false)
on conflict (id) do nothing;

drop policy if exists pet_photos_objects_select on storage.objects;
create policy pet_photos_objects_select on storage.objects for select
  using (
    bucket_id = 'pet-photos'
    and exists (
      select 1 from public.pets p
      where p.id::text = (storage.foldername(objects.name))[1]
        and p.user_id = auth.uid()
    )
  );

drop policy if exists pet_photos_objects_insert on storage.objects;
create policy pet_photos_objects_insert on storage.objects for insert
  with check (
    bucket_id = 'pet-photos'
    and exists (
      select 1 from public.pets p
      where p.id::text = (storage.foldername(objects.name))[1]
        and p.user_id = auth.uid()
    )
  );

-- Update and delete as well: replacing a photo removes the old object, and
-- removing a pet removes its photo with it.
drop policy if exists pet_photos_objects_update on storage.objects;
create policy pet_photos_objects_update on storage.objects for update
  using (
    bucket_id = 'pet-photos'
    and exists (
      select 1 from public.pets p
      where p.id::text = (storage.foldername(objects.name))[1]
        and p.user_id = auth.uid()
    )
  );

drop policy if exists pet_photos_objects_delete on storage.objects;
create policy pet_photos_objects_delete on storage.objects for delete
  using (
    bucket_id = 'pet-photos'
    and exists (
      select 1 from public.pets p
      where p.id::text = (storage.foldername(objects.name))[1]
        and p.user_id = auth.uid()
    )
  );
