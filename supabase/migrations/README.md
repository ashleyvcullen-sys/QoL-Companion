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

Both were applied as a single combined paste, which is why the second one
reports as already satisfied if re-run. Both are written to be re-runnable.

## Not yet applied

| Migration | What it does | Why it is needed |
|---|---|---|
| `20260825030000_medication_reminder_days.sql` | Adds a nullable `reminder_days` integer array to `medications` | A medication given more than once a week or month needs a reminder on each of its days, and only the owner knows which days those are. **Until this is run, choosing reminder days fails to save.** |
| `20260825020000_medication_reminder_time.sql` | Adds a nullable `reminder_time` to `medications` | Medications scheduled by frequency ("twice a day", "once a month") can now remind, at a time of day the owner chooses. **Until this is run, saving a frequency medication with reminders on fails.** |

Update these tables whenever a migration is applied.
