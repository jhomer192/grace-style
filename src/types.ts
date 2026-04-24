export interface ColorSwatch {
  name: string
  hex: string
  whyWorks?: string
}

export interface Hairstyle {
  name: string
  description: string
  why: string
}

export interface StyleProfile {
  analyzedAt: string
  season: string
  undertone: 'warm' | 'cool' | 'neutral'
  seasonSummary: string
  bestColors: ColorSwatch[]
  avoidColors: ColorSwatch[]
  colorWhyOverall: string
  makeup: {
    foundationUndertone: string
    eyeshadow: ColorSwatch[]
    lipColors: ColorSwatch[]
    blush: ColorSwatch
  }
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
