import { generalOrderLink } from '../data/products.js'

export default function WhatsAppFloat() {
  return (
    <a
      className="wa-float"
      href={generalOrderLink()}
      target="_blank"
      rel="noreferrer"
      aria-label="Order now"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
        <path d="M21 11.5a8.5 8.5 0 0 1-12.35 7.6L3 20l1-5.5A8.5 8.5 0 1 1 21 11.5z" />
      </svg>
    </a>
  )
}