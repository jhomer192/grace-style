import { useRef, useState } from 'react'
import type { StyleProfile } from '../types'
import { MakeupMockup } from './MakeupMockup'

interface Props {
  profile: StyleProfile
  photo: string
}

type Fit = 'boxy' | 'slim'
type Gender = 'mens' | 'womens'

/**
 * Build a Google Shopping search URL for a t-shirt of a given color, fit,
 * and gender. Google Shopping is multi-retailer (Amazon, Uniqlo, J.Crew,
 * Target, etc. all surface in one results page), takes color names as plain
 * English, and requires no API key. The query string just packs in the
 * descriptors — the relevance is whatever Google's shopping index decides.
 *
 * Why not Amazon-only: locking to one retailer narrows price + style range
 * a lot, especially for less common colors. Multi-retailer search lets the
 * user pick whatever shop they trust.
 */
function shopUrl(colorName: string, fit: Fit, gender: Gender): string {
  const fitWord = fit === 'boxy' ? 'boxy oversized' : 'slim fit fitted'
  const genderWord = gender === 'mens' ? "men's" : "women's"
  const q = `${colorName} ${fitWord} t-shirt ${genderWord}`
  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(q)}`
}

/**
 * Pick a foreground color (near-black or off-white) that contrasts with `hex`,
 * using the WCAG luminance formula. Used so paint-chip labels stay legible
 * against any palette color the model returns.
 */
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

/** Format an analyzedAt ISO string as `MAY 2026` for the magazine masthead. */
function masthead(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d
    .toLocaleString('en-US', { month: 'long', year: 'numeric' })
    .toUpperCase()
}

/** Two-option pill toggle used for the fit and gender selectors. Kept tiny
 *  and inline so the editorial card doesn't grow a chunky form-control look. */
function SegToggle<T extends string>({
  accent,
  value,
  options,
  onChange,
}: {
  accent: string
  value: T
  options: ReadonlyArray<{ v: T; label: string }>
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex rounded-full bg-white border border-stone-200 p-0.5">
      {options.map(opt => {
        const active = opt.v === value
        return (
          <button
            key={opt.v}
            type="button"
            onClick={() => onChange(opt.v)}
            className={`px-2.5 py-1 rounded-full text-[10px] tracking-wide font-medium transition-colors ${
              active
                ? 'text-white shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
            style={active ? { backgroundColor: accent } : undefined}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

/** A single paint-chip swatch — color block on top, label band below.
 *  When `href` is set the whole chip becomes a clickable link (opens in a
 *  new tab) so users can shop the color in one tap. */
function PaintChip({
  hex,
  name,
  whyWorks,
  muted = false,
  showHex = true,
  href,
}: {
  hex: string
  name: string
  whyWorks?: string
  muted?: boolean
  showHex?: boolean
  href?: string
}) {
  const ink = readableInk(hex)

  const inner = (
    <div className="aspect-[4/5] flex flex-col">
      {/* Color block — takes ~70% of chip height */}
      <div className="flex-1 relative" style={{ backgroundColor: hex }}>
        {showHex && (
          <span
            className="absolute top-1.5 right-1.5 text-[8px] font-medium tracking-wider"
            style={{ color: ink, opacity: 0.7 }}
          >
            {hex.toUpperCase()}
          </span>
        )}
        {href && (
          /* Subtle "shop" affordance on hover so the chip reads as
             interactive without cluttering the editorial layout. */
          <span
            className="absolute bottom-1 left-1 text-[7.5px] font-medium tracking-[0.18em] uppercase rounded-full px-1.5 py-0.5 backdrop-blur-sm"
            style={{
              color: ink,
              backgroundColor: ink === '#1c1917' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.35)',
            }}
          >
            Shop ↗
          </span>
        )}
      </div>
      {/* Label band — cream-on-cream so the color stays the hero */}
      <div className="bg-white/90 px-1.5 py-1.5">
        <p className="text-stone-800 text-[10px] font-medium leading-tight font-serif">
          {name}
        </p>
        {whyWorks && (
          <p className="text-stone-500 text-[8px] leading-snug mt-0.5 line-clamp-2">
            {whyWorks}
          </p>
        )}
      </div>
    </div>
  )

  const baseClass = `relative rounded-md overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.06)] ${
    muted ? 'opacity-60' : ''
  } ${href ? 'block transition-transform hover:scale-[1.03] hover:shadow-md' : ''}`

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-label={`Shop ${name} t-shirts`}
        className={baseClass}
      >
        {inner}
      </a>
    )
  }
  return <div className={baseClass}>{inner}</div>
}

export function ColorCard({ profile, photo }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  // Shop-link controls. These pin the per-chip Google Shopping URL to the
  // user's actual silhouette + gender preference rather than guessing — so
  // a man who wears boxy tees gets boxy men's results and not a generic
  // unisex search. The state is local because it shouldn't persist across
  // analyses (Gary's preference != Grace's), but it does survive tab
  // switches because the component instance lives across them.
  const [fit, setFit] = useState<Fit>('boxy')
  const [gender, setGender] = useState<Gender>('mens')

  // Hero accent: pull from the first best color so each analysis has its own
  // signature tint. Fall back to a warm cream if for some reason the array is empty.
  const accent = profile.bestColors[0]?.hex ?? '#c9a679'
  const accentInk = readableInk(accent)

  const download = async () => {
    if (!cardRef.current) return
    // We use html-to-image (SVG foreignObject) instead of html2canvas because
    // html2canvas 1.4.1 chokes on Tailwind 4's oklch() color values.
    const { toPng } = await import('html-to-image')
    const dataUrl = await toPng(cardRef.current, {
      pixelRatio: 3,
      cacheBust: true,
      backgroundColor: '#f7f2ea',
    })
    const link = document.createElement('a')
    const slug =
      (profile.name || 'color')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'color'
    link.download = `${slug}-color-analysis.png`
    link.href = dataUrl
    link.click()
  }

  return (
    <div className="space-y-3">
      {/* Downloadable card — fixed 9:16-ish portrait frame for IG-story / Threads sharing. */}
      <div
        ref={cardRef}
        className="relative rounded-2xl overflow-hidden shadow-[0_8px_28px_rgba(120,90,40,0.10)]"
        style={{
          background:
            'radial-gradient(circle at 50% 0%, #fbf6ee 0%, #f7f2ea 55%, #f1eade 100%)',
        }}
      >
        {/* Decorative accent strip across the very top */}
        <div className="h-1.5 w-full" style={{ backgroundColor: accent }} />

        <div className="px-6 pt-5 pb-6 space-y-6">
          {/* ── Masthead ─────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between text-[9px] tracking-[0.22em] text-stone-500 font-medium">
            <span>STYLE&nbsp;ANALYSIS</span>
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
          <div className="text-center space-y-3 pt-1">
            {/* Circular portrait with accent ring */}
            <div className="flex justify-center">
              <div
                className="rounded-full p-[3px]"
                style={{
                  background: `conic-gradient(from 180deg, ${accent}, #e9dcc6, ${accent})`,
                }}
              >
                <img
                  src={photo}
                  alt={profile.name ? `${profile.name}'s portrait` : 'Your portrait'}
                  className="w-24 h-24 rounded-full object-cover border-[3px] border-[#fbf6ee]"
                />
              </div>
            </div>

            {profile.name && (
              <p className="font-serif italic text-stone-600 text-base">
                {profile.name}
              </p>
            )}

            {/* Season — magazine cover treatment */}
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-3 text-stone-400">
                <span
                  className="h-px w-6"
                  style={{ backgroundColor: accent, opacity: 0.5 }}
                />
                <span className="text-[9px] tracking-[0.3em] font-medium">
                  YOUR SEASON
                </span>
                <span
                  className="h-px w-6"
                  style={{ backgroundColor: accent, opacity: 0.5 }}
                />
              </div>
              <h2 className="font-serif text-stone-800 text-[34px] leading-[1.05] tracking-tight">
                {profile.season}
              </h2>
              <p className="text-[10px] tracking-[0.2em] uppercase text-stone-500 font-medium">
                {profile.undertone === 'warm'
                  ? 'Warm undertone'
                  : profile.undertone === 'cool'
                    ? 'Cool undertone'
                    : 'Neutral undertone'}
              </p>
            </div>

            <p className="font-serif italic text-stone-600 text-[13px] leading-snug max-w-[280px] mx-auto pt-1">
              {profile.seasonSummary}
            </p>
          </div>

          {/* ── Why these colors work ───────────────────────────────────── */}
          <div
            className="rounded-xl px-4 py-3"
            style={{
              backgroundColor: `${accent}14`,
              borderLeft: `2px solid ${accent}`,
            }}
          >
            <p
              className="text-[9px] label-caps mb-1"
              style={{ color: accent, filter: 'brightness(0.7)' }}
            >
              The thread that ties it together
            </p>
            <p className="text-stone-700 text-[11px] leading-relaxed">
              {profile.colorWhyOverall}
            </p>
          </div>

          {/* ── Palette ─────────────────────────────────────────────────── */}
          <section className="space-y-3">
            <div className="flex items-center gap-3 text-stone-400">
              <div
                className="editorial-rule flex-1"
                style={{ color: accent, opacity: 0.4 }}
              />
              <h3 className="text-stone-700 text-[10px] label-caps">
                Wear&nbsp;This
              </h3>
              <div
                className="editorial-rule flex-1"
                style={{ color: accent, opacity: 0.4 }}
              />
            </div>

            {/* Fit + gender toggles. Each chip's shop link rebuilds from
                these so the search query matches the user's actual taste. */}
            <div className="flex items-center justify-center gap-2 text-[10px]">
              <SegToggle
                accent={accent}
                value={fit}
                options={[
                  { v: 'boxy', label: 'Boxy' },
                  { v: 'slim', label: 'Slim' },
                ]}
                onChange={setFit}
              />
              <SegToggle
                accent={accent}
                value={gender}
                options={[
                  { v: 'mens', label: "Men's" },
                  { v: 'womens', label: "Women's" },
                ]}
                onChange={setGender}
              />
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {profile.bestColors.map(c => (
                <PaintChip
                  key={c.hex + c.name}
                  hex={c.hex}
                  name={c.name}
                  whyWorks={c.whyWorks}
                  href={shopUrl(c.name, fit, gender)}
                />
              ))}
            </div>

            <p className="text-center text-stone-400 text-[9px] tracking-wide italic">
              Tap a swatch to shop t-shirts in that color
            </p>
          </section>

          {/* ── Avoid ───────────────────────────────────────────────────── */}
          <section className="space-y-3">
            <div className="flex items-center gap-3 text-stone-400">
              <div
                className="editorial-rule flex-1"
                style={{ color: '#a8a29e', opacity: 0.4 }}
              />
              <h3 className="text-stone-500 text-[10px] label-caps">
                Skip&nbsp;These
              </h3>
              <div
                className="editorial-rule flex-1"
                style={{ color: '#a8a29e', opacity: 0.4 }}
              />
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {profile.avoidColors.map(c => (
                <PaintChip
                  key={c.hex + c.name}
                  hex={c.hex}
                  name={c.name}
                  whyWorks={c.whyWorks}
                  muted
                />
              ))}
            </div>
          </section>

          {/* ── Makeup (opt-in) ─────────────────────────────────────────── */}
          {profile.makeup && (
            <section className="space-y-3">
              <div className="flex items-center gap-3 text-stone-400">
                <div
                  className="editorial-rule flex-1"
                  style={{ color: accent, opacity: 0.4 }}
                />
                <h3 className="text-stone-700 text-[10px] label-caps">
                  Makeup
                </h3>
                <div
                  className="editorial-rule flex-1"
                  style={{ color: accent, opacity: 0.4 }}
                />
              </div>

              <p className="font-serif italic text-stone-600 text-[12px] text-center leading-snug">
                {profile.makeup.foundationUndertone}
              </p>

              {/* Stylized face mockup with the recommended palette painted on,
                  paired with a legend so each color block is identified by name. */}
              <div className="grid grid-cols-[140px_1fr] gap-3 items-center">
                <div
                  className="rounded-xl overflow-hidden p-1"
                  style={{ backgroundColor: `${accent}10` }}
                >
                  <MakeupMockup makeup={profile.makeup} />
                </div>

                <div className="space-y-2 text-[10px]">
                  <div>
                    <p className="text-stone-400 label-caps mb-1 text-[9px]">Eyes</p>
                    <div className="flex flex-col gap-0.5">
                      {profile.makeup.eyeshadow.map(c => (
                        <div key={c.hex + c.name} className="flex items-center gap-1.5">
                          <span
                            className="w-3 h-3 rounded-sm border border-white shadow-sm flex-shrink-0"
                            style={{ backgroundColor: c.hex }}
                          />
                          <span className="text-stone-700 truncate">{c.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-stone-400 label-caps mb-1 text-[9px]">Lips</p>
                    <div className="flex flex-col gap-0.5">
                      {profile.makeup.lipColors.map(c => (
                        <div key={c.hex + c.name} className="flex items-center gap-1.5">
                          <span
                            className="w-3 h-3 rounded-sm border border-white shadow-sm flex-shrink-0"
                            style={{ backgroundColor: c.hex }}
                          />
                          <span className="text-stone-700 truncate">{c.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-stone-400 label-caps mb-1 text-[9px]">Blush</p>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-3 h-3 rounded-sm border border-white shadow-sm flex-shrink-0"
                        style={{ backgroundColor: profile.makeup.blush.hex }}
                      />
                      <span className="text-stone-700 truncate">{profile.makeup.blush.name}</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ── Accessories ─────────────────────────────────────────────── */}
          <section className="space-y-3">
            <div className="flex items-center gap-3 text-stone-400">
              <div
                className="editorial-rule flex-1"
                style={{ color: accent, opacity: 0.4 }}
              />
              <h3 className="text-stone-700 text-[10px] label-caps">
                Accessories
              </h3>
              <div
                className="editorial-rule flex-1"
                style={{ color: accent, opacity: 0.4 }}
              />
            </div>

            <div className="flex flex-wrap justify-center gap-1.5">
              <span
                className="text-[10px] px-3 py-1 rounded-full font-medium tracking-wide capitalize"
                style={{ backgroundColor: accent, color: accentInk }}
              >
                {profile.accessories.metalTone}&nbsp;metals
              </span>
              {profile.accessories.jewelryStyle.map(j => (
                <span
                  key={j}
                  className="text-stone-700 text-[10px] px-3 py-1 rounded-full font-medium tracking-wide capitalize bg-white border border-stone-200"
                >
                  {j}
                </span>
              ))}
            </div>
          </section>

          {/* ── Footer masthead ─────────────────────────────────────────── */}
          <div className="pt-2 flex items-center justify-between text-[8px] tracking-[0.25em] text-stone-400 font-medium">
            <span>{profile.name ? profile.name.toUpperCase() : 'YOUR'}&nbsp;·&nbsp;COLOR</span>
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: accent, opacity: 0.7 }}
            />
            <span>GRACE-STYLE.APP</span>
          </div>
        </div>
      </div>

      {/* Download button — outside the captured card */}
      <button
        onClick={download}
        className="w-full py-3 rounded-2xl bg-stone-800 text-white text-sm font-medium hover:bg-stone-700 active:scale-[0.98] transition-all"
      >
        Save Color Card
      </button>
    </div>
  )
}
