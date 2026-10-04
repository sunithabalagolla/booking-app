// Colourful sample posters drawn by code (SVG), for the seed movies only
// (docs/home-design.md Section 9: each movie its own picture and palette).
// Made-up movies, no real posters (copyright).
// SVG in an <img> cannot load web fonts, so the titles use Georgia bold (decided
// 2026-10-04) and the small text Courier.

const escapeXml = (text) =>
  String(text).replace(/[<>&'"]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[ch])

// Splits the title into at most 2 lines of about `max` letters
function titleLines(title, max = 14) {
  const lines = []
  for (const word of title.split(' ')) {
    const last = lines.at(-1)
    if (last && (`${last} ${word}`.length <= max || lines.length === 2)) lines[lines.length - 1] = `${last} ${word}`
    else lines.push(word)
  }
  return lines.slice(0, 2)
}

// Small helper: n items spread with a seeded pattern (same picture every run)
const spread = (n, fn) => Array.from({ length: n }, (_, i) => fn(i)).join('')

// The pictures: each fills the top 400 × 400 of the poster
const PICTURES = {
  // Rain lines, a lightning bolt, a dark figure. Navy, gold lightning
  monsoon: {
    palette: { background: '#16324A', band: '#0D1F2F', title: '#D9A441', text: '#E8D9B5' },
    draw: () => `
<ellipse cx="110" cy="70" rx="120" ry="45" fill="#0D1F2F"/><ellipse cx="300" cy="60" rx="140" ry="50" fill="#0D1F2F"/>
${spread(46, (i) => `<line x1="${(i * 37) % 420 - 10}" y1="${(i * 53) % 330 + 30}" x2="${(i * 37) % 420 - 22}" y2="${(i * 53) % 330 + 62}" stroke="#7FA6C4" stroke-width="2" opacity="0.6"/>`)}
<polygon points="232,70 190,190 226,190 196,300 280,160 240,160 268,70" fill="#D9A441"/>
<rect x="0" y="360" width="400" height="40" fill="#0D1F2F"/>
<circle cx="120" cy="268" r="16" fill="#05101A"/>
<path d="M98 290 h44 l10 72 h-64 z" fill="#05101A"/><path d="M92 300 l-30 40 M148 300 l20 -60" stroke="#05101A" stroke-width="9" stroke-linecap="round"/>`,
  },
  // Moon, a dark house with one lit window, a red gulmohar tree. Dark green, red
  ghost: {
    palette: { background: '#13201A', band: '#0A130E', title: '#C8402E', text: '#E8D9B5' },
    draw: () => `
<circle cx="310" cy="85" r="46" fill="#EDE3C8"/><circle cx="296" cy="74" r="8" fill="#D5C9A8"/>
<path d="M120 400 V230 l80 -70 l80 70 V400 z" fill="#060B08"/>
<rect x="186" y="250" width="28" height="34" fill="#E8B25C"/><line x1="200" y1="250" x2="200" y2="284" stroke="#060B08" stroke-width="3"/>
<rect x="40" y="250" width="12" height="150" fill="#3B2316"/>
${spread(14, (i) => `<circle cx="${20 + ((i * 23) % 70)}" cy="${200 + ((i * 17) % 70)}" r="${18 + (i % 3) * 4}" fill="${i % 2 ? '#C8402E' : '#A8321F'}"/>`)}
<rect x="0" y="380" width="400" height="20" fill="#060B08"/>`,
  },
  // Sunset bands, a road to the horizon, a small bus. Orange / coral / plum
  sapnon: {
    palette: { background: '#5B2A4E', band: '#3F1B36', title: '#F6C38B', text: '#F3E9D2' },
    draw: () => `
<rect width="400" height="90" fill="#5B2A4E"/><rect y="90" width="400" height="70" fill="#9B3B5A"/>
<rect y="160" width="400" height="60" fill="#E8604C"/><rect y="220" width="400" height="40" fill="#F28C38"/>
<circle cx="200" cy="260" r="60" fill="#F9C66A"/>
<rect y="260" width="400" height="140" fill="#3F1B36"/>
<polygon points="190,260 210,260 330,400 70,400" fill="#2A1225"/>
${spread(5, (i) => `<rect x="${198 - i}" y="${275 + i * 25}" width="${4 + i * 2}" height="${10 + i * 3}" fill="#F6C38B"/>`)}
<rect x="150" y="320" width="64" height="34" rx="6" fill="#6FA37A"/><rect x="156" y="326" width="12" height="10" fill="#F3E9D2"/>
<rect x="172" y="326" width="12" height="10" fill="#F3E9D2"/><rect x="188" y="326" width="12" height="10" fill="#F3E9D2"/>
<circle cx="164" cy="356" r="6" fill="#1E140E"/><circle cx="200" cy="356" r="6" fill="#1E140E"/>`,
  },
  // Sun, sea waves, a sailing boat, birds. Sand, sea blue
  kadal: {
    palette: { background: '#F1D9A8', band: '#2F6F86', title: '#F3E9D2', text: '#F1D9A8' },
    draw: () => `
<circle cx="290" cy="110" r="48" fill="#E8833A"/>
${spread(4, (i) => `<path d="M${60 + i * 60} ${70 + (i % 2) * 22} q10 -10 20 0 q10 -10 20 0" fill="none" stroke="#3B2A20" stroke-width="3"/>`)}
<rect y="230" width="400" height="170" fill="#2F6F86"/>
${spread(5, (i) => `<path d="M0 ${255 + i * 30} q25 -14 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0" fill="none" stroke="#9CC9D6" stroke-width="3" opacity="0.8"/>`)}
<path d="M140 250 h120 l-22 30 h-76 z" fill="#6B4A2E"/>
<line x1="200" y1="250" x2="200" y2="140" stroke="#3B2A20" stroke-width="4"/>
<polygon points="204,145 204,244 262,244" fill="#F3E9D2"/><polygon points="196,160 196,244 150,244" fill="#E8D9B5"/>`,
  },
  // Stars, a ringed planet, a rocket. Purple, rust planet
  star: {
    palette: { background: '#24163A', band: '#160D25', title: '#F2C766', text: '#E8D9B5' },
    draw: () => `
${spread(40, (i) => `<circle cx="${(i * 89) % 400}" cy="${(i * 47) % 380}" r="${i % 4 === 0 ? 2.5 : 1.4}" fill="#F3E9D2" opacity="${0.5 + (i % 3) * 0.2}"/>`)}
<circle cx="120" cy="130" r="62" fill="#B5532E"/><path d="M70 110 q50 -20 100 10" stroke="#8E3D20" stroke-width="8" fill="none"/>
<ellipse cx="120" cy="135" rx="105" ry="20" fill="none" stroke="#E8B25C" stroke-width="6" transform="rotate(-15 120 135)"/>
<g transform="rotate(30 280 270)">
<path d="M280 180 q28 40 22 120 h-44 q-6 -80 22 -120 z" fill="#F3E9D2"/>
<circle cx="280" cy="235" r="11" fill="#2F6F86" stroke="#3B2A20" stroke-width="3"/>
<path d="M258 280 l-20 30 h20 z M302 280 l20 30 h-20 z" fill="#C8402E"/>
<path d="M266 302 q14 50 28 0 z" fill="#F28C38"/></g>`,
  },
  // Big moon, a small train on a track. Night blue
  chandamama: {
    palette: { background: '#1B2B4A', band: '#111C31', title: '#F3E9D2', text: '#E8D9B5' },
    draw: () => `
${spread(24, (i) => `<circle cx="${(i * 71) % 400}" cy="${(i * 37) % 200}" r="1.6" fill="#F3E9D2" opacity="0.7"/>`)}
<circle cx="200" cy="170" r="120" fill="#F2E6C2"/>
<circle cx="160" cy="130" r="18" fill="#E2D3A6"/><circle cx="240" cy="200" r="24" fill="#E2D3A6"/><circle cx="215" cy="110" r="10" fill="#E2D3A6"/>
<rect y="330" width="400" height="70" fill="#111C31"/>
<line x1="0" y1="352" x2="400" y2="352" stroke="#8A7A5C" stroke-width="4"/>
${spread(13, (i) => `<rect x="${i * 32}" y="352" width="6" height="12" fill="#6B5B40"/>`)}
<rect x="230" y="296" width="80" height="44" rx="4" fill="#C8402E"/><rect x="292" y="276" width="14" height="22" fill="#3B2A20"/>
<rect x="140" y="304" width="80" height="36" rx="4" fill="#2F6F86"/><rect x="50" y="304" width="80" height="36" rx="4" fill="#D9A441"/>
${spread(3, (i) => `<rect x="${62 + i * 90}" y="312" width="20" height="14" fill="#F3E9D2"/>`)}
${spread(6, (i) => `<circle cx="${70 + i * 45}" cy="344" r="8" fill="#1E140E"/>`)}
<circle cx="300" cy="262" r="10" fill="#E8E2D2" opacity="0.8"/><circle cx="314" cy="244" r="13" fill="#E8E2D2" opacity="0.6"/><circle cx="332" cy="222" r="16" fill="#E8E2D2" opacity="0.4"/>`,
  },
}

export const POSTER_PICTURES = Object.keys(PICTURES)

// picture: one of POSTER_PICTURES
export function posterSvg({ title, tagline, languages, certificate, picture }) {
  const { palette, draw } = PICTURES[picture]
  const lines = titleLines(title)
  const titleY = lines.length === 1 ? 470 : 448
  const titleText = lines
    .map((line, i) => `<text x="200" y="${titleY + i * 46}" text-anchor="middle" font-family="Georgia, serif" font-size="42" font-weight="bold" fill="${palette.title}">${escapeXml(line)}</text>`)
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
<rect width="400" height="600" fill="${palette.background}"/>
<svg x="0" y="0" width="400" height="400" viewBox="0 0 400 400">${draw()}</svg>
<rect y="400" width="400" height="200" fill="${palette.band}"/>
${titleText}
<text x="200" y="530" text-anchor="middle" font-family="'Courier New', monospace" font-size="17" font-style="italic" fill="${palette.text}">${escapeXml(tagline)}</text>
<text x="200" y="558" text-anchor="middle" font-family="'Courier New', monospace" font-size="14" fill="${palette.text}">${escapeXml(languages.join(' · '))}</text>
<rect x="326" y="18" width="52" height="32" rx="4" fill="${palette.band}" stroke="${palette.title}" stroke-width="2.5" transform="rotate(-8 352 34)"/>
<text x="352" y="41" text-anchor="middle" font-family="Georgia, serif" font-size="18" font-weight="bold" fill="${palette.title}" transform="rotate(-8 352 34)">${escapeXml(certificate)}</text>
<text x="200" y="586" text-anchor="middle" font-family="'Courier New', monospace" font-size="11" letter-spacing="3" fill="${palette.text}" opacity="0.8">SAMPLE · TALKIES</text>
<rect x="6" y="6" width="388" height="588" fill="none" stroke="${palette.title}" stroke-width="2" opacity="0.6"/>
</svg>`
}
