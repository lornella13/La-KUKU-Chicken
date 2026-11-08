import { useMapCenter } from '../lib/mapCenter.js'
import { generalOrderLink } from '../data/products.js'

function buildMapEmbedUrl(latitude, longitude) {
  const delta = 0.0018
  const minLng = longitude - delta
  const minLat = latitude - delta
  const maxLng = longitude + delta
  const maxLat = latitude + delta
  return `https://www.openstreetmap.org/export/embed.html?bbox=${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}&layer=mapnik&marker=${latitude}%2C${longitude}`
}

export default function Locations() {
  const { center, title, snippet, isLoading } = useMapCenter()
  const [lat, lng] = center || [0.3023023, 32.5488439]
  const activeTitle = title || 'Red Sea Specialized Medical Services'
  const activeAddress = snippet || 'Near Red Sea Specialized Medical Services, Mugwanya Rd, Kampala, Uganda'
  const embedUrl = buildMapEmbedUrl(lat, lng)

  if (isLoading) {
    return (
      <section id="locations" className="locations">
        <div className="wrap">
          <div className="sec-head sec-head-center">
            <div className="eyebrow eyebrow-center">Locations</div>
            <h2>Find us in Rubaga.</h2>
          </div>
          <div className="p-8 text-center">Loading dynamic store location...</div>
        </div>
      </section>
    )
  }

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
            <div className="info-panel">
              <span className="panel-tag">Active Location</span>
              <h2 className="panel-title">{activeTitle}</h2>
              <div className="panel-address">
                <p className="addr-label">ADDRESS</p>
                <p className="addr-value">{activeAddress}</p>
              </div>
              <div className="panel-hours">
                <p className="hours-label">OPENING HOURS</p>
                <p className="hours-value">Mon - Sat: 7:00 - 20:00</p>
                <p className="hours-value">Sunday: 8:00 - 18:00</p>
              </div>
              <div className="panel-actions">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="directions-btn"
                >
                  Get directions
                </a>
                <a
                  href={generalOrderLink()}
                  target="_blank"
                  rel="noreferrer"
                  className="order-btn"
                >
                  Order now
                </a>
              </div>
            </div>
          </div>

          <div className="map-frame">
            <iframe
              className="map-iframe"
              src={embedUrl}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen=""
              referrerPolicy="no-referrer-when-downgrade"
              title={`Map showing ${activeTitle} location`}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
