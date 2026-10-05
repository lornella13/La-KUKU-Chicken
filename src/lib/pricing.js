/**
 * Money and promotion pricing.
 *
 * Single source of truth for how a price is turned into the number a customer
 * sees, shared by the public site and the admin dashboard so the two can never
 * disagree.
 *
 * Money is whole Ugandan shillings held as integers. No floating point is used
 * for money anywhere in this file: percentages are handled with integer
 * arithmetic and an explicit half-up rounding step, because 16,000 * 0.9 is
 * 14400.000000000002 in IEEE 754 and that class of drift is unacceptable in a
 * price.
 *
 * The database is authoritative: public_products.current_price is computed in
 * SQL from the database clock. The functions here mirror that logic for admin
 * previews and for the static fallback catalogue, and the two are kept
 * deliberately identical.
 */

/** Format whole shillings the way the site displays them: 21000 -> "21,000/=". */
export function formatPrice(value) {
  // Reject null/undefined/empty explicitly: Number(null) is 0, which would
  // silently render a missing price as "0/=".
  if (value === null || value === undefined || value === '') return '—'
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return '—'
  return `${n.toLocaleString('en-US')}/=`
}

/** Format a number of shillings with no currency suffix, for form inputs. */
export function formatAmount(value) {
  if (value === null || value === undefined || value === '') return ''
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return ''
  return n.toLocaleString('en-US')
}

/**
 * Effective price for a product under an optional promotion.
 *
 * Deterministic by construction:
 *   - percentage    -> round(price * (100 - value) / 100), never below 0
 *   - fixed_amount  -> max(0, price - value)
 *   - no promotion  -> the list price
 *
 * Only ONE promotion can ever apply to a product (products.active_promotion_id),
 * so there is no ambiguity when two promotions overlap in time.
 */
export function effectivePrice(price, promotion) {
  const listPrice = Math.max(0, Math.round(Number(price) || 0))
  if (!promotion) return listPrice

  const value = Number(promotion.discount_value)
  if (!Number.isFinite(value) || value <= 0) return listPrice

  if (promotion.discount_type === 'percentage') {
    // Rounds the FINAL price, not the discount.
    //
    // This must match the SQL in public_products exactly:
    //   round(price * (100 - discount_value) / 100)
    // Rounding the discount first instead would disagree with the database on
    // half-way values (1250 @ 33% -> 838 here, 837 if the discount is rounded
    // first), and the customer would be shown a price the database never
    // computed. Postgres ROUND on numeric is half-up, which Math.round matches
    // for positive values.
    return Math.max(0, Math.round((listPrice * (100 - value)) / 100))
  }

  if (promotion.discount_type === 'fixed_amount') {
    return Math.max(0, listPrice - Math.round(value))
  }

  return listPrice
}

/** Human label for a promotion, e.g. "10% OFF" or "2,000 OFF". */
export function promotionLabel(promotion) {
  if (!promotion) return null
  const value = Number(promotion.discount_value)
  if (!Number.isFinite(value)) return null

  if (promotion.discount_type === 'percentage') {
    // Drop a trailing ".00" so "10.00%" reads as "10%".
    const shown = Number.isInteger(value) ? String(value) : String(value).replace(/\.?0+$/, '')
    return `${shown}% OFF`
  }

  if (promotion.discount_type === 'fixed_amount') {
    return `${formatAmount(value)} OFF`
  }

  return null
}

/**
 * Is a promotion live right now?
 *
 * Accepts an optional `now` so it can be unit tested, and defaults to the
 * current date. On the live site the database has already decided this in SQL;
 * this helper exists for the admin UI and the static fallback.
 */
export function isPromotionLive(promotion, now = new Date()) {
  if (!promotion?.is_active) return false
  const start = parseDateOnly(promotion.start_date)
  const end = parseDateOnly(promotion.end_date)
  if (start === null || end === null) return false
  const today = toDateOnly(now)
  return today >= start && today <= end
}

/** Parse a YYYY-MM-DD string as a calendar date, avoiding timezone drift. */
function parseDateOnly(value) {
  if (typeof value !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return `${m[1]}-${m[2]}-${m[3]}`
}

function toDateOnly(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
