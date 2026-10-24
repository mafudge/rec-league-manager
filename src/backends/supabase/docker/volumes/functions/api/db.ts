// Database access through PostgREST with supabase-js. Organizer routes use userClient: it sends the
// organizer's own access token, so Postgres runs as role "authenticated" with auth.uid() = their id and
// row-level security (migrations/0001_init.sql) hides every league that isn't theirs.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const env = (name: string) => Deno.env.get(name) ?? ''
const noSession = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }

/** A client acting as the signed-in organizer; RLS does the ownership filtering. */
export const userClient = (token: string): SupabaseClient =>
  createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: noSession,
  })

/** The service role bypasses RLS. Only the public page (US07, GET /api/public/{slug}) may use it. */
export const serviceClient = (): SupabaseClient =>
  createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: noSession })
