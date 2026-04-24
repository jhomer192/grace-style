#!/usr/bin/env npx ts-node
/**
 * End-to-end test for the style analysis API.
 *
 * Usage:
 *   npx ts-node tests/e2e.ts ./path/to/portrait.jpg
 *
 * Starts the Express server in-process, uploads the photo,
 * validates the full response schema, and prints a report.
 */

import * as fs from 'fs'
import * as path from 'path'
import * as http from 'http'
import FormData from 'form-data'

// ── Schema validation ────────────────────────────────────────────────────────

type Fail = { field: string; issue: string }

function check(fails: Fail[], cond: boolean, field: string, issue: string) {
  if (!cond) fails.push({ field, issue })
}

function isHex(v: unknown): boolean {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)
}

function validateSwatch(s: unknown, path: string, fails: Fail[], requireWhy = false) {
  if (typeof s !== 'object' || s === null) { fails.push({ field: path, issue: 'not an object' }); return }
  const sw = s as Record<string, unknown>
  check(fails, typeof sw.name === 'string' && sw.name.length > 0, `${path}.name`, 'missing or empty')
  check(fails, isHex(sw.hex), `${path}.hex`, `invalid hex: ${sw.hex}`)
  if (requireWhy) {
    check(fails, typeof sw.whyWorks === 'string' && sw.whyWorks.length > 0, `${path}.whyWorks`, 'missing or empty')
  }
}

function validateProfile(data: unknown): Fail[] {
  const fails: Fail[] = []

  if (typeof data !== 'object' || data === null) {
    return [{ field: 'root', issue: 'response is not an object' }]
  }

  const p = data as Record<string, unknown>

  // Top-level fields
  check(fails, typeof p.analyzedAt === 'string', 'analyzedAt', 'missing')
  check(fails, typeof p.season === 'string' && p.season.length > 0, 'season', 'missing')
  check(fails, ['warm', 'cool', 'neutral'].includes(p.undertone as string), 'undertone', `invalid: ${p.undertone}`)
  check(fails, typeof p.seasonSummary === 'string' && p.seasonSummary.length > 10, 'seasonSummary', 'missing or too short')
  check(fails, typeof p.colorWhyOverall === 'string' && p.colorWhyOverall.length > 10, 'colorWhyOverall', 'missing or too short')
  check(fails, p.error === null || typeof p.error === 'string', 'error', 'must be null or string')

  // bestColors — 8 entries
  check(fails, Array.isArray(p.bestColors) && (p.bestColors as unknown[]).length === 8, 'bestColors', `expected 8, got ${Array.isArray(p.bestColors) ? (p.bestColors as unknown[]).length : 'non-array'}`)
  if (Array.isArray(p.bestColors)) {
    (p.bestColors as unknown[]).forEach((s, i) => validateSwatch(s, `bestColors[${i}]`, fails, true))
  }

  // avoidColors — 4 entries
  check(fails, Array.isArray(p.avoidColors) && (p.avoidColors as unknown[]).length === 4, 'avoidColors', `expected 4, got ${Array.isArray(p.avoidColors) ? (p.avoidColors as unknown[]).length : 'non-array'}`)
  if (Array.isArray(p.avoidColors)) {
    (p.avoidColors as unknown[]).forEach((s, i) => validateSwatch(s, `avoidColors[${i}]`, fails, true))
  }

  // makeup
  const mk = p.makeup as Record<string, unknown> | undefined
  check(fails, typeof mk === 'object' && mk !== null, 'makeup', 'missing')
  if (mk) {
    check(fails, typeof mk.foundationUndertone === 'string', 'makeup.foundationUndertone', 'missing')
    check(fails, Array.isArray(mk.eyeshadow) && (mk.eyeshadow as unknown[]).length === 3, 'makeup.eyeshadow', 'expected 3 entries')
    check(fails, Array.isArray(mk.lipColors) && (mk.lipColors as unknown[]).length === 2, 'makeup.lipColors', 'expected 2 entries')
    if (mk.blush) validateSwatch(mk.blush, 'makeup.blush', fails)
  }

  // hair
  const hr = p.hair as Record<string, unknown> | undefined
  check(fails, typeof hr === 'object' && hr !== null, 'hair', 'missing')
  if (hr) {
    check(fails, typeof hr.faceShape === 'string', 'hair.faceShape', 'missing')
    check(fails, Array.isArray(hr.hairstyles) && (hr.hairstyles as unknown[]).length === 3, 'hair.hairstyles', 'expected 3 entries')
    if (Array.isArray(hr.hairstyles)) {
      (hr.hairstyles as unknown[]).forEach((s: unknown, i) => {
        const st = s as Record<string, unknown>
        check(fails, typeof st?.name === 'string', `hair.hairstyles[${i}].name`, 'missing')
        check(fails, typeof st?.description === 'string', `hair.hairstyles[${i}].description`, 'missing')
        check(fails, typeof st?.why === 'string', `hair.hairstyles[${i}].why`, 'missing')
      })
    }
    check(fails, Array.isArray(hr.colorOptions) && (hr.colorOptions as unknown[]).length === 3, 'hair.colorOptions', 'expected 3 entries')
    if (Array.isArray(hr.colorOptions)) {
      (hr.colorOptions as unknown[]).forEach((s, i) => validateSwatch(s, `hair.colorOptions[${i}]`, fails, true))
    }
    check(fails, Array.isArray(hr.styleNotes) && (hr.styleNotes as unknown[]).length === 3, 'hair.styleNotes', 'expected 3 entries')
  }

  // accessories
  const acc = p.accessories as Record<string, unknown> | undefined
  check(fails, typeof acc === 'object' && acc !== null, 'accessories', 'missing')
  if (acc) {
    check(fails, typeof acc.metalTone === 'string', 'accessories.metalTone', 'missing')
    check(fails, Array.isArray(acc.jewelryStyle) && (acc.jewelryStyle as unknown[]).length === 3, 'accessories.jewelryStyle', 'expected 3 entries')
  }

  return fails
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────

function post(url: string, form: FormData): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, {
      method: 'POST',
      headers: form.getHeaders(),
    }, (res) => {
      let raw = ''
      res.on('data', (c) => { raw += c })
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode ?? 0, body: JSON.parse(raw) })
        } catch {
          resolve({ status: res.statusCode ?? 0, body: raw })
        }
      })
    })
    req.on('error', reject)
    form.pipe(req)
  })
}

function get(url: string): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let raw = ''
      res.on('data', (c) => { raw += c })
      res.on('end', () => {
        try { resolve({ status: res.statusCode ?? 0, body: JSON.parse(raw) }) }
        catch { resolve({ status: res.statusCode ?? 0, body: raw }) }
      })
    }).on('error', reject)
  })
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const imagePath = process.argv[2]
  if (!imagePath) {
    console.error('Usage: npx ts-node tests/e2e.ts <path-to-portrait.jpg>')
    process.exit(1)
  }

  const resolved = path.resolve(imagePath)
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`)
    process.exit(1)
  }

  const PORT = process.env.PORT ?? '3001'
  const BASE = `http://localhost:${PORT}`

  console.log('\n=== Grace Style — E2E Test ===\n')
  console.log(`Image:  ${resolved}`)
  console.log(`Server: ${BASE}\n`)

  // 1. Health check — server must already be running (start it with npm run server)
  console.log('[1/3] Health check...')
  try {
    const health = await get(`${BASE}/api/health`)
    if (health.status !== 200) throw new Error(`HTTP ${health.status}`)
    console.log('      ✓ Server is up\n')
  } catch (err) {
    console.error(`      ✗ Server not reachable at ${BASE}`)
    console.error(`        Start it with: npm run server`)
    process.exit(1)
  }

  // 2. Upload photo and get analysis
  console.log('[2/3] Uploading photo and calling Claude...')
  console.log('      (this takes ~15–30s)\n')

  const ext = path.extname(resolved).toLowerCase()
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.webp': 'image/webp',
  }
  const mime = mimeMap[ext] ?? 'image/jpeg'

  const form = new FormData()
  form.append('photo', fs.createReadStream(resolved), { contentType: mime, filename: path.basename(resolved) })

  let result: { status: number; body: unknown }
  try {
    result = await post(`${BASE}/api/analyze`, form)
  } catch (err) {
    console.error('      ✗ Request failed:', err)
    process.exit(1)
  }

  if (result.status !== 200) {
    console.error(`      ✗ HTTP ${result.status}:`, result.body)
    process.exit(1)
  }
  console.log('      ✓ Got response\n')

  // 3. Validate schema
  console.log('[3/3] Validating response schema...')
  const fails = validateProfile(result.body)

  const profile = result.body as Record<string, unknown>

  if (fails.length === 0) {
    console.log('      ✓ All schema checks passed\n')
    console.log('── Result ──────────────────────────────')
    console.log(`Season:    ${profile.season}`)
    console.log(`Undertone: ${profile.undertone}`)
    console.log(`Summary:   ${profile.seasonSummary}`)
    console.log(`\nWhy these colors work:`)
    console.log(`  ${profile.colorWhyOverall}`)
    console.log(`\nBest colors:`)
    const best = profile.bestColors as Array<Record<string, string>>
    best.forEach(c => console.log(`  ${c.hex}  ${c.name} — ${c.whyWorks}`))
    const hair = profile.hair as Record<string, unknown>
    console.log(`\nFace shape: ${hair.faceShape}`)
    const styles = hair.hairstyles as Array<Record<string, string>>
    console.log('Hairstyles:')
    styles.forEach(s => console.log(`  • ${s.name}: ${s.why}`))
    console.log('\n✅ PASS\n')
  } else {
    console.log(`      ✗ ${fails.length} schema issue(s):\n`)
    fails.forEach(f => console.log(`        [${f.field}] ${f.issue}`))
    console.log('\n❌ FAIL\n')
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
