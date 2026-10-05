import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider.jsx'
import AdminShell from './AdminShell.jsx'

/**
 * Route guard for every admin screen.
 *
 * Used as a layout route (no `element` on a leaf), so AdminShell renders the
 * matched page through its <Outlet/>.
 *
 * Three outcomes:
 *   - still checking the session  -> render a neutral loading state
 *   - no session                  -> redirect to /admin/login
 *   - session but not staff       -> redirect to /admin/login (never render
 *                                    the dashboard, not even a preview)
 *
 * This is UX, not security. A user who edits JavaScript to skip this guard can
 * render whatever they like, but every database write is still refused by the
 * RLS policies, which key off the JWT rather than anything in the browser.
 */
export default function RequireAdmin() {
  const { user, isStaff, loading, backendAvailable } = useAuth()
  const location = useLocation()

  if (!backendAvailable) {
    return (
      <div className="admin-message">
        <h1>Admin unavailable</h1>
        <p>
          The admin area needs the database connection. Add the Supabase settings
          to your <code>.env.local</code> file and restart the dev server.
        </p>
        <p className="admin-message-hint">
          The public website is unaffected and still shows the catalogue.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="admin-message" role="status" aria-live="polite">
        <p>Checking your access…</p>
      </div>
    )
  }

  if (!user || !isStaff) {
    // `replace` so the browser Back button does not bounce between the guarded
    // URL and the login page.
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }

  return <AdminShell />
}
