import { useRef, type RefObject } from 'react'

interface Props {
  preview: string | null
  fileInputRef: RefObject<HTMLInputElement | null>
  onFile: (f: File) => void
}

export function UploadZone({ preview, fileInputRef, onFile }: Props) {
  const dragRef = useRef(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragRef.current = false
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) onFile(f)
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); dragRef.current = true }}
      onDragLeave={() => { dragRef.current = false }}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className="relative cursor-pointer rounded-3xl border-2 border-dashed border-stone-300 hover:border-stone-400 transition-colors bg-white overflow-hidden"
      style={{ minHeight: 280 }}
    >
      {preview ? (
        <div className="relative w-full h-72">
          <img
            src={preview}
            alt="Your photo"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/20 flex items-end justify-center pb-4">
            <span className="text-white text-xs bg-black/40 px-3 py-1 rounded-full">Tap to change</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-72 gap-3 px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center">
            <svg className="w-7 h-7 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
            </svg>
          </div>
          <div>
            <p className="text-stone-700 font-medium">Upload your photo</p>
            <p className="text-stone-400 text-xs mt-1">Front-facing, good lighting works best</p>
          </div>
          <span className="text-xs text-stone-400 bg-stone-50 px-3 py-1 rounded-full">JPG, PNG, WebP · Max 10MB</span>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  )
}
