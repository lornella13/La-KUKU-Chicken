import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'

/**
 * Admin authentication and role resolution.
 *
 * Two separate questions are answered here, and they are NOT the same:
 *
 *   1. Is there an authenticated Supabase session?  -> `user`
 *   2. Does that user hold a staff role in admin_profiles? -> `role`
 *
 * A signed-in user with no admin_profiles row is a normal customer account and
 * gets NO admin access. This mirrors the database, which independently refuses
 * every write through RLS; the UI check exists only so we do not render screens
 * the user cannot use.
 *
 * Tokens are never read, stored or handled by this code. Supabase's client owns
 * the session in localStorage and refreshes it itself.
 */

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return undefined
    }

    let cancelled = false

    // Resolve the role for a given user id.
    // An authenticated user with no admin_profiles row returns null, which is
    // treated as "not staff".
    const loadRole = async (userId) => {
      if (!userId) {
        if (!cancelled) setRole(null)
        return
      }
      try {
        const { data, error } = await supabase
          .from('admin_profiles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle()

        if (cancelled) return
        if (error) {
          // A read failure must not be treated as "authorised".
          console.error('Role lookup failed:', error.code ?? error.message)
          setRole(null)
          return
        }
        setRole(data?.role ?? null)
      } catch {
        if (!cancelled) setRole(null)
      }
    }

    // Supabase restores an existing session on load.
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      const current = data.session?.user ?? null
      setUser(current)
      loadRole(current?.id).finally(() => {
        if (!cancelled) setLoading(false)
      })
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const current = session?.user ?? null
      setUser(current)

      if (event === 'SIGNED_OUT') {
        setRole(null)
        setLoading(false)
        return
      }

      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        // Do not await inside this callback: Supabase warns about awaiting
        // calls that themselves use the auth lock. Fire and forget.
        loadRole(current?.id).finally(() => {
          if (!cancelled) setLoading(false)
        })
      }
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      role,
      isStaff: role === 'admin' || role === 'manager',
      isAdmin: role === 'admin',
      loading,
      backendAvailable: supabase !== null,

      /**
       * Sign in with email and password.
       *
       * The returned message is deliberately identical whether the account
       * does not exist or the password is wrong, so this endpoint cannot be
       * used to discover which email addresses have accounts.
       */
      async signIn(email, password) {
        if (!supabase) return { ok: false, error: 'Sign-in is unavailable: the database is not configured.' }

        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: String(email ?? '').trim(),
            password: String(password ?? ''),
          })

          if (error) {
            console.warn('Sign-in rejected:', error.status ?? 'error')
            return { ok: false, error: 'Email or password is incorrect.' }
          }

          if (!data?.user) {
            return { ok: false, error: 'Email or password is incorrect.' }
          }

          // Confirm staff status before letting the caller in.
          const { data: profile, error: roleError } = await supabase
            .from('admin_profiles')
            .select('role')
            .eq('user_id', data.user.id)
            .maybeSingle()

          if (roleError) {
            console.error('Role check failed:', roleError.code ?? roleError.message)
            await supabase.auth.signOut()
            return { ok: false, error: 'Could not verify your access. Please try again.' }
          }

          if (!profile) {
            // Authenticated but not staff: end the session immediately so a
            // normal customer account never lingers with an active session.
            await supabase.auth.signOut()
            return {
              ok: false,
              error: 'This account does not have administrator access.',
            }
          }

          return { ok: true, role: profile.role }
        } catch {
          return { ok: false, error: 'Something went wrong signing in. Please try again.' }
        }
      },

      /** Send a password-reset email. Uses Supabase Auth, no custom token flow. */
      async requestPasswordReset(email) {
        if (!supabase) return { ok: false, error: 'Password reset is unavailable.' }
        try {
          const { error } = await supabase.auth.resetPasswordForEmail(
            String(email ?? '').trim(),
            { redirectTo: `${window.location.origin}/admin/login` },
          )
          if (error) {
            console.warn('Password reset request failed:', error.status ?? 'error')
            return { ok: false, error: 'Could not send the reset email.' }
          }
          return { ok: true }
        } catch {
          return { ok: false, error: 'Could not send the reset email.' }
        }
      },

      /**
       * Sign out. Calls Supabase to terminate the session, which invalidates
       * the refresh token, then clears all role state held in memory.
       */
      async signOut() {
        if (supabase) {
          try {
            await supabase.auth.signOut()
          } catch (err) {
            console.error('Sign-out failed:', err?.message ?? err)
          }
        }
        setUser(null)
        setRole(null)
      },
    }),
    [user, role, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
