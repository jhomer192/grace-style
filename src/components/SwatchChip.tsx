import { useState } from 'react'
import type { ColorSwatch } from '../types'

interface Props {
  swatch: ColorSwatch
  size?: 'sm' | 'md' | 'lg'
  muted?: boolean
}

export function SwatchChip({ swatch, size = 'md', muted = false }: Props) {
  const [copied, setCopied] = useState(false)

  const handleTap = () => {
    navigator.clipboard.writeText(swatch.hex).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const sizes = { sm: 'w-8 h-8', md: 'w-12 h-12', lg: 'w-16 h-16' }

  return (
    <button onClick={handleTap} className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
      <div
        className={`${sizes[size]} rounded-full border-2 border-white shadow-md relative ${muted ? 'opacity-40' : ''}`}
        style={{ backgroundColor: swatch.hex }}
      >
        {copied && (
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
            <span className="text-white text-xs font-bold">✓</span>
          </div>
        )}
      </div>
      <span className={`text-xs text-center leading-tight max-w-[56px] ${muted ? 'text-stone-400' : 'text-stone-600'}`}>
        {copied ? 'Copied!' : swatch.name}
      </span>
    </button>
  )
}
