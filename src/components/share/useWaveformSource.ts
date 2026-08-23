import { useEffect, useMemo, useRef, useState } from 'react';
import { isCachedAudioUrl } from '../../utils/audioUrl.ts';

// Supplies the per-bar amplitudes the circular waveform draws, in three tiers
// that are deliberately close in appearance so a downgrade never reads as
// "broken", only as "calmer":
//
//   live      real AnalyserNode spectrum. Requires the ACAO header, which only
//             our cached audio host sends.
//   seeded    deterministic amplitudes derived from the clip id, modulated by
//             time while playing. Used for original RSS enclosures, which
//             audioUrl.ts passes through to third-party hosts that send no
//             CORS headers.
//   rest      the seeded shape held still. Used when paused, when reduced
//             motion is requested, and before playback starts.
//
// Amplitudes are written into a caller-owned Float32Array rather than React
// state: this is read once per animation frame and must not re-render.

export type WaveformTier = 'live' | 'seeded';

// createMediaElementSource() may be called only once per element for the
// lifetime of the page, and throws on a second call. Elements are keyed weakly
// so a remount that reuses an element reattaches instead of throwing.
const graphs = new WeakMap<HTMLAudioElement, { analyser: AnalyserNode; ctx: AudioContext }>();

function buildGraph(element: HTMLAudioElement) {
  const existing = graphs.get(element);
  if (existing) return existing;

  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;

  const ctx: AudioContext = new Ctor();
  const source = ctx.createMediaElementSource(element);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  // Some smoothing in the analyser itself, the rest in the per-bar easing
  // below. Raw bin values jitter far too much to look designed.
  analyser.smoothingTimeConstant = 0.72;
  source.connect(analyser);
  // The element's audio now flows through the graph, so the analyser must
  // reach the destination or playback goes silent.
  analyser.connect(ctx.destination);

  const graph = { analyser, ctx };
  graphs.set(element, graph);
  return graph;
}

/** Cheap deterministic hash so the same clip always gets the same resting
 *  silhouette. Two different clips should not look identical at rest. */
function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededProfile(seed: string, barCount: number): Float32Array {
  const out = new Float32Array(barCount);
  let state = hashString(seed) || 1;
  const next = () => {
    // xorshift32: enough randomness for a silhouette, no dependency.
    state ^= state << 13; state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5; state >>>= 0;
    return state / 4294967296;
  };
  // Speech-like: a few broad swells with grain on top, rather than white noise.
  const swellA = next() * Math.PI * 2;
  const swellB = next() * Math.PI * 2;
  for (let i = 0; i < barCount; i++) {
    const t = (i / barCount) * Math.PI * 2;
    const swell = 0.5 + 0.28 * Math.sin(t * 3 + swellA) + 0.16 * Math.sin(t * 7 + swellB);
    out[i] = Math.max(0.06, Math.min(1, swell * (0.72 + next() * 0.42)));
  }
  return out;
}

interface Options {
  element: HTMLAudioElement | null;
  audioUrl?: string;
  seed: string;
  barCount: number;
  isPlaying: boolean;
  reducedMotion: boolean;
}

export interface WaveformSource {
  tier: WaveformTier;
  /** Fill `out` with amplitudes in 0..1 for the current frame. */
  read: (out: Float32Array, timeMs: number) => void;
}

export function useWaveformSource({
  element,
  audioUrl,
  seed,
  barCount,
  isPlaying,
  reducedMotion,
}: Options): WaveformSource {
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const profile = useMemo(() => seededProfile(seed, barCount), [seed, barCount]);
  const binsRef = useRef<Uint8Array | null>(null);
  // Per-bar eased values, so bars decay smoothly instead of snapping to zero
  // between frames.
  const easedRef = useRef<Float32Array>(new Float32Array(barCount));

  useEffect(() => {
    if (easedRef.current.length !== barCount) easedRef.current = new Float32Array(barCount);
  }, [barCount]);

  // Attach the analyser only for audio we know sends CORS headers. Attempting
  // it on a third-party enclosure yields a tainted, permanently silent graph.
  useEffect(() => {
    if (!element || !audioUrl) return;
    if (!isCachedAudioUrl(element.currentSrc || element.src || audioUrl)) return;
    try {
      const graph = buildGraph(element);
      if (!graph) return;
      ctxRef.current = graph.ctx;
      setAnalyser(graph.analyser);
      binsRef.current = new Uint8Array(graph.analyser.frequencyBinCount);
    } catch {
      // Autoplay policy, an unsupported browser, or a source that turned out
      // not to be readable. The seeded tier covers all of them.
      setAnalyser(null);
    }
  }, [element, audioUrl]);

  // Browsers start the context suspended until a user gesture.
  useEffect(() => {
    const ctx = ctxRef.current;
    if (ctx && isPlaying && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }, [isPlaying]);

  useEffect(() => () => {
    // Deliberately not closing the AudioContext: it is bound to the element's
    // MediaElementSource, which cannot be recreated. Closing it on unmount
    // would permanently mute a remount of the same element.
  }, []);

  const tier: WaveformTier = analyser ? 'live' : 'seeded';

  const read = useMemo(() => (out: Float32Array, timeMs: number) => {
    const eased = easedRef.current;
    const active = isPlaying && !reducedMotion;

    if (analyser && binsRef.current && active) {
      const bins = binsRef.current;
      analyser.getByteFrequencyData(bins);
      // Mirror one spectrum across both halves of the ring. A bilaterally
      // symmetric ring reads as a designed object; an asymmetric one reads as
      // noise wrapped in a circle.
      const half = Math.ceil(barCount / 2);
      // Speech energy sits low in the spectrum; the top bins are near-empty
      // and would flatten the ring if included.
      const usable = Math.floor(bins.length * 0.62);
      for (let i = 0; i < half; i++) {
        const from = Math.floor((i / half) * usable);
        const to = Math.max(from + 1, Math.floor(((i + 1) / half) * usable));
        let peak = 0;
        for (let b = from; b < to; b++) if (bins[b] > peak) peak = bins[b];
        // Slight upward tilt so higher bands, which carry less energy, still
        // register visually.
        const tilt = 1 + (i / half) * 0.55;
        const target = Math.min(1, (peak / 255) * tilt);
        const value = eased[i] + (target - eased[i]) * 0.35;
        eased[i] = value;
        out[i] = Math.max(0.05, value);
        const mirror = barCount - 1 - i;
        if (mirror >= half) out[mirror] = out[i];
      }
      return;
    }

    if (active) {
      // Seeded tier: the clip's fixed silhouette, breathing.
      const t = timeMs / 1000;
      for (let i = 0; i < barCount; i++) {
        const wobble = 0.72 + 0.28 * Math.sin(t * 2.1 + i * 0.42);
        const target = profile[i] * wobble;
        eased[i] += (target - eased[i]) * 0.18;
        out[i] = Math.max(0.05, eased[i]);
      }
      return;
    }

    // Rest: the silhouette, compressed toward the ring and held still. Not a
    // flat circle, which would read as a plain border rather than a waveform.
    for (let i = 0; i < barCount; i++) {
      const target = 0.16 + profile[i] * 0.30;
      eased[i] += (target - eased[i]) * 0.12;
      out[i] = Math.max(0.04, eased[i]);
    }
  }, [analyser, barCount, isPlaying, profile, reducedMotion]);

  return { tier, read };
}
