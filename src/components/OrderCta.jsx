import { generalOrderLink } from '../data/products.js'

export default function OrderCta() {
  return (
    <section className="order-cta">
      <div className="wrap order-cta-inner">
        <div>
          <h2>Ready to order?</h2>
          <p>Get your fresh chicken from La Kuku.</p>
        </div>
        <div className="order-cta-actions">
          <a href={generalOrderLink()} target="_blank" rel="noreferrer" className="btn btn-lg">
            Order now
          </a>
          <a href="#products" className="btn ghost btn-lg">Browse products</a>
        </div>
      </div>
    </section>
  )
}