#!/usr/bin/env npx ts-node
/**
 * Analyze a photo of Grace and write her color profile to src/data/grace-profile.json
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... npx ts-node scripts/analyze.ts ./path/to/grace.jpg
 *
 * Reads the image, calls Claude claude-sonnet-4-6 with vision, writes structured JSON.
 */

import Anthropic from '@anthropic-ai/sdk'
import * as fs from 'fs'
import * as path from 'path'

const SYSTEM_PROMPT = `You are a professional color analyst specializing in the 12-season color analysis system.
Analyze the person's photo and return ONLY a valid JSON object. No markdown, no code fences, no explanation — raw JSON only.

The JSON must match this exact schema:
{
  "name": "Grace",
  "analyzedAt": "<ISO date string>",
  "season": "<one of: Spring, Light Spring, Warm Spring, True Spring, Summer, Light Summer, Cool Summer, True Summer, Autumn, Soft Autumn, Warm Autumn, True Autumn, Winter, Cool Winter, True Winter, Bright Winter>",
  "undertone": "<warm | cool | neutral>",
  "seasonSummary": "<2 sentences describing what this season means for their coloring and what looks best>",
  "bestColors": [
    { "name": "<color name>", "hex": "<6-digit hex with #>" }
  ],
  "avoidColors": [
    { "name": "<color name>", "hex": "<6-digit hex with #>" }
  ],
  "makeup": {
    "foundationUndertone": "<description of ideal foundation undertone and shade range>",
    "eyeshadow": [
      { "name": "<color name>", "hex": "<hex>" }
    ],
    "lipColors": [
      { "name": "<color name>", "hex": "<hex>" }
    ],
    "blush": { "name": "<color name>", "hex": "<hex>" }
  },
  "hair": {
    "colorOptions": [
      { "name": "<color name>", "hex": "<hex>" }
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
- bestColors: exactly 8 entries
- avoidColors: exactly 4 entries
- makeup.eyeshadow: exactly 3 entries
- makeup.lipColors: exactly 2 entries
- hair.colorOptions: exactly 3 entries
- hair.styleNotes: exactly 3 entries
- accessories.jewelryStyle: exactly 3 entries
- All hex codes must be valid 6-digit hex strings with #
- If you cannot clearly see the person's face or determine their coloring, set error to a brief explanation string instead of null, and fill remaining fields with empty/default values`

async function main() {
  const photoPath = process.argv[2]
  if (!photoPath) {
    console.error('Usage: npx ts-node scripts/analyze.ts <path-to-photo>')
    process.exit(1)
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is required')
    process.exit(1)
  }

  const resolvedPath = path.resolve(photoPath)
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: File not found: ${resolvedPath}`)
    process.exit(1)
  }

  const ext = path.extname(resolvedPath).toLowerCase()
  const mediaTypeMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  }
  const mediaType = mediaTypeMap[ext]
  if (!mediaType) {
    console.error(`Error: Unsupported file type ${ext}. Use .jpg, .jpeg, .png, or .webp`)
    process.exit(1)
  }

  console.log(`Reading photo: ${resolvedPath}`)
  const imageData = fs.readFileSync(resolvedPath)
  const base64 = imageData.toString('base64')

  const client = new Anthropic({ apiKey })

  console.log('Analyzing with Claude vision...')
  let raw: string
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp',
                data: base64,
              },
            },
            {
              type: 'text',
              text: 'Analyze this person\'s color season and return the JSON profile.',
            },
          ],
        },
      ],
    })
    raw = response.content[0].type === 'text' ? response.content[0].text : ''
  } catch (err) {
    console.error('Claude API error:', err)
    process.exit(1)
  }

  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()

  let profile: unknown
  try {
    profile = JSON.parse(cleaned)
  } catch {
    console.error('Failed to parse Claude response as JSON.')
    console.error('Raw response:', raw)
    process.exit(1)
  }

  // Inject current date if missing
  const p = profile as Record<string, unknown>
  if (!p.analyzedAt) p.analyzedAt = new Date().toISOString().split('T')[0]
  if (!p.name) p.name = 'Grace'

  const outputPath = path.resolve(__dirname, '../src/data/grace-profile.json')
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, JSON.stringify(profile, null, 2))

  if (p.error) {
    console.warn(`\n⚠️  Claude flagged an issue: ${p.error}`)
    console.warn('The profile was saved but results may be unreliable. Try a clearer photo.')
  } else {
    console.log(`\n✅ Profile saved to: ${outputPath}`)
    console.log(`   Season: ${p.season} (${p.undertone} undertone)`)
    console.log(`\nRun the app and her analysis will be loaded automatically.`)
  }
}

main()
