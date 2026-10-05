import { useState } from 'react'
import { generalOrderLink } from '../data/products.js'

const NAV_ITEMS = [
  { href: '#story', label: 'Our Story' },
  { href: '#products', label: 'Products' },
  { href: '#locations', label: 'Locations' },
  { href: '#contact', label: 'Contact' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)

  const closeMenu = () => setOpen(false)

  return (
    <header className="nav">
      <div className="nav-row">
        <a href="#top" className="brand" onClick={closeMenu}>
          <span className="mark">
            <img src="/images/brand/logo-mark.png" alt="" width="38" height="38" />
          </span>
          <span>La Kuku<small>Chicken done right</small></span>
        </a>

        <nav id="mobile-nav" className={`links ${open ? 'open' : ''}`} aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <a key={item.href} href={item.href} onClick={closeMenu}>
              {item.label}
            </a>
          ))}
          <a
            className="btn mobile-order"
            href={generalOrderLink()}
            target="_blank"
            rel="noreferrer"
            onClick={closeMenu}
          >
            Order now
          </a>
        </nav>

        <div className="nav-cta">
          <a href="#contact" className="btn ghost" onClick={closeMenu}>Contact</a>
          <a href={generalOrderLink()} target="_blank" rel="noreferrer" className="btn">
            Order now
          </a>
          <button
            className={`burger ${open ? 'is-open' : ''}`}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((o) => !o)}
          >
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
    </header>
  )
}