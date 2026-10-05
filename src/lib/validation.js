/**
 * Client-side validation.
 *
 * IMPORTANT: this exists purely to give the administrator immediate, clear
 * feedback. It is NOT a security control. Everything here is duplicated by
 * CHECK constraints in the database (supabase/migrations/0001_core_schema.sql),
 * so a request that bypasses this file is still rejected by Postgres. Never
 * rely on this alone.
 */

const MAX_NAME = 120
const MAX_DESCRIPTION = 2000
const MAX_CATEGORY = 60
const MAX_UNIT = 30
const MAX_PRICE = 1_000_000_000

export const CATEGORIES = ['Chicken', 'Sausages']

/**
 * Parse a user-entered price.
 *
 * Rejects the malformed values that would otherwise become NaN or Infinity in
 * the database: empty strings, "abc", "1e999", negative numbers, and values
 * with more precision than whole shillings.
 *
 * Thousands separators must be correctly grouped ("16,000", "1,000,000").
 * Checking the grouping BEFORE stripping commas is deliberate: stripping first
 * would silently turn "1,2,3" into 123 and write the wrong price.
 */
export function parsePriceInput(raw) {
  const text = String(raw ?? '').trim()
  if (text === '') return { ok: false, error: 'Price is required' }

  const grouped = /^\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)
  const plain = /^\d+(\.\d+)?$/.test(text)
  if (!grouped && !plain) return { ok: false, error: 'Enter a number, for example 16000' }

  const value = Number(text.replace(/,/g, ''))
  if (!Number.isFinite(value)) return { ok: false, error: 'Enter a valid number' }
  if (value < 0) return { ok: false, error: 'Price cannot be negative' }
  if (value > MAX_PRICE) return { ok: false, error: 'Price is unrealistically high' }
  if (!Number.isInteger(value)) return { ok: false, error: 'Price must be whole shillings' }

  return { ok: true, value }
}

/** Reject anything that is not a plain http(s) URL or a site-relative path. */
export function validateImageUrl(raw) {
  const text = String(raw ?? '').trim()
  if (text === '') return { ok: true, value: null }

  if (text.startsWith('/')) {
    // Site-relative path. Reject traversal and protocol-relative URLs.
    if (text.startsWith('//')) return { ok: false, error: 'Invalid image path' }
    if (text.includes('..')) return { ok: false, error: 'Invalid image path' }
    return { ok: true, value: text }
  }

  if (!/^https:\/\//i.test(text)) {
    // Deliberately https only: no http downgrade, no javascript:, no data:.
    return { ok: false, error: 'Image must be an https:// URL or a /path' }
  }

  try {
    const url = new URL(text)
    if (url.protocol !== 'https:') return { ok: false, error: 'Image must be https' }
    return { ok: true, value: text }
  } catch {
    return { ok: false, error: 'Enter a valid image URL' }
  }
}

/** Validate a product for create/update. Returns { ok, value, errors }. */
export function validateProduct(input) {
  const errors = {}

  const name = String(input.name ?? '').trim()
  if (name === '') errors.name = 'Product name is required'
  else if (name.length > MAX_NAME) errors.name = `Keep the name under ${MAX_NAME} characters`

  const description = String(input.description ?? '').trim()
  if (description.length > MAX_DESCRIPTION)
    errors.description = `Keep the description under ${MAX_DESCRIPTION} characters`

  const category = String(input.category ?? '').trim()
  if (category === '') errors.category = 'Category is required'
  else if (category.length > MAX_CATEGORY) errors.category = 'Category is too long'

  const unit = String(input.unit ?? '').trim()
  if (unit === '') errors.unit = 'Unit is required'
  else if (unit.length > MAX_UNIT) errors.unit = 'Unit is too long'

  const price = parsePriceInput(input.price)
  if (!price.ok) errors.price = price.error

  const image = validateImageUrl(input.image_url)
  if (!image.ok) errors.image_url = image.error

  const ok = Object.keys(errors).length === 0
  return {
    ok,
    errors,
    value: ok
      ? {
          name,
          description,
          category,
          unit,
          price: price.value,
          image_url: image.value,
          is_available: Boolean(input.is_available),
        }
      : null,
  }
}

/** Validate a promotion for create/update. */
export function validatePromotion(input) {
  const errors = {}

  const name = String(input.name ?? '').trim()
  if (name === '') errors.name = 'Promotion name is required'
  else if (name.length > MAX_NAME) errors.name = `Keep the name under ${MAX_NAME} characters`

  const discountType = input.discount_type
  if (discountType !== 'percentage' && discountType !== 'fixed_amount')
    errors.discount_type = 'Choose a discount type'

  const rawValue = String(input.discount_value ?? '').trim().replace(/,/g, '')
  let discountValue = null
  if (rawValue === '') {
    errors.discount_value = 'Discount is required'
  } else if (!/^\d+(\.\d{1,2})?$/.test(rawValue)) {
    errors.discount_value = 'Enter a number, for example 10 or 2000'
  } else {
    discountValue = Number(rawValue)
    if (!Number.isFinite(discountValue)) {
      errors.discount_value = 'Enter a valid number'
    } else if (discountValue <= 0) {
      errors.discount_value = 'Discount must be more than zero'
    } else if (discountType === 'percentage' && discountValue > 100) {
      errors.discount_value = 'A percentage discount cannot be more than 100'
    } else if (discountType === 'fixed_amount' && !Number.isInteger(discountValue)) {
      // A fixed discount of 0.50 UGX is meaningless: prices are whole shillings
      // and the computed price is rounded to whole shillings anyway.
      errors.discount_value = 'A fixed discount must be whole shillings'
    }
  }

  const start = String(input.start_date ?? '').trim()
  const end = String(input.end_date ?? '').trim()
  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRe.test(start)) errors.start_date = 'Choose a start date'
  if (!dateRe.test(end)) errors.end_date = 'Choose an end date'
  if (dateRe.test(start) && dateRe.test(end) && end < start)
    errors.end_date = 'The end date cannot be before the start date'

  if (input.is_active) {
    if (!dateRe.test(start)) errors.is_active = 'Set valid dates before activating'
    else if (!dateRe.test(end)) errors.is_active = 'Set valid dates before activating'
  }

  const ok = Object.keys(errors).length === 0
  return {
    ok,
    errors,
    value: ok
      ? {
          name,
          discount_type: discountType,
          discount_value: discountValue,
          start_date: start,
          end_date: end,
          is_active: Boolean(input.is_active),
        }
      : null,
  }
}
