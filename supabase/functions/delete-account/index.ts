// Deletes the calling user's entire account — their pet(s), all QoL/pain
// entries for those pets, and finally the auth.users record itself.
//
// Runs server-side only, using the service-role key (injected automatically
// by the Supabase Edge Functions runtime as SUPABASE_SERVICE_ROLE_KEY — this
// is never sent to or readable by the client). Required for Apple App Store
// Guideline 5.1.1(v): genuine in-app account deletion, not just a "contact
// us" request.
//
// Deploy: see README.md in this directory for one-time setup.

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonResponse({ error: 'Missing Authorization header' }, 401)
  }

  // Verify the caller's own session to get their real, authenticated user
  // id — this must never be trusted from a client-supplied parameter for a
  // destructive, irreversible operation like account deletion. Using the
  // anon key + the caller's own bearer token here (rather than the
  // service-role client) means this can only ever resolve to whoever the
  // token actually belongs to.
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userError } = await callerClient.auth.getUser()
  if (userError || !userData?.user) {
    return jsonResponse({ error: 'Invalid or expired session' }, 401)
  }
  const userId = userData.user.id

  // Service-role client — bypasses Row Level Security. Only ever used
  // below, scoped to the verified user id above.
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    const { data: pets, error: petsFetchError } = await adminClient
      .from('pets')
      .select('id')
      .eq('user_id', userId)
    if (petsFetchError) throw petsFetchError

    const petIds = (pets ?? []).map((pet) => pet.id)

    if (petIds.length > 0) {
      // Explicit cleanup of dependent tables first — belt-and-braces for a
      // compliance-critical deletion, rather than relying solely on a
      // foreign-key cascade that may or may not be configured on these
      // tables.
      const { error: generalError } = await adminClient
        .from('general_qol_entries')
        .delete()
        .in('pet_id', petIds)
      if (generalError) throw generalError

      const { error: painError } = await adminClient
        .from('pain_log_entries')
        .delete()
        .in('pet_id', petIds)
      if (painError) throw painError

      const { error: petsDeleteError } = await adminClient
        .from('pets')
        .delete()
        .eq('user_id', userId)
      if (petsDeleteError) throw petsDeleteError
    }

    // Deleting the auth.users record last, once all of this user's app data
    // is confirmed gone.
    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId)
    if (deleteUserError) throw deleteUserError

    return jsonResponse({ success: true })
  } catch (err) {
    console.error('delete-account error:', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return jsonResponse({ error: message }, 500)
  }
})
