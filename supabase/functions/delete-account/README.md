# delete-account Edge Function

Deletes the calling user's entire account (pets, all QoL/pain entries, and
the `auth.users` record) using the service-role key server-side. Built for
Apple App Store Guideline 5.1.1(v) — genuine in-app account deletion.

This repo has no Supabase CLI login or service-role credential available to
deploy this automatically — it needs to be deployed once, manually, from
your machine.

## Deploy via the Supabase CLI (recommended)

```bash
# One-time setup, if you haven't already:
npx supabase login
npx supabase link --project-ref <your-project-ref>   # find this in your Supabase project's Settings > General

# Deploy the function:
npx supabase functions deploy delete-account
```

No manual secrets setup needed — `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY` are automatically injected into every Edge
Function's runtime environment by Supabase.

## Deploy via the Supabase Dashboard (no CLI needed)

1. Go to your project's **Edge Functions** page in the Supabase Dashboard.
2. Create a new function named exactly `delete-account`.
3. Paste in the contents of `index.ts` from this directory.
4. Deploy.

## Verifying it worked

Once deployed, the app calls it via `supabase.functions.invoke('delete-account')`,
which automatically attaches the current user's session token — no manual
wiring needed on top of what's already in `src/screens/Home.jsx`.

To sanity check independently of the app: sign in, grab the session's
access token, then:

```bash
curl -i -X POST 'https://<your-project-ref>.supabase.co/functions/v1/delete-account' \
  -H "Authorization: Bearer <the access token>" \
  -H "apikey: <your anon key>"
```

A `{"success":true}` response means the account, its pet(s), and all
associated entries were deleted and the user has been signed out
server-side (their session is no longer valid).
