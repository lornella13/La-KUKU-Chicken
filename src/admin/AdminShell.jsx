import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider.jsx'

/**
 * Admin layout: brand bar, section navigation, sign out.
 * Rendered only for an authenticated staff user (see RequireAdmin).
 */
export default function AdminShell() {
  const { user, role, signOut } = useAuth()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
    setSigningOut(false)
    // Clear admin state by leaving the area entirely. replace so Back does not
    // return to a guarded screen.
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="admin">
      <header className="admin-bar">
        <Link to="/admin" className="admin-brand">
          <img src="/images/brand/logo-mark.png" alt="" width="32" height="32" />
          <span>
            La Kuku <small>Admin</small>
          </span>
        </Link>

        <nav className="admin-nav" aria-label="Admin sections">
          <NavLink to="/admin" end>
            Products
          </NavLink>
          <NavLink to="/admin/promotions">Promotions</NavLink>
          <NavLink to="/admin/settings">Settings</NavLink>
        </nav>

        <div className="admin-user">
          <span className="admin-role" title="Your role in the database">
            {role}
          </span>
          <span className="admin-email" title={user?.email ?? ''}>
            {user?.email}
          </span>
          <button
            type="button"
            className="admin-btn ghost"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </header>

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  )
}
