import { useEffect, useState } from 'react'

const MESSAGES = [
  'Reading your undertones...',
  'Mapping your season...',
  'Curating your palette...',
  'Analyzing your features...',
  'Finding your best colors...',
  'Styling your look...',
]

/**
 * Loading screen for /api/analyze.
 *
 * Two pieces of information beyond the spinner:
 *   1. A rotating tagline so the screen feels alive.
 *   2. A live elapsed-seconds counter + an explicit "usually 30–60s" hint.
 *
 * The counter matters because Claude's vision step routinely takes 30–45s
 * for a multi-photo analysis, and without a number the user has no way to
 * tell whether the spinner is making progress or hung. After 75s we add a
 * gentle "still going" message so they don't bounce; the actual hard
 * timeout (110s on the client, 90s on the server) takes over from there.
 */
export function LoadingState() {
  const [idx, setIdx] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % MESSAGES.length), 2200)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const start = Date.now()
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }, 500)
    return () => clearInterval(t)
  }, [])

  const slow = elapsed > 75

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-5">
      <div className="w-14 h-14 rounded-full border-4 border-stone-200 border-t-amber-600 animate-spin" />

      <p className="text-stone-600 text-sm text-center min-h-[20px] transition-all">
        {MESSAGES[idx]}
      </p>

      <div className="flex items-center gap-2 text-[11px] text-stone-400">
        <span className="font-mono tabular-nums">{elapsed}s</span>
        <span>·</span>
        <span>usually 30–60 seconds</span>
      </div>

      {slow && (
        <p className="text-stone-500 text-[11px] text-center max-w-[260px] mt-2 leading-snug">
          Still going — a multi-photo analysis can take a little longer.
          Hang tight, almost there.
        </p>
      )}
    </div>
  )
}
