import { useEffect, useRef, useState } from 'react'
import type { SavedAnalysis, StyleProfile } from './types'
import { UploadZone } from './components/UploadZone'
import { LoadingState } from './components/LoadingState'
import { ColorCard } from './components/ColorCard'
import { HairCard } from './components/HairCard'
import { SavedDrawer } from './components/SavedDrawer'
import { deleteAnalysis, loadAnalyses, saveAnalysis } from './utils/storage'

type Tab = 'color' | 'hair'

/** Server-side limit (see server.ts MAX_PHOTOS). Mirrored here so the UI
 *  blocks over-selection client-side and we never bother the server. */
const MAX_PHOTOS = 5
const MAX_FILE_SIZE = 10 * 1024 * 1024

interface PendingPhoto {
  file: File
  preview: string
}

/** Read a File as a data URL — used for previewing and for persisting the
 *  hero image into localStorage. */
function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error ?? new Error('FileReader failed'))
    r.readAsDataURL(file)
  })
}

export default function App() {
  const [photos, setPhotos] = useState<PendingPhoto[]>([])
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<StyleProfile | null>(null)
  // The hero photo to render on the result card. When opening a saved
  // analysis we don't have the original Files, only the persisted data URL,
  // so we keep this independent of `photos`.
  const [resultPhoto, setResultPhoto] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('color')
  const [name, setName] = useState('')
  const [includeMakeup, setIncludeMakeup] = useState(true)
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setAnalyses(loadAnalyses())
  }, [])

  /**
   * Append newly-picked files to the pending photo set, up to the cap. Each
   * file is validated for size and type; bad files are surfaced as a single
   * error rather than silently dropped, otherwise users can't tell why their
   * photo didn't appear.
   */
  const addFiles = async (incoming: File[]) => {
    setError(null)
    const slots = MAX_PHOTOS - photos.length
    if (slots <= 0) {
      setError(`Already at the ${MAX_PHOTOS}-photo limit`)
      return
    }
    const accepted: PendingPhoto[] = []
    const rejections: string[] = []

    for (const f of incoming.slice(0, slots)) {
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) {
        rejections.push(`${f.name}: must be JPG, PNG, or WebP`)
        continue
      }
      if (f.size > MAX_FILE_SIZE) {
        rejections.push(`${f.name}: must be under 10MB`)
        continue
      }
      try {
        const preview = await readDataUrl(f)
        accepted.push({ file: f, preview })
      } catch {
        rejections.push(`${f.name}: could not be read`)
      }
    }

    if (accepted.length > 0) {
      setPhotos(prev => [...prev, ...accepted])
      setProfile(null)
    }
    if (rejections.length > 0) {
      setError(rejections.join('  ·  '))
    } else if (incoming.length > slots) {
      setError(`Only the first ${slots} photo${slots === 1 ? '' : 's'} were added — limit is ${MAX_PHOTOS}`)
    }
  }

  const removePhoto = (idx: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== idx))
  }

  const analyze = async () => {
    if (photos.length === 0) return
    if (!name.trim()) {
      setError('Please enter a name so we can label your saved card')
      return
    }
    setLoading(true)
    setError(null)
    setProfile(null)

    const form = new FormData()
    // multer.array('photo', ...) accepts the same field name repeated. Each
    // photo is appended as a separate `photo` part.
    for (const p of photos) form.append('photo', p.file)
    form.append('name', name.trim())
    form.append('includeMakeup', includeMakeup ? 'true' : 'false')

    try {
      const res = await fetch('/api/analyze', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')
      if (data.error) {
        setError(data.error)
      } else {
        const result = data as StyleProfile
        setProfile(result)
        setTab('color')
        // The first uploaded photo becomes the hero/saved image. The other
        // photos informed the analysis but are discarded post-analyze to
        // keep localStorage under quota for households running 30 saves.
        const hero = photos[0].preview
        setResultPhoto(hero)
        const saved = saveAnalysis(name.trim(), result, hero)
        setAnalyses(prev => [saved, ...prev.filter(a => a.id !== saved.id)])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setPhotos([])
    setProfile(null)
    setResultPhoto(null)
    setError(null)
    setLoading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  /** Re-open a previously saved analysis without re-running the API. */
  const openSaved = (a: SavedAnalysis) => {
    setPhotos([])
    setResultPhoto(a.photoDataUrl)
    setProfile(a.profile)
    setName(a.name)
    setIncludeMakeup(Boolean(a.profile.makeup))
    setError(null)
    setLoading(false)
    setTab('color')
    setDrawerOpen(false)
  }

  const removeSaved = (id: string) => {
    deleteAnalysis(id)
    setAnalyses(loadAnalyses())
  }

  return (
    <div className="min-h-screen bg-[#faf8f5] font-sans">
      {/* Header */}
      <header className="relative text-center pt-10 pb-6 px-4">
        <h1 className="text-4xl font-serif text-stone-800 tracking-tight mb-1">Personal Palette Generator</h1>
        <p className="text-stone-500 text-sm">Color & style analysis — for everyone</p>

        {/* Saved analyses trigger. Hidden when empty so first-run isn't cluttered. */}
        {analyses.length > 0 && (
          <button
            onClick={() => setDrawerOpen(true)}
            className="absolute top-10 right-4 sm:right-6 flex items-center gap-1.5 text-stone-600 text-xs bg-white border border-stone-200 rounded-full px-3 py-1.5 hover:bg-stone-50 transition-colors"
            aria-label="Open saved analyses"
          >
            <span className="font-medium">Saved</span>
            <span className="bg-stone-100 text-stone-600 rounded-full px-1.5 text-[10px] font-semibold">
              {analyses.length}
            </span>
          </button>
        )}
      </header>

      <main className="max-w-md mx-auto px-4 pb-16">
        {/* Upload + analyze */}
        {!profile && !loading && (
          <div className="space-y-4">
            <UploadZone
              previews={photos.map(p => p.preview)}
              maxPhotos={MAX_PHOTOS}
              fileInputRef={fileInputRef}
              onAddFiles={addFiles}
              onRemove={removePhoto}
            />

            {/* Name field — required so the saved card is labelled */}
            <label className="block">
              <span className="text-stone-600 text-xs font-medium uppercase tracking-wider">Your name</span>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Jack"
                maxLength={60}
                className="mt-1.5 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-stone-800 placeholder-stone-400 focus:outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-100"
              />
            </label>

            {/* Makeup toggle. Defaults on; users who don't want makeup recs flip it off. */}
            <label className="flex items-center justify-between gap-3 bg-white border border-stone-200 rounded-2xl px-4 py-3 cursor-pointer">
              <span className="flex flex-col">
                <span className="text-stone-700 text-sm font-medium">Include makeup palette</span>
                <span className="text-stone-400 text-xs">Foundation undertone, eyeshadow, lips, blush + face mockup</span>
              </span>
              <input
                type="checkbox"
                checked={includeMakeup}
                onChange={e => setIncludeMakeup(e.target.checked)}
                className="w-5 h-5 rounded accent-stone-700 cursor-pointer"
              />
            </label>

            {error && (
              <p className="text-red-500 text-sm text-center bg-red-50 rounded-xl py-3 px-4">{error}</p>
            )}

            {photos.length > 0 && (
              <button
                onClick={analyze}
                className="w-full bg-stone-800 text-white py-4 rounded-2xl text-base font-medium tracking-wide hover:bg-stone-700 active:scale-[0.98] transition-all"
              >
                Analyze My Colors
              </button>
            )}

            <p className="text-center text-xs text-stone-400">
              Your photos are sent to Anthropic for analysis only and are not stored on our servers.
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && <LoadingState />}

        {/* Results */}
        {profile && !loading && resultPhoto && (
          <div className="space-y-4">
            {/* Editorial header — minimal here since the heavy treatment lives on the cards themselves */}
            <div className="text-center space-y-1 py-2">
              {profile.name && (
                <p className="text-stone-500 text-[10px] uppercase tracking-[0.3em] font-medium">
                  {profile.name}'s analysis
                </p>
              )}
              <h2 className="font-serif text-stone-800 text-2xl tracking-tight">
                {profile.season}
              </h2>
              <p className="text-stone-500 text-[10px] uppercase tracking-[0.25em]">
                {profile.undertone} undertone
                {profile.photoCount && profile.photoCount > 1 ? ` · ${profile.photoCount} photos` : ''}
              </p>
            </div>

            {/* Tabs */}
            <div className="flex rounded-2xl bg-stone-100 p-1">
              {(['color', 'hair'] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all capitalize ${
                    tab === t
                      ? 'bg-white text-stone-800 shadow-sm'
                      : 'text-stone-500 hover:text-stone-700'
                  }`}
                >
                  {t === 'color' ? 'Colors' : 'Hair'}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {tab === 'color' && <ColorCard profile={profile} photo={resultPhoto} />}
            {tab === 'hair' && <HairCard profile={profile} />}

            {/* Try another */}
            <button
              onClick={reset}
              className="w-full py-3 rounded-2xl text-stone-500 text-sm border border-stone-200 hover:border-stone-300 hover:text-stone-700 transition-all"
            >
              Try Another Photo
            </button>
          </div>
        )}
      </main>

      <SavedDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        analyses={analyses}
        onSelect={openSaved}
        onDelete={removeSaved}
      />
    </div>
  )
}
