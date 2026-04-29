export interface ColorSwatch {
  name: string
  hex: string
  whyWorks?: string
}

export interface Hairstyle {
  name: string
  description: string
  why: string
  /** Optimized search phrase Claude crafted for stock-photo lookup —
   *  bakes in apparent age, gender presentation, race, and hair texture
   *  so the example photo actually matches the person being analyzed. */
  imageSearchQuery?: string
  /** Direct image URL from the stock provider (Pexels). Server-enriched.
   *  Absent when PEXELS_API_KEY is unset or no match was returned. */
  exampleImageUrl?: string
  /** Attribution required by Pexels' terms of use. */
  imageCredit?: {
    photographer: string
    sourceUrl: string
  }
}

export interface MakeupProfile {
  foundationUndertone: string
  eyeshadow: ColorSwatch[]
  lipColors: ColorSwatch[]
  blush: ColorSwatch
}

export interface StyleProfile {
  /** Display name supplied by the user on upload (e.g. "Jack"). */
  name?: string
  /** How many photos the analysis was synthesized from (1–5). Echoed by the
   *  server so the rendered card can show "Analyzed from N photos". */
  photoCount?: number
  analyzedAt: string
  season: string
  undertone: 'warm' | 'cool' | 'neutral'
  seasonSummary: string
  bestColors: ColorSwatch[]
  avoidColors: ColorSwatch[]
  colorWhyOverall: string
  /** Omitted when the user opts out of makeup recommendations on upload. */
  makeup?: MakeupProfile
  hair: {
    faceShape: string
    hairstyles: Hairstyle[]
    colorOptions: ColorSwatch[]
    styleNotes: string[]
  }
  accessories: {
    metalTone: string
    jewelryStyle: string[]
  }
  error: string | null
}

/** A persisted analysis, stored in localStorage so users can revisit past results. */
export interface SavedAnalysis {
  /** Stable id: `${nameSlug}-${createdAt}`. */
  id: string
  name: string
  /** ISO timestamp when the analysis was created on the client. */
  createdAt: string
  /** data: URL of the uploaded photo so cards remain renderable offline. */
  photoDataUrl: string
  profile: StyleProfile
}
