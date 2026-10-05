import { useCallback, useEffect, useState } from 'react'
import { fetchAllProductsForAdmin } from '../lib/productsRepo.js'
import { formatPrice } from '../lib/pricing.js'
import { parsePriceInput } from '../lib/validation.js'
import { supabase } from '../lib/supabase.js'
import ProductForm from './ProductForm.jsx'

/**
 * Admin product list: the whole catalogue with price, availability and
 * promotion state, plus inline price increase/decrease.
 *
 * Every write goes through the Supabase client as a parameterised query. No SQL
 * is ever assembled by string interpolation, so product names containing
 * quotes cannot break out of anything.
 */
export default function ProductsList() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [flash, setFlash] = useState(null)
  const [editing, setEditing] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { rows: data, error: err } = await fetchAllProductsForAdmin()
    setRows(data)
    setError(err ? 'Could not load products. Please refresh to try again.' : null)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function patchProduct(id, changes) {
    setBusyId(id)
    setFlash(null)
    const { error: err } = await supabase.from('products').update(changes).eq('id', id)
    setBusyId(null)

    if (err) {
      console.error('Product update failed:', err.code ?? err.message)
      setError('Unable to save the product. Please try again.')
      return
    }
    setError(null)
    setFlash('Saved. The public website now shows this price.')
    load()
  }

  async function toggleAvailability(row) {
    await patchProduct(row.id, { is_available: !row.is_available })
  }

  /**
   * Adjust a price by a fixed step, re-validated through the same parser the
   * form uses, so a step can never write a negative or non-integer price.
   */
  async function adjustPrice(row, delta) {
    const next = Math.max(0, Number(row.price) + delta)
    const parsed = parsePriceInput(String(next))
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    await patchProduct(row.id, { price: parsed.value })
  }

  if (loading) {
    return (
      <section className="admin-section">
        <h1>Products</h1>
        <p role="status">Loading products…</p>
      </section>
    )
  }

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <h1>Products</h1>
        <button type="button" className="admin-btn primary" onClick={() => setEditing({ mode: 'new' })}>
          + Add Product
        </button>
      </div>

      {error && (
        <p className="admin-alert" role="alert">
          {error}
        </p>
      )}
      {flash && (
        <p className="admin-notice" role="status">
          {flash}
        </p>
      )}

      {editing && (
        <ProductForm
          product={editing.product ?? null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            setFlash('Product saved. The public website now shows it.')
            load()
          }}
        />
      )}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <caption className="sr-only">All products</caption>
          <thead>
            <tr>
              <th scope="col">Product</th>
              <th scope="col">Price</th>
              <th scope="col">Adjust</th>
              <th scope="col">Status</th>
              <th scope="col">Promotion</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={row.is_available ? undefined : 'is-disabled'}>
                <th scope="row">
                  <span className="admin-product-name">{row.name}</span>
                  <span className="admin-product-meta">
                    {row.unit} · {row.category}
                  </span>
                </th>
                <td className="admin-price">
                  {formatPrice(row.price)}
                  {row.promotion_live && (
                    <span className="admin-price-promo">{formatPrice(row.current_price)}</span>
                  )}
                </td>
                <td>
                  <div className="admin-stepper">
                    <button
                      type="button"
                      onClick={() => adjustPrice(row, -500)}
                      disabled={busyId === row.id || row.price <= 0}
                      aria-label={`Decrease ${row.name} by 500`}
                    >
                      −500
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustPrice(row, 500)}
                      disabled={busyId === row.id}
                      aria-label={`Increase ${row.name} by 500`}
                    >
                      +500
                    </button>
                  </div>
                </td>
                <td>
                  <span className={row.is_available ? 'badge ok' : 'badge off'}>
                    {row.is_available ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td>
                  {row.promotion_live ? (
                    <span className="badge promo">{row.promotion_label}</span>
                  ) : (
                    <span className="badge none">None</span>
                  )}
                </td>
                <td className="admin-actions">
                  <button
                    type="button"
                    className="admin-btn small"
                    onClick={() => setEditing({ product: row })}
                    disabled={busyId === row.id}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="admin-btn small ghost"
                    onClick={() => toggleAvailability(row)}
                    disabled={busyId === row.id}
                  >
                    {row.is_available ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="admin-empty">
                  No products yet. Use “+ Add Product” to create the first one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="admin-foot-note">
        Only available products appear on the public website. Disabling a product
        hides it and removes its order button without deleting any history.
      </p>
    </section>
  )
}