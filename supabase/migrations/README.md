# Migration status

These files are applied **by hand** in the Supabase Dashboard SQL Editor. No
CLI or service-role credential is wired into local tooling, so nothing in this
repo can apply them, and — more importantly — **nothing in this repo can tell
you whether they have been applied.**

Read that second point carefully before flagging a migration as outstanding.
The presence of a file here says nothing about the state of the database. The
only source of truth is the database itself. To check, run this in the SQL
Editor:

```sql
select 'column' as kind, column_name as name
from information_schema.columns
where table_schema = 'public' and table_name = 'bcs_entries'
union all
select 'policy' as kind, policyname as name
from pg_policies
where schemaname = 'public' and tablename = 'bcs_entries'
order by kind, name;
```

## Applied

| Migration | Applied | Verified by |
|---|---|---|
| `20260823100000_create_bcs_entries.sql` | 23 Aug 2026 | Query above returned all 7 columns and all 4 `bcs_*_own` policies |
| `20260823110000_add_bcs_weight.sql` | 23 Aug 2026 | `weight_kg` present in the same result |
| `20260823120000_create_medications.sql` | 23 Aug 2026 | `medications` + `medication_doses` present, 4 policies each. **`medication_doses_slot_idx` was dropped and recreated the same day** — it was originally PARTIAL (`where dose_time is not null`), which Postgres refuses to use for ON CONFLICT inference, so every dose upsert failed. Now a plain unique index; NULL dose_time still allows repeat as-needed doses because Postgres treats NULLs as distinct. |
| `20260823130000_create_pet_media.sql` | 23 Aug 2026 | `pet_media` present with 4 policies; `pet-media` bucket exists and is PRIVATE; 3 storage.objects policies present. **The three storage.objects policies were dropped and recreated the same day** — the originals used an unaliased `storage.foldername(name)`, which Postgres bound to `pets.name` instead of the object's name and silently denied every upload. Verified fixed: the policy now reads `storage.foldername(objects.name)` with a `pets p` alias. |
| `20260823140000_medication_schedule_modes.sql` | 23 Aug 2026 | `schedule_mode`, `frequency_count`, `frequency_period`, `reminders_enabled` all present on `medications` |
| `20260823150000_create_condition_monitoring.sql` | 23 Aug 2026 | `pet_conditions` (7 cols) and `condition_entries` (7 cols) present, verified via information_schema |
| `20260823160000_create_condition_events.sql` | 23 Aug 2026 | `condition_events` (8 cols) present, verified via information_schema |
| `20260824000000_add_condition_config.sql` | 24 Aug 2026 | `config` present on `pet_conditions`: `jsonb`, default `'{}'::jsonb`, confirmed via information_schema. Adds `config` jsonb to `pet_conditions` so a condition's parameter list can be composed per pet rather than fixed — cancer monitoring needs it; every other condition defaults to `'{}'` and behaves exactly as before, so there was nothing to back-fill. Written `add column if not exists`, so re-running is a no-op. |
| `20260825000000_medication_monthly_frequency.sql` | 25 Aug 2026 | Ash ran it in the SQL Editor. Widens `medications_frequency_period_check` to `('day', 'week', 'month')` so "N times per month" can be saved. Drop-and-recreate rather than alter, because Postgres cannot widen a check in place; `if exists` on the drop makes it re-runnable. Nothing to back-fill — the new set is a strict superset, so every existing row already satisfies it. |
| `20260825010000_medication_dates.sql` | 25 Aug 2026 | Ash ran it in the SQL Editor, and confirmed `started_on` and `ended_on` both present via information_schema. Adds the two dates, back-fills `started_on` from `created_at` (the best available answer for rows added as they were prescribed), and adds `medications_dates_order_check` so an end date cannot precede a start. Both columns stay nullable: "I don't know when this started" is a real answer, and a guess drawn on a calendar as fact would be worse than a gap. |
| `20260825020000_medication_reminder_time.sql` | 25 Aug 2026 | Ash ran it in the SQL Editor, and confirmed `reminder_time` present via information_schema. Adds a nullable `reminder_time text` to `medications` — one time of day at which to raise a frequency medication's doses, chosen by the owner. Kept separate from `times`, which are the prescribed clock times a dose is due at and each get their own tick box and reminder. Nullable because a medication on set times, or given as needed, or with reminders off, has no such time. `add column if not exists`, so re-running is a no-op. |
| `20260825030000_medication_reminder_days.sql` | 25 Aug 2026 | Ash ran it in the SQL Editor, and confirmed `reminder_days` present via information_schema. Adds a nullable `reminder_days integer[]` to `medications`. Meaning depends on `frequency_period`: for `'week'` these are JavaScript weekdays (0 Sunday – 6 Saturday), for `'month'` they are dates of the month. Capped at 28 by the app rather than by the database — a reminder set for the 31st would silently skip five months a year, and the owner would have no way of knowing. Null or empty means "no days chosen" and the app falls back to the day the course started, which is the behaviour from before the column existed. |
| `20260829000000_medication_conditions.sql` | 29 Aug 2026 | Ash ran it in the SQL Editor, and confirmed `condition_keys` present via information_schema — one row, `ARRAY`, nullable. Adds a nullable `condition_keys text[]` to `medications`, so a medication can say which condition (or conditions) it is for and a disease page can list only that condition's drugs instead of every active one. An array rather than a single key because one drug genuinely can treat two things at once. Deliberately NOT a foreign key: conditions are defined in `lib/conditions.js`, not in the database, and a pet can be prescribed something for a condition they are not tracking. Null or empty means "not tied to a condition", which is a real answer for a wormer or a supplement — so there was nothing to back-fill. `add column if not exists`, so re-running is a no-op. |

The 25 Aug medication migrations were applied in two sittings: the monthly
frequency and dates pair together, then the two reminder columns. All four are
written `if not exists` / `if exists`, so re-running any of them is a no-op.

Both reminder columns were confirmed present against `information_schema` on
25 Aug 2026 — two rows returned. To re-check at any point:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'medications'
  and column_name in ('reminder_time', 'reminder_days');
```

Two rows means both are present.

## Not yet applied

Add a row here the moment a new migration file is written, not when someone
remembers — a file sitting in the folder with no row in either table is
indistinguishable from one that has been applied, and that ambiguity is what
this document exists to remove.

| Migration | What it does | Why it is needed |
|---|---|---|
| `20260830000000_subscription_pet_gating.sql` | Adds `user_entitlements`, the `pet_limit_for` / `pet_count_for` / `visible_pet_ids` functions, and replaces every RLS policy on `pets` | Client-side gating is bypassable with the anon key and the user's own JWT. Until this is applied the pet limit is a suggestion. |

**Read the header of that file before running it.** It drops and recreates
all RLS policies on `public.pets`, which was created in the Dashboard, so
this repo has no record of what its policies are currently called. Run the
`pg_policies` query in the header first and keep the output.

After applying, verify — the second query is the one that matters, because a
`NULL` limit would make the whole thing fail open:

```sql
select public.pet_limit_for(auth.uid());          -- must be 1, never null
select count(*) from public.visible_pet_ids(auth.uid());
select policyname, cmd from pg_policies
 where schemaname = 'public' and tablename = 'pets';
```

Also confirm these two inherit the restriction rather than checking a
`user_id` column directly — if either does, its select policy needs the
`pet_id in (select public.visible_pet_ids(auth.uid()))` clause adding:

```sql
select tablename, policyname, qual from pg_policies
 where schemaname = 'public'
   and tablename in ('general_qol_entries', 'pain_log_entries');
```

The `revenuecat-webhook` Edge Function must be deployed with JWT
verification **off** (`--no-verify-jwt`), and `REVENUECAT_WEBHOOK_SECRET`
set in Edge Function secrets to the same value as the Authorization header
configured in the RevenueCat dashboard. With verify_jwt left on, every
delivery is rejected before the function runs and the only symptom is that
subscriptions silently never apply.

Update these tables whenever a migration is applied.
