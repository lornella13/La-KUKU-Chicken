import { useEffect, useMemo, useState } from 'react'
import ProductCard from './ProductCard.jsx'
import { productGroups as staticGroups } from '../data/products.js'
import { fetchProducts } from '../lib/productsRepo.js'
import { groupRowsIntoCards } from '../lib/groupProducts.js'

/**
 * Public product section.
 *
 * Markup, class names and layout are unchanged. The only difference is the
 * data source: rows now come from the database (falling back to the existing
 * static catalogue if the database is unavailable), so an admin changing a
 * price is reflected here without a code change or redeploy.
 */
export default function Products() {
  const [filter, setFilter] = useState('all')
  const [groups, setGroups] = useState(staticGroups)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    fetchProducts()
      .then(({ rows }) => {
        if (cancelled) return
        // Only swap in database data if it actually has products; an empty or
        // failed response must not blank out a working public page.
        if (rows.length > 0) {
          setGroups(groupRowsIntoCards(rows))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const filters = useMemo(
    () => [
      { id: 'all', label: 'Everything' },
      ...groups.map((g) => ({ id: g.id, label: g.label })),
    ],
    [groups],
  )

  const visible =
    filter === 'all' ? groups : groups.filter((g) => g.id === filter)

  return (
    <section id="products" className="products">
      <div className="wrap">
        <div className="sec-head sec-head-center">
          <div className="eyebrow eyebrow-center">Our Products</div>
          <h2>
            Fresh Chicken. <span className="accent">Quality</span> You Can Trust.
          </h2>
          <p>
            Every cut is sold by weight at a price you can read at a glance. No
            haggling, no surprises. Dressed fresh, or frozen on request.
          </p>
        </div>

        <div className="filter-row" role="group" aria-label="Filter products by category">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`chip ${filter === f.id ? 'is-active' : ''}`}
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {visible.map((group) => (
          <div key={group.id} className="product-group">
            <div className="cat-label">
              <h3 className="cat-name">{group.label}</h3>
              <span className="cat-blurb">{group.blurb}</span>
            </div>
            <div className="product-grid">
              {group.items.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}