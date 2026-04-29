#!/usr/bin/env npx ts-node
/**
 * End-to-end test for the style analysis API.
 *
 * Usage:
 *   npx ts-node tests/e2e.ts ./path/to/portrait.jpg
 *
 * Runs two analyses back-to-back (with makeup, without makeup) so we exercise
 * both branches of the conditional prompt and verify the multi-user fields
 * (name echo, optional makeup section) round-trip correctly.
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

function validateSwatch(s: unknown, p: string, fails: Fail[], requireWhy = false) {
  if (typeof s !== 'object' || s === null) { fails.push({ field: p, issue: 'not an object' }); return }
  const sw = s as Record<string, unknown>
  check(fails, typeof sw.name === 'string' && sw.name.length > 0, `${p}.name`, 'missing or empty')
  check(fails, isHex(sw.hex), `${p}.hex`, `invalid hex: ${sw.hex}`)
  if (requireWhy) {
    check(fails, typeof sw.whyWorks === 'string' && sw.whyWorks.length > 0, `${p}.whyWorks`, 'missing or empty')
  }
}

interface ValidateOpts {
  expectMakeup: boolean
  expectName?: string
}

function validateProfile(data: unknown, opts: ValidateOpts): Fail[] {
  const fails: Fail[] = []

  if (typeof data !== 'object' || data === null) {
    return [{ field: 'root', issue: 'response is not an object' }]
  }

  const p = data as Record<string, unknown>

  // The server contract is: when `error` is non-null, content fields are
  // intentionally empty. Don't run the strict content checks in that case —
  // but the structural invariants (name echo, makeup presence) MUST still
  // hold, since those are independent of whether Claude could see a face.
  const isErrorResponse = typeof p.error === 'string' && p.error.length > 0

  check(fails, typeof p.analyzedAt === 'string', 'analyzedAt', 'missing')
  check(fails, p.error === null || typeof p.error === 'string', 'error', 'must be null or string')

  // Optional name — must round-trip when supplied by the client (always)
  if (opts.expectName !== undefined) {
    check(fails, p.name === opts.expectName, 'name', `expected ${JSON.stringify(opts.expectName)}, got ${JSON.stringify(p.name)}`)
  }

  // makeup presence — invariant on the includeMakeup flag (always)
  if (opts.expectMakeup) {
    check(fails, 'makeup' in p && typeof p.makeup === 'object' && p.makeup !== null,
          'makeup', 'missing (expected because includeMakeup=true)')
  } else {
    // The server MUST strip the makeup field when the user opted out, even if
    // Claude included it anyway — otherwise the client would render a section
    // the user explicitly hid.
    check(fails, !('makeup' in p), 'makeup', 'must be absent when includeMakeup=false')
  }

  if (isErrorResponse) {
    // Error path verified — content checks below would be noise.
    return fails
  }

  // ── Content checks (only when Claude returned a real analysis) ────────────
  check(fails, typeof p.season === 'string' && (p.season as string).length > 0, 'season', 'missing')
  check(fails, ['warm', 'cool', 'neutral'].includes(p.undertone as string), 'undertone', `invalid: ${p.undertone}`)
  check(fails, typeof p.seasonSummary === 'string' && (p.seasonSummary as string).length > 10, 'seasonSummary', 'missing or too short')
  check(fails, typeof p.colorWhyOverall === 'string' && (p.colorWhyOverall as string).length > 10, 'colorWhyOverall', 'missing or too short')

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

  // makeup contents (only present in expectMakeup case here)
  if (opts.expectMakeup) {
    const mk = p.makeup as Record<string, unknown>
    check(fails, typeof mk.foundationUndertone === 'string', 'makeup.foundationUndertone', 'missing')
    check(fails, Array.isArray(mk.eyeshadow) && (mk.eyeshadow as unknown[]).length === 3, 'makeup.eyeshadow', 'expected 3 entries')
    check(fails, Array.isArray(mk.lipColors) && (mk.lipColors as unknown[]).length === 2, 'makeup.lipColors', 'expected 2 entries')
    if (mk.blush) validateSwatch(mk.blush, 'makeup.blush', fails)
  }

  // hair — always present
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

  // accessories — always present
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

// ── Test runner ─────────────────────────────────────────────────────────────

interface RunCase {
  label: string
  name: string
  includeMakeup: boolean
}

async function runCase(base: string, imagePath: string, mime: string, c: RunCase): Promise<boolean> {
  console.log(`▶ ${c.label}  (name=${JSON.stringify(c.name)}, includeMakeup=${c.includeMakeup})`)

  const form = new FormData()
  form.append('photo', fs.createReadStream(imagePath), { contentType: mime, filename: path.basename(imagePath) })
  form.append('name', c.name)
  form.append('includeMakeup', c.includeMakeup ? 'true' : 'false')

  const result = await post(`${base}/api/analyze`, form)
  if (result.status !== 200) {
    console.error(`  ✗ HTTP ${result.status}:`, result.body)
    return false
  }

  const fails = validateProfile(result.body, { expectMakeup: c.includeMakeup, expectName: c.name })
  if (fails.length > 0) {
    console.error(`  ✗ ${fails.length} schema issue(s):`)
    fails.forEach(f => console.error(`     [${f.field}] ${f.issue}`))
    return false
  }

  const p = result.body as Record<string, unknown>
  if (typeof p.error === 'string' && p.error.length > 0) {
    console.log(`  ✓ structural invariants held (error path): ${p.error}\n`)
  } else {
    console.log(`  ✓ ${p.season} / ${p.undertone} undertone${c.includeMakeup ? ' / +makeup' : ' / no makeup'}\n`)
  }
  return true
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

  console.log('\n=== Style Analysis — E2E Tests ===\n')
  console.log(`Image:  ${resolved}`)
  console.log(`Server: ${BASE}\n`)

  // Health check
  try {
    const health = await get(`${BASE}/api/health`)
    if (health.status !== 200) throw new Error(`HTTP ${health.status}`)
    console.log('Server is up.\n')
  } catch {
    console.error(`Server not reachable at ${BASE}. Start it with: npm run server`)
    process.exit(1)
  }

  const ext = path.extname(resolved).toLowerCase()
  const mimeMap: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.webp': 'image/webp',
  }
  const mime = mimeMap[ext] ?? 'image/jpeg'

  const cases: RunCase[] = [
    { label: 'Case 1 — full analysis with makeup',  name: 'Test User',  includeMakeup: true  },
    { label: 'Case 2 — analysis without makeup',    name: 'Jack',        includeMakeup: false },
  ]

  let allOk = true
  for (const c of cases) {
    const ok = await runCase(BASE, resolved, mime, c)
    if (!ok) allOk = false
  }

  console.log(allOk ? '✅ All cases passed\n' : '❌ One or more cases failed\n')
  process.exit(allOk ? 0 : 1)
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
