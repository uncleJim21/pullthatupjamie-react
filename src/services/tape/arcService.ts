import { USE_MOCK_TAPE } from '../../config/tapeConfig.ts';
import { mockArc } from '../../data/mockTapeData.ts';
import { runPull, hydrateCitations } from './tapeClient.ts';
import type { ArcInput, ArcResult } from './tapeTypes.ts';

/**
 * Arc — how a person's view on their core thesis evolved over time.
 * Real path (future): pull the person's quotes across dates from their
 * guest-dominant episodes, then read a conviction level from each. For now the
 * demo is mock-backed (curated, hand-verified clips with conviction reads).
 */
export async function getArc(input: ArcInput): Promise<ArcResult> {
  if (USE_MOCK_TAPE) {
    await new Promise(r => setTimeout(r, 700 + Math.random() * 900));
    return mockArc(input.person);
  }

  // Real path is a thin placeholder until the longitudinal endpoint exists; the
  // mock is the source of truth for the demo. See docs/tape-api.md.
  const text = await runPull(`Trace how ${input.person} has talked about their core macro thesis over time.`);
  const citations = await hydrateCitations(text);
  return {
    person: input.person,
    thesis: '',
    verdict: '',
    calls: citations.map(c => ({ date: c.publishedDate || '', label: '', conviction: 3, citation: c })),
    generatedAt: new Date().toISOString(),
  };
}
