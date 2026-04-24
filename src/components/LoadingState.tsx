import { useEffect, useState } from 'react'

const MESSAGES = [
  'Reading your undertones...',
  'Mapping your season...',
  'Curating your palette...',
  'Analyzing your features...',
  'Finding your best colors...',
  'Styling your look...',
]

export function LoadingState() {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % MESSAGES.length), 2200)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6">
      <div className="w-14 h-14 rounded-full border-4 border-stone-200 border-t-amber-600 animate-spin" />
      <p className="text-stone-500 text-sm text-center min-h-[20px] transition-all">{MESSAGES[idx]}</p>
    </div>
  )
}
