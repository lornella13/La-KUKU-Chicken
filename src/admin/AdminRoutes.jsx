import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from './AuthProvider.jsx'
import RequireAdmin from './RequireAdmin.jsx'
import LoginPage from './LoginPage.jsx'
import ProductsList from './ProductsList.jsx'
import PromotionsList from './PromotionsList.jsx'
import SettingsPage from './SettingsPage.jsx'
import './admin.css'

/**
 * Admin route table.
 *
 * `/admin/login` is public. Everything else sits behind RequireAdmin, which
 * redirects to the login page unless there is an authenticated STAFF session.
 *
 * Products are edited through a modal on the list screen rather than through
 * separate /admin/products/new and /admin/products/edit/:id routes. Those URLs
 * are still registered and redirect to the list, so any bookmark or link keeps
 * working after this change.
 */
export default function AdminRoutes() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<LoginPage />} />

        <Route element={<RequireAdmin />}>
          <Route index element={<ProductsList />} />
          <Route path="products" element={<ProductsList />} />
          <Route path="products/new" element={<ProductsList />} />
          <Route path="products/edit/:id" element={<ProductsList />} />
          <Route path="promotions" element={<PromotionsList />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<LoginPage />} />
      </Routes>
    </AuthProvider>
  )
}