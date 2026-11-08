import { productGroups } from '../data/products.js'

export function groupRowsIntoCards(rows) {
  const groups = new Map()

  for (const row of rows) {

    if (!groups.has(row.category)) {
      groups.set(row.category, new Map())
    }

    const cards = groups.get(row.category)

    if (!cards.has(row.name)) {
      cards.set(row.name, { rows: [], sortKey: null, hasOrder: false })
    }

    const card = cards.get(row.name)
    card.rows.push(row)

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

      items: [...cards.entries()]
        .sort(([, a], [, b]) => {
          if (a.hasOrder !== b.hasOrder) return a.hasOrder ? -1 : 1
          return a.sortKey - b.sortKey
        })
        .map(([, card]) => toCardProduct(card.rows)),
    }))
    .sort((a, b) => categoryOrder(a.label) - categoryOrder(b.label))
}

function toCardProduct(rows) {
  const ordered = rows
    .slice()

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

    sizes: head.sizes ?? undefined,

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

    onPromotion: ordered.some((r) => r.is_promoted),
  }
}

function sizeSortKey(row) {
  if (typeof row.sort_order === 'number') return row.sort_order
  return Number(row.list_price ?? 0)
}

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

const BLURBS = new Map(productGroups.map((g) => [g.label, g.blurb]))

function blurbFor(category) {
  return BLURBS.get(category) ?? ''
}

export function uniqueProductNames(rows) {
  const names = new Set()
  for (const row of rows) {
    if (row.name) names.add(row.name)
  }
  return [...names]
}