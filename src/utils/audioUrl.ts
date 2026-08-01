// Episode audio was historically served straight from the DigitalOcean Spaces
// origin. The backend now fronts that same bucket with a Cloudflare Worker at
// `audio.pullthatupjamie.ai` (30-day edge cache) to cut a large DO egress bill.
//
// Some API responses (notably the search index / get-hierarchy metadata) still
// embed the raw Spaces origin in their `audioUrl`, so a play would bypass the
// cache and keep billing egress. We normalize any playback URL to the cached
// host at the single point of use (the shared audio controller). The object key
// and file extension are identical across hosts — only the host swaps — so this
// is a pure host rewrite with no risk of a wrong extension.
//
// URLs that don't point at the raw Spaces origin (e.g. original RSS enclosures)
// are returned unchanged, since the cached host only fronts our bucket.

const RAW_AUDIO_HOSTS = [
  'cascdr-chads-stay-winning.nyc3.cdn.digitaloceanspaces.com',
  'cascdr-chads-stay-winning.nyc3.digitaloceanspaces.com',
];

const CACHED_AUDIO_HOST = 'audio.pullthatupjamie.ai';

/** Rewrite a raw DigitalOcean Spaces audio URL to the cached Cloudflare host.
 *  Non-matching URLs (and empty values) pass through unchanged. */
export function toCachedAudioUrl(url: string): string {
  if (!url) return url;
  for (const host of RAW_AUDIO_HOSTS) {
    if (url.includes(host)) return url.replace(host, CACHED_AUDIO_HOST);
  }
  return url;
}

/** True when the URL points at our cached audio host. */
export function isCachedAudioUrl(url: string): boolean {
  return !!url && url.includes(CACHED_AUDIO_HOST);
}

// Source audio is being re-encoded from .mp3 to .m4a. During that transition an
// API response's extension can briefly disagree with the object actually in the
// bucket (metadata says .mp3, object is already .m4a, or vice versa), which
// 404/403s on play. swapAudioExtension() gives the player one alternate to try.
const AUDIO_EXT_SWAP: Record<string, string> = { '.mp3': '.m4a', '.m4a': '.mp3' };

/** Swap a playback URL's audio extension to the other of .mp3/.m4a, preserving
 *  any query string and `#t=` fragment. Returns null when there's no known
 *  audio extension to swap (so callers can skip the retry). */
export function swapAudioExtension(url: string): string | null {
  if (!url) return null;
  // Isolate the path's extension from any ?query or #fragment tail.
  const m = url.match(/^([^?#]*?)(\.[a-z0-9]+)([?#].*)?$/i);
  if (!m) return null;
  const [, base, ext, tail = ''] = m;
  const next = AUDIO_EXT_SWAP[ext.toLowerCase()];
  return next ? `${base}${next}${tail}` : null;
}
