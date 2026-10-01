import { useState } from 'react'
import { contactInfo, allProducts, generalOrderLink, locationInfo, waLink } from '../data/products.js'

// Derived from the product list so it can never drift out of sync with it.
const PRODUCT_OPTIONS = [...allProducts.map((p) => p.name), 'Other / Bulk order']

const CONTACT_LINKS = [
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    value: contactInfo.whatsappDisplay,
    href: generalOrderLink(),
    external: true,
    hint: 'Fastest way to order',
    icon: (
      <path d="M21 11.5a8.5 8.5 0 0 1-12.35 7.6L3 20l1-5.5A8.5 8.5 0 1 1 21 11.5z" />
    ),
  },
  {
    key: 'phone',
    label: 'Call',
    value: contactInfo.phoneDisplay,
    href: `tel:${contactInfo.phone}`,
    hint: 'Speak to the shop',
    icon: <path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3.1 5.2 2 2 0 0 1 5 3h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8.9 10.6a16 16 0 0 0 6.5 6.5l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z" />,
  },
  {
    key: 'email',
    label: 'Email',
    value: contactInfo.email,
    href: `mailto:${contactInfo.email}`,
    hint: 'For larger enquiries',
    icon: (
      <>
        <path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
        <path d="M3 6l9 7 9-7" />
      </>
    ),
  },
]

export default function Contact() {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    product: PRODUCT_OPTIONS[0],
    message: '',
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const text =
      `New inquiry from ${form.name}\n\n` +
      `Phone: ${form.phone}\n` +
      `Product: ${form.product}\n` +
      `Message: ${form.message || 'None'}`
    window.location.href = waLink(text)
  }

  return (
    <section id="contact" className="contact">
      <div className="wrap">
        <div className="sec-head sec-head-center">
          <div className="eyebrow eyebrow-center">Contact</div>
          <h2>Talk to us.</h2>
          <p>
            WhatsApp is the fastest way to order. Send a message and we will
            reply with availability and ordering details.
          </p>
        </div>

        <div className="contact-grid">
          <div className="contact-list">
            {CONTACT_LINKS.map((item) => (
              <a
                className="contact-item"
                key={item.key}
                href={item.href}
                {...(item.external ? { target: '_blank', rel: 'noreferrer' } : {})}
              >
                <span className="ic" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    {item.icon}
                  </svg>
                </span>
                <div>
                  <div className="label">{item.label}</div>
                  <div className="value">{item.value}</div>
                  <div className="hint">{item.hint}</div>
                </div>
              </a>
            ))}

            <div className="contact-item is-static">
              <span className="ic" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
              </span>
              <div>
                <div className="label">Visit</div>
                <div className="value">{locationInfo.branchName}</div>
                <div className="hint">{locationInfo.address}</div>
              </div>
            </div>
          </div>

          <form className="order-form" onSubmit={handleSubmit}>
            <h3>Send an inquiry</h3>
            <p className="form-note">
              This form opens WhatsApp with your details filled in. Nothing is
              stored on this site.
            </p>

            <div className="field-row">
              <div className="field">
                <label htmlFor="name">Name</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Your name"
                  value={form.name}
                  onChange={handleChange}
                  autoComplete="name"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="phone">Phone</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+256 or +250 7XX XXX XXX"
                  value={form.phone}
                  onChange={handleChange}
                  autoComplete="tel"
                  required
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="product">Product</label>
              <select id="product" name="product" value={form.product} onChange={handleChange}>
                {PRODUCT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="message">Message</label>
              <textarea
                id="message"
                name="message"
                rows="4"
                placeholder="Quantity, delivery location, preferred date..."
                value={form.message}
                onChange={handleChange}
              />
            </div>

            <button type="submit" className="btn btn-lg form-submit">
              Send inquiry on WhatsApp
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}