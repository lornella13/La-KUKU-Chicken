

export const chickenProducts = [
  {
    id: 'whole-chicken',
    name: 'Whole Chicken',
    unit: 'per kg',
    category: 'chicken',
    variants: [{ label: 'per kg', price: 15000 }],
    sizes: [
      { label: '0.9 - 1 kg', price: 15000, jumbo: false },
      { label: '1.1 - 1.2 kg', price: 18000, jumbo: false },
      { label: '1.3 - 1.4 kg', price: 21000, jumbo: false },
      { label: '1.5 - 1.6 kg', price: 24000, jumbo: true },
      { label: '1.7 - 1.8 kg', price: 28000, jumbo: true },
      { label: '1.9 - 2 kg', price: 30000, jumbo: true },
    ],
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

export const sausagesProducts = [
  {
    id: 'smoked-chicken-sausages',
    name: 'Smoked Chicken Sausages',
    unit: 'per pack',
    category: 'sausages',
    variants: [{ label: 'per pack', price: 18000 }],
    image: '/images/products/smokedchicken.png',
    alt: 'Fully cooked smoked chicken sausages',
    description: 'Fully cooked smoked chicken sausages, ready to eat.',
  },
  {
    id: 'chicken-sausages',
    name: 'Chicken Sausages',
    unit: 'per pack',
    category: 'sausages',
    variants: [{ label: 'per pack', price: 15000 }],
    image: '/images/products/smokedchicken.png',
    alt: 'Half cooked chicken sausages',
    description: 'Half cooked chicken sausages, finish on the grill or in the pan.',
  },
  {
    id: 'hungarian-sausages',
    name: 'Hungarian beef sausages',
    unit: 'per pack',
    category: 'sausages',
    variants: [{ label: 'per pack', price: 22000 }],
    image: '/images/products/hungarian beef saosage.png',
    alt: 'Fully cooked Hungarian style sausages',
    description: 'Fully cooked Hungarian style sausages.',
  },
  {
    id: 'beef-sausages',
    name: 'Beef Sausages',
    unit: 'per pack',
    category: 'sausages',
    variants: [
      { label: 'Half cooked', price: 14000 },
      { label: 'Raw', price: 9000 },
    ],
    image: '/images/products/royalbutchery.png',
    alt: 'Beef sausages',
    description: 'Beef sausages, available half cooked or raw.',
  },
  {
    id: 'minced-meat',
    name: 'Minced Meat',
    unit: 'per kg',
    category: 'sausages',
    variants: [{ label: 'per kg', price: 24000 }],
    image: '/images/products/minced-meat.png',
    alt: 'Fresh minced meat',
    description: 'Fresh minced meat, sold by the kilogram.',
  },
]

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
    blurb: 'Beef and smoked chicken sausages, sold per pack.',
    items: sausagesProducts,
  },
]

export const allProducts = [...chickenProducts, ...sausagesProducts]

export const heroImage = {
  src: '/images/hero/whole-chicken.webp',
  alt: 'Fresh whole dressed chicken, ready for the kitchen',
}

export const WHATSAPP_NUMBER = '256705629568'

const UGANDA_COUNTRY_CODE = '256'
const UGANDA_DIGIT_COUNT = 12

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
  address: 'Mugwanya Road, Rubaga, Kampala, Uganda',
  hours: [
    { days: 'Mon – Sat', time: '7:00 – 20:00' },
    { days: 'Sunday', time: '8:00 – 18:00' },
  ],
  delivery: '24/7',

  mapEmbedUrl:
    'https://www.openstreetmap.org/export/embed.html?bbox=32.54689%2C0.30253%2C32.55289%2C0.30753' +
    '&layer=mapnik&marker=0.30503%2C32.54989',

  directionsUrl:
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent('Mugwanya Road, Rubaga, Kampala, Uganda'),
}

export function isPlaceholder(value) {
  return typeof value === 'string' && /^\s*\[|placeholder/i.test(value)
}

function whatsappLink(message) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}

export function waLink(message) {
  return whatsappLink(message)
}

export function formatPrice(value) {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return '—'
  return `${n.toLocaleString('en-US')}/=`
}

export function productOrderLink(product, variant) {

  const size = product.variants.length > 1 ? ` (${variant.label})` : ''

  const price = formatPrice(variant.price)
  const promo =
    variant.isPromoted && variant.listPrice > variant.price
      ? ` [${variant.promotionLabel} from ${formatPrice(variant.listPrice)}]`
      : ''

  return whatsappLink(
    `Hello La Kuku, I would like to order ${product.name}${size}${promo} - ${price}. Please share availability and ordering details.`,
  )
}

export function generalOrderLink() {
  return whatsappLink(
    'Hello La Kuku, I would like to place an order. Please share availability and ordering details.',
  )
}

export function priceListLink() {
  return whatsappLink(
    'Hello La Kuku, please send me your current price list and ordering details.',
  )
}