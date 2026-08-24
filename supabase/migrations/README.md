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

Both were applied as a single combined paste, which is why the second one
reports as already satisfied if re-run. Both are written to be re-runnable.

## Not yet applied

Nothing. Every migration in this folder has been applied and verified.

Update these tables whenever a migration is applied.
