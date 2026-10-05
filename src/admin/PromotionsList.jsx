import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchPromotions, fetchAllProductsForAdmin } from '../lib/productsRepo.js'
import { supabase } from '../lib/supabase.js'
import { validatePromotion } from '../lib/validation.js'
import { isPromotionLive, promotionLabel } from '../lib/pricing.js'
import PromotionForm from './PromotionForm.jsx'

/** All promotions, with live/expired/draft state and what they are applied to. */
export default function PromotionsList() {
  const [promotions, setPromotions] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [flash, setFlash] = useState(null)
  const [editing, setEditing] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [promoResult, productResult] = await Promise.all([
      fetchPromotions(),
      fetchAllProductsForAdmin(),
    ])
    setPromotions(promoResult.rows)
    setProducts(productResult.rows)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const nameById = useMemo(() => new Map(products.map((p) => [p.id, p.name])), [products])

  async function toggleActive(promo) {
    setBusyId(promo.id)
    setFlash(null)

    const nextActive = !promo.is_active

    // Deactivating must also detach the promotion from any product, otherwise
    // the pointer lingers and the admin list shows a stale "None".
    const { error: err } = await supabase
      .from('promotions')
      .update({ is_active: nextActive })
      .eq('id', promo.id)

    if (!err && !nextActive) {
      const { error: detachErr } = await supabase
        .from('products')
        .update({ active_promotion_id: null })
        .eq('active_promotion_id', promo.id)
      if (detachErr) {
        console.error('Detach failed:', detachErr.code ?? detachErr.message)
      }
    }

    setBusyId(null)

    if (err) {
      console.error('Promotion update failed:', err.code ?? err.message)
      setError('Unable to update the promotion. Please try again.')
      return
    }
    setError(null)
    setFlash(nextActive ? 'Promotion activated.' : 'Promotion deactivated and removed from products.')
    load()
  }

  async function removePromotion(promo) {
    if (
      !window.confirm(
        `Delete “${promo.name}”? It will be removed from every product it is applied to.`,
      )
    ) {
      return
    }

    setBusyId(promo.id)
    // Clear the pointer first: the FK is ON DELETE SET NULL, but detaching
    // explicitly keeps the audit trail meaningful.
    await supabase.from('products').update({ active_promotion_id: null }).eq('active_promotion_id', promo.id)
    const { error: err } = await supabase.from('promotions').delete().eq('id', promo.id)
    setBusyId(null)

    if (err) {
      console.error('Promotion delete failed:', err.code ?? err.message)
      setError('Unable to delete the promotion. Please try again.')
      return
    }
    setFlash('Promotion deleted.')
    load()
  }

  if (loading) {
    return (
      <section className="admin-section">
        <h1>Promotions</h1>
        <p role="status">Loading promotions…</p>
      </section>
    )
  }

  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <h1>Promotions</h1>
        <button type="button" className="admin-btn primary" onClick={() => setEditing({ mode: 'new' })}>
          + Create Promotion
        </button>
      </div>

      {error && <p className="admin-alert" role="alert">{error}</p>}
      {flash && <p className="admin-notice" role="status">{flash}</p>}

      {editing && (
        <PromotionForm
          promotion={editing.promotion ?? null}
          products={products}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            setFlash('Promotion saved. Active promotions show on the public site immediately.')
            load()
          }}
        />
      )}

      {promotions.length === 0 ? (
        <p className="admin-empty">
          No promotions yet. Create one to put a discount on selected products.
        </p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <caption className="sr-only">All promotions</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Discount</th>
                <th scope="col">Dates</th>
                <th scope="col">Applied to</th>
                <th scope="col">State</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {promotions.map((promo) => {
                const ids = (promo.promotion_products ?? []).map((r) => r.product_id)
                const live = isPromotionLive(promo)
                const state = !promo.is_active ? 'Draft' : live ? 'Live' : 'Not in date range'
                return (
                  <tr key={promo.id}>
                    <th scope="row">{promo.name}</th>
                    <td>{promotionLabel(promo) ?? '—'}</td>
                    <td className="admin-dates">
                      {promo.start_date} → {promo.end_date}
                    </td>
                    <td className="admin-applied">
                      {ids.length === 0
                        ? '—'
                        : ids.map((id) => nameById.get(id) ?? 'Unknown product').join(', ')}
                    </td>
                    <td>
                      <span className={live ? 'badge promo' : promo.is_active ? 'badge warn' : 'badge none'}>
                        {state}
                      </span>
                    </td>
                    <td className="admin-actions">
                      <button
                        type="button"
                        className="admin-btn small"
                        onClick={() => setEditing({ promotion: promo })}
                        disabled={busyId === promo.id}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="admin-btn small ghost"
                        onClick={() => toggleActive(promo)}
                        disabled={busyId === promo.id}
                      >
                        {promo.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        className="admin-btn small danger"
                        onClick={() => removePromotion(promo)}
                        disabled={busyId === promo.id}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="admin-foot-note">
        A product shows a discount only while its promotion is active and today
        falls between the start and end dates. That check runs in the database,
        so an expired promotion stops applying on its own.
      </p>
    </section>
  )
}