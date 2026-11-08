import { supabase, isBackendAvailable } from './supabase.js'
import { chickenProducts, sausagesProducts } from '../data/products.js'
import { effectivePrice, isPromotionLive, promotionLabel } from './pricing.js'

let warnedAboutFallback = false

function warnFallbackOnce(reason) {
  if (warnedAboutFallback) return
  warnedAboutFallback = true
  console.warn(
    `[products] Serving the built-in static catalogue (${reason}). ` +
      'The public site stays up, but prices will not reflect the database.',
  )
}

function staticRows() {
  const rows = []

  let productPosition = 0

  for (const p of [...chickenProducts, ...sausagesProducts]) {

    const sizeOptions = p.sizes ?? p.variants ?? []
    if (sizeOptions.length === 0) {
      throw new Error(`Product "${p.name}" has no sizes or variants; refusing to guess.`)
    }
    sizeOptions.forEach((option, index) => {
      const price = Number(option.price)
      if (!Number.isInteger(price) || price < 0) {
        throw new Error(`Invalid price for ${p.name} ${option.label}: ${option.price}`)
      }
      rows.push({
        id: staticId(`${p.id}-${option.label}`),
        name: p.name,
        description: p.description,
        unit: p.unit,
        category: p.category === 'sausages' ? 'Sausages' : 'Chicken',
        image_url: p.image,
        is_available: true,
        list_price: price,
        current_price: price,
        is_promoted: false,
        promotion_id: null,
        promotion_name: null,
        discount_type: null,
        discount_value: null,
        promotion_end_date: null,
        variant_label: sizeOptions.length > 1 ? option.label : null,
        sort_order: productPosition * 100 + index,
        updated_at: null,
        source: 'static',

        sizes: p.sizes ?? null,
      })
    })
    productPosition += 1
  }
  return rows
}

function staticId(slug) {
  const hex = Array.from(slug)
    .map((ch) => ch.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('')
  return `00000000-0000-4000-8000-${hex.slice(0, 12).padEnd(12, '0')}`
}

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

export async function fetchPromotionById(id) {
  if (!isBackendAvailable()) return { row: null, source: 'static', error: null }

  const { data, error } = await supabase
    .from('promotions')
    .select('*, promotion_products(product_id)')
    .eq('id', id)
    .maybeSingle()

  return { row: data ?? null, source: 'database', error: error ?? null }
}
