import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { spawn } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

const app = express()
app.use(cors())
app.use(express.json())

/** Cap per request. Anything beyond 5 photos hits diminishing returns and
 *  inflates Claude latency / token cost without sharpening the analysis. */
const MAX_PHOTOS = 5

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: MAX_PHOTOS },
})

/**
 * Build the system prompt. Sections of the schema can be toggled off so a user
 * who doesn't want makeup recommendations doesn't get a half-empty card or
 * irrelevant advice. Hair, color, and accessories always render.
 */
function buildSystemPrompt(opts: { includeMakeup: boolean }): string {
  const makeupBlock = opts.includeMakeup
    ? `
  "makeup": {
    "foundationUndertone": "<description>",
    "eyeshadow": [{ "name": "<name>", "hex": "<hex>", "whyWorks": "<why>" }],
    "lipColors": [{ "name": "<name>", "hex": "<hex>", "whyWorks": "<why>" }],
    "blush": { "name": "<name>", "hex": "<hex>", "whyWorks": "<why>" }
  },`
    : ''

  const makeupRequirements = opts.includeMakeup
    ? `- makeup.eyeshadow: exactly 3 entries
- makeup.lipColors: exactly 2 entries
`
    : `- DO NOT include a "makeup" key in the output. The user has opted out of makeup recommendations.
`

  return `You are an expert personal stylist and color analyst specializing in the 12-season color analysis system.
Read the portrait image file and return ONLY a valid JSON object. No markdown, no code fences, no explanation — raw JSON only.

Return this exact schema:
{
  "analyzedAt": "<ISO date>",
  "season": "<e.g. Soft Autumn, True Winter, Light Spring, Cool Summer, etc.>",
  "undertone": "<warm | cool | neutral>",
  "seasonSummary": "<2 sentences: what this season means for their coloring and what naturally looks best>",
  "colorWhyOverall": "<2–3 sentences explaining the science/logic behind why these specific hues work — mention skin undertone, contrast level, value, saturation>",
  "bestColors": [
    { "name": "<color name>", "hex": "<#xxxxxx>", "whyWorks": "<1 sentence — specific reason this particular hue enhances their coloring>" }
  ],
  "avoidColors": [
    { "name": "<color name>", "hex": "<#xxxxxx>", "whyWorks": "<1 sentence — why this clashes or washes them out>" }
  ],${makeupBlock}
  "hair": {
    "faceShape": "<oval | round | square | heart | oblong | diamond>",
    "hairstyles": [
      { "name": "<style name>", "description": "<what it looks like — length, layers, texture>", "why": "<why this flatters their face shape and coloring>", "imageSearchQuery": "<a 4–8 word stock-photo search phrase that bakes in apparent age range, gender presentation, race/ethnicity, and hair texture, plus the haircut name — e.g. 'south asian man textured crop haircut' or 'black woman shoulder length curly bob'. Be specific about demographics so the example photo actually matches the person>" }
    ],
    "colorOptions": [
      { "name": "<color name>", "hex": "<#xxxxxx>", "whyWorks": "<why this hair color suits their season and skin tone>" }
    ],
    "styleNotes": ["<tip 1>", "<tip 2>", "<tip 3>"]
  },
  "accessories": {
    "metalTone": "<gold | silver | rose gold | mixed>",
    "jewelryStyle": ["<descriptor 1>", "<descriptor 2>", "<descriptor 3>"]
  },
  "error": null
}

Requirements:
- bestColors: exactly 8 entries, each with whyWorks
- avoidColors: exactly 4 entries, each with whyWorks
${makeupRequirements}- hair.hairstyles: exactly 3 entries
- hair.colorOptions: exactly 3 entries
- hair.styleNotes: exactly 3 entries
- accessories.jewelryStyle: exactly 3 entries
- Every hairstyles entry MUST include imageSearchQuery — be demographically specific so the photo actually resembles the person
- All hex codes must be valid 6-digit hex strings starting with #
- Tailor recommendations to the apparent person in the photo without assuming gender from any single feature — base advice on their actual coloring, face shape, and existing styling.
- If you cannot clearly see the person's face, set error to a brief explanation and fill other fields with empty/default values`
}

interface PhotoInput {
  buffer: Buffer
  mimeType: string
}

function extFor(mime: string): string {
  return mime === 'image/png' ? '.png' : mime === 'image/webp' ? '.webp' : '.jpg'
}

/** Hard cap on how long we'll wait for the claude CLI to return. Cloudflare
 *  quick tunnels disconnect at 100s; if Claude is genuinely stuck we'd rather
 *  the server return a friendly error in <90s than have the client see a
 *  raw network drop. */
const CLAUDE_TIMEOUT_MS = 90_000

async function analyzeWithClaude(
  photos: PhotoInput[],
  opts: { includeMakeup: boolean },
): Promise<string> {
  if (photos.length === 0) throw new Error('analyzeWithClaude called with no photos')

  // Write each photo to its own tmp file. Including a per-photo index in the
  // path makes the prompt easier for Claude to parse — `photo-1`, `photo-2`,
  // etc. — while keeping the overall request a single batched analysis.
  const ts = Date.now()
  const tmpPaths = photos.map((p, i) =>
    path.join(os.tmpdir(), `grace-style-${ts}-${i + 1}${extFor(p.mimeType)}`),
  )
  photos.forEach((p, i) => fs.writeFileSync(tmpPaths[i], p.buffer))

  try {
    return await new Promise<string>((resolve, reject) => {
      // The prompt explicitly tells Claude how to combine multiple photos:
      // synthesize one analysis using the variety of lighting/outfits to
      // refine the read, rather than analysing each photo separately.
      const photoBlock =
        photos.length === 1
          ? `Read the portrait image at this exact path: ${tmpPaths[0]}`
          : `Read all of these portrait images of the same person, taken in different outfits or lighting:\n${tmpPaths
              .map((p, i) => `  Photo ${i + 1}: ${p}`)
              .join('\n')}\n\nUse the full set to refine your read of skin undertone, hair color, contrast level, and which palette truly flatters them — rather than relying on any one photo's lighting.`

      const prompt = `${photoBlock}\n\nThen analyze the person's color season and return the JSON profile as specified in your instructions. Return ONLY raw JSON.`

      const proc = spawn('claude', [
        '--print',
        prompt,
        '--system-prompt', buildSystemPrompt(opts),
        '--allowedTools', 'Read',
        '--output-format', 'json',
        '--no-session-persistence',
      ])

      let stdout = ''
      let stderr = ''
      let timedOut = false

      // Hard timeout: SIGTERM first to let claude clean up, then SIGKILL 5s
      // later as a last resort so a stuck CLI process doesn't pin a slot.
      const timer = setTimeout(() => {
        timedOut = true
        proc.kill('SIGTERM')
        setTimeout(() => {
          if (!proc.killed) proc.kill('SIGKILL')
        }, 5_000)
      }, CLAUDE_TIMEOUT_MS)

      proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
      proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })

      proc.on('close', (code) => {
        clearTimeout(timer)
        if (timedOut) {
          reject(new Error(`claude timed out after ${CLAUDE_TIMEOUT_MS / 1000}s`))
          return
        }
        if (code !== 0) {
          reject(new Error(`claude exited ${code}: ${stderr.slice(0, 500)}`))
          return
        }

        // --output-format json wraps response in {"result": "..."}
        let text = stdout
        try {
          const wrapper = JSON.parse(stdout)
          if (wrapper.result) text = wrapper.result
        } catch {
          // stdout is already the raw text
        }

        resolve(text)
      })

      proc.on('error', (err) => {
        clearTimeout(timer)
        reject(err)
      })
    })
  } finally {
    for (const p of tmpPaths) {
      try { fs.unlinkSync(p) } catch { /* ignore */ }
    }
  }
}

function parseProfile(raw: string): unknown {
  const cleaned = raw
    .replace(/^```(?:json)?\n?/m, '')
    .replace(/\n?```$/m, '')
    .trim()
  return JSON.parse(cleaned)
}

/** Persisted Pexels lookup cache. Keyed by lowercased search query so two
 *  users requesting the same haircut on the same demographic don't both
 *  burn an API request. Stored as a flat JSON object on disk so it survives
 *  server restarts but stays trivial to inspect / clear. */
interface PexelsCacheEntry {
  url: string
  photographer: string
  sourceUrl: string
}

const PEXELS_CACHE_PATH = path.join(os.tmpdir(), 'grace-style-pexels-cache.json')

function loadPexelsCache(): Record<string, PexelsCacheEntry> {
  try {
    return JSON.parse(fs.readFileSync(PEXELS_CACHE_PATH, 'utf8'))
  } catch {
    return {}
  }
}

function savePexelsCache(cache: Record<string, PexelsCacheEntry>): void {
  try {
    fs.writeFileSync(PEXELS_CACHE_PATH, JSON.stringify(cache))
  } catch (err) {
    // Cache failures are non-fatal — next request will just re-query.
    console.warn('Could not persist Pexels cache:', err)
  }
}

/**
 * Fetch one example image from Pexels for a given search query. Returns
 * `null` (not throws) on any failure so missing imagery never blocks the
 * analysis itself — the UI just renders the text-only recommendation.
 *
 * Pexels' free tier: 200/hour, 20k/month, no card required.
 * Sign up at pexels.com/api → instant key → set PEXELS_API_KEY in .env.
 */
async function fetchPexelsImage(
  query: string,
  cache: Record<string, PexelsCacheEntry>,
): Promise<PexelsCacheEntry | null> {
  const key = query.trim().toLowerCase()
  if (!key) return null
  if (cache[key]) return cache[key]

  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) return null

  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=portrait`
    const res = await fetch(url, { headers: { Authorization: apiKey } })
    if (!res.ok) {
      console.warn(`Pexels ${res.status} for "${query}"`)
      return null
    }
    const data = await res.json() as {
      photos?: Array<{
        src: { large: string; medium: string }
        photographer: string
        url: string
      }>
    }
    const photo = data.photos?.[0]
    if (!photo) return null

    const entry: PexelsCacheEntry = {
      url: photo.src.large || photo.src.medium,
      photographer: photo.photographer,
      sourceUrl: photo.url,
    }
    cache[key] = entry
    return entry
  } catch (err) {
    console.warn(`Pexels fetch failed for "${query}":`, err)
    return null
  }
}

/**
 * Enrich each hairstyle in the profile with an example photo URL. Runs the
 * Pexels lookups in parallel — they're independent and the page already
 * paid the latency tax for the Claude analysis itself.
 */
async function enrichHairstylesWithImages(profile: Record<string, unknown>): Promise<void> {
  const hair = profile.hair as { hairstyles?: Array<Record<string, unknown>> } | undefined
  if (!hair?.hairstyles?.length) return

  const cache = loadPexelsCache()
  const before = JSON.stringify(cache)

  await Promise.all(
    hair.hairstyles.map(async (h) => {
      const q = typeof h.imageSearchQuery === 'string' ? h.imageSearchQuery : ''
      if (!q) return
      const result = await fetchPexelsImage(q, cache)
      if (result) {
        h.exampleImageUrl = result.url
        h.imageCredit = {
          photographer: result.photographer,
          sourceUrl: result.sourceUrl,
        }
      }
    }),
  )

  if (JSON.stringify(cache) !== before) savePexelsCache(cache)
}

/**
 * Coerce a multipart text field to a boolean. Accepts "true"/"false",
 * "1"/"0", "on"/"off". Defaults to fallback for missing or unrecognised input.
 */
function parseBool(v: unknown, fallback: boolean): boolean {
  if (typeof v !== 'string') return fallback
  const s = v.trim().toLowerCase()
  if (s === 'true' || s === '1' || s === 'on' || s === 'yes') return true
  if (s === 'false' || s === '0' || s === 'off' || s === 'no') return false
  return fallback
}

app.post('/api/analyze', upload.array('photo', MAX_PHOTOS), async (req, res) => {
  // Per-request log id so concurrent requests are easy to disambiguate when
  // multiple users hit the tunnel at once.
  const reqId = Math.random().toString(36).slice(2, 8)
  const reqStart = Date.now()
  const logTag = (event: string) => `[${new Date().toISOString()}] [analyze ${reqId}] ${event}`

  // multer.array() puts files on req.files. The single-file legacy field name
  // is kept ('photo') so old clients that send one file still work — multer
  // just returns a 1-element array for them.
  const files = (req.files as Express.Multer.File[] | undefined) ?? []
  if (files.length === 0) {
    console.warn(logTag('rejected: no photo uploaded'))
    res.status(400).json({ error: 'No photo uploaded' })
    return
  }

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  for (const f of files) {
    if (!allowed.includes(f.mimetype)) {
      console.warn(logTag(`rejected: unsupported mime ${f.mimetype}`))
      res.status(400).json({ error: 'Unsupported file type. Use JPG, PNG, or WebP.' })
      return
    }
  }

  // Optional client-supplied fields. The server doesn't trust or persist
  // these — they're just used to shape the prompt and echoed back to the
  // client so the rendered card is labelled correctly.
  const includeMakeup = parseBool(req.body?.includeMakeup, true)
  const rawName = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 60) : ''

  console.log(
    logTag(
      `start photos=${files.length} bytes=${files.reduce((s, f) => s + f.size, 0)} ` +
      `name="${rawName || '<unset>'}" makeup=${includeMakeup} ua="${(req.headers['user-agent'] || '').slice(0, 60)}"`,
    ),
  )

  const photos: PhotoInput[] = files.map(f => ({ buffer: f.buffer, mimeType: f.mimetype }))

  let raw: string
  try {
    raw = await analyzeWithClaude(photos, { includeMakeup })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(logTag(`claude failed in ${Date.now() - reqStart}ms: ${msg}`))
    const friendly = msg.includes('timed out')
      ? 'Analysis timed out. Try again with a single photo or a faster connection.'
      : 'Analysis failed. Please try again.'
    res.status(500).json({ error: friendly })
    return
  }

  let profile: unknown
  try {
    profile = parseProfile(raw)
  } catch {
    console.warn(logTag('first parse failed, retrying once'))
    // Retry once
    try {
      raw = await analyzeWithClaude(photos, { includeMakeup })
      profile = parseProfile(raw)
    } catch {
      console.error(logTag(`parse failed after retry. raw head=${(raw || '').slice(0, 200)}`))
      res.status(500).json({ error: 'Failed to parse analysis. Please try again.' })
      return
    }
  }

  const p = profile as Record<string, unknown>
  if (!p.analyzedAt) p.analyzedAt = new Date().toISOString().split('T')[0]
  if (rawName) p.name = rawName
  // Echo the photo count so the card can show "Analyzed from N photos" —
  // the client doesn't trust this for any logic, just renders the badge.
  p.photoCount = files.length
  // Defensive: if Claude included makeup despite the opt-out, drop it so the
  // client doesn't render a section the user explicitly hid.
  if (!includeMakeup && 'makeup' in p) delete p.makeup

  // Enrich hairstyles with Pexels example photos. Non-fatal — if the API
  // key is missing or any lookup fails, we just ship the text-only profile.
  try {
    await enrichHairstylesWithImages(p)
  } catch (err) {
    console.warn(logTag(`hair enrichment failed: ${err instanceof Error ? err.message : err}`))
  }

  const elapsed = Date.now() - reqStart
  const errField = typeof p.error === 'string' && p.error ? `error="${p.error.slice(0, 80)}"` : 'ok'
  console.log(logTag(`done in ${elapsed}ms ${errField}`))

  res.json(profile)
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Style API running on http://localhost:${PORT}`)
})

export { app }
