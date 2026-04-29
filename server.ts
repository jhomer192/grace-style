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

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

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
      { "name": "<style name>", "description": "<what it looks like — length, layers, texture>", "why": "<why this flatters their face shape and coloring>" }
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
- All hex codes must be valid 6-digit hex strings starting with #
- Tailor recommendations to the apparent person in the photo without assuming gender from any single feature — base advice on their actual coloring, face shape, and existing styling.
- If you cannot clearly see the person's face, set error to a brief explanation and fill other fields with empty/default values`
}

async function analyzeWithClaude(
  imageBuffer: Buffer,
  mimeType: string,
  opts: { includeMakeup: boolean },
): Promise<string> {
  const ext = mimeType === 'image/png' ? '.png' : mimeType === 'image/webp' ? '.webp' : '.jpg'
  const tmpPath = path.join(os.tmpdir(), `grace-style-${Date.now()}${ext}`)
  fs.writeFileSync(tmpPath, imageBuffer)

  try {
    return await new Promise<string>((resolve, reject) => {
      const prompt = `Read the portrait image at this exact path: ${tmpPath}\n\nThen analyze the person's color season and return the JSON profile as specified in your instructions. Return ONLY raw JSON.`

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

      proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
      proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })

      proc.on('close', (code) => {
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
    })
  } finally {
    try { fs.unlinkSync(tmpPath) } catch { /* ignore */ }
  }
}

function parseProfile(raw: string): unknown {
  const cleaned = raw
    .replace(/^```(?:json)?\n?/m, '')
    .replace(/\n?```$/m, '')
    .trim()
  return JSON.parse(cleaned)
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

app.post('/api/analyze', upload.single('photo'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No photo uploaded' })
    return
  }

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowed.includes(req.file.mimetype)) {
    res.status(400).json({ error: 'Unsupported file type. Use JPG, PNG, or WebP.' })
    return
  }

  // Optional client-supplied fields. The server doesn't trust or persist
  // these — they're just used to shape the prompt and echoed back to the
  // client so the rendered card is labelled correctly.
  const includeMakeup = parseBool(req.body?.includeMakeup, true)
  const rawName = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 60) : ''

  let raw: string
  try {
    raw = await analyzeWithClaude(req.file.buffer, req.file.mimetype, { includeMakeup })
  } catch (err) {
    console.error('Claude CLI error:', err)
    res.status(500).json({ error: 'Analysis failed. Please try again.' })
    return
  }

  let profile: unknown
  try {
    profile = parseProfile(raw)
  } catch {
    // Retry once
    try {
      raw = await analyzeWithClaude(req.file.buffer, req.file.mimetype, { includeMakeup })
      profile = parseProfile(raw)
    } catch {
      console.error('Parse failed after retry. Raw:', raw?.slice(0, 300))
      res.status(500).json({ error: 'Failed to parse analysis. Please try again.' })
      return
    }
  }

  const p = profile as Record<string, unknown>
  if (!p.analyzedAt) p.analyzedAt = new Date().toISOString().split('T')[0]
  if (rawName) p.name = rawName
  // Defensive: if Claude included makeup despite the opt-out, drop it so the
  // client doesn't render a section the user explicitly hid.
  if (!includeMakeup && 'makeup' in p) delete p.makeup

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
