import { useRef, type RefObject } from 'react'

interface Props {
  /** Up to MAX_PHOTOS data: URLs, in display order (first becomes the hero). */
  previews: string[]
  /** Hard cap matching the server's MAX_PHOTOS — 5 is plenty for the analysis. */
  maxPhotos: number
  fileInputRef: RefObject<HTMLInputElement | null>
  onAddFiles: (files: File[]) => void
  onRemove: (index: number) => void
}

/**
 * Multi-photo upload zone.
 *
 * UX shape: when no photos are picked, render the original big drop-zone CTA.
 * Once at least one is picked, the hero photo takes the top tile and the rest
 * appear as a thumbnail strip with a "+ Add more" cell when capacity remains.
 * Each thumb gets a remove button so users can swap one out without resetting.
 *
 * Why a hero + strip rather than a 5-equal grid: the first photo is the one
 * that becomes the saved card's portrait, so it deserves the visual emphasis.
 */
export function UploadZone({
  previews,
  maxPhotos,
  fileInputRef,
  onAddFiles,
  onRemove,
}: Props) {
  const dragRef = useRef(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragRef.current = false
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) onAddFiles(files)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length > 0) onAddFiles(files)
    // Reset so picking the same file twice in a row still triggers onChange
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const triggerPick = () => fileInputRef.current?.click()

  // ── Empty state ────────────────────────────────────────────────────────
  if (previews.length === 0) {
    return (
      <div
        onDragOver={e => {
          e.preventDefault()
          dragRef.current = true
        }}
        onDragLeave={() => {
          dragRef.current = false
        }}
        onDrop={handleDrop}
        onClick={triggerPick}
        className="relative cursor-pointer rounded-3xl border-2 border-dashed border-stone-300 hover:border-stone-400 transition-colors bg-white overflow-hidden"
        style={{ minHeight: 280 }}
      >
        <div className="flex flex-col items-center justify-center h-72 gap-3 px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center">
            <svg
              className="w-7 h-7 text-stone-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z"
              />
            </svg>
          </div>
          <div>
            <p className="text-stone-700 font-medium">Upload your photos</p>
            <p className="text-stone-400 text-xs mt-1">
              Up to {maxPhotos} photos · different outfits & lighting sharpen the read
            </p>
          </div>
          <span className="text-xs text-stone-400 bg-stone-50 px-3 py-1 rounded-full">
            JPG, PNG, WebP · Max 10MB each
          </span>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={handleChange}
        />
      </div>
    )
  }

  // ── Populated state ────────────────────────────────────────────────────
  const remaining = maxPhotos - previews.length
  const [hero, ...rest] = previews

  return (
    <div className="space-y-2">
      {/* Hero photo */}
      <div
        className="relative rounded-3xl overflow-hidden bg-white border border-stone-200"
        style={{ height: 280 }}
      >
        <img src={hero} alt="Hero portrait" className="w-full h-full object-cover" />
        <button
          type="button"
          onClick={() => onRemove(0)}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 text-white text-sm flex items-center justify-center backdrop-blur-sm"
          aria-label="Remove hero photo"
        >
          ×
        </button>
        <div className="absolute bottom-3 left-3 text-white text-[10px] tracking-[0.2em] uppercase bg-black/40 px-2 py-1 rounded-full backdrop-blur-sm">
          Hero · 1 of {previews.length}
        </div>
      </div>

      {/* Thumbnail strip + add tile */}
      {(rest.length > 0 || remaining > 0) && (
        <div className="grid grid-cols-5 gap-2">
          {rest.map((src, i) => (
            <div
              key={`${i}-${src.slice(0, 32)}`}
              className="relative aspect-square rounded-xl overflow-hidden bg-white border border-stone-200"
            >
              <img
                src={src}
                alt={`Photo ${i + 2}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => onRemove(i + 1)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/55 hover:bg-black/75 text-white text-xs flex items-center justify-center backdrop-blur-sm"
                aria-label={`Remove photo ${i + 2}`}
              >
                ×
              </button>
            </div>
          ))}
          {remaining > 0 && (
            <button
              type="button"
              onClick={triggerPick}
              className="aspect-square rounded-xl border-2 border-dashed border-stone-300 hover:border-stone-400 hover:bg-stone-50 transition-colors text-stone-400 text-2xl flex flex-col items-center justify-center"
              aria-label="Add another photo"
            >
              <span className="leading-none">+</span>
              <span className="text-[9px] tracking-[0.18em] uppercase mt-0.5 text-stone-400">
                Add
              </span>
            </button>
          )}
        </div>
      )}

      <p className="text-stone-400 text-xs text-center pt-1">
        {previews.length === 1
          ? 'Tip: add 1–4 more in different shirts or lighting for a sharper analysis'
          : `Analyzing from ${previews.length} photo${previews.length > 1 ? 's' : ''}`}
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={handleChange}
      />
    </div>
  )
}
