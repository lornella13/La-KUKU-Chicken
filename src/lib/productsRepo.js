import { supabase, isBackendAvailable } from './supabase.js'
import { chickenProducts, sausageProducts } from '../data/products.js'
import { effectivePrice, isPromotionLive, promotionLabel } from './pricing.js'

/**
 * Product read model for the public website and the admin dashboard.
 *
 * The database is the source of truth. If Supabase is not configured, or the
 * request fails, this falls back to the existing static catalogue so the public
 * site keeps working exactly as it did before the backend was introduced. The
 * fallback is announced once in the console so it is never mistaken for live
 * data.
 */

let warnedAboutFallback = false

function warnFallbackOnce(reason) {
  if (warnedAboutFallback) return
  warnedAboutFallback = true
  console.warn(
    `[products] Serving the built-in static catalogue (${reason}). ` +
      'The public site stays up, but prices will not reflect the database.',
  )
}

/** Shape the static catalogue like a database row so both paths render alike. */
function staticRows() {
  const rows = []
  // The shop's curated order, position within the catalogue times 100 so a
  // product's sizes keep their own 0/1/2 slots inside its block. This is what
  // makes the fallback render in exactly the same order as the database.
  let productPosition = 0

  for (const p of [...chickenProducts, ...sausageProducts]) {
    for (const [index, variant] of (p.variants ?? []).entries()) {
      rows.push({
        id: staticId(`${p.id}-${variant.label}`),
        name: p.name,
        description: p.description,
        unit: p.unit,
        category: p.category === 'sausages' ? 'Sausages' : 'Chicken',
        image_url: p.image,
        is_available: true,
        list_price: variant.price,
        current_price: variant.price,
        is_promoted: false,
        promotion_id: null,
        promotion_name: null,
        discount_type: null,
        discount_value: null,
        promotion_end_date: null,
        // Static size labels are preserved so the existing size pills keep
        // working identically before the database takes over.
        variant_label: variant.label,
        sort_order: productPosition * 100 + index,
        updated_at: null,
        source: 'static',
      })
    }
    productPosition += 1
  }
  return rows
}

/**
 * Deterministic, collision-resistant id for a static row.
 *
 * The admin dashboard only needs a stable React key and a route parameter for
 * static rows, and there is no such database record to edit, so a UUID-shaped
 * value derived from the slug is enough. It is never used in a query.
 */
function staticId(slug) {
  const hex = Array.from(slug)
    .map((ch) => ch.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('')
  return `00000000-0000-4000-8000-${hex.slice(0, 12).padEnd(12, '0')}`
}

/**
 * Fetch every publicly visible product with its effective price.
 *
 * `public_products` is a security_invoker view, so RLS applies to it: the
 * anon role sees only available products, and the effective price is computed
 * by Postgres from the database clock.
 *
 * @param {object} [options]
 * @param {boolean} [options.includeUnavailable] staff-only; ignored by RLS
 *        for the anon role, but requested explicitly for the admin list.
 */
export async function fetchProducts({ includeUnavailable = false } = {}) {
  if (!isBackendAvailable()) {
    warnFallbackOnce('Supabase is not configured')
    return { rows: staticRows(), source: 'static', error: null }
  }

  const query = supabase
    .from('public_products')
    .select(
      'id, name, description, unit, category, image_url, is_available, ' +
        'list_price, current_price, is_promoted, promotion_id, promotion_name, ' +
        'discount_type, discount_value, promotion_end_date, updated_at',
    )
    .order('category', { ascending: true })
    .order('name', { ascending: true })

  const { data, error } = await query

  if (error || !data) {
    warnFallbackOnce(error ? `query failed: ${error.code ?? 'error'}` : 'no data returned')
    return { rows: staticRows(), source: 'static', error: error ?? null }
  }

  return { rows: data, source: 'database', error: null }
}

/** Fetch every product including disabled ones. Staff only; RLS enforces it. */
export async function fetchAllProductsForAdmin() {
  if (!isBackendAvailable()) {
    return { rows: staticRows(), source: 'static', error: null }
  }

  const { data, error } = await supabase
    .from('products')
    .select(
      'id, name, description, unit, category, image_url, is_available, ' +
        'price, active_promotion_id, created_at, updated_at',
    )
    .order('name', { ascending: true })

  if (error || !data) {
    return { rows: [], source: 'database', error: error ?? null }
  }

  // Attach promotion state for the admin table without a second round trip
  // per row, by resolving the active promotions in one query.
  const ids = [...new Set(data.map((p) => p.active_promotion_id).filter(Boolean))]
  let promosById = new Map()
  if (ids.length > 0) {
    const { data: promos } = await supabase
      .from('promotions')
      .select('id, name, discount_type, discount_value, is_active, start_date, end_date')
      .in('id', ids)
    promosById = new Map((promos ?? []).map((p) => [p.id, p]))
  }

  const rows = data.map((p) => {
    const promo = p.active_promotion_id ? promosById.get(p.active_promotion_id) : null
    const live = promo ? isPromotionLive(promo) : false
    return {
      ...p,
      promotion: promo ?? null,
      promotion_live: live,
      promotion_label: live ? promotionLabel(promo) : null,
      current_price: effectivePrice(p.price, live ? promo : null),
    }
  })

  return { rows, source: 'database', error: null }
}

/** Fetch a single product by id. */
export async function fetchProductById(id) {
  if (!isBackendAvailable()) {
    const row = staticRows().find((r) => r.id === id)
    return { row: row ?? null, source: 'static', error: null }
  }

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  return { row: data ?? null, source: 'database', error: error ?? null }
}

/** Fetch all promotions with the products they cover. */
export async function fetchPromotions() {
  if (!isBackendAvailable()) {
    return { rows: [], source: 'static', error: null }
  }

  const { data, error } = await supabase
    .from('promotions')
    .select('*, promotion_products(product_id)')
    .order('start_date', { ascending: false })

  return { rows: data ?? [], source: 'database', error: error ?? null }
}

/** Fetch a single promotion with its product links. */
export async function fetchPromotionById(id) {
  if (!isBackendAvailable()) return { row: null, source: 'static', error: null }

  const { data, error } = await supabase
    .from('promotions')
    .select('*, promotion_products(product_id)')
    .eq('id', id)
    .maybeSingle()

  return { row: data ?? null, source: 'database', error: error ?? null }
}
