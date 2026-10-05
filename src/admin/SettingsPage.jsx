import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from './AuthProvider.jsx'
import { isBackendAvailable } from '../lib/supabase.js'

/**
 * Admin settings: account, role, and the audit trail.
 *
 * The audit log is written by database triggers, so it records changes made
 * through the API by anyone, not just changes made through this UI. Read access
 * is admin-only, enforced by RLS.
 */
export default function SettingsPage() {
  const { user, role, isAdmin, signOut } = useAuth()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isBackendAvailable() || !isAdmin) {
      setLoading(false)
      return
    }

    let cancelled = false

    supabase
      .from('audit_logs')
      .select('id, actor_user_id, action, entity_type, entity_id, details, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error: err }) => {
        if (cancelled) return
        setLogs(data ?? [])
        if (err) setError('The audit log could not be loaded.')
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isAdmin])

  return (
    <section className="admin-section">
      <h1>Settings</h1>

      <div className="admin-card">
        <h2>Your account</h2>
        <dl className="admin-defs">
          <dt>Email</dt>
          <dd>{user?.email}</dd>
          <dt>Role</dt>
          <dd>
            <span className="badge ok">{role}</span>
          </dd>
          <dt>User ID</dt>
          <dd>
            <code className="admin-code">{user?.id}</code>
          </dd>
        </dl>
        <p className="admin-field-hint">
          Roles come from the <code>admin_profiles</code> table and are enforced
          by database policies. This page cannot change them.
        </p>
      </div>

      <div className="admin-card">
        <h2>Security</h2>
        <ul className="admin-list">
          <li>Passwords are handled by Supabase Auth. None are stored in this application.</li>
          <li>Sign out ends the session on the server and clears local admin state.</li>
          <li>Database writes are authorised by Row Level Security, not by this interface.</li>
        </ul>
        <button type="button" className="admin-btn ghost" onClick={signOut}>
          Sign out
        </button>
      </div>

      {isAdmin && (
        <div className="admin-card">
          <h2>Recent activity</h2>
          {loading && <p role="status">Loading activity…</p>}
          {error && <p className="admin-alert" role="alert">{error}</p>}
          {!loading && !error && logs.length === 0 && (
            <p className="admin-empty">Nothing logged yet.</p>
          )}
          {logs.length > 0 && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <caption className="sr-only">Recent administrative actions</caption>
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Action</th>
                    <th scope="col">Record</th>
                    <th scope="col">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td className="admin-dates">
                        {new Date(log.created_at).toLocaleString('en-GB')}
                      </td>
                      <td>{log.action}</td>
                      <td>{log.entity_type}</td>
                      <td className="admin-code-cell">{summarise(log.details)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/** Render the small details bag without using dangerouslySetInnerHTML. */
function summarise(details) {
  if (!details || typeof details !== 'object') return ''
  return Object.entries(details)
    .map(([key, value]) => `${key}: ${value}`)
    .join(' · ')
}