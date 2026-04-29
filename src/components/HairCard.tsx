import { useRef } from 'react'
import type { StyleProfile } from '../types'

interface Props {
  profile: StyleProfile
}

function readableInk(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return '#1c1917'
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  return L > 0.5 ? '#1c1917' : '#fdfcf9'
}

function masthead(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d
    .toLocaleString('en-US', { month: 'long', year: 'numeric' })
    .toUpperCase()
}

export function HairCard({ profile }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)

  // Hair colors drive the accent — gives the card its own identity vs. the
  // color card, which keys off the bestColors palette.
  const accent = profile.hair.colorOptions[0]?.hex ?? '#9b7653'
  const accentInk = readableInk(accent)

  const download = async () => {
    if (!cardRef.current) return
    // See ColorCard for why we replaced html2canvas with html-to-image.
    const { toPng } = await import('html-to-image')
    const dataUrl = await toPng(cardRef.current, {
      pixelRatio: 3,
      cacheBust: true,
      backgroundColor: '#f7f2ea',
    })
    const link = document.createElement('a')
    const slug =
      (profile.name || 'hair')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'hair'
    link.download = `${slug}-hair-analysis.png`
    link.href = dataUrl
    link.click()
  }

  return (
    <div className="space-y-3">
      <div
        ref={cardRef}
        className="relative rounded-2xl overflow-hidden shadow-[0_8px_28px_rgba(120,90,40,0.10)]"
        style={{
          background:
            'radial-gradient(circle at 50% 0%, #fbf6ee 0%, #f7f2ea 55%, #f1eade 100%)',
        }}
      >
        {/* Top accent strip */}
        <div className="h-1.5 w-full" style={{ backgroundColor: accent }} />

        <div className="px-6 pt-5 pb-6 space-y-6">
          {/* ── Masthead ─────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between text-[9px] tracking-[0.22em] text-stone-500 font-medium">
            <span>HAIR&nbsp;ANALYSIS</span>
            <span className="flex items-center gap-2">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: accent }}
              />
              VOL.&nbsp;01
            </span>
            <span>{masthead(profile.analyzedAt)}</span>
          </div>

          {/* ── Hero ─────────────────────────────────────────────────────── */}
          <div className="text-center space-y-2 pt-1">
            {profile.name && (
              <p className="font-serif italic text-stone-600 text-base">
                {profile.name}
              </p>
            )}

            <div className="flex items-center justify-center gap-3 text-stone-400">
              <span
                className="h-px w-6"
                style={{ backgroundColor: accent, opacity: 0.5 }}
              />
              <span className="text-[9px] tracking-[0.3em] font-medium">
                FACE SHAPE
              </span>
              <span
                className="h-px w-6"
                style={{ backgroundColor: accent, opacity: 0.5 }}
              />
            </div>

            <h2 className="font-serif text-stone-800 text-[34px] leading-[1.05] tracking-tight capitalize">
              {profile.hair.faceShape}
            </h2>
          </div>

          {/* ── Hairstyles ──────────────────────────────────────────────── */}
          <section className="space-y-3">
            <div className="flex items-center gap-3 text-stone-400">
              <div
                className="editorial-rule flex-1"
                style={{ color: accent, opacity: 0.4 }}
              />
              <h3 className="text-stone-700 text-[10px] label-caps">
                Hairstyles&nbsp;For&nbsp;You
              </h3>
              <div
                className="editorial-rule flex-1"
                style={{ color: accent, opacity: 0.4 }}
              />
            </div>

            <div className="space-y-2.5">
              {profile.hair.hairstyles.map((style, i) => (
                <div
                  key={i}
                  className="bg-white/70 rounded-xl p-3 border border-stone-100"
                >
                  <div className="flex items-baseline gap-2 mb-1">
                    <span
                      className="font-serif text-[20px] leading-none"
                      style={{ color: accent, opacity: 0.7 }}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <p className="font-serif text-stone-800 text-[15px] leading-tight">
                      {style.name}
                    </p>
                  </div>
                  <p className="text-stone-600 text-[11px] leading-snug mb-1.5">
                    {style.description}
                  </p>
                  <p
                    className="text-[10px] leading-snug italic font-serif"
                    style={{ color: accent, filter: 'brightness(0.7)' }}
                  >
                    {style.why}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Hair Colors ─────────────────────────────────────────────── */}
          <section className="space-y-3">
            <div className="flex items-center gap-3 text-stone-400">
              <div
                className="editorial-rule flex-1"
                style={{ color: accent, opacity: 0.4 }}
              />
              <h3 className="text-stone-700 text-[10px] label-caps">
                Color&nbsp;Options
              </h3>
              <div
                className="editorial-rule flex-1"
                style={{ color: accent, opacity: 0.4 }}
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {profile.hair.colorOptions.map(c => (
                <div
                  key={c.hex + c.name}
                  className="rounded-md overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                >
                  <div
                    className="aspect-square relative"
                    style={{ backgroundColor: c.hex }}
                  >
                    <span
                      className="absolute top-1.5 right-1.5 text-[8px] font-medium tracking-wider"
                      style={{ color: readableInk(c.hex), opacity: 0.7 }}
                    >
                      {c.hex.toUpperCase()}
                    </span>
                  </div>
                  <div className="bg-white/90 px-2 py-1.5">
                    <p className="font-serif text-stone-800 text-[11px] leading-tight">
                      {c.name}
                    </p>
                    {c.whyWorks && (
                      <p className="text-stone-500 text-[9px] leading-snug mt-0.5 line-clamp-3">
                        {c.whyWorks}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Style Notes ─────────────────────────────────────────────── */}
          <section className="space-y-3">
            <div className="flex items-center gap-3 text-stone-400">
              <div
                className="editorial-rule flex-1"
                style={{ color: accent, opacity: 0.4 }}
              />
              <h3 className="text-stone-700 text-[10px] label-caps">
                Style&nbsp;Notes
              </h3>
              <div
                className="editorial-rule flex-1"
                style={{ color: accent, opacity: 0.4 }}
              />
            </div>

            <ul className="space-y-1.5">
              {profile.hair.styleNotes.map((note, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span
                    className="font-serif text-[13px] leading-none mt-0.5"
                    style={{ color: accent }}
                  >
                    ✦
                  </span>
                  <p className="text-stone-700 text-[11px] leading-relaxed font-serif italic">
                    {note}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {/* ── Footer masthead ─────────────────────────────────────────── */}
          <div className="pt-2 flex items-center justify-between text-[8px] tracking-[0.25em] text-stone-400 font-medium">
            <span>{profile.name ? profile.name.toUpperCase() : 'YOUR'}&nbsp;·&nbsp;HAIR</span>
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: accent, opacity: 0.7 }}
            />
            <span>GRACE-STYLE.APP</span>
          </div>
        </div>
      </div>

      <button
        onClick={download}
        className="w-full py-3 rounded-2xl bg-stone-800 text-white text-sm font-medium hover:bg-stone-700 active:scale-[0.98] transition-all"
      >
        Save Hair Card
      </button>
    </div>
  )
}
