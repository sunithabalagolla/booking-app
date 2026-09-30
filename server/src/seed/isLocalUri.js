// True when every database host in the link is this laptop (Docker MongoDB).
// Atlas links (mongodb+srv://...) and anything we cannot read count as NOT local.
export function isLocalUri(uri) {
  try {
    const hosts = new URL(uri).host.split(',')
    return hosts.every((h) => /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(h))
  } catch {
    return false
  }
}
