import type { SavedAnalysis } from '../types'
import { formatCreatedAt } from '../utils/storage'

interface Props {
  open: boolean
  onClose: () => void
  analyses: SavedAnalysis[]
  onSelect: (a: SavedAnalysis) => void
  onDelete: (id: string) => void
}

/**
 * Slide-in panel listing every analysis stored in this browser. Each entry is
 * one tap to re-open — handy for households where multiple people use the
 * same device and want to compare past results.
 */
export function SavedDrawer({ open, onClose, analyses, onSelect, onDelete }: Props) {
  return (
    <>
      {/* Scrim */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 bg-black/30 transition-opacity z-30 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      />

      {/* Panel */}
      <aside
        aria-label="Saved analyses"
        className={`fixed top-0 right-0 h-full w-full sm:w-96 bg-[#faf8f5] shadow-xl z-40 transition-transform overflow-y-auto ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="sticky top-0 bg-[#faf8f5] border-b border-stone-100 px-5 py-4 flex items-center justify-between">
          <h2 className="font-serif text-xl text-stone-800">Saved Analyses</h2>
          <button
            onClick={onClose}
            aria-label="Close saved analyses"
            className="text-stone-500 hover:text-stone-700 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100"
          >
            ×
          </button>
        </div>

        {analyses.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-stone-500 text-sm">No saved analyses yet.</p>
            <p className="text-stone-400 text-xs mt-2 leading-relaxed">
              Run an analysis and it will appear here so you can revisit it later
              or share with someone in your household.
            </p>
          </div>
        ) : (
          <ul className="px-3 py-2 space-y-1">
            {analyses.map(a => (
              <li key={a.id}>
                <div className="flex items-center gap-3 p-2 rounded-2xl hover:bg-stone-100 transition-colors">
                  <button
                    onClick={() => onSelect(a)}
                    className="flex items-center gap-3 flex-1 text-left min-w-0"
                  >
                    <img
                      src={a.photoDataUrl}
                      alt=""
                      className="w-12 h-12 rounded-xl object-cover border border-stone-200 flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-stone-800 font-medium text-sm truncate">{a.name}</p>
                      <p className="text-stone-400 text-xs truncate">
                        {a.profile.season} · {formatCreatedAt(a.createdAt)}
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete ${a.name}'s analysis from ${formatCreatedAt(a.createdAt)}?`)) {
                        onDelete(a.id)
                      }
                    }}
                    aria-label={`Delete ${a.name}'s analysis`}
                    className="text-stone-300 hover:text-red-500 text-lg w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 flex-shrink-0"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </>
  )
}
