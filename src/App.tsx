import { useState, useRef } from 'react'
import type { StyleProfile } from './types'
import { UploadZone } from './components/UploadZone'
import { LoadingState } from './components/LoadingState'
import { ColorCard } from './components/ColorCard'
import { HairCard } from './components/HairCard'

type Tab = 'color' | 'hair'

export default function App() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<StyleProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('color')
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    setLoading(true)
    setError(null)
    setProfile(null)

    const form = new FormData()
    form.append('photo', file)

    try {
      const res = await fetch('/api/analyze', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')
      if (data.error) {
        setError(data.error)
      } else {
        setProfile(data as StyleProfile)
        setTab('color')
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

  return (
    <div className="min-h-screen bg-[#faf8f5] font-sans">
      {/* Header */}
      <header className="text-center pt-10 pb-6 px-4">
        <h1 className="text-4xl font-serif text-stone-800 tracking-tight mb-1">Style Analysis</h1>
        <p className="text-stone-500 text-sm">Upload a clear, front-facing photo to discover your season</p>
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
              Your photo is sent to Anthropic for analysis only and is not stored.
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
    </div>
  )
}
