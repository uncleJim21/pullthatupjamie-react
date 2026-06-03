// Tape skin — global synthesis-tier preference.
//
// One choice (Deep = quality / Fast = fast), set once on the launcher and
// applied across every action. Persisted in localStorage so it survives
// reloads, and synced across hook instances via a `storage` event listener so
// flipping it on the launcher takes effect inside any open View immediately.

import { useEffect, useState, useCallback } from 'react';
import type { TapeModel } from './tapeTypes.ts';

const STORAGE_KEY = 'tapeModel';
const DEFAULT_MODEL: TapeModel = 'quality';

const readStored = (): TapeModel => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'fast' ? 'fast' : DEFAULT_MODEL;
  } catch {
    return DEFAULT_MODEL;
  }
};

/** Same-tab cross-component sync: localStorage's `storage` event only fires
 *  cross-tab, so we emit our own custom event on every write that other hook
 *  instances in this tab listen for. */
const EVENT = 'tape-model-changed';

export function useTapeModel(): [TapeModel, (m: TapeModel) => void] {
  const [model, setModel] = useState<TapeModel>(readStored);

  useEffect(() => {
    const onChange = () => setModel(readStored());
    window.addEventListener(EVENT, onChange);
    window.addEventListener('storage', onChange); // cross-tab
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  const set = useCallback((m: TapeModel) => {
    try { localStorage.setItem(STORAGE_KEY, m); } catch { /* sessionStorage-only env */ }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return [model, set];
}
