/**
 * Environment configuration.
 *
 * Only two values are ever read, and both are safe to expose to the browser:
 * the project URL and the Supabase *publishable* (anon) key. Supabase
 * publishable keys are designed to be public — the anon role is granted only
 * what Row Level Security allows, which is why the security model does not
 * depend on hiding this key.
 *
 * A Supabase SERVICE-ROLE / secret key must never appear in this file, in any
 * VITE_* variable, or anywhere else in src/ or public/. Vite inlines every
 * VITE_* value into the shipped JavaScript bundle, so anything placed here is
 * readable by anyone who opens the browser.
 */

const URL = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

const looksConfigured =
  typeof URL === 'string' &&
  URL.length > 0 &&
  typeof KEY === 'string' &&
  KEY.length > 0

/**
 * Guard against pasting the SERVICE-ROLE key here.
 *
 * That key bypasses Row Level Security entirely, so shipping it would hand full
 * database access to every visitor. Both the new `sb_secret_…` format and the
 * legacy `eyJ…` JWT format are detected. `sb_publishable_…` is correct and is
 * allowed through.
 */
function looksLikeServiceRoleKey(key) {
  if (key.startsWith('sb_secret_')) return true

  if (key.startsWith('eyJ')) {
    try {
      const payload = JSON.parse(atob(key.split('.')[1]))
      return payload.role === 'service_role'
    } catch {
      return false
    }
  }

  return false
}

export const supabaseConfig = {
  url: looksConfigured ? URL : null,
  publishableKey: looksConfigured ? KEY : null,
  isConfigured: looksConfigured,
}

/**
 * Why the backend is unavailable, or null when it is configured.
 * Shown to administrators, never rendered on the public site.
 */
export const configProblem = !looksConfigured
  ? 'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.local'
  : looksLikeServiceRoleKey(KEY)
    ? 'VITE_SUPABASE_PUBLISHABLE_KEY looks like a SERVICE-ROLE key. That key bypasses Row Level Security and must never be shipped to a browser. Use the publishable/anon key instead.'
    : null
