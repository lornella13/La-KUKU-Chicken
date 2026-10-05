import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider.jsx'

/**
 * Admin sign-in.
 *
 * Reached only at /admin/login. Uses Supabase Auth's password sign-in; there is
 * no custom auth endpoint, no hard-coded credential, and no password is ever
 * stored by this application.
 *
 * Error messages are intentionally generic so the form cannot be used to find
 * out which email addresses have accounts.
 */
export default function LoginPage() {
  const { user, isStaff, signIn, requestPasswordReset, backendAvailable, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)
  const [resetting, setResetting] = useState(false)

  // Already signed in with staff rights? Skip the form.
  useEffect(() => {
    if (!loading && user && isStaff) {
      const from = location.state?.from
      navigate(from && from.startsWith('/admin') ? from : '/admin', { replace: true })
    }
  }, [loading, user, isStaff, navigate, location.state])

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)

    const result = await signIn(email, password)
    setBusy(false)

    if (!result.ok) {
      setError(result.error)
      // Do not retain the password in component state after a failure.
      setPassword('')
      return
    }

    const from = location.state?.from
    navigate(from && from.startsWith('/admin') ? from : '/admin', { replace: true })
  }

  async function handleReset(event) {
    event.preventDefault()
    setError(null)
    setNotice(null)

    if (!email.trim()) {
      setError('Enter your email address first, then choose "Send reset link".')
      return
    }

    setResetting(true)
    const result = await requestPasswordReset(email)
    setResetting(false)

    // Always the same confirmation, whether or not the address exists.
    setNotice('If that address has an account, a reset link is on its way.')
  }

  if (loading) {
    return (
      <div className="admin-message" role="status" aria-live="polite">
        <p>Loading…</p>
      </div>
    )
  }

  if (user && !isStaff) {
    return (
      <div className="admin-message">
        <h1>No administrator access</h1>
        <p>
          You are signed in, but this account is not an administrator. Ask the
          shop owner to add your user id to the <code>admin_profiles</code> table.
        </p>
        <a className="admin-btn" href="/">
          Back to the website
        </a>
      </div>
    )
  }

  return (
    <div className="admin-login">
      <form className="admin-login-card" onSubmit={handleSubmit} noValidate>
        <img
          className="admin-login-logo"
          src="/images/brand/logo-mark.png"
          alt=""
          width="56"
          height="56"
        />
        <h1>La Kuku Admin</h1>
        <p className="admin-login-sub">Sign in to manage products and prices.</p>

        {!backendAvailable && (
          <p className="admin-alert" role="alert">
            The database is not configured, so signing in is unavailable. Add the
            Supabase keys to <code>.env.local</code> and restart the server.
          </p>
        )}

        {error && (
          <p className="admin-alert" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="admin-notice" role="status">
            {notice}
          </p>
        )}

        <label htmlFor="admin-email">Email</label>
        <input
          id="admin-email"
          name="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={busy || !backendAvailable}
        />

        <label htmlFor="admin-password">Password</label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={busy || !backendAvailable}
        />

        <button
          type="submit"
          className="admin-btn primary"
          disabled={busy || !backendAvailable}
        >
          {busy ? 'Signing in…' : 'Login'}
        </button>

        <button
          type="button"
          className="admin-btn link"
          onClick={handleReset}
          disabled={resetting || !backendAvailable}
        >
          {resetting ? 'Sending…' : 'Send reset link'}
        </button>

        <p className="admin-login-foot">
          <a href="/">← Back to the website</a>
        </p>
      </form>
    </div>
  )
}
