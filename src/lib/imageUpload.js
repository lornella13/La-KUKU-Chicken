import { supabase } from './supabase.js'

/**
 * Product image uploads.
 *
 * Threat model — what an attacker controls and what we refuse to trust:
 *
 *   1. The FILE ITSELF may be anything: a PHP script, an HTML page, an SVG
 *      with embedded JavaScript, or a 4 GB file. Mitigated by an allow-list of
 *      MIME types, a size ceiling, a re-check of the decoded image, and the
 *      bucket's own allowed_mime_types / file_size_limit.
 *
 *   2. The FILENAME is fully attacker-controlled and is the classic source of
 *      path traversal ("../../index.html") and extension confusion
 *      ("photo.svg"). Never used. The object name is generated here from a
 *      fresh UUID plus an extension derived from the *detected* type, so the
 *      name is always `products/<uuid>.<ext>`.
 *
 *   3. The DECLARED MIME type is attacker-controlled. `file.type` comes from
 *      the browser and is trivially spoofed, so it is treated as a hint only.
 *      The allow-list check below also inspects the real magic bytes.
 *
 *   4. The USER may be unauthenticated or not an admin. RLS on storage.objects
 *      is the actual gate: only staff can insert, and the object name must
 *      begin with `products/`. A client-side check is only a courtesy.
 */

const BUCKET = 'product-images'
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const MAX_DIMENSION = 6000 // reject absurd canvases / decompression bombs

/** Extensions we are willing to write, keyed by the MIME type we detected. */
const ALLOWED = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/**
 * Sniff the real content type from the leading bytes.
 * Returns a MIME string only when the signature matches an allowed type.
 */
export function sniffImageType(bytes) {
  const view = new Uint8Array(bytes)

  // JPEG: FF D8 FF
  if (view.length >= 3 && view[0] === 0xff && view[1] === 0xd8 && view[2] === 0xff) {
    return 'image/jpeg'
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    view.length >= 8 &&
    view[0] === 0x89 && view[1] === 0x50 && view[2] === 0x4e && view[3] === 0x47 &&
    view[4] === 0x0d && view[5] === 0x0a && view[6] === 0x1a && view[7] === 0x0a
  ) {
    return 'image/png'
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    view.length >= 12 &&
    view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46 &&
    view[8] === 0x57 && view[9] === 0x45 && view[10] === 0x42 && view[11] === 0x50
  ) {
    return 'image/webp'
  }

  // SVG, HTML, scripts and anything else fall through to null. SVG is
  // intentionally not supported: it is an active document format.
  return null
}

/**
 * Client-side pre-flight validation.
 * Returns { ok, error } and never throws.
 */
export function validateImageFile(file) {
  if (!file) return { ok: false, error: 'Choose an image file' }

  if (typeof file.size !== 'number' || !Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, error: 'That file appears to be empty' }
  }

  if (file.size > MAX_BYTES) {
    const mb = Math.round(MAX_BYTES / (1024 * 1024))
    return { ok: false, error: `Image must be smaller than ${mb} MB` }
  }

  // A filename extension is only a hint; it is checked for plausibility so a
  // .html or .php file is refused early with a clear message, but it is never
  // used to build the stored path.
  const ext = String(file.name ?? '').toLowerCase().split('.').pop()
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    return { ok: false, error: 'Only JPG, PNG or WebP images are allowed' }
  }

  // `file.type` is a hint from the browser and can be spoofed. If it IS set and
  // is not allowed, reject. If empty/unknown, fall through to magic-byte
  // sniffing in uploadProductImage.
  if (file.type && !Object.prototype.hasOwnProperty.call(ALLOWED, file.type)) {
    return { ok: false, error: 'Only JPG, PNG or WebP images are allowed' }
  }

  return { ok: true, error: null }
}

/**
 * Verify the decoded image really is an image of a sane size.
 * Uses createImageBitmap, which decodes the bytes — an HTML or SVG payload
 * will not decode successfully here.
 */
async function verifyDecodableImage(file) {
  if (typeof createImageBitmap !== 'function') {
    // Older browser: fall back to an <img> load check.
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        const ok = img.naturalWidth <= MAX_DIMENSION && img.naturalHeight <= MAX_DIMENSION
        URL.revokeObjectURL(url)
        resolve(ok)
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(false)
      }
      img.src = url
    })
  }

  try {
    const bitmap = await createImageBitmap(file)
    const ok = bitmap.width <= MAX_DIMENSION && bitmap.height <= MAX_DIMENSION
    bitmap.close?.()
    return ok
  } catch {
    return false
  }
}

/**
 * Upload a product image and return its public URL.
 *
 * @param {File} file
 * @param {string} productId used only to namespace the generated object name
 * @returns {Promise<{ok: boolean, path?: string, url?: string, error?: string}>}
 */
export async function uploadProductImage(file, productId) {
  const check = validateImageFile(file)
  if (!check.ok) return { ok: false, error: check.error }

  if (!supabase) {
    return { ok: false, error: 'Image upload needs the database to be configured' }
  }

  // 1. Magic-byte sniff. The declared type is never trusted.
  let head
  try {
    head = await file.slice(0, 32).arrayBuffer()
  } catch {
    return { ok: false, error: 'Could not read that file' }
  }

  const detected = sniffImageType(head)
  if (!detected || !ALLOWED[detected]) {
    return { ok: false, error: 'That file is not a JPG, PNG or WebP image' }
  }

  // 2. The bytes must actually decode as an image.
  const decodable = await verifyDecodableImage(file)
  if (!decodable) {
    return { ok: false, error: 'That image could not be read, or it is too large' }
  }

  // 3. Generate the object name ourselves.
  //    - crypto.randomUUID gives an unpredictable, collision-free name.
  //    - the extension comes from the DETECTED type, not the filename.
  //    - the filename is discarded entirely, so "../" cannot escape.
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`

  const ext = ALLOWED[detected]
  // productId is a UUID from the database; sanitise defensively so it can only
  // ever contribute hex characters, even if the value were unexpected.
  const safeProductId = String(productId ?? 'unassigned').replace(/[^a-zA-Z0-9-]/g, '')
  const path = `products/${safeProductId}/${uuid}.${ext}`

  // 4. Upload. RLS rejects this unless the caller is staff.
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '31536000',
      upsert: false, // never silently overwrite an existing object
      contentType: detected, // server is told the sniffed type, not the claim
    })

  if (error) {
    // Do not surface raw provider text (it can contain bucket/object detail).
    console.error('Image upload failed:', error.code ?? error.message)
    if (error.status === '400' || error.status === '403') {
      return { ok: false, error: 'Upload not permitted. Check your admin role.' }
    }
    return { ok: false, error: 'The image could not be uploaded. Please try again.' }
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { ok: true, path, url: data.publicUrl }
}

/*
 * Note on deletion.
 *
 * There is deliberately no automatic cleanup when an admin replaces a photo.
 * `upsert: false` plus a generated object name means a new file is always
 * written alongside the old one, so a mistaken replacement can be undone.
 * Removing an orphaned upload is a deliberate admin action performed in the
 * Supabase Storage dashboard, where it is admin-only by definition.
 *
 * The original photographs in public/images/products/ are never deleted by any
 * code path in this application — they are the fallback catalogue.
 */
