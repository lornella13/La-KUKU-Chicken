import { contactInfo, locationInfo, generalOrderLink } from '../data/products.js'

const NAV_ITEMS = [
  { href: '#story', label: 'Our Story' },
  { href: '#products', label: 'Products' },
  { href: '#locations', label: 'Locations' },
  { href: '#contact', label: 'Contact' },
]

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer>
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <a href="#top" className="brand">
              <span className="mark">
                <img src="/images/brand/logo.png" alt="La Kuku Chicken" width="88" height="88" loading="lazy" decoding="async" />
              </span>
            </a>
            <p className="foot-blurb">
              Fresh &amp; frozen, 100% halal chicken and sausages in Rubaga,
              Kampala. Dressed to order, priced by the kilo, ordered on WhatsApp.
            </p>
            <a href={generalOrderLink()} target="_blank" rel="noreferrer" className="btn">
              Order on WhatsApp
            </a>
          </div>

          <nav className="foot-col" aria-label="Footer">
            <h2 className="foot-title">Explore</h2>
            {NAV_ITEMS.map((item) => (
              <a key={item.href} href={item.href}>{item.label}</a>
            ))}
          </nav>

          <div className="foot-col">
            <h2 className="foot-title">Contact</h2>
            <a href={generalOrderLink()} target="_blank" rel="noreferrer">
              WhatsApp · {contactInfo.whatsappDisplay}
            </a>
            <a href={`tel:${contactInfo.phone}`}>{contactInfo.phoneDisplay}</a>
            <a href={`mailto:${contactInfo.email}`}>{contactInfo.email}</a>
          </div>

          <div className="foot-col">
            <h2 className="foot-title">Find us</h2>
            <p>{locationInfo.branchName}</p>
            <p className="foot-addr">{locationInfo.address}</p>
            <a
              href={locationInfo.directionsUrl}
              target="_blank"
              rel="noreferrer"
            >
              Get directions
            </a>
          </div>
        </div>

        <div className="foot-fine">
          © {year} La Kuku Chicken · Rubaga, Kampala. All rights reserved.
        </div>
      </div>
    </footer>
  )
}