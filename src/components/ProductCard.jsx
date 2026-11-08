import { useEffect, useRef, useState } from 'react'
import { formatPrice, productOrderLink, WHATSAPP_NUMBER } from '../data/products.js'

export default function ProductCard({ product }) {
  const {
    name,
    description,
    image,
    alt,
    unit,
    variants,
    sizes,
  } = product

  const [active, setActive] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const groupRef = useRef(null)
  const dropdownRef = useRef(null)

  const hasSizeDropdown = Boolean(sizes && sizes.length > 1)

  const variant = variants[hasSizeDropdown ? 0 : active]
  const canOrder = product.is_available !== false && variant.available !== false
  const onPromo = Boolean(variant.isPromoted)

  const selectedSize = selectedIndex !== null ? sizes[selectedIndex] : null
  const priceText = hasSizeDropdown
    ? selectedSize
      ? formatPrice(selectedSize.price)
      : `From ${formatPrice(variant.price)}`
    : formatPrice(variant.price)
  const displayUnit = hasSizeDropdown ? 'per bird' : unit

  let orderLink
  let orderAria
  if (hasSizeDropdown) {
    if (selectedSize) {
      orderLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
        `Hello La Kuku, I would like to order a Whole Chicken (${selectedSize.label}) at ${formatPrice(selectedSize.price)}. Please share availability and ordering details.`,
      )}`
      orderAria = `Order ${name} (${selectedSize.label}) on WhatsApp at ${formatPrice(selectedSize.price)}`
    } else {
      orderLink = productOrderLink(product, variant)
      orderAria = `Order ${name} on WhatsApp`
    }
  } else {
    orderLink = productOrderLink(product, variant)
    orderAria = `Order ${name}${variants.length > 1 ? ` ${variant.label}` : ''} on WhatsApp${
      onPromo ? ` at ${formatPrice(variant.price)}` : ''
    }`
  }

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false)
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  
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

  
  function onDropdownKeyDown(event) {
    const keys = ['ArrowUp', 'ArrowDown', 'Enter', 'Escape']
    if (!keys.includes(event.key)) return

    event.preventDefault()
    if (event.key === 'Escape') {
      setDropdownOpen(false)
      return
    }
    if (event.key === 'Enter') {
      setDropdownOpen(false)
      return
    }
    const last = sizes.length - 1
    let next = selectedIndex ?? 0
    if (event.key === 'ArrowDown') next = next === last ? 0 : next + 1
    else next = next === 0 ? last : next - 1
    setSelectedIndex(next)
  }

  let sizeSelector
  if (hasSizeDropdown) {
    const selected = sizes[selectedIndex ?? 0]
    sizeSelector = (
      <div className="p-size-dropdown" ref={dropdownRef}>
        <button
          type="button"
          className={`p-size-btn ${dropdownOpen ? 'is-open' : ''}`}
          aria-haspopup="listbox"
          aria-expanded={dropdownOpen}
          aria-label={`Choose a weight for ${name}`}
          onClick={() => setDropdownOpen(!dropdownOpen)}
          onKeyDown={onDropdownKeyDown}
        >
          <span className="p-size-btn-label">
            {selectedIndex === null
              ? 'Select weight & price'
              : `${selected.label} · `}
          </span>
          {selectedIndex !== null && (
            <span className="p-size-btn-price">{formatPrice(selected.price)}</span>
          )}
          <span className="p-size-btn-chevron">▼</span>
        </button>
        {dropdownOpen && (
          <div
            className="p-size-list"
            role="listbox"
            aria-label={`Choose a weight for ${name}`}
          >
            {sizes.map((s, i) => (
              <button
                key={s.label}
                type="button"
                role="option"
                aria-selected={selectedIndex === i}
                className={`p-size-option ${selectedIndex === i ? 'is-selected' : ''}`}
                onClick={() => {
                  setSelectedIndex(i)
                  setDropdownOpen(false)
                }}
              >
                <span className="p-size-weight">{s.label}</span>
                <span className="p-size-price">{formatPrice(s.price)}</span>
                {selectedIndex === i && <span className="p-size-tick">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  } else if (variants.length > 1) {
    sizeSelector = (
      <div
        className="p-variants"
        role="radiogroup"
        aria-label={`Choose a size for ${name}`}
        ref={groupRef}
        onKeyDown={onKeyDown}
      >
        {variants.map((v, i) => (
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
    )
  } else {
    sizeSelector = <div className="p-variants" />
  }

  return (
    <article
      className={`product-card ${canOrder ? '' : 'is-unavailable'}${
        dropdownOpen ? ' is-dropdown-open' : ''
      }`}
      style={{ zIndex: dropdownOpen ? 50 : undefined }}
    >
      <div className="p-img">
        
        <img src={image} alt={alt} loading="lazy" decoding="async" />

        {onPromo && (
          <span className="p-promo-badge">{variant.promotionLabel}</span>
        )}
        {!canOrder && <span className="p-sold-out">Sold out</span>}
      </div>

      <div className="p-body">
        <h3 className="p-name">{name}</h3>
        <p className="p-desc">{description}</p>

        {sizeSelector}

        <div className="p-buy">
          <p className="p-price">
            {onPromo && (
              <span className="amount was">{formatPrice(variant.listPrice)}</span>
            )}
            <span className="amount">{priceText}</span>
            <span className="p-unit">{displayUnit}</span>
          </p>

          {canOrder ? (
            <a
              className="btn wa-btn"
              href={orderLink}
              target="_blank"
              rel="noreferrer"
              aria-label={orderAria}
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
