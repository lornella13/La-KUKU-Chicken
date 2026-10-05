import { BrowserRouter, Route, Routes } from 'react-router-dom'
import PublicSite from './components/PublicSite.jsx'
import AdminRoutes from './admin/AdminRoutes.jsx'

/**
 * Application root.
 *
 * The public website is served at "/" exactly as before. The admin area lives
 * under /admin and carries its own guard, styles and session handling. Nothing
 * about the public page's markup or design changes because of the router.
 *
 * Unknown paths fall back to the public site rather than a dead end, so a stale
 * bookmark or a mistyped URL still lands somewhere useful.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicSite />} />
        <Route path="/admin/*" element={<AdminRoutes />} />
        <Route path="*" element={<PublicSite />} />
      </Routes>
    </BrowserRouter>
  )
}