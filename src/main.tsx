import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted web fonts. Google Fonts works for the live UI, but html-to-image
// can't embed cross-origin @font-face rules into its SVG output, so the
// downloaded card would fall back to a system serif. Bundling the fonts
// same-origin lets the PNG ship with the real typography.
import '@fontsource/playfair-display/400.css'
import '@fontsource/playfair-display/500.css'
import '@fontsource/playfair-display/600.css'
import '@fontsource/playfair-display/700.css'
import '@fontsource/playfair-display/400-italic.css'
import '@fontsource/playfair-display/500-italic.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
