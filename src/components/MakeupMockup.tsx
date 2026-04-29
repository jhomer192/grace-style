import type { MakeupProfile } from '../types'

interface Props {
  makeup: MakeupProfile
  /** Skin tone for the face fill. Defaults to a warm neutral that reads
   *  legibly against the cream card background while not dominating it. */
  skinHex?: string
  /** Hair tone for the silhouette behind the face. Defaults to a soft brown. */
  hairHex?: string
}

/**
 * Editorial face mockup with the recommended makeup applied as overlay tints.
 *
 * This is a stylized illustration, not a photo edit — the goal is to show the
 * eyeshadow / lip / blush palette working *together* on a face, the way beauty
 * editorial spreads do. Photo-realistic tinting of the user's actual portrait
 * would require a face-landmark + image-edit pipeline (DALL-E, Imagen, or
 * SAM + diffusion), which is a separate architectural conversation.
 *
 * Layer order matters — eyelid before eye whites before pupils before lashes,
 * etc — so the makeup tints sit *underneath* facial features rather than
 * obscuring them.
 */
export function MakeupMockup({
  makeup,
  skinHex = '#f0d4b8',
  hairHex = '#5a4530',
}: Props) {
  // We pull a few representative colors from the recommendation set:
  //   - First eyeshadow as the dominant lid color (often the medium tone)
  //   - Second eyeshadow (when available) as a darker outer-corner accent
  //   - First lip color as the lip tint
  //   - Blush hex on the apples of the cheeks
  // If any are missing the SVG falls back to neutral defaults so the mockup
  // never half-renders.
  const lid = makeup.eyeshadow[0]?.hex ?? '#c4a585'
  const crease = makeup.eyeshadow[1]?.hex ?? lid
  const highlight = makeup.eyeshadow[2]?.hex ?? '#f5e6d3'
  const lipColor = makeup.lipColors[0]?.hex ?? '#9b4d4d'
  const blushColor = makeup.blush?.hex ?? '#d4836b'

  return (
    <svg
      viewBox="0 0 240 320"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto"
      role="img"
      aria-label="Stylized makeup look mockup"
    >
      <defs>
        {/* Soft radial gradients let the makeup blend into the face rather
            than sitting like flat sticker patches. */}
        <radialGradient id="blush-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={blushColor} stopOpacity="0.7" />
          <stop offset="60%" stopColor={blushColor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={blushColor} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="lid-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={highlight} stopOpacity="0.55" />
          <stop offset="55%" stopColor={lid} stopOpacity="0.85" />
          <stop offset="100%" stopColor={crease} stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="lid-grad-flip" x1="100%" y1="0%" x2="0%" y2="0%">
          <stop offset="0%" stopColor={highlight} stopOpacity="0.55" />
          <stop offset="55%" stopColor={lid} stopOpacity="0.85" />
          <stop offset="100%" stopColor={crease} stopOpacity="0.95" />
        </linearGradient>
      </defs>

      {/* ── Hair silhouette (soft cloud behind the face) ─────────────────── */}
      <path
        d="M 35 145 Q 35 55 120 50 Q 205 55 205 145 L 200 130 Q 195 90 175 75 Q 145 60 120 60 Q 95 60 65 75 Q 45 90 40 130 Z"
        fill={hairHex}
        opacity="0.85"
      />

      {/* ── Face oval ────────────────────────────────────────────────────── */}
      <ellipse
        cx="120"
        cy="180"
        rx="78"
        ry="105"
        fill={skinHex}
        stroke="#c89d75"
        strokeWidth="0.8"
        opacity="0.95"
      />

      {/* ── Hair front strands framing the face ──────────────────────────── */}
      <path
        d="M 50 110 Q 55 95 75 90 Q 70 110 60 140 Z"
        fill={hairHex}
        opacity="0.9"
      />
      <path
        d="M 190 110 Q 185 95 165 90 Q 170 110 180 140 Z"
        fill={hairHex}
        opacity="0.9"
      />

      {/* ── Brows ────────────────────────────────────────────────────────── */}
      <path
        d="M 70 142 Q 88 134 108 142"
        fill="none"
        stroke="#3d2c1f"
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d="M 132 142 Q 152 134 170 142"
        fill="none"
        stroke="#3d2c1f"
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity="0.85"
      />

      {/* ── Eyeshadow on lids (drawn before eye whites so it sits underneath) */}
      <path
        d="M 65 158 Q 88 146 110 158 Q 110 172 88 172 Q 70 172 65 165 Z"
        fill="url(#lid-grad)"
      />
      <path
        d="M 130 158 Q 152 146 175 158 Q 170 165 152 172 Q 130 172 130 158 Z"
        fill="url(#lid-grad-flip)"
      />

      {/* ── Eye whites ───────────────────────────────────────────────────── */}
      <ellipse cx="88" cy="170" rx="13" ry="6" fill="#fdfdfb" />
      <ellipse cx="152" cy="170" rx="13" ry="6" fill="#fdfdfb" />

      {/* ── Iris + pupil ─────────────────────────────────────────────────── */}
      <circle cx="88" cy="170" r="5" fill="#5a4530" />
      <circle cx="152" cy="170" r="5" fill="#5a4530" />
      <circle cx="88" cy="170" r="2.2" fill="#1c1917" />
      <circle cx="152" cy="170" r="2.2" fill="#1c1917" />
      <circle cx="89.5" cy="168.5" r="0.9" fill="#fff" />
      <circle cx="153.5" cy="168.5" r="0.9" fill="#fff" />

      {/* ── Upper lash line ─────────────────────────────────────────────── */}
      <path
        d="M 75 165 Q 88 161 101 165"
        fill="none"
        stroke="#1c1917"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M 139 165 Q 152 161 165 165"
        fill="none"
        stroke="#1c1917"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      {/* ── Blush on apples of cheeks ─────────────────────────────────── */}
      <ellipse cx="68" cy="218" rx="22" ry="16" fill="url(#blush-grad)" />
      <ellipse cx="172" cy="218" rx="22" ry="16" fill="url(#blush-grad)" />

      {/* ── Nose suggestion (very subtle) ──────────────────────────────── */}
      <path
        d="M 120 195 Q 117 220 114 232 Q 117 238 123 238"
        fill="none"
        stroke="#c89d75"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.55"
      />

      {/* ── Lips ─────────────────────────────────────────────────────────── */}
      <path
        d="M 100 258
           Q 108 252 120 256
           Q 132 252 140 258
           Q 132 266 120 268
           Q 108 266 100 258 Z"
        fill={lipColor}
        opacity="0.92"
      />
      {/* Cupid's bow accent — slightly darker for dimension */}
      <path
        d="M 113 256 L 120 252 L 127 256"
        fill="none"
        stroke={lipColor}
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.7"
      />
      {/* Lip-line center seam */}
      <path
        d="M 100 258 Q 120 263 140 258"
        fill="none"
        stroke={lipColor}
        strokeWidth="0.8"
        opacity="0.6"
      />

      {/* ── Foundation note label at bottom ─────────────────────────────── */}
      <text
        x="120"
        y="305"
        textAnchor="middle"
        fontFamily="'Playfair Display', serif"
        fontStyle="italic"
        fontSize="11"
        fill="#78716c"
      >
        as the look comes together
      </text>
    </svg>
  )
}
