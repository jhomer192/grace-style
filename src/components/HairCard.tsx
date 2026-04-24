import { useRef } from 'react'
import type { StyleProfile } from '../types'

interface Props {
  profile: StyleProfile
}

export function HairCard({ profile }: Props) {
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
    link.download = 'hair-analysis.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div className="space-y-3">
      <div ref={cardRef} className="bg-[#faf8f5] rounded-3xl p-5 space-y-5 border border-stone-100">

        {/* Face shape */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-stone-700 font-semibold text-xs uppercase tracking-wider mb-1">Face Shape</h3>
            <span className="bg-amber-100 text-amber-800 px-3 py-0.5 rounded-full text-xs font-semibold capitalize">
              {profile.hair.faceShape}
            </span>
          </div>
        </div>

        {/* Hairstyle recommendations */}
        <div>
          <h3 className="text-stone-700 font-semibold text-xs uppercase tracking-wider mb-3">Hairstyles For You</h3>
          <div className="space-y-3">
            {profile.hair.hairstyles.map((style, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-stone-100">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-amber-700 text-xs font-bold">{i + 1}</span>
                  </div>
                  <div>
                    <p className="text-stone-800 font-semibold text-sm">{style.name}</p>
                    <p className="text-stone-500 text-xs mt-0.5 leading-relaxed">{style.description}</p>
                    <p className="text-amber-700 text-xs mt-1.5 leading-relaxed">
                      <span className="font-medium">Why: </span>{style.why}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hair color options */}
        <div>
          <h3 className="text-stone-700 font-semibold text-xs uppercase tracking-wider mb-3">Hair Colors That Suit You</h3>
          <div className="grid grid-cols-3 gap-3">
            {profile.hair.colorOptions.map(c => (
              <div key={c.hex} className="flex flex-col items-center gap-1.5">
                <div
                  className="w-14 h-14 rounded-2xl border-2 border-white shadow-md"
                  style={{ backgroundColor: c.hex }}
                />
                <p className="text-stone-600 text-xs font-medium text-center">{c.name}</p>
                {c.whyWorks && (
                  <p className="text-stone-400 text-[10px] text-center leading-tight">{c.whyWorks}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Style tips */}
        <div>
          <h3 className="text-stone-700 font-semibold text-xs uppercase tracking-wider mb-3">Style Tips</h3>
          <ul className="space-y-2">
            {profile.hair.styleNotes.map((note, i) => (
              <li key={i} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 mt-1.5" />
                <p className="text-stone-600 text-xs leading-relaxed">{note}</p>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-center text-[10px] text-stone-300">grace-style.app</p>
      </div>

      <button
        onClick={download}
        className="w-full py-3 rounded-2xl bg-stone-100 text-stone-600 text-sm font-medium hover:bg-stone-200 active:scale-[0.98] transition-all"
      >
        Save Hair Card
      </button>
    </div>
  )
}
