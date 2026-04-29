import { useRef } from 'react'
import type { StyleProfile } from '../types'
import { SwatchChip } from './SwatchChip'

interface Props {
  profile: StyleProfile
  photo: string
}

export function ColorCard({ profile, photo }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)

  const download = async () => {
    if (!cardRef.current) return
    const html2canvas = (await import('html2canvas')).default
    const canvas = await html2canvas(cardRef.current, {
      scale: 3,
      useCORS: true,
      backgroundColor: '#faf8f5',
    })
    const link = document.createElement('a')
    const slug = (profile.name || 'color').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'color'
    link.download = `${slug}-color-analysis.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div className="space-y-3">
      {/* Downloadable card */}
      <div ref={cardRef} className="bg-[#faf8f5] rounded-3xl p-5 space-y-5 border border-stone-100">

        {/* Header with photo */}
        <div className="flex items-center gap-4">
          <img
            src={photo}
            alt={profile.name ? `${profile.name}'s portrait` : 'Your portrait'}
            className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-md flex-shrink-0"
          />
          <div>
            {profile.name && (
              <p className="text-stone-800 font-serif text-lg leading-tight mb-0.5">{profile.name}</p>
            )}
            <div className="inline-block bg-amber-100 text-amber-800 px-3 py-0.5 rounded-full text-xs font-semibold tracking-widest uppercase mb-1">
              {profile.season}
            </div>
            <p className="text-stone-600 text-xs leading-relaxed">{profile.seasonSummary}</p>
          </div>
        </div>

        {/* Why these colors work */}
        <div className="bg-amber-50 rounded-2xl p-4">
          <h3 className="text-amber-800 font-semibold text-xs uppercase tracking-wider mb-2">Why These Colors Work</h3>
          <p className="text-stone-600 text-xs leading-relaxed">{profile.colorWhyOverall}</p>
        </div>

        {/* Best colors */}
        <div>
          <h3 className="text-stone-700 font-semibold text-xs uppercase tracking-wider mb-3">Colors That Love You</h3>
          <div className="grid grid-cols-4 gap-3">
            {profile.bestColors.map(c => (
              <div key={c.hex} className="flex flex-col items-center gap-1.5">
                <SwatchChip swatch={c} size="lg" />
                {c.whyWorks && (
                  <p className="text-stone-400 text-[10px] text-center leading-tight">{c.whyWorks}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Avoid */}
        <div>
          <h3 className="text-stone-400 font-semibold text-xs uppercase tracking-wider mb-3">Colors to Skip</h3>
          <div className="grid grid-cols-4 gap-3">
            {profile.avoidColors.map(c => (
              <div key={c.hex} className="flex flex-col items-center gap-1.5">
                <SwatchChip swatch={c} size="md" muted />
                {c.whyWorks && (
                  <p className="text-stone-300 text-[10px] text-center leading-tight">{c.whyWorks}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Makeup — only when the user opted in on upload */}
        {profile.makeup && (
          <div>
            <h3 className="text-stone-700 font-semibold text-xs uppercase tracking-wider mb-3">Makeup</h3>
            <p className="text-stone-500 text-xs mb-3">{profile.makeup.foundationUndertone}</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-stone-400 text-[10px] uppercase tracking-wide mb-2">Eyes</p>
                <div className="flex gap-1.5 flex-wrap">
                  {profile.makeup.eyeshadow.map(c => <SwatchChip key={c.hex} swatch={c} size="sm" />)}
                </div>
              </div>
              <div>
                <p className="text-stone-400 text-[10px] uppercase tracking-wide mb-2">Lips</p>
                <div className="flex gap-1.5 flex-wrap">
                  {profile.makeup.lipColors.map(c => <SwatchChip key={c.hex} swatch={c} size="sm" />)}
                </div>
              </div>
              <div>
                <p className="text-stone-400 text-[10px] uppercase tracking-wide mb-2">Blush</p>
                <SwatchChip swatch={profile.makeup.blush} size="sm" />
              </div>
            </div>
          </div>
        )}

        {/* Accessories */}
        <div>
          <h3 className="text-stone-700 font-semibold text-xs uppercase tracking-wider mb-2">Accessories</h3>
          <div className="flex gap-2 flex-wrap">
            <span className="bg-stone-100 text-stone-600 text-xs px-3 py-1 rounded-full capitalize">{profile.accessories.metalTone} metals</span>
            {profile.accessories.jewelryStyle.map(j => (
              <span key={j} className="bg-stone-100 text-stone-600 text-xs px-3 py-1 rounded-full capitalize">{j}</span>
            ))}
          </div>
        </div>

        <p className="text-center text-[10px] text-stone-300">grace-style.app</p>
      </div>

      {/* Download button */}
      <button
        onClick={download}
        className="w-full py-3 rounded-2xl bg-stone-100 text-stone-600 text-sm font-medium hover:bg-stone-200 active:scale-[0.98] transition-all"
      >
        Save Color Card
      </button>
    </div>
  )
}
