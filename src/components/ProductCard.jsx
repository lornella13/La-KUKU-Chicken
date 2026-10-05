import { useRef, useState } from 'react'
import { formatPrice, productOrderLink } from '../data/products.js'

/**
 * Public product card.
 *
 * The layout, class names and image treatment are unchanged. Three things were
 * added for database-driven data:
 *
 *   1. Prices come from the database (via groupProducts), so an admin change
 *      shows up without a rebuild.
 *   2. A promotion shows the original price struck through, the discount, and
 *      the price the customer actually pays.
 *   3. An unavailable product cannot be ordered — the WhatsApp button is
 *      replaced, so nobody can send an order for something that is sold out.
 *
 * Product name, description and image are rendered as plain text through
 * JSX, which React escapes. No dangerouslySetInnerHTML is used anywhere, so
 * admin-entered content cannot inject HTML or script.
 */
export default function ProductCard({ product }) {
  const {
    name,
    description,
    image,
    alt,
    unit,
    variants,
  } = product

  // Smallest size first, so the card opens on the entry-level pack.
  const [active, setActive] = useState(0)
  const groupRef = useRef(null)

  const hasSizes = variants.length > 1
  const variant = variants[active]
  const orderLink = productOrderLink(product, variant)
  const canOrder = product.is_available !== false && variant.available !== false
  const onPromo = Boolean(variant.isPromoted)

  /** Radiogroup keyboard support: arrows move between sizes, Home/End jump. */
  function onKeyDown(event) {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End']
    if (!keys.includes(event.key)) return

    const last = variants.length - 1
    let next = active
    if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last
    else if (event.key === 'ArrowRight' || event.key === 'ArrowDown')
      next = active === last ? 0 : active + 1
    else next = active === 0 ? last : active - 1

    event.preventDefault()
    setActive(next)
    groupRef.current?.querySelectorAll('.p-variant')[next]?.focus()
  }

  return (
    <article className={`product-card ${canOrder ? '' : 'is-unavailable'}`}>
      <div className="p-img">
        {/* Original photograph, shown complete: the container uses
            object-fit: contain, so nothing is cropped or distorted. */}
        <img src={image} alt={alt} loading="lazy" decoding="async" />

        {onPromo && (
          <span className="p-promo-badge">{variant.promotionLabel}</span>
        )}
        {!canOrder && <span className="p-sold-out">Sold out</span>}
      </div>

      <div className="p-body">
        <h3 className="p-name">{name}</h3>
        <p className="p-desc">{description}</p>

        {/* Always rendered so cards with and without a size toggle keep the
            same height and stay aligned in the grid. */}
        <div
          className="p-variants"
          role={hasSizes ? 'radiogroup' : undefined}
          aria-label={hasSizes ? `Choose a size for ${name}` : undefined}
          ref={groupRef}
          onKeyDown={hasSizes ? onKeyDown : undefined}
        >
          {hasSizes &&
            variants.map((v, i) => (
              <button
                key={v.rowId ?? v.label}
                type="button"
                role="radio"
                aria-checked={i === active}
                aria-disabled={v.available === false ? 'true' : undefined}
                tabIndex={i === active ? 0 : -1}
                className={`p-variant ${i === active ? 'is-active' : ''} ${
                  v.available === false ? 'is-out' : ''
                }`}
                onClick={() => setActive(i)}
              >
                {v.label}
              </button>
            ))}
        </div>

        <div className="p-buy">
          <p className="p-price">
            {onPromo && (
              <span className="amount was">{formatPrice(variant.listPrice)}</span>
            )}
            <span className="amount">{formatPrice(variant.price)}</span>
            <span className="p-unit">{unit}</span>
          </p>

          {canOrder ? (
            <a
              className="btn wa-btn"
              href={orderLink}
              target="_blank"
              rel="noreferrer"
              aria-label={`Order ${name}${hasSizes ? ` ${variant.label}` : ''} on WhatsApp${
                onPromo ? ` at ${formatPrice(variant.price)}` : ''
              }`}
            >
              Order now
            </a>
          ) : (
            <span className="btn wa-btn is-disabled" aria-disabled="true">
              Currently unavailable
            </span>
          )}
        </div>
      </div>
    </article>
  )
}