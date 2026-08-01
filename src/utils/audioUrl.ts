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
