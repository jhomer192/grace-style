import { useEffect, useRef, useState } from 'react'
import type { SavedAnalysis, StyleProfile } from './types'
import { UploadZone } from './components/UploadZone'
import { LoadingState } from './components/LoadingState'
import { ColorCard } from './components/ColorCard'
import { HairCard } from './components/HairCard'
import { SavedDrawer } from './components/SavedDrawer'
import { deleteAnalysis, loadAnalyses, saveAnalysis } from './utils/storage'

type Tab = 'color' | 'hair'

export default function App() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<StyleProfile | null>(null)
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

  const handleFile = (f: File) => {
    if (f.size > 10 * 1024 * 1024) {
      setError('Photo must be under 10MB')
      return
    }
    setFile(f)
    setError(null)
    setProfile(null)
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target?.result as string)
    reader.readAsDataURL(f)
  }

  const analyze = async () => {
    if (!file) return
    if (!name.trim()) {
      setError('Please enter a name so we can label your saved card')
      return
    }
    setLoading(true)
    setError(null)
    setProfile(null)

    const form = new FormData()
    form.append('photo', file)
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
        // Persist so the drawer immediately reflects the new entry. We use
        // the data: URL that's already in `preview` rather than re-reading
        // the file, since FileReader is async.
        if (preview) {
          const saved = saveAnalysis(name.trim(), result, preview)
          setAnalyses(prev => [saved, ...prev.filter(a => a.id !== saved.id)])
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setFile(null)
    setPreview(null)
    setProfile(null)
    setError(null)
    setLoading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  /** Re-open a previously saved analysis without re-running the API. */
  const openSaved = (a: SavedAnalysis) => {
    setFile(null)
    setPreview(a.photoDataUrl)
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
        <h1 className="text-4xl font-serif text-stone-800 tracking-tight mb-1">Style Analysis</h1>
        <p className="text-stone-500 text-sm">Personal color & style analysis — for everyone</p>

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
              preview={preview}
              fileInputRef={fileInputRef}
              onFile={handleFile}
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
                <span className="text-stone-400 text-xs">Foundation undertone, eyeshadow, lips, blush</span>
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

            {file && (
              <button
                onClick={analyze}
                className="w-full bg-stone-800 text-white py-4 rounded-2xl text-base font-medium tracking-wide hover:bg-stone-700 active:scale-[0.98] transition-all"
              >
                Analyze My Colors
              </button>
            )}

            <p className="text-center text-xs text-stone-400">
              Your photo is sent to Anthropic for analysis only and is not stored on our servers.
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && <LoadingState />}

        {/* Results */}
        {profile && !loading && (
          <div className="space-y-4">
            {/* Season badge */}
            <div className="text-center">
              {profile.name && (
                <p className="text-stone-500 text-xs uppercase tracking-widest mb-1">{profile.name}'s analysis</p>
              )}
              <div className="inline-block bg-amber-100 text-amber-800 px-5 py-1.5 rounded-full text-sm font-semibold tracking-widest uppercase mb-1">
                {profile.season}
              </div>
              <div className="text-stone-500 text-xs mt-1">
                {profile.undertone === 'warm' ? 'Warm' : profile.undertone === 'cool' ? 'Cool' : 'Neutral'} undertone
              </div>
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
            {tab === 'color' && <ColorCard profile={profile} photo={preview!} />}
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
