import { locationInfo, isPlaceholder, generalOrderLink } from '../data/products.js'

/** Renders a value, or a marked "to be confirmed" note when it is still a stub. */
function Detail({ value, children }) {
  if (isPlaceholder(value)) {
    return (
      <span className="todo" title={value}>
        {children ?? 'To be confirmed'}
      </span>
    )
  }
  return <p>{value}</p>
}

const ICONS = {
  pin: (
    <>
      <path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </>
  ),
  scooter: (
    <>
      <circle cx="6" cy="17" r="3" />
      <circle cx="18" cy="17" r="3" />
      <path d="M9 17h6M6 14V7h4l3 5h3" />
    </>
  ),
}

function Row({ icon, label, children }) {
  return (
    <div className="loc-row">
      <span className="ic" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          {ICONS[icon]}
        </svg>
      </span>
      <div>
        <strong>{label}</strong>
        {children}
      </div>
    </div>
  )
}

export default function Locations() {
  return (
    <section id="locations" className="locations">
      <div className="wrap">
        <div className="sec-head sec-head-center">
          <div className="eyebrow eyebrow-center">Locations</div>
          <h2>Find us in Rubaga.</h2>
          <p>
            One shop today, built to scale. Visit the counter to pick up, or
            message us on WhatsApp before you travel.
          </p>
        </div>

        <div className="loc-grid">
          <div className="loc-card">
            <h3>{locationInfo.branchName}</h3>

            <Row icon="pin" label="Address">
              <p>{locationInfo.address}</p>
            </Row>

            <Row icon="clock" label="Opening hours">
              <table className="hours-table">
                <caption className="sr-only">Opening hours for {locationInfo.branchName}</caption>
                <tbody>
                  {locationInfo.hours.map((h) => (
                    <tr key={h.days}>
                      <th scope="row">{h.days}</th>
                      <td>
                        {isPlaceholder(h.time) ? (
                          <span className="todo" title={h.time}>To be confirmed</span>
                        ) : (
                          h.time
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Row>

            <Row icon="scooter" label="Delivery">
              <Detail value={locationInfo.delivery} />
            </Row>

            <div className="loc-actions">
              <a
                href={locationInfo.directionsUrl}
                target="_blank"
                rel="noreferrer"
                className="btn ghost"
              >
                Get directions
              </a>
              <a href={generalOrderLink()} target="_blank" rel="noreferrer" className="btn">
                Order on WhatsApp
              </a>
            </div>
          </div>

          <div className="map-frame">
            <iframe
              className="map-iframe"
              src={locationInfo.mapEmbedUrl}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen=""
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Map showing La Kuku Chicken Rubaga Branch location"
            />
          </div>
        </div>
      </div>
    </section>
  )
}