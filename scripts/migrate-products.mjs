#!/usr/bin/env node
/**
 * One-time migration: copy the existing static catalogue into Supabase.
 *
 * The source of truth for this run is src/data/products.js — the same file the
 * website has always used. Nothing is invented: every row below comes from that
 * file, and the script verifies what it wrote by reading it back and diffing it
 * against the source.
 *
 * ---------------------------------------------------------------------------
 * SECURITY — read this before running
 * ---------------------------------------------------------------------------
 * This script needs to INSERT rows, and RLS only permits staff. A migration is
 * not staff, so this script authenticates as the service role.
 *
 * The service role key BYPASSES Row Level Security. It must therefore:
 *   - never be stored in a VITE_* variable (Vite inlines those into the bundle)
 *   - never be placed in src/, public/, or committed to git
 *   - live only in your local .env.local, which .gitignore already excludes
 *
 * .env.example documents it as a placeholder. This script reads the key from
 * the process environment and never prints it.
 *
 * Run it ONCE, from your machine:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
 *   node scripts/migrate-products.mjs
 *
 * Or put those two values in .env.local and run it with no arguments.
 * ---------------------------------------------------------------------------
 */

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(here, '..')

// ---------------------------------------------------------------------------
// Minimal .env loader. Avoids a dependency and keeps the key out of argv,
// which would otherwise be visible in the shell history and process list.
// ---------------------------------------------------------------------------
function loadEnvFile() {
  for (const name of ['.env.local', '.env']) {
    const path = join(projectRoot, name)
    if (!existsSync(path)) continue
    for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq === -1) continue
      const key = line.slice(0, eq).trim()
      let value = line.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!(key in process.env)) process.env[key] = value
    }
  }
}

loadEnvFile()

const URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!URL || !SERVICE_KEY) {
  console.error(
    'Missing credentials.\n\n' +
      'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (git-ignored)\n' +
      'or as environment variables, then run this script again.\n\n' +
      'The service-role key is only needed for this one-off migration. It must\n' +
      'never be added to a VITE_ variable or placed in src/ or public/.',
  )
  process.exit(1)
}

if (URL.includes('YOUR-PROJECT-REF')) {
  console.error('SUPABASE_URL is still the placeholder from .env.example. Fill in the real URL.')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Read the existing catalogue.
// ---------------------------------------------------------------------------
const { chickenProducts, sausageProducts } = await import(
  join(projectRoot, 'src/data/products.js')
)

/**
 * Flatten the site's product/variant model into one row per size.
 *
 * The database stores one row per size; the website rebuilds the 15 cards by
 * grouping rows on (category, name). Splitting here keeps that grouping intact
 * rather than collapsing 18 sizes into 15 products and losing the size buttons.
 */
function toRows(groups, startPosition) {
  const rows = []
  let productPosition = startPosition

  for (const product of groups) {
    const variants = product.variants ?? []
    if (variants.length === 0) {
      throw new Error(`Product "${product.name}" has no variants; refusing to guess.`)
    }
    variants.forEach((variant, index) => {
      const price = Number(variant.price)
      if (!Number.isInteger(price) || price < 0) {
        throw new Error(`Invalid price for ${product.name} ${variant.label}: ${variant.price}`)
      }
      rows.push({
        name: product.name,
        description: product.description ?? '',
        price,
        unit: product.unit ?? '',
        category: product.category === 'sausages' ? 'Sausages' : 'Chicken',
        image_url: product.image ?? null,
        is_available: true,
        // A single-size product keeps no variant label, so the public card
        // shows no size buttons, exactly as it does today.
        variant_label: variants.length > 1 ? variant.label : null,
        // GLOBAL ordering, not per-product.
        //
        // Position in the catalogue times 100, plus the size index. The
        // website groups rows back into cards and orders them by the smallest
        // sort_order in the card, so this reproduces the shop's curated order
        // (Whole Chicken first, Royal Butchery last) instead of re-sorting the
        // page by price.
        sort_order: productPosition * 100 + index,
      })
    })
    productPosition += 1
  }
  return rows
}

const chickenRows = toRows(chickenProducts, 0)
const sausageRows = toRows(sausageProducts, chickenProducts.length)
const rows = [...chickenRows, ...sausageRows]

const supabase = createClient(URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

console.log(`Preparing ${rows.length} product rows from src/data/products.js`)

// ---------------------------------------------------------------------------
// Upsert.
//
// Conflict target matches the unique index created in migration 0005
// (category, name, variant_label) so re-running this is safe and idempotent.
// ---------------------------------------------------------------------------
const { error } = await supabase.from('products').upsert(rows, {
  onConflict: 'category,name,variant_label',
})

if (error) {
  console.error('\nMigration failed:', error.message)
  console.error('code:', error.code ?? '(none)')
  process.exit(1)
}

console.log('Write complete. Verifying…')

// ---------------------------------------------------------------------------
// Verify: read back and diff against the source file.
// ---------------------------------------------------------------------------
const { data: readBack, error: readError } = await supabase
  .from('products')
  .select('id, name, description, price, unit, category, image_url, is_available, variant_label, sort_order')
  .order('category')
  .order('name')
  .order('sort_order')

if (readError) {
  console.error('\nCould not verify — read failed:', readError.message)
  process.exit(1)
}

const key = (r) => `${r.category}|${r.name}|${r.variant_label ?? ''}`
const sourceByKey = new Map(rows.map((r) => [key(r), r]))
const dbByKey = new Map(readBack.map((r) => [key(r), r]))

const missing = []
const mismatched = []

for (const [k, source] of sourceByKey) {
  const found = dbByKey.get(k)
  if (!found) {
    missing.push(k)
    continue
  }
  const problems = []
  // price is numeric(12,2) in Postgres. Depending on the PostgREST version it
  // may arrive as a JSON number or a string like "16000.00", so compare
  // numerically rather than with strict equality.
  if (Number(found.price) !== source.price)
    problems.push(`price ${found.price} != ${source.price}`)
  if (found.description !== source.description) problems.push('description differs')
  if (found.unit !== source.unit) problems.push(`unit "${found.unit}" != "${source.unit}"`)
  if (found.category !== source.category) problems.push('category differs')
  if ((found.image_url ?? null) !== (source.image_url ?? null))
    problems.push(`image "${found.image_url}" != "${source.image_url}"`)
  if (found.is_available !== source.is_available) problems.push('availability differs')
  if (problems.length > 0) mismatched.push(`${k}: ${problems.join('; ')}`)
}

// Rows already in the database that the source file does not describe. These are
// NOT deleted — they may be products added through the admin dashboard.
const extras = [...dbByKey.keys()].filter((k) => !sourceByKey.has(k))

console.log(`\nSource rows : ${rows.length}`)
console.log(`Database    : ${readBack.length}`)
console.log(`Missing     : ${missing.length}`)
console.log(`Mismatched  : ${mismatched.length}`)
console.log(`Not in file : ${extras.length}`)

if (missing.length > 0) {
  console.log('\nMissing from the database:')
  missing.forEach((m) => console.log('  -', m))
}
if (mismatched.length > 0) {
  console.log('\nMismatched:')
  mismatched.forEach((m) => console.log('  -', m))
}
if (extras.length > 0) {
  console.log('\nIn the database but not in products.js (left untouched):')
  extras.forEach((m) => console.log('  -', m))
}

if (missing.length > 0 || mismatched.length > 0) {
  console.error('\nVerification FAILED — do not switch the website over to the database yet.')
  process.exit(1)
}

console.log('\nVerification passed: every product in products.js is present and identical.')
console.log('Distinct products (cards):', new Set(rows.map((r) => `${r.category}|${r.name}`)).size)
console.log('Next: add your user to admin_profiles, then sign in at /admin/login.')