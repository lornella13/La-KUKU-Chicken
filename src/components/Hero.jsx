import { heroImage, generalOrderLink } from '../data/products.js'

const BADGES = ['Fresh & frozen, not fried', '100% halal', 'Premium quality always']

export default function Hero() {
  return (
    <section className="hero">
      <div className="wrap hero-grid">
        <div>
          <div className="eyebrow">Rubaga, Kampala · Fresh &amp; frozen chicken</div>

          <h1>
            Chicken<br />
            <span className="accent">Done</span> <span className="strike">Right.</span>
          </h1>

          <p className="lede">
            La Kuku Chicken supplies fresh &amp; frozen, 100% halal chicken and
            sausages, dressed to order, priced by the kilo, delivered across
            Kampala.
          </p>

          <div className="hero-actions">
            <a href={generalOrderLink()} target="_blank" rel="noreferrer" className="btn btn-lg">
              Order on WhatsApp
            </a>
            <a href="#products" className="btn ghost btn-lg">Explore Products</a>
          </div>

          <div className="badge-row">
            {BADGES.map((badge) => (
              <span className="badge" key={badge}>
                <span className="dot" />
                {badge}
              </span>
            ))}
          </div>
        </div>

        <div className="tag-stage">
          <figure className="hero-photo">
            <img
              className="hero-img"
              src={heroImage.src}
              alt={heroImage.alt}
              width="800"
              height="533"
              loading="eager"
              decoding="async"
            />
          </figure>

          <div className="price-tag one">
            <div className="cut">Whole Chicken</div>
            <div className="name">14,000/=</div>
            <div className="unit">per kg · fresh, dressed</div>
          </div>
          <div className="price-tag two">
            <div className="cut">Drumsticks</div>
            <div className="name">17,000/=</div>
            <div className="unit">per kg</div>
          </div>
        </div>
      </div>
    </section>
  )
}