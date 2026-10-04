// Vintage sample canteen pictures drawn by code (SVG), for the seed food items only.
// Simple flat shapes in the Talkies colours (UI-01), like an old canteen board.
// SVG in an <img> cannot load web fonts, so the text uses Georgia / Courier.

const escapeXml = (text) =>
  String(text).replace(/[<>&'"]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[ch])

const INK = '#3B2A20'
const CREAM = '#F3E9D2'
const MAROON = '#7B1E1E'
const GOLD = '#D9A441'
const GREEN = '#2F5D50'
const WOOD = '#6B4A2E'

// Red-and-cream striped popcorn box with popcorn on top (x = centre)
function popcorn(x = 200, scale = 1) {
  const w = 120 * scale
  const left = x - w / 2
  let stripes = ''
  for (let i = 0; i < 5; i++) stripes += `<rect x="${left + i * (w / 5)}" y="${170 * scale + (1 - scale) * 200}" width="${w / 10}" height="${130 * scale}" fill="${MAROON}"/>`
  const top = 170 * scale + (1 - scale) * 200
  let pops = ''
  for (let i = 0; i < 7; i++) pops += `<circle cx="${left + 10 * scale + i * (w - 20 * scale) / 6}" cy="${top - 8 * scale - (i % 2) * 12 * scale}" r="${16 * scale}" fill="${CREAM}" stroke="${INK}" stroke-width="2"/>`
  return `${pops}<rect x="${left}" y="${top}" width="${w}" height="${130 * scale}" fill="${CREAM}" stroke="${INK}" stroke-width="3"/>${stripes}<rect x="${left}" y="${top}" width="${w}" height="${130 * scale}" fill="none" stroke="${INK}" stroke-width="3"/>`
}

// Glass bottle with a gold label (x = centre)
function bottle(x = 200, scale = 1) {
  const s = (n) => n * scale
  const base = 300
  return `<path d="M${x - s(14)} ${base - s(170)} h${s(28)} v${s(40)} q${s(26)} ${s(20)} ${s(26)} ${s(50)} v${s(80)} h-${s(80)} v-${s(80)} q0 -${s(30)} ${s(26)} -${s(50)} z" fill="${GREEN}" stroke="${INK}" stroke-width="3"/>
<rect x="${x - s(16)}" y="${base - s(184)}" width="${s(32)}" height="${s(14)}" fill="${GOLD}" stroke="${INK}" stroke-width="2"/>
<rect x="${x - s(40)}" y="${base - s(70)}" width="${s(80)}" height="${s(34)}" fill="${GOLD}"/>`
}

const DRAWINGS = {
  popcorn: () => popcorn(),
  samosa: () => `<path d="M110 290 L170 170 L230 290 Z" fill="${GOLD}" stroke="${INK}" stroke-width="3"/><path d="M180 290 L240 170 L300 290 Z" fill="${GOLD}" stroke="${INK}" stroke-width="3"/>
<path d="M130 270 L170 200 M200 270 L240 200" stroke="${WOOD}" stroke-width="2"/><ellipse cx="205" cy="300" rx="120" ry="14" fill="none" stroke="${INK}" stroke-width="3"/>`,
  coffee: () => `<path d="M160 150 h80 l-10 130 h-60 z" fill="#C9C2B4" stroke="${INK}" stroke-width="3"/><ellipse cx="200" cy="150" rx="40" ry="8" fill="${WOOD}" stroke="${INK}" stroke-width="2"/>
<path d="M120 275 h160 l-20 30 h-120 z" fill="#C9C2B4" stroke="${INK}" stroke-width="3"/>
<path d="M185 130 q-10 -20 0 -40 M215 130 q-10 -20 0 -40" fill="none" stroke="${INK}" stroke-width="2"/>`,
  drink: () => bottle(),
  puff: () => `<rect x="120" y="190" width="160" height="90" rx="10" fill="${GOLD}" stroke="${INK}" stroke-width="3"/>
<path d="M130 215 h140 M130 240 h140 M130 265 h140" stroke="${WOOD}" stroke-width="2"/><ellipse cx="200" cy="295" rx="110" ry="12" fill="none" stroke="${INK}" stroke-width="3"/>`,
  combo: () => `${popcorn(160, 0.85)}${bottle(270, 0.85)}`,
}

// picture: one of the keys in DRAWINGS
export function foodSvg({ name, picture, isVeg }) {
  // Veg / non-veg mark, top right: green square + dot / brown square + triangle
  const mark = isVeg
    ? `<rect x="340" y="20" width="40" height="40" fill="${CREAM}" stroke="${GREEN}" stroke-width="4"/><circle cx="360" cy="40" r="11" fill="${GREEN}"/>`
    : `<rect x="340" y="20" width="40" height="40" fill="${CREAM}" stroke="${WOOD}" stroke-width="4"/><path d="M360 28 L372 50 H348 Z" fill="${WOOD}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
<rect width="400" height="400" fill="${CREAM}"/>
<rect x="10" y="10" width="380" height="380" fill="none" stroke="${INK}" stroke-width="3"/>
<rect x="18" y="18" width="364" height="364" fill="none" stroke="${INK}" stroke-width="1" stroke-dasharray="6 4"/>
${DRAWINGS[picture]()}
${mark}
<text x="200" y="345" text-anchor="middle" font-family="Georgia, serif" font-size="26" font-weight="bold" fill="${MAROON}">${escapeXml(name)}</text>
<text x="200" y="372" text-anchor="middle" font-family="'Courier New', monospace" font-size="12" letter-spacing="3" fill="${INK}">SAMPLE · TALKIES CANTEEN</text>
</svg>`
}
