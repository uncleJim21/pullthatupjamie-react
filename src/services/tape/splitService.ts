import { USE_MOCK_TAPE } from '../../config/tapeConfig.ts';
import { mockSplit } from '../../data/mockTapeData.ts';
import { runPull, hydrateCitations } from './tapeClient.ts';
import { splitPrompt } from './tapePrompts.ts';
import type { SplitInput, SplitResult, SplitSide } from './tapeTypes.ts';

export async function getSplit(input: SplitInput): Promise<SplitResult> {
  if (USE_MOCK_TAPE) {
    await new Promise(r => setTimeout(r, 900 + Math.random() * 1000));
    return mockSplit(input.personA, input.personB, input.topic);
  }

  const text = await runPull(splitPrompt(input.personA, input.personB, input.topic));
  const sides: SplitSide[] = [];
  let contrastSummary: string | undefined;

  for (const block of text.split(/\n(?=##\s)/)) {
    const personMatch = block.match(/^##\s*PERSON:\s*(.+)/i);
    const contrastMatch = block.match(/^##\s*CONTRAST/i);
    if (personMatch) {
      const body = block.replace(/^##.*\n?/, '');
      sides.push({
        person: personMatch[1].trim(),
        positionSummary: body.replace(/\{\{clip:[^}]+\}\}/g, '').trim(),
        citations: await hydrateCitations(block),
      });
    } else if (contrastMatch) {
      contrastSummary = block.replace(/^##.*\n?/, '').replace(/\{\{clip:[^}]+\}\}/g, '').trim();
    }
  }

  const blank: SplitSide = { person: '', positionSummary: '', citations: [] };
  return {
    topic: input.topic,
    sideA: sides[0] || { ...blank, person: input.personA },
    sideB: sides[1] || { ...blank, person: input.personB },
    contrastSummary,
    generatedAt: new Date().toISOString(),
  };
}
