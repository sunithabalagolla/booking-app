// Vintage sample posters drawn by code (SVG), for the seed movies only.
// Made-up movies, no real posters (copyright). Colours from the Talkies theme (UI-01).
// SVG in an <img> cannot load web fonts, so the text uses Georgia / Courier.

const escapeXml = (text) =>
  String(text).replace(/[<>&'"]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[ch])

// Splits the title into lines of about `max` letters (max 3 lines)
function titleLines(title, max = 12) {
  const lines = []
  for (const word of title.split(' ')) {
    const last = lines.at(-1)
    if (last && `${last} ${word}`.length <= max) lines[lines.length - 1] = `${last} ${word}`
    else lines.push(word)
  }
  return lines.slice(0, 3)
}

// One film strip (row of sprocket holes) across the poster
function sprockets(y) {
  let holes = ''
  for (let x = 14; x < 400; x += 28) holes += `<rect x="${x}" y="${y}" width="14" height="10" rx="2" fill="#F3E9D2"/>`
  return `<rect x="0" y="${y - 6}" width="400" height="22" fill="#1E140E"/>${holes}`
}

export function posterSvg({ title, tagline, languages, certificate, background, accent }) {
  const lines = titleLines(title)
  // Title below the sun circle: 1 line at y=360, each extra line moves it up a little
  const titleY = 360 - (lines.length - 1) * 25
  const titleText = lines
    .map((line, i) => `<text x="200" y="${titleY + i * 50}" text-anchor="middle" font-family="Georgia, serif" font-size="44" font-weight="bold" fill="#F3E9D2">${escapeXml(line)}</text>`)
    .join('')

  // Sun rays behind the title, an old film poster favourite
  let rays = ''
  for (let i = 0; i < 18; i++) rays += `<rect x="197" y="-20" width="6" height="200" fill="${accent}" opacity="0.35" transform="rotate(${i * 20} 200 180)"/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600">
<rect width="400" height="600" fill="${background}"/>
${sprockets(12)}${sprockets(572)}
<rect x="18" y="40" width="364" height="520" fill="none" stroke="${accent}" stroke-width="4"/>
<rect x="28" y="50" width="344" height="500" fill="none" stroke="${accent}" stroke-width="1.5"/>
${rays}
<circle cx="200" cy="180" r="70" fill="${accent}"/>
<circle cx="200" cy="180" r="58" fill="${background}"/>
${titleText}
<text x="200" y="455" text-anchor="middle" font-family="'Courier New', monospace" font-size="17" fill="${accent}">${escapeXml(tagline)}</text>
<text x="200" y="500" text-anchor="middle" font-family="'Courier New', monospace" font-size="15" fill="#F3E9D2">${escapeXml(languages.join(' · '))}</text>
<rect x="320" y="70" width="44" height="30" rx="4" fill="none" stroke="#F3E9D2" stroke-width="2" transform="rotate(-10 342 85)"/>
<text x="342" y="92" text-anchor="middle" font-family="Georgia, serif" font-size="17" font-weight="bold" fill="#F3E9D2" transform="rotate(-10 342 85)">${escapeXml(certificate)}</text>
<text x="200" y="538" text-anchor="middle" font-family="'Courier New', monospace" font-size="12" letter-spacing="3" fill="#F3E9D2">SAMPLE · TALKIES</text>
</svg>`
}
