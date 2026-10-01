import { generalOrderLink } from '../data/products.js'

const PILLARS = [
  {
    num: '01',
    title: 'Fresh, not fried',
    body: 'We supply fresh and frozen chicken, dressed to order, never pre-fried. You buy raw cuts ready for your own kitchen.',
  },
  {
    num: '02',
    title: '100% halal, always',
    body: 'Every cut we sell is halal. It is the one standard we do not negotiate on, whatever the cut or the price.',
  },
  {
    num: '03',
    title: 'Priced in plain sight',
    body: 'One price per kilogram, listed openly on this page. What you read is what you pay at the counter.',
  },
]

export default function Story() {
  return (
    <section id="story" className="story">
      <div className="wrap">
        <div className="story-intro">
          <div className="story-copy">
            <div className="eyebrow">Our Story</div>
            <h2>Chicken done right means never taking shortcuts.</h2>

            <p>
              La Kuku Chicken is a Rubaga-based chicken and sausage supplier
              serving Kampala. We sell raw chicken the way it should be sold:
              fresh or frozen, dressed to order, halal, and weighed out in front
              of you at a published price.
            </p>
            <p>
              No takeaway boxes, no frying, no mystery. Just clean cuts, honest
              weights, and a shop you can send your order to on WhatsApp when the
              kitchen needs restocking.
            </p>

            <div className="story-actions">
              <a href="#products" className="btn">See the price list</a>
              <a href={generalOrderLink()} target="_blank" rel="noreferrer" className="btn ghost">
                Order on WhatsApp
              </a>
            </div>
          </div>

          <figure className="story-figure">
            <img
              src="/images/products/wholechicken.png"
              alt="A whole dressed chicken from La Kuku Chicken"
              width="720"
              height="720"
              loading="lazy"
              decoding="async"
            />
            <figcaption>Whole chicken, dressed fresh</figcaption>
          </figure>
        </div>

        <div className="story-grid">
          {PILLARS.map((pillar) => (
            <div className="story-card" key={pillar.num}>
              <div className="num">{pillar.num}</div>
              <h3>{pillar.title}</h3>
              <p>{pillar.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}