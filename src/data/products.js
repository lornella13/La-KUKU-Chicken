/**
 * A purchasable size of a product.
 * @typedef {{ label: string; price: number }} Variant
 *
 * A product shown on one card. Sizes live in `variants` (smallest first) so a
 * product is never duplicated just because it comes in more than one size.
 * @typedef {{
 *   id: string,
 *   name: string,
 *   description: string,
 *   image: string,
 *   alt: string,
 *   unit: string,
 *   category: string,
 *   variants: Variant[],
 * }} Product
 */

export const chickenProducts = [
  {
    id: 'whole-chicken',
    name: 'Whole Chicken',
    unit: 'per kg',
    category: 'chicken',
    variants: [{ label: 'per kg', price: 15000 }],
    image: '/images/products/wholechicken.png',
    alt: 'Fresh whole dressed chicken',
    description: 'One whole bird, dressed and ready for the pot, grill or roaster.',
  },
  {
    id: 'mixed-portion',
    name: 'Mixed Portion',
    unit: 'per kg',
    category: 'chicken',
    variants: [{ label: 'per kg', price: 15000 }],
    image: '/images/products/mixed.png',
    alt: 'Fresh mixed chicken portion',
    description: 'A mixed pack of cuts when you want variety in one purchase.',
  },
  {
    id: 'whole-leg',
    name: 'Whole Leg',
    unit: 'per kg',
    category: 'chicken',
    variants: [{ label: 'per kg', price: 17000 }],
    image: '/images/products/leg.png',
    alt: 'Fresh whole chicken leg',
    description: 'Thigh and drumstick kept together, the classic fry or roast portion.',
  },
  {
    id: 'drumsticks',
    name: 'Drumsticks',
    unit: 'per kg',
    category: 'chicken',
    variants: [{ label: 'per kg', price: 18000 }],
    image: '/images/products/drumsticks.png',
    alt: 'Fresh chicken drumsticks',
    description: 'A firm, meaty drumstick that stays juicy through long cooking.',
  },
  {
    id: 'wings',
    name: 'Wings',
    unit: 'per kg',
    category: 'chicken',
    variants: [{ label: 'per kg', price: 17000 }],
    image: '/images/products/wings.png',
    alt: 'Fresh chicken wings',
    description: 'Wings with the skin on, portioned for frying, grilling or stewing.',
  },
  {
    id: 'thighs',
    name: 'Thighs',
    unit: 'per kg',
    category: 'chicken',
    variants: [{ label: 'per kg', price: 16000 }],
    image: '/images/products/thighs.png',
    alt: 'Fresh chicken thighs',
    description: 'Bone-in thighs, forgiving to cook and hard to dry out.',
  },
  {
    id: 'breast-fillets',
    name: 'Breast Fillets',
    unit: 'per kg',
    category: 'chicken',
    variants: [{ label: 'per kg', price: 22000 }],
    image: '/images/products/breat_fillet.png',
    alt: 'Fresh chicken breast fillets',
    description: 'Skinless fillets, trimmed and ready to slice, grill or dice.',
  },
  {
    id: 'gizzards',
    name: 'Gizzards',
    unit: 'per kg',
    category: 'chicken',
    variants: [{ label: 'per kg', price: 18000 }],
    image: '/images/products/gizzards.png',
    alt: 'Fresh chicken gizzards',
    description: 'A traditional offal, sold for stews, sauces and slow cooking.',
  },
  {
    id: 'liver',
    name: 'Liver',
    unit: 'per kg',
    category: 'chicken',
    variants: [{ label: 'per kg', price: 10000 }],
    image: '/images/products/liver.png',
    alt: 'Fresh chicken liver',
    description: 'Fresh liver for sautéing, stews and traditional dishes.',
  },
  {
    id: 'necks',
    name: 'Necks',
    unit: 'per kg',
    category: 'chicken',
    variants: [{ label: 'per kg', price: 9000 }],
    image: '/images/products/neck.png',
    alt: 'Fresh chicken necks',
    description: 'Necks with plenty of connective tissue for rich stocks.',
  },
  {
    id: 'backs',
    name: 'Backs',
    unit: 'per kg',
    category: 'chicken',
    variants: [{ label: 'per kg', price: 9000 }],
    image: '/images/products/back.png',
    alt: 'Fresh chicken backs',
    description: 'Backs for stock, broth and slow-simmered sauces.',
  },
]

export const sausageProducts = [
  {
    id: 'smoked-chicken-sausage',
    name: 'Smoked Chicken Sausage',
    unit: 'per pack',
    category: 'sausages',
    variants: [{ label: 'per pack', price: 18000 }],
    image: '/images/products/smokedchicken.png',
    alt: 'Fully cooked smoked chicken sausage',
    description: 'Fully cooked smoked chicken sausage, ready to eat.',
  },
  {
    id: 'chicken-sausage',
    name: 'Chicken Sausage',
    unit: 'per pack',
    category: 'sausages',
    variants: [{ label: 'per pack', price: 15000 }],
    image: '/images/products/chicken-sausage.png',
    alt: 'Half cooked chicken sausage',
    description: 'Half cooked chicken sausage, finish on the grill or in the pan.',
  },
  {
    id: 'hungarian-sausage',
    name: 'Hungarian Sausage',
    unit: 'per pack',
    category: 'sausages',
    variants: [{ label: 'per pack', price: 22000 }],
    image: '/images/products/hungarian beef saosage.png',
    alt: 'Fully cooked Hungarian style sausage',
    description: 'Fully cooked Hungarian style sausage.',
  },
  {
    id: 'beef-sausage',
    name: 'Beef Sausage',
    unit: 'per pack',
    category: 'sausages',
    variants: [
      { label: 'Half cooked', price: 14000 },
      { label: 'Raw', price: 9000 },
    ],
    image: '/images/products/royalbutchery.png',
    alt: 'Beef sausage',
    description: 'Beef sausage, available half cooked or raw.',
  },
  {
    id: 'minced-meat',
    name: 'Minced Meat',
    unit: 'per kg',
    category: 'sausages',
    variants: [{ label: 'per kg', price: 22000 }],
    image: '/images/products/minced-meat.png',
    alt: 'Fresh minced meat',
    description: 'Fresh minced meat, sold by the kilogram.',
  },
]

// Grouped once so sections can render, filter and label them from one source.
export const productGroups = [
  {
    id: 'chicken',
    label: 'Chicken',
    blurb: 'Sold per kilogram, dressed fresh or frozen on request.',
    items: chickenProducts,
  },
  {
    id: 'sausages',
    label: 'Sausages',
    blurb: 'Beef and smoked chicken sausage, sold per pack.',
    items: sausageProducts,
  },
]

export const allProducts = [...chickenProducts, ...sausageProducts]

export const heroImage = {
  src: '/images/hero/whole-chicken.webp',
  alt: 'Fresh whole dressed chicken, ready for the kitchen',
}

/* ==========================================================================
   WhatsApp number — THE single source of truth for every WhatsApp link.

   Format rules (wa.me takes the bare international number):
     - digits only
     - no '+', spaces, dashes or parentheses
     - no leading zero on the national part
     - country code 256, then the 9-digit national number  =>  12 digits
       (mobile 0776 023983, fixed line 020 123 3983, etc.)

   Fix this one constant and every link, display string and tel: link follows.
   ========================================================================== */
export const WHATSAPP_NUMBER = '256761023983'

const UGANDA_COUNTRY_CODE = '256'
const UGANDA_DIGIT_COUNT = 12 // 256 + 9 national digits

/**
 * True when the number is digits-only and a full 12-digit Ugandan number.
 * Used to fail loudly in development instead of shipping dead order links.
 */
export function isValidWhatsAppNumber(value) {
  return (
    typeof value === 'string' &&
    /^[0-9]+$/.test(value) &&
    value.length === UGANDA_DIGIT_COUNT &&
    value.startsWith(UGANDA_COUNTRY_CODE)
  )
}

if (import.meta.env?.DEV && !isValidWhatsAppNumber(WHATSAPP_NUMBER)) {
  console.warn(
    `[contact] WHATSAPP_NUMBER "${WHATSAPP_NUMBER}" is not a valid Ugandan ` +
      `WhatsApp number: expected ${UGANDA_DIGIT_COUNT} digits starting with ` +
      `${UGANDA_COUNTRY_CODE} (country code + 9-digit national number), ` +
      `digits only, no leading zero. Got ${WHATSAPP_NUMBER.length} digits. ` +
      `WhatsApp order links will not work until this is corrected.`,
  )
}

// Human-readable forms are derived from the constant so they cannot drift.
const nationalDigits = WHATSAPP_NUMBER.slice(UGANDA_COUNTRY_CODE.length)
const groupedNumber = nationalDigits.replace(/^(\d{3})(\d+)$/, '$1 $2')

export const contactInfo = {
  whatsapp: WHATSAPP_NUMBER,
  whatsappDisplay: `+${UGANDA_COUNTRY_CODE} ${groupedNumber}`,
  phone: `+${WHATSAPP_NUMBER}`,
  phoneDisplay: `+${UGANDA_COUNTRY_CODE} ${groupedNumber}`,
  email: 'ssuubichristian@gmail.com',
}

export const locationInfo = {
  branchName: 'Rubaga Branch',
  address: 'Mugwanya Road, next to Lubiri SS, Rubaga, Kampala, Uganda',
  hours: [
    { days: 'Mon – Sat', time: '7:00 – 20:00' },
    { days: 'Sunday', time: '8:00 – 18:00' },
  ],
  delivery: '24/7',
  // The old `maps.google.com/maps?...&output=embed` URL is retired by Google
  // and now renders a blank white frame, so the map uses OpenStreetMap's
  // embed instead: no API key, no quota, always renders.
  //
  // Marker is the geocoded point for Lubiri Secondary School (0.30503, 32.54989),
  // which is what the address anchors to ("Mugwanya Road, next to Lubiri SS").
  // Approximate -- drop a pin on the exact shopfront in OpenStreetMap and copy
  // the marker/bbox values here if the shop sits further along the road.
  mapEmbedUrl:
    'https://www.openstreetmap.org/export/embed.html?bbox=32.5434%2C0.3005%2C32.5564%2C0.3096' +
    '&layer=mapnik&marker=0.30503%2C32.54989',
  // Opens the full map in a new tab; still Google Maps, which is what people
  // here use for navigation.
  directionsUrl:
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent('Lubiri SS, Mugwanya Road, Rubaga, Kampala, Uganda'),
}

/**
 * Placeholder-safe rendering: site copy still awaiting real values is shown as
 * a clearly marked "to be confirmed" note instead of leaking raw
 * `[Placeholder ...]` text to visitors. The original string is kept in the
 * title attribute so the shop owner can still read and replace it.
 */
export function isPlaceholder(value) {
  return typeof value === 'string' && /^\s*\[|placeholder/i.test(value)
}

/**
 * Builds a wa.me deep link with the message pre-filled.
 *
 * Every WhatsApp link on the site goes through here, so the URL shape is
 * defined in exactly one place:
 *   https://wa.me/<WHATSAPP_NUMBER>?text=<encodeURIComponent(message)>
 * One helper for every entry point, so no message text is hand-written twice.
 */
function whatsappLink(message) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}

/** Builds a wa.me deep link with the message pre-filled. */
export function waLink(message) {
  return whatsappLink(message)
}

/** Formats a variant price the way it is shown on the card: 21000 -> "21,000/=". */
export function formatPrice(value) {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return '—'
  return `${n.toLocaleString('en-US')}/=`
}

/** Pre-filled order enquiry for a product at one specific size. */
export function productOrderLink(product, variant) {
  // Size only appears in the message when it is a real choice, so the
  // single-size cuts read as a plain product name.
  const size = product.variants.length > 1 ? ` (${variant.label})` : ''

  // The message quotes the price the customer was actually shown, so a
  // promotion cannot produce a mismatch between the card and the order.
  // When a promotion is live the original price is included for the shop's
  // records, and the message is percent-encoded by whatsappLink.
  const price = formatPrice(variant.price)
  const promo =
    variant.isPromoted && variant.listPrice > variant.price
      ? ` [${variant.promotionLabel} from ${formatPrice(variant.listPrice)}]`
      : ''

  return whatsappLink(
    `Hello La Kuku, I would like to order ${product.name}${size}${promo} - ${price}. Please share availability and ordering details.`,
  )
}

/** Generic order enquiry (hero, navbar, floating button, pre-footer CTA). */
export function generalOrderLink() {
  return whatsappLink(
    'Hello La Kuku, I would like to place an order. Please share availability and ordering details.',
  )
}

/** Pre-filled enquiry for the full list. */
export function priceListLink() {
  return whatsappLink(
    'Hello La Kuku, please send me your current price list and ordering details.',
  )
}