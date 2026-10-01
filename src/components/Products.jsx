import { useState } from 'react'
import ProductCard from './ProductCard.jsx'
import { productGroups, priceListLink } from '../data/products.js'

const FILTERS = [
  { id: 'all', label: 'Everything' },
  ...productGroups.map((g) => ({ id: g.id, label: g.label })),
]

export default function Products() {
  const [filter, setFilter] = useState('all')

  const groups =
    filter === 'all' ? productGroups : productGroups.filter((g) => g.id === filter)

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
          {FILTERS.map((f) => (
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

        {groups.map((group) => (
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

        <div className="products-note">
          <a href={priceListLink()} target="_blank" rel="noreferrer" className="btn">
            Get the full price list on WhatsApp
          </a>
          <a href="#contact" className="btn ghost">Ask about bulk orders</a>
        </div>
      </div>
    </section>
  )
}