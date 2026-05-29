import { USE_MOCK_TAPE } from '../../config/tapeConfig.ts';
import { mockReadIn } from '../../data/mockTapeCompanies.ts';
import type { ReadInInput, ReadInResult } from './tapeTypes.ts';

/**
 * Read in — fast company research scaling Quick / Brief / Deep.
 * Mock-backed for the Potemkin (hand-curated per-ticker fixtures in
 * mockTapeCompanies.ts). Real path will pull current quotes via search-quotes
 * by company name, then synthesize the pulse + sections.
 */
export async function getReadIn(input: ReadInInput): Promise<ReadInResult> {
  if (USE_MOCK_TAPE) {
    await new Promise(r => setTimeout(r, 500 + Math.random() * 700));
    return mockReadIn(input.ticker);
  }
  // Real path lives behind a future endpoint; mock is source of truth for the demo.
  return mockReadIn(input.ticker);
}
