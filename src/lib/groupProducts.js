import { productGroups } from '../data/products.js'

/**
 * Rebuild the product cards from database rows.
 *
 * The website sells some products in more than one size and shows them as ONE
 * card with size buttons. The database stores one row per size, so rows are
 * grouped on (category, name) and reassembled into the card shape the existing
 * ProductCard component already understands.
 *
 * Pure function over plain row objects — no React, no network — so it can be
 * reasoned about and tested on its own.
 *
 * The one import is the static section copy (product group labels/blurbs),
 * which keeps the category headings identical to the existing site.
 *
 * @param {Array} rows rows from public_products or the static catalogue
 * @returns {Array} groups: [{ id, label, blurb, items: [cardProduct] }]
 */
export function groupRowsIntoCards(rows) {
  const groups = new Map()

  for (const row of rows) {
    // Grouped by CATEGORY. Inside a category, rows sharing a name are size
    // variants of ONE card, so a second map collapses them.
    if (!groups.has(row.category)) {
      groups.set(row.category, new Map())
    }

    const cards = groups.get(row.category)

    if (!cards.has(row.name)) {
      cards.set(row.name, { rows: [], sortKey: null, hasOrder: false })
    }

    const card = cards.get(row.name)
    card.rows.push(row)

    // Ordering key for the whole card.
    //
    // sort_order is authoritative when present: it encodes the shop's curated
    // order (Whole Chicken first, Royal Butchery last). Falling back to price as
    // the sort key would silently re-shuffle the page by cheapest item, which is
    // NOT the order the shop arranged.
    const explicit = typeof row.sort_order === 'number' ? row.sort_order : null
    if (explicit !== null) {
      card.hasOrder = true
      if (card.sortKey === null || explicit < card.sortKey) card.sortKey = explicit
    } else {
      const price = Number(row.list_price ?? 0)
      if (card.sortKey === null || price < card.sortKey) card.sortKey = price
    }
  }

  return [...groups.entries()]
    .map(([category, cards]) => ({
      id: category,
      label: category,
      blurb: blurbFor(category),
      // Cards carrying an explicit sort_order keep the shop's order; any card
      // without one falls back to a stable price-based order behind them.
      items: [...cards.entries()]
        .sort(([, a], [, b]) => {
          if (a.hasOrder !== b.hasOrder) return a.hasOrder ? -1 : 1
          return a.sortKey - b.sortKey
        })
        .map(([, card]) => toCardProduct(card.rows)),
    }))
    .sort((a, b) => categoryOrder(a.label) - categoryOrder(b.label))
}

/**
 * Turn the rows of one product into a single card.
 *
 * The first row supplies the card's name, description, image and unit. Every
 * row contributes one size button, ordered smallest first, so the size pills
 * behave exactly as they did before the database existed.
 */
function toCardProduct(rows) {
  const ordered = rows
    .slice()
    // Explicit sort_order wins; otherwise price ascending, which puts the
    // smallest pack first and makes it the default selection.
    .sort((a, b) => sizeSortKey(a) - sizeSortKey(b))

  const head = ordered[0]

  return {
    id: head.id,
    name: head.name,
    description: head.description,
    image: head.image_url,
    alt: head.name,
    unit: head.unit,
    category: head.category,

    // RLS already filters out unavailable rows for public visitors, so a card
    // only exists when at least one size is visible. Individual sizes can still
    // be marked unavailable while the rest of the card stays orderable.
    is_available: ordered.some((r) => r.is_available !== false),

    variants: ordered.map((r) => ({
      label: r.variant_label ?? '',
      price: r.current_price ?? r.list_price ?? 0,
      listPrice: r.list_price ?? r.current_price ?? 0,
      available: r.is_available !== false,
      isPromoted: Boolean(r.is_promoted),
      promotionLabel: r.is_promoted ? promoText(r) : null,
      rowId: r.id,
    })),

    // Convenience flag for the whole card.
    onPromotion: ordered.some((r) => r.is_promoted),
  }
}

/** Sort key for a size row: explicit order first, then price ascending. */
function sizeSortKey(row) {
  if (typeof row.sort_order === 'number') return row.sort_order
  return Number(row.list_price ?? 0)
}


/** "10% OFF" / "2,000 OFF" from a promoted row. */
function promoText(row) {
  const value = Number(row.discount_value)
  if (!Number.isFinite(value)) return 'Special offer'
  if (row.discount_type === 'percentage') {
    const shown = Number.isInteger(value) ? String(value) : String(value).replace(/\.?0+$/, '')
    return `${shown}% OFF`
  }
  if (row.discount_type === 'fixed_amount') {
    return `${Math.round(value).toLocaleString('en-US')} OFF`
  }
  return 'Special offer'
}

const CATEGORY_ORDER = ['Chicken', 'Sausages']
function categoryOrder(label) {
  const i = CATEGORY_ORDER.indexOf(label)
  return i === -1 ? CATEGORY_ORDER.length : i
}

/**
 * Blurb text per category.
 *
 * Read from the existing productGroups definitions rather than re-typed here.
 * Section blurbs are static marketing copy, not product data, so they stay in
 * the data file — importing them means the heading text can never drift from
 * what the shop already had on the page.
 */
const BLURBS = new Map(productGroups.map((g) => [g.label, g.blurb]))

function blurbFor(category) {
  return BLURBS.get(category) ?? ''
}

/** Product names for the contact form dropdown, de-duplicated. */
export function uniqueProductNames(rows) {
  const names = new Set()
  for (const row of rows) {
    if (row.name) names.add(row.name)
  }
  return [...names]
}