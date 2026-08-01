// WebGL context-loss resilience for the react-three-fiber scenes.
//
// Neither r3f nor three.js recovers a lost WebGL context on their own — three
// logs "THREE.WebGLRenderer: Context Lost." and the canvas stays dead. This is
// especially likely inside the landing-page embed iframe, where several
// <Canvas> scenes (galaxy, nebula, warp-speed overlay) plus troika-three-text's
// throwaway SDF context share the browser's limited pool of live GL contexts;
// when the pool is exhausted the galaxy's context can be evicted.
//
// Calling preventDefault() on 'webglcontextlost' tells the browser to keep the
// canvas restorable; on 'webglcontextrestored' we invalidate() so demand-driven
// scenes redraw. Returns a cleanup function that detaches the listeners.

import type { WebGLRenderer } from 'three';

export function attachContextLossRecovery(
  gl: WebGLRenderer,
  invalidate: () => void
): () => void {
  const canvas = gl.domElement;
  const onLost = (e: Event) => {
    // Prevent the default so the browser will fire 'webglcontextrestored'.
    e.preventDefault();
  };
  const onRestored = () => {
    invalidate();
  };
  canvas.addEventListener('webglcontextlost', onLost, false);
  canvas.addEventListener('webglcontextrestored', onRestored, false);
  return () => {
    canvas.removeEventListener('webglcontextlost', onLost, false);
    canvas.removeEventListener('webglcontextrestored', onRestored, false);
  };
}

// troika-three-text (drei's <Text>) generates glyph SDFs via WebGL and blits
// them with ANGLE_instanced_arrays. When that extension is unavailable it
// fails with "ANGLE_instanced_arrays not supported" — sometimes as a rejected
// promise (GPU generate path), sometimes as a synchronous throw (the JS
// fallback's WebGL blit). troika still renders labels, so it's benign, but it
// pollutes the console and (in prod) can trip error monitoring. Swallow that
// one specific, known-benign error on both channels. Idempotent; no-op on the
// server. The dev-server overlay is handled separately via craco.config.js.
const BENIGN_SDF_ERROR = /ANGLE_instanced_arrays not supported|WebGL (SDF )?generation not supported/;

let troikaGuardInstalled = false;

export function installTroikaSdfRejectionGuard(): void {
  if (troikaGuardInstalled || typeof window === 'undefined') return;
  troikaGuardInstalled = true;
  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    const msg = String((e.reason && e.reason.message) || e.reason || '');
    if (BENIGN_SDF_ERROR.test(msg)) e.preventDefault();
  });
  window.addEventListener('error', (e: ErrorEvent) => {
    const msg = String((e.error && e.error.message) || e.message || '');
    if (BENIGN_SDF_ERROR.test(msg)) e.preventDefault();
  });
}
