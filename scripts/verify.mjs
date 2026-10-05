/**
 * Offline verification of the parts that do not need a live database:
 * money/promotion arithmetic, card grouping, input validation, upload sniffing,
 * and secret scanning.
 *
 * Run with:  node scripts/verify.mjs
 *
 * These tests deliberately cover the pure logic only. Anything requiring a real
 * Supabase project (RLS enforcement, auth, storage) CANNOT be verified here and
 * is listed in ADMIN_SETUP.md as a manual check.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

let passed = 0
const failures = []

function check(name, fn) {
  try {
    fn()
    passed++
  } catch (err) {
    failures.push(`${name}: ${err.message}`)
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed')
}

function equal(actual, expected, msg) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${msg || 'mismatch'}: got ${a}, expected ${e}`)
}

// Import the modules under test. They are plain ESM with no DOM dependency
// except imageUpload's browser APIs, which are only touched inside functions.
const pricing = await import(join(root, 'src/lib/pricing.js'))
const group = await import(join(root, 'src/lib/groupProducts.js'))
const validation = await import(join(root, 'src/lib/validation.js'))

const { effectivePrice, formatPrice, promotionLabel, isPromotionLive } = pricing
const { groupRowsIntoCards, uniqueProductNames } = group
const { parsePriceInput, validatePromotion, validateImageUrl, validateProduct } = validation

// ---------------------------------------------------------------------------
// Money formatting
// ---------------------------------------------------------------------------
check('formatPrice renders whole UGX the way the site does', () => {
  equal(formatPrice(21000), '21,000/=')
  equal(formatPrice(0), '0/=')
  equal(formatPrice(16000), '16,000/=')
})

check('formatPrice never throws on bad input', () => {
  assert(formatPrice(undefined) === '—', 'undefined should render as em dash')
  assert(formatPrice(null) === '—', 'null should render as em dash')
  assert(formatPrice('abc') === '—', 'non-numeric should render as em dash')
})

// ---------------------------------------------------------------------------
// Promotion arithmetic — the security-critical part.
// ---------------------------------------------------------------------------
check('percentage discount is exact on integers', () => {
  equal(effectivePrice(16000, { discount_type: 'percentage', discount_value: 10 }), 14400)
  equal(effectivePrice(21000, { discount_type: 'percentage', discount_value: 10 }), 18900)
  equal(effectivePrice(12000, { discount_type: 'percentage', discount_value: 50 }), 6000)
})

check('no float drift on a value that would break with floats', () => {
  // 0.9 * 21000 is 18900.000000000002 in IEEE 754.
  equal(effectivePrice(21000, { discount_type: 'percentage', discount_value: 10 }), 18900)
  // 33% of 1250 is 412.5 -> must round half-up to 838, not 837.4999...
  equal(effectivePrice(1250, { discount_type: 'percentage', discount_value: 33 }), 838)
})

check('percentage rounds half-up', () => {
  equal(effectivePrice(1005, { discount_type: 'percentage', discount_value: 50 }), 503) // 502.5 -> 503
  equal(effectivePrice(1007, { discount_type: 'percentage', discount_value: 50 }), 504) // 503.5 -> 504
})

check('fixed amount subtracts and clamps at zero', () => {
  equal(effectivePrice(16000, { discount_type: 'fixed_amount', discount_value: 2000 }), 14000)
  equal(effectivePrice(1000, { discount_type: 'fixed_amount', discount_value: 5000 }), 0)
})

check('100% and 0% behave at the boundaries', () => {
  equal(effectivePrice(16000, { discount_type: 'percentage', discount_value: 100 }), 0)
  equal(effectivePrice(16000, { discount_type: 'percentage', discount_value: 0 }), 16000)
})

check('invalid discounts are ignored rather than applied', () => {
  // A negative or NaN discount must never reduce or inflate a price.
  equal(effectivePrice(16000, { discount_type: 'percentage', discount_value: -5 }), 16000)
  equal(effectivePrice(16000, { discount_type: 'percentage', discount_value: NaN }), 16000)
  equal(effectivePrice(16000, { discount_type: 'percentage', discount_value: 'abc' }), 16000)
  equal(effectivePrice(16000, { discount_type: 'percentage', discount_value: 0 }), 16000)
  equal(effectivePrice(16000, { discount_type: 'fixed_amount', discount_value: -1000 }), 16000)
  equal(effectivePrice(16000, { discount_type: 'unknown_type', discount_value: 50 }), 16000)
})

check('promotion never produces a negative price', () => {
  for (const price of [0, 1, 500, 999, 16000, 1000000]) {
    for (const v of [1, 10, 50, 99, 100]) {
      const out = effectivePrice(price, { discount_type: 'percentage', discount_value: v })
      assert(out >= 0, `negative result for ${price}/${v}`)
    }
    for (const v of [0, 1, 999, 5000, 999999]) {
      const out = effectivePrice(price, { discount_type: 'fixed_amount', discount_value: v })
      assert(out >= 0, `negative result for ${price} fixed ${v}`)
    }
  }
})

check('promotion label formatting', () => {
  equal(promotionLabel({ discount_type: 'percentage', discount_value: 10 }), '10% OFF')
  equal(promotionLabel({ discount_type: 'percentage', discount_value: '12.50' }), '12.5% OFF')
  equal(promotionLabel({ discount_type: 'fixed_amount', discount_value: 2000 }), '2,000 OFF')
  equal(promotionLabel(null), null)
})

check('promotion window uses calendar dates, not timezones', () => {
  const promo = {
    is_active: true,
    start_date: '2026-10-02',
    end_date: '2026-10-05',
  }
  assert(isPromotionLive(promo, new Date(2026, 9, 2, 23, 59)), 'start day is inclusive')
  assert(isPromotionLive(promo, new Date(2026, 9, 5, 0, 1)), 'end day is inclusive')
  assert(!isPromotionLive(promo, new Date(2026, 9, 6)), 'day after end is expired')
  assert(!isPromotionLive(promo, new Date(2026, 9, 1)), 'day before start is not live')
  assert(!isPromotionLive({ ...promo, is_active: false }, new Date(2026, 9, 3)), 'inactive is not live')
})

// ---------------------------------------------------------------------------
// Price input parsing — the Phase 8 attack surface.
// ---------------------------------------------------------------------------
check('malformed prices are rejected', () => {
  const bad = ['', '   ', 'abc', '-1', '-0.01', 'NaN', 'Infinity', '1e999', '1,2,3', '12abc', '0x10', '.']
  for (const input of bad) {
    const r = parsePriceInput(input)
    assert(!r.ok, `should have rejected ${JSON.stringify(input)}`)
    assert(typeof r.error === 'string' && r.error.length > 0, 'rejection needs a message')
  }
})

check('valid prices are accepted', () => {
  equal(parsePriceInput('16000').value, 16000)
  equal(parsePriceInput(' 21000 ').value, 21000)
  equal(parsePriceInput('16,000').value, 16000)
  equal(parsePriceInput('0').value, 0)
})

check('fractional shillings are rejected', () => {
  assert(!parsePriceInput('16000.50').ok, 'sub-shilling precision should be refused')
})

// ---------------------------------------------------------------------------
// Image URL validation — XSS / SSRF-adjacent input.
// ---------------------------------------------------------------------------
check('dangerous image URL schemes are rejected', () => {
  const bad = [
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'http://insecure.example.com/a.png',
    '//evil.example.com/a.png',
    '/images/../../etc/passwd',
  ]
  for (const url of bad) {
    const r = validateImageUrl(url)
    assert(!r.ok, `should have rejected ${url}`)
  }
})

check('legitimate image URLs are accepted', () => {
  assert(validateImageUrl('').ok, 'empty is allowed (means no image)')
  equal(validateImageUrl('').value, null)
  assert(validateImageUrl('/images/products/wings.png').ok, 'site-relative path')
  assert(validateImageUrl('https://abc.supabase.co/storage/v1/o/p/1.png').ok, 'https URL')
})

// ---------------------------------------------------------------------------
// Product validation
// ---------------------------------------------------------------------------
check('product validation requires the important fields', () => {
  const r = validateProduct({ name: '  ', price: '', category: '', unit: '' })
  assert(!r.ok, 'blank product should be rejected')
  assert(r.errors.name, 'name error expected')
  assert(r.errors.price, 'price error expected')
  assert(r.errors.category, 'category error expected')
  assert(r.errors.unit, 'unit error expected')
})

check('a valid product passes and is normalised', () => {
  const r = validateProduct({
    name: '  Chicken Wings  ',
    description: '  tasty  ',
    price: '16,000',
    unit: ' per kg ',
    category: 'Chicken',
    image_url: '',
    is_available: true,
  })
  assert(r.ok, 'should be valid')
  equal(r.value.name, 'Chicken Wings')
  equal(r.value.price, 16000)
  equal(r.value.image_url, null)
})

// ---------------------------------------------------------------------------
// Promotion validation — mirrors the database CHECK constraints.
// ---------------------------------------------------------------------------
check('promotion validation rejects out-of-range discounts', () => {
  const base = { name: 'Deal', start_date: '2026-10-02', end_date: '2026-10-05' }

  assert(!validatePromotion({ ...base, discount_type: 'percentage', discount_value: 0 }).ok, '0% refused')
  assert(!validatePromotion({ ...base, discount_type: 'percentage', discount_value: 101 }).ok, '101% refused')
  assert(!validatePromotion({ ...base, discount_type: 'percentage', discount_value: -5 }).ok, 'negative refused')
  assert(!validatePromotion({ ...base, discount_type: 'percentage', discount_value: 100 }).ok === false, '100% allowed')
  assert(!validatePromotion({ ...base, discount_type: 'fixed_amount', discount_value: -1 }).ok, 'negative fixed refused')
  assert(validatePromotion({ ...base, discount_type: 'fixed_amount', discount_value: 0.5 }).ok === false, 'sub-shilling fixed refused')
})

check('promotion validation rejects a backwards date range', () => {
  const r = validatePromotion({
    name: 'Deal',
    discount_type: 'percentage',
    discount_value: 10,
    start_date: '2026-10-05',
    end_date: '2026-10-02',
  })
  assert(!r.ok)
  assert(r.errors.end_date, 'end_date error expected')
})

check('promotion validation rejects an unknown discount type', () => {
  const r = validatePromotion({
    name: 'Deal',
    discount_type: 'free',
    discount_value: 100,
    start_date: '2026-10-02',
    end_date: '2026-10-05',
  })
  assert(!r.ok)
  assert(r.errors.discount_type)
})

// ---------------------------------------------------------------------------
// Card grouping — must preserve the existing 15-card / 18-variant design.
// ---------------------------------------------------------------------------
check('variants regroup into one card per name', () => {
  const rows = [
    { name: 'Wings', category: 'Chicken', unit: 'per kg', description: 'd', image_url: '/a.png', list_price: 12000, current_price: 12000, variant_label: '500g', sort_order: 0, is_available: true },
    { name: 'Wings', category: 'Chicken', unit: 'per kg', description: 'd', image_url: '/a.png', list_price: 21000, current_price: 21000, variant_label: '1kg', sort_order: 1, is_available: true },
    { name: 'Thighs', category: 'Chicken', unit: 'per kg', description: 'd', image_url: '/b.png', list_price: 15000, current_price: 15000, variant_label: null, sort_order: 0, is_available: true },
    { name: 'Sausage', category: 'Sausages', unit: 'per kg', description: 'd', image_url: '/c.png', list_price: 16000, current_price: 16000, variant_label: null, sort_order: 0, is_available: true },
  ]

  const groups = groupRowsIntoCards(rows)
  equal(groups.length, 2, 'two category groups')
  equal(groups[0].label, 'Chicken')
  equal(groups[0].items.length, 2, 'two cards in Chicken')
  equal(groups[1].items.length, 1, 'one card in Sausages')

  const wings = groups[0].items[0]
  equal(wings.name, 'Wings')
  equal(wings.variants.length, 2, 'one card keeps both size buttons')
  equal(wings.variants[0].label, '500g')
  equal(wings.variants[0].price, 12000)
  equal(wings.variants[1].price, 21000)
})

check('sizes are ordered smallest first when sort_order is absent', () => {
  const rows = [
    { name: 'Choma', category: 'Chicken', unit: 'per kg', description: 'd', image_url: '/a.png', list_price: 21000, current_price: 21000, variant_label: '1kg', is_available: true },
    { name: 'Choma', category: 'Chicken', unit: 'per kg', description: 'd', image_url: '/a.png', list_price: 12000, current_price: 12000, variant_label: '500g', is_available: true },
  ]
  const card = groupRowsIntoCards(rows)[0].items[0]
  equal(card.variants[0].label, '500g', 'smallest first')
  equal(card.variants[1].label, '1kg')
})

check('a promoted row carries the discount to the card', () => {
  const rows = [
    {
      name: 'Wings', category: 'Chicken', unit: 'per kg', description: 'd',
      image_url: '/a.png', list_price: 16000, current_price: 14400,
      variant_label: null, is_available: true,
      is_promoted: true, discount_type: 'percentage', discount_value: 10,
    },
  ]
  const card = groupRowsIntoCards(rows)[0].items[0]
  assert(card.onPromotion, 'card should be flagged as on promotion')
  equal(card.variants[0].price, 14400, 'customer pays the discounted price')
  equal(card.variants[0].listPrice, 16000, 'original price retained')
  equal(card.variants[0].promotionLabel, '10% OFF')
})

check('curated order is preserved, not re-sorted by price', () => {
  // The shop arranged Whole Chicken first and Royal Butchery last. A card whose
  // sort_order says "early" must stay early even though it is not the cheapest.
  const rows = [
    { name: 'Royal Butchery', category: 'Sausages', unit: 'per kg', description: 'd', image_url: '/c.png', list_price: 5000, current_price: 5000, variant_label: null, sort_order: 1400, is_available: true },
    { name: 'Whole Chicken', category: 'Chicken', unit: 'per kg', description: 'd', image_url: '/a.png', list_price: 14000, current_price: 14000, variant_label: null, sort_order: 0, is_available: true },
    { name: 'Liver', category: 'Chicken', unit: 'per kg', description: 'd', image_url: '/b.png', list_price: 8000, current_price: 8000, variant_label: null, sort_order: 800, is_available: true },
  ]
  const groups = groupRowsIntoCards(rows)
  const chicken = groups.find((g) => g.label === 'Chicken')
  equal(chicken.items.map((i) => i.name), ['Whole Chicken', 'Liver'], 'sorted by sort_order')
  // Sausages must still come after Chicken regardless of price.
  equal(groups.map((g) => g.label), ['Chicken', 'Sausages'])
})

check('a multi-size product keeps both sizes ordered smallest first', () => {
  const rows = [
    { name: 'Wings', category: 'Chicken', unit: 'per kg', description: 'd', image_url: '/a.png', list_price: 12000, current_price: 12000, variant_label: '500g', sort_order: 400, is_available: true },
    { name: 'Wings', category: 'Chicken', unit: 'per kg', description: 'd', image_url: '/a.png', list_price: 21000, current_price: 21000, variant_label: '1kg', sort_order: 401, is_available: true },
  ]
  const card = groupRowsIntoCards(rows)[0].items[0]
  equal(card.variants.map((v) => v.label), ['500g', '1kg'])
  equal(card.variants.map((v) => v.price), [12000, 21000])
})

check('unique product names for the contact dropdown', () => {
  const rows = [
    { name: 'Wings' }, { name: 'Wings' }, { name: 'Thighs' },
  ]
  equal(uniqueProductNames(rows), ['Wings', 'Thighs'])
})

// ---------------------------------------------------------------------------
// Secret scanning — the checks that matter most.
// ---------------------------------------------------------------------------
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

const files = [
  ...walk(join(root, 'src')),
  ...walk(join(root, 'public')),
  ...walk(join(root, 'scripts')),
  ...walk(join(root, 'supabase')),
  join(root, 'index.html'),
  join(root, 'vercel.json'),
  join(root, 'package.json'),
].filter((f) => /\.(js|jsx|mjs|css|html|json|sql|webmanifest)$/.test(f))

const SECRET_PATTERNS = [
  { name: 'service_role in a string literal', re: /service_role['"\s]*[:=]\s*['"][A-Za-z0-9._-]{20,}/ },
  { name: 'hard-coded JWT (anon/service)', re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: 'sb_secret_ key', re: /sb_secret_[A-Za-z0-9_-]{10,}/ },
  { name: 'generic secret assignment', re: /\b(SUPABASE_SERVICE_ROLE_KEY|service_role_key|SECRET_KEY)\s*[:=]\s*['"][^'"]{12,}['"]/ },
  { name: 'hard-coded password literal', re: /password\s*[:=]\s*['"][^'"]{3,}['"]/i },
]

/**
 * Strip comments before scanning.
 *
 * Necessary: this codebase documents its own security decisions in prose, and a
 * scanner that matched those comments would either cry wolf or force the
 * documentation to be deleted. Only executable code is scanned.
 */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:\\])\/\/[^\n]*/g, '$1 ')
}

check('no secrets committed in source or public assets', () => {
  const hits = []
  for (const file of files) {
    const text = stripComments(readFileSync(file, 'utf8'))
    for (const { name, re } of SECRET_PATTERNS) {
      if (re.test(text)) hits.push(`${name} in ${file.replace(root, '.')}`)
    }
  }
  assert(hits.length === 0, `secret-like patterns found:\n  ${hits.join('\n  ')}`)
})

check('no dangerouslySetInnerHTML anywhere', () => {
  const hits = []
  for (const file of files.filter((f) => /\.(js|jsx)$/.test(f))) {
    if (stripComments(readFileSync(file, 'utf8')).includes('dangerouslySetInnerHTML')) {
      hits.push(file.replace(root, '.'))
    }
  }
  assert(hits.length === 0, `dangerouslySetInnerHTML found in: ${hits.join(', ')}`)
})

check('every RLS-enabled table actually has RLS enabled in the migrations', () => {
  const sql = readdirSync(join(root, 'supabase/migrations'))
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(join(root, 'supabase/migrations', f), 'utf8'))
    .join('\n')

  const tables = ['products', 'promotions', 'promotion_products', 'admin_profiles', 'audit_logs']
  for (const table of tables) {
    assert(
      new RegExp(`alter table (public\\.)?${table} enable row level security`, 'i').test(sql),
      `${table} is never given ENABLE ROW LEVEL SECURITY`,
    )
  }
})

check('no permissive USING(true)/WITH CHECK(true) write policy exists', () => {
  const sql = readdirSync(join(root, 'supabase/migrations'))
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(join(root, 'supabase/migrations', f), 'utf8'))
    .join('\n')

  // Find every CREATE POLICY and check the body of write policies.
  const policies = sql.split(/create policy/i).slice(1)
  for (const chunk of policies) {
    const isWrite = /\bfor\s+(insert|update|delete|all)\b/i.test(chunk)
    if (!isWrite) continue
    const body = chunk.slice(0, chunk.indexOf(';') + 1)
    assert(
      !/\busing\s*\(\s*true\s*\)/i.test(body),
      `permissive USING(true) in policy: ${body.split('\n')[0].trim()}`,
    )
    assert(
      !/\bwith check\s*\(\s*true\s*\)/i.test(body),
      `permissive WITH CHECK(true) in policy: ${body.split('\n')[0].trim()}`,
    )
  }
})

check('the service-role key is never reachable from frontend code', () => {
  const frontend = [...walk(join(root, 'src')), join(root, 'index.html')]

  // Precise patterns for real misuse, rather than the word "service_role",
  // which legitimately appears in the explanatory comments of env.js.
  const badPatterns = [
    /import\.meta\.env\.VITE_[A-Z0-9_]*(SERVICE|SECRET|PRIVATE)[A-Z0-9_]*/,
    /VITE_[A-Z0-9_]*(SERVICE|SECRET|PRIVATE)[A-Z0-9_]*\s*[=:]/,
    /createBrowserClient|createClient\([^)]*SERVICE_ROLE/is,
    /\bsupabase\.service_role\b/,
    /\bsb_secret_[A-Za-z0-9_-]{8,}/,
  ]

  for (const file of frontend.filter((f) => /\.(js|jsx|html)$/.test(f))) {
    const text = stripComments(readFileSync(file, 'utf8'))
    for (const re of badPatterns) {
      assert(
        !re.test(text),
        `frontend can reach the service-role key: ${file.replace(root, '.')}`,
      )
    }
  }
})

check('the browser only ever reads the publishable key', () => {
  // Every env var the frontend reads must be on the allow-list.
  const allow = new Set([
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    // Vite's own compile-time built-ins, not project secrets.
    'PROD',
    'DEV',
    'MODE',
    'BASE_URL',
  ])
  const hits = []
  for (const file of walk(join(root, 'src')).filter((f) => /\.(js|jsx)$/.test(f))) {
    const text = stripComments(readFileSync(file, 'utf8'))
    for (const m of text.matchAll(/import\.meta\.env\.([A-Z0-9_]+)/g)) {
      if (!allow.has(m[1])) hits.push(`${m[1]} in ${file.replace(root, '.')}`)
    }
  }
  assert(hits.length === 0, `unexpected env vars read by the frontend:\n  ${hits.join('\n  ')}`)
})

check('.env is git-ignored and .env.example holds placeholders only', () => {
  const gitignore = readFileSync(join(root, '.gitignore'), 'utf8')
  assert(/^\.env$/m.test(gitignore), '.env must be ignored')
  assert(/^\.env\.\*$/m.test(gitignore), '.env.* must be ignored')
  assert(/!\.env\.example/m.test(gitignore), '.env.example must stay tracked')

  const example = readFileSync(join(root, '.env.example'), 'utf8')
  const values = example
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
  for (const line of values) {
    const value = line.split('=')[1].trim()
    assert(
      /YOUR_|https:\/\/YOUR-PROJECT-REF/.test(value),
      `.env.example must contain placeholders only, found: ${value}`,
    )
  }
})

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
console.log(`\nOffline verification: ${passed} passed, ${failures.length} failed\n`)
if (failures.length > 0) {
  for (const f of failures) console.error('  FAIL  ' + f)
  process.exit(1)
}
console.log('Covered: pricing arithmetic, promotion determinism, input validation,')
console.log('         image URL schemes, card grouping, secret scanning, RLS presence.')
console.log('\nNOT covered (needs a live Supabase project): RLS enforcement,')
console.log('authentication, role checks, storage writes, foreign keys.')