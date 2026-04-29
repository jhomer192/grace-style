/**
 * localStorage-backed persistence for past analyses.
 *
 * Each browser keeps its own list. Multiple people sharing a browser is rare;
 * the more common case is one person revisiting their own past results, or
 * a family/household running analyses for each other on the same device.
 *
 * Photos are stored as data: URLs so saved cards remain renderable offline
 * even if the upstream blob URL has been revoked.
 */
import type { SavedAnalysis, StyleProfile } from '../types'

const STORAGE_KEY = 'grace-style.analyses.v1'

/** Soft cap so a household with many runs can't blow past the localStorage quota. */
const MAX_ANALYSES = 30

function safeParse(json: string | null): SavedAnalysis[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed.filter(isAnalysis) : []
  } catch {
    return []
  }
}

function isAnalysis(x: unknown): x is SavedAnalysis {
  if (typeof x !== 'object' || x === null) return false
  const a = x as Record<string, unknown>
  return typeof a.id === 'string'
    && typeof a.name === 'string'
    && typeof a.createdAt === 'string'
    && typeof a.photoDataUrl === 'string'
    && typeof a.profile === 'object'
}

export function loadAnalyses(): SavedAnalysis[] {
  if (typeof window === 'undefined') return []
  return safeParse(window.localStorage.getItem(STORAGE_KEY))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function persist(analyses: SavedAnalysis[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(analyses))
  } catch (err) {
    // Quota exceeded — drop oldest entries until it fits, but never fail loudly.
    if (analyses.length > 1) {
      persist(analyses.slice(0, analyses.length - 1))
    } else {
      console.warn('Could not persist analysis to localStorage', err)
    }
  }
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'anon'
}

export function saveAnalysis(name: string, profile: StyleProfile, photoDataUrl: string): SavedAnalysis {
  const createdAt = new Date().toISOString()
  const entry: SavedAnalysis = {
    id: `${slug(name)}-${createdAt}`,
    name: name.trim() || 'Anonymous',
    createdAt,
    photoDataUrl,
    profile,
  }
  const next = [entry, ...loadAnalyses()].slice(0, MAX_ANALYSES)
  persist(next)
  return entry
}

export function deleteAnalysis(id: string): void {
  persist(loadAnalyses().filter(a => a.id !== id))
}

/** Format an ISO timestamp as a short, locale-aware label. */
export function formatCreatedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
