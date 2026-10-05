import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { validateProduct, CATEGORIES } from '../lib/validation.js'
import { formatPrice } from '../lib/pricing.js'
import { uploadProductImage, validateImageFile } from '../lib/imageUpload.js'

const BLANK = {
  name: '',
  description: '',
  price: '',
  unit: 'per kg',
  category: 'Chicken',
  image_url: '',
  is_available: true,
}

/**
 * Create / edit a product.
 *
 * Validation runs in the browser for immediate feedback AND is repeated by the
 * database's CHECK constraints on save. The client checks are a convenience,
 * never the security boundary.
 */
export default function ProductForm({ product, onClose, onSaved }) {
  const isEdit = Boolean(product?.id)

  const [form, setForm] = useState(BLANK)
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)

  useEffect(() => {
    if (!product) {
      setForm(BLANK)
      return
    }
    setForm({
      name: product.name ?? '',
      description: product.description ?? '',
      price: product.price === null || product.price === undefined ? '' : String(product.price),
      unit: product.unit ?? 'per kg',
      category: product.category ?? 'Chicken',
      image_url: product.image_url ?? '',
      is_available: product.is_available ?? true,
    })
  }, [product])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    // Clear the message for a field as soon as the admin edits it.
    setErrors((e) => {
      if (!e[field]) return e
      const next = { ...e }
      delete next[field]
      return next
    })
  }

  async function handleFile(event) {
    const file = event.target.files?.[0]
    event.target.value = '' // allow re-picking the same file
    if (!file) return

    setUploadError(null)

    // Pre-flight checks (size, extension, declared MIME).
    const check = validateImageFile(file)
    if (!check.ok) {
      setUploadError(check.error)
      return
    }

    // New products have no id yet, so namespace under a placeholder; the object
    // name is still generated server-side from a UUID.
    setUploading(true)
    const result = await uploadProductImage(file, product?.id ?? 'new')
    setUploading(false)

    if (!result.ok) {
      setUploadError(result.error)
      return
    }

    // Uploading never deletes the file it replaces. Removing an old upload is a
    // deliberate admin action in Supabase Storage, so a mistaken replacement
    // can always be undone.
    update('image_url', result.url)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setStatus(null)

    const result = validateProduct(form)
    if (!result.ok) {
      setErrors(result.errors)
      setStatus('Please fix the highlighted fields.')
      return
    }

    setErrors({})
    setSaving(true)

    try {
      if (isEdit) {
        const { error: err } = await supabase
          .from('products')
          .update(result.value)
          .eq('id', product.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('products').insert(result.value)
        if (err) throw err
      }

      setStatus('Saved.')
      onSaved?.()
    } catch (err) {
      // Log the technical detail for the developer; show the customer-safe
      // message. Database CHECK failures arrive as err.message; a helpful,
      // non-sensitive summary is surfaced for the common cases.
      console.error('Product save failed:', err?.code ?? err?.message ?? err)

      if (err?.code === '23514') {
        setStatus('The database rejected this product. Check the name, price and dates are valid.')
      } else if (err?.code === '23503') {
        setStatus('That promotion link is not valid. Re-apply the promotion to this product first.')
      } else if (err?.code === '42501') {
        setStatus('You do not have permission to change products.')
      } else {
        setStatus('Unable to save the product. Please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  const previewSrc = useMemo(() => form.image_url || null, [form.image_url])

  return (
    <div className="admin-modal" role="dialog" aria-modal="true" aria-label={isEdit ? 'Edit product' : 'Add product'}>
      <div className="admin-modal-card">
        <h2>{isEdit ? `Edit ${product.name}` : 'Add Product'}</h2>

        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="pf-name">Product name</label>
          <input
            id="pf-name"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            maxLength={120}
            required
          />
          {errors.name && <p className="admin-field-error">{errors.name}</p>}

          <label htmlFor="pf-description">Description</label>
          <textarea
            id="pf-description"
            rows={4}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            maxLength={2000}
          />
          {errors.description && <p className="admin-field-error">{errors.description}</p>}

          <div className="admin-row">
            <div>
              <label htmlFor="pf-price">Price (UGX)</label>
              <input
                id="pf-price"
                inputMode="numeric"
                value={form.price}
                onChange={(e) => update('price', e.target.value)}
                placeholder="16000"
                required
              />
              {errors.price && <p className="admin-field-error">{errors.price}</p>}
              {Number.isFinite(Number(form.price)) && form.price !== '' && (
                <p className="admin-field-hint">Customers will see {formatPrice(form.price)}</p>
              )}
            </div>

            <div>
              <label htmlFor="pf-unit">Unit</label>
              <input
                id="pf-unit"
                value={form.unit}
                onChange={(e) => update('unit', e.target.value)}
                placeholder="per kg"
                maxLength={30}
                required
              />
              {errors.unit && <p className="admin-field-error">{errors.unit}</p>}
            </div>

            <div>
              <label htmlFor="pf-category">Category</label>
              <select
                id="pf-category"
                value={form.category}
                onChange={(e) => update('category', e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {errors.category && <p className="admin-field-error">{errors.category}</p>}
            </div>
          </div>

          <label htmlFor="pf-image">Product image</label>
          <div className="admin-image-row">
            {previewSrc && (
              <img
                className="admin-image-preview"
                src={previewSrc}
                alt=""
                // Admin-entered URLs are validated to https or /path by
                // validateImageUrl, and React escapes the attribute value.
                onError={(e) => {
                  e.currentTarget.style.visibility = 'hidden'
                }}
              />
            )}
            <div className="admin-image-controls">
              <input
                id="pf-image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFile}
                disabled={uploading}
              />
              <p className="admin-field-hint">
                JPG, PNG or WebP, up to 5 MB. The stored filename is generated
                automatically.
              </p>
              {uploading && <p className="admin-field-hint">Uploading…</p>}
              {uploadError && <p className="admin-field-error">{uploadError}</p>}
            </div>
          </div>

          <label htmlFor="pf-image-url">…or paste an image URL</label>
          <input
            id="pf-image-url"
            value={form.image_url}
            onChange={(e) => update('image_url', e.target.value)}
            placeholder="https://… or /images/products/…"
          />
          {errors.image_url && <p className="admin-field-error">{errors.image_url}</p>}

          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={form.is_available}
              onChange={(e) => update('is_available', e.target.checked)}
            />
            Available — show this product on the public website
          </label>

          {status && (
            <p className={status === 'Saved.' ? 'admin-notice' : 'admin-alert'} role="status">
              {status}
            </p>
          )}

          <div className="admin-modal-actions">
            <button type="button" className="admin-btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="admin-btn primary" disabled={saving || uploading}>
              {saving ? 'Saving…' : 'Save product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}