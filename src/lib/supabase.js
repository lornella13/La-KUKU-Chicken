import { createClient } from '@supabase/supabase-js'
import { supabaseConfig, configProblem } from './env.js'

/**
 * The single Supabase client for the whole app.
 *
 * This client holds the PUBLISHABLE (anon) key and inherits the `anon` Postgres
 * role. It is NOT an admin client and must never be given a service-role key —
 * that would bypass Row Level Security and hand full database access to anyone
 * who opens devtools.
 *
 * All write authorization is enforced by the policies in
 * supabase/migrations/0002_row_level_security.sql. The UI hides controls for
 * convenience only; the database is what actually refuses the write.
 *
 * When the project is not configured this is `null` rather than a broken
 * client, so the public website keeps serving its static catalogue instead of
 * throwing on every render.
 */
export const supabase = (() => {
  if (!supabaseConfig.isConfigured || configProblem) return null

  try {
    return createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
      auth: {
        // Supabase stores the session in localStorage and refreshes it itself.
        // We deliberately do not hand-roll token storage.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        // Keep sessions short-lived and re-checked against the database.
        flowType: 'implicit',
      },
      global: {
        headers: { 'X-Client-Info': 'la-kuku-web' },
      },
    })
  } catch (err) {
    // Never surface a raw Supabase error object to a visitor; log locally only.
    console.error('Supabase client initialisation failed:', err?.message ?? err)
    return null
  }
})()

/** True when the database layer can be used at all. */
export const isBackendAvailable = () => supabase !== null
