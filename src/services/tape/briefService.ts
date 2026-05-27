import { USE_MOCK_TAPE } from '../../config/tapeConfig.ts';
import { mockBrief } from '../../data/mockTapeData.ts';
import { runPull, hydrateCitations } from './tapeClient.ts';
import { briefPrompt } from './tapePrompts.ts';
import type { BriefInput, BriefResult, BriefPublisherSection } from './tapeTypes.ts';

export async function getBrief(input: BriefInput): Promise<BriefResult> {
  if (USE_MOCK_TAPE) {
    await new Promise(r => setTimeout(r, 800 + Math.random() * 1000));
    return mockBrief(input.topic, input.asOfDate);
  }

  const text = await runPull(briefPrompt(input.topic, input.asOfDate));
  let headline = '';
  const sections: BriefPublisherSection[] = [];

  for (const block of text.split(/\n(?=#{1,2}\s)/)) {
    const headlineMatch = block.match(/^#\s*HEADLINE:\s*(.+)/i);
    const pubMatch = block.match(/^##\s*PUBLISHER:\s*(.+)/i);
    if (headlineMatch) headline = headlineMatch[1].trim();
    else if (pubMatch) {
      const body = block.replace(/^##.*\n?/, '');
      sections.push({
        publisher: pubMatch[1].trim(),
        summary: body.replace(/\{\{clip:[^}]+\}\}/g, '').trim(),
        citations: await hydrateCitations(block),
      });
    }
  }

  return { topic: input.topic, asOfDate: input.asOfDate, headline, sections, generatedAt: new Date().toISOString() };
}
