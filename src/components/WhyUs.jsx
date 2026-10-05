const REASONS = [
  {
    title: 'Quality',
    body: 'Premium quality always. The same standard across every cut, from a single breast fillet to a full sausage pack.',
    icon: 'shield',
  },
  {
    title: 'Freshness',
    body: 'Fresh and frozen stock, not fried. Dressed to order so you receive raw chicken ready for your own cooking.',
    icon: 'leaf',
  },
  {
    title: 'Convenience',
    body: 'Order now in a few taps, pick up in Rubaga, and get a published price per kilo before you commit.',
    icon: 'bolt',
  },
]

const ICONS = {
  shield: (
    <path d="M12 3l7 3v5c0 4.4-2.9 8.3-7 9.5C7.9 19.3 5 15.4 5 11V6l7-3z" />
  ),
  leaf: (
    <>
      <path d="M4 20c0-8 5-13 16-14 0 10-5 15-16 14z" />
      <path d="M9 15c2-2 4-3.5 7-4.5" />
    </>
  ),
  bolt: <path d="M13 3L5 13h6l-1 8 8-10h-6l1-8z" />,
}

export default function WhyUs() {
  return (
    <section id="why" className="why">
      <div className="wrap">
        <div className="sec-head sec-head-center">
          <div className="eyebrow eyebrow-center">Why La Kuku?</div>
          <h2>Three reasons Kampala kitchens order from us.</h2>
        </div>

        <ul className="why-grid">
          {REASONS.map((reason) => (
            <li className="why-card" key={reason.title}>
              <span className="why-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  {ICONS[reason.icon]}
                </svg>
              </span>
              <h3>{reason.title}</h3>
              <p>{reason.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}