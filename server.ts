import express from 'express'
import cors from 'cors'
import multer from 'multer'
import Anthropic from '@anthropic-ai/sdk'

const app = express()
app.use(cors())
app.use(express.json())

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are an expert personal stylist and color analyst specializing in the 12-season color analysis system.
Analyze the person's photo and return ONLY a valid JSON object. No markdown, no code fences, no explanation — raw JSON only.

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
  ],
  "makeup": {
    "foundationUndertone": "<description>",
    "eyeshadow": [{ "name": "<name>", "hex": "<hex>", "whyWorks": "<why>" }],
    "lipColors": [{ "name": "<name>", "hex": "<hex>", "whyWorks": "<why>" }],
    "blush": { "name": "<name>", "hex": "<hex>", "whyWorks": "<why>" }
  },
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
- makeup.eyeshadow: exactly 3 entries
- makeup.lipColors: exactly 2 entries
- hair.hairstyles: exactly 3 entries
- hair.colorOptions: exactly 3 entries
- hair.styleNotes: exactly 3 entries
- accessories.jewelryStyle: exactly 3 entries
- All hex codes must be valid 6-digit hex strings starting with #
- If you cannot clearly see the person's face, set error to a brief explanation and fill other fields with empty/default values`

app.post('/api/analyze', upload.single('photo'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No photo uploaded' })
    return
  }

  const ext = req.file.mimetype
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowed.includes(ext)) {
    res.status(400).json({ error: 'Unsupported file type. Use JPG, PNG, or WebP.' })
    return
  }

  const base64 = req.file.buffer.toString('base64')

  let raw: string
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: ext as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
              data: base64,
            },
          },
          {
            type: 'text',
            text: 'Analyze this person\'s color season, best colors with explanations why they work, and hairstyle recommendations. Return the JSON profile.',
          },
        ],
      }],
    })
    raw = response.content[0].type === 'text' ? response.content[0].text : ''
  } catch (err) {
    console.error('Claude API error:', err)
    res.status(500).json({ error: 'Analysis failed. Please try again.' })
    return
  }

  const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()

  let profile: unknown
  try {
    profile = JSON.parse(cleaned)
  } catch {
    // Retry with explicit instruction
    try {
      const retry = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: ext as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
                  data: base64,
                },
              },
              { type: 'text', text: 'Analyze this person\'s color season and hairstyles. Return ONLY raw JSON, no code fences, no markdown.' },
            ],
          },
        ],
      })
      const retryRaw = retry.content[0].type === 'text' ? retry.content[0].text : ''
      profile = JSON.parse(retryRaw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim())
    } catch {
      res.status(500).json({ error: 'Failed to parse analysis. Please try again.' })
      return
    }
  }

  const p = profile as Record<string, unknown>
  if (!p.analyzedAt) p.analyzedAt = new Date().toISOString().split('T')[0]

  res.json(profile)
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Style API running on http://localhost:${PORT}`)
})
