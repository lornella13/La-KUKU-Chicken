import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { validatePromotion } from '../lib/validation.js'
import { effectivePrice, formatPrice, promotionLabel } from '../lib/pricing.js'

const BLANK = {
  name: '',
  discount_type: 'percentage',
  discount_value: '',
  start_date: '',
  end_date: '',
  is_active: true,
}

/**
 * Create / edit a promotion and choose which products it applies to.
 *
 * Save order matters and is enforced by database triggers:
 *   1. upsert the promotion row
 *   2. sync promotion_products (this is what defines the promotion's coverage)
 *   3. only then point products.active_promotion_id at it
 *
 * A product may reference at most one promotion, so activating a promotion
 * detaches it from any product that previously had a different one. That is the
 * deterministic rule: overlap can never produce an ambiguous price.
 */
export default function PromotionForm({ promotion, products, onClose, onSaved }) {
  const isEdit = Boolean(promotion?.id)

  const [form, setForm] = useState(BLANK)
  const [selected, setSelected] = useState(() => new Set())
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!promotion) {
      setForm(BLANK)
      setSelected(new Set())
      return
    }
    setForm({
      name: promotion.name ?? '',
      discount_type: promotion.discount_type ?? 'percentage',
      discount_value:
        promotion.discount_value === null || promotion.discount_value === undefined
          ? ''
          : String(promotion.discount_value),
      start_date: promotion.start_date ?? '',
      end_date: promotion.end_date ?? '',
      is_active: promotion.is_active ?? false,
    })
    setSelected(new Set((promotion.promotion_products ?? []).map((r) => r.product_id)))
  }, [promotion])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => {
      if (!e[field]) return e
      const next = { ...e }
      delete next[field]
      return next
    })
  }

  function toggleProduct(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setStatus(null)

    const result = validatePromotion(form)
    if (!result.ok) {
      setErrors(result.errors)
      setStatus('Please fix the highlighted fields.')
      return
    }
    setErrors({})
    setSaving(true)

    try {
      let promoId = promotion?.id

      // 1. Upsert the promotion itself.
      if (isEdit) {
        const { error: err } = await supabase
          .from('promotions')
          .update(result.value)
          .eq('id', promoId)
        if (err) throw err
      } else {
        const { data, error: err } = await supabase
          .from('promotions')
          .insert(result.value)
          .select('id')
          .single()
        if (err) throw err
        promoId = data.id
      }

      // 2. Sync coverage. Delete removed links, insert added ones.
      const existing = new Set((promotion?.promotion_products ?? []).map((r) => r.product_id))
      const toAdd = [...selected].filter((id) => !existing.has(id))
      const toRemove = [...existing].filter((id) => !selected.has(id))

      if (toRemove.length > 0) {
        const { error: err } = await supabase
          .from('promotion_products')
          .delete()
          .eq('promotion_id', promoId)
          .in('product_id', toRemove)
        if (err) throw err
      }

      if (toAdd.length > 0) {
        const { error: err } = await supabase
          .from('promotion_products')
          .insert(toAdd.map((product_id) => ({ promotion_id: promoId, product_id })))
        if (err) throw err
      }

      // 3. Apply or detach the promotion pointer.
      if (form.is_active) {
        // Detach anything else first so no product is claimed twice.
        const { error: detachErr } = await supabase
          .from('products')
          .update({ active_promotion_id: null })
          .not('active_promotion_id', 'is', null)
        if (detachErr) throw detachErr

        if (toAdd.length > 0 || (selected.size > 0 && isEdit)) {
          const { error: applyErr } = await supabase
            .from('products')
            .update({ active_promotion_id: promoId })
            .in('id', toAdd.length > 0 ? toAdd : [...selected])
          if (applyErr) throw applyErr
        }
      } else {
        const { error: err } = await supabase
          .from('products')
          .update({ active_promotion_id: null })
          .eq('active_promotion_id', promoId)
        if (err) throw err
      }

      setStatus('Saved.')
      onSaved?.()
    } catch (err) {
      console.error('Promotion save failed:', err?.code ?? err?.message ?? err)

      if (err?.code === '23514') {
        setStatus(
          'The database rejected these values. Check the discount is above 0, no more than 100% for a percentage, and that the dates are in order.',
        )
      } else if (err?.code === '23503') {
        setStatus('That product link is not valid.')
      } else if (err?.code === '23505') {
        setStatus('One of those products is already in this promotion.')
      } else if (err?.code === '42501') {
        setStatus('You do not have permission to manage promotions.')
      } else {
        setStatus('Unable to save the promotion. Please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  // Preview of the resulting price, mirroring the SQL in public_products.
  const preview = effectivePrice(10000, {
    discount_type: form.discount_type,
    discount_value: Number(form.discount_value) || 0,
  })

  return (
    <div className="admin-modal" role="dialog" aria-modal="true" aria-label="Promotion">
      <div className="admin-modal-card wide">
        <h2>{isEdit ? `Edit ${promotion.name}` : 'Create Promotion'}</h2>

        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="pr-name">Name</label>
          <input
            id="pr-name"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Weekend Chicken Deal"
            maxLength={120}
            required
          />
          {errors.name && <p className="admin-field-error">{errors.name}</p>}

          <div className="admin-row">
            <div>
              <label htmlFor="pr-type">Discount type</label>
              <select
                id="pr-type"
                value={form.discount_type}
                onChange={(e) => update('discount_type', e.target.value)}
              >
                <option value="percentage">Percentage</option>
                <option value="fixed_amount">Fixed amount (UGX)</option>
              </select>
              {errors.discount_type && <p className="admin-field-error">{errors.discount_type}</p>}
            </div>

            <div>
              <label htmlFor="pr-value">
                Discount {form.discount_type === 'percentage' ? '(%)' : '(UGX)'}
              </label>
              <input
                id="pr-value"
                inputMode="decimal"
                value={form.discount_value}
                onChange={(e) => update('discount_value', e.target.value)}
                placeholder={form.discount_type === 'percentage' ? '10' : '2000'}
                required
              />
              {errors.discount_value && <p className="admin-field-error">{errors.discount_value}</p>}
              {form.discount_type === 'percentage' && (
                <p className="admin-field-hint">Between 1 and 100.</p>
              )}
            </div>
          </div>

          <div className="admin-row">
            <div>
              <label htmlFor="pr-start">Start</label>
              <input
                id="pr-start"
                type="date"
                value={form.start_date}
                onChange={(e) => update('start_date', e.target.value)}
                required
              />
              {errors.start_date && <p className="admin-field-error">{errors.start_date}</p>}
            </div>

            <div>
              <label htmlFor="pr-end">End</label>
              <input
                id="pr-end"
                type="date"
                value={form.end_date}
                onChange={(e) => update('end_date', e.target.value)}
                required
              />
              {errors.end_date && <p className="admin-field-error">{errors.end_date}</p>}
            </div>
          </div>

          <fieldset className="admin-fieldset">
            <legend>Products</legend>
            {products.length === 0 && (
              <p className="admin-field-hint">No products found to apply this to.</p>
            )}
            <div className="admin-check-grid">
              {products.map((p) => (
                <label key={p.id} className="admin-checkbox">
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggleProduct(p.id)}
                  />
                  <span>
                    {p.name} <small>{formatPrice(p.price)}</small>
                  </span>
                </label>
              ))}
            </div>
            {selected.size === 0 && (
              <p className="admin-field-hint">Select at least one product to apply this promotion.</p>
            )}
          </fieldset>

          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => update('is_active', e.target.checked)}
            />
            Active — show this discount on the public website
          </label>

          {Number(form.discount_value) > 0 && (
            <p className="admin-field-hint">
              Example: a {formatPrice(10000)} item becomes{' '}
              <strong>{formatPrice(preview)}</strong> ({promotionLabel({
                discount_type: form.discount_type,
                discount_value: Number(form.discount_value),
              })}).
            </p>
          )}

          {status && (
            <p className={status === 'Saved.' ? 'admin-notice' : 'admin-alert'} role="status">
              {status}
            </p>
          )}

          <div className="admin-modal-actions">
            <button type="button" className="admin-btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="admin-btn primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save promotion'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}