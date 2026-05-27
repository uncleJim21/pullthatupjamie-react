import { USE_MOCK_TAPE } from '../../config/tapeConfig.ts';
import { mockDossier } from '../../data/mockTapeData.ts';
import { runPull, hydrateCitations } from './tapeClient.ts';
import { dossierPrompt } from './tapePrompts.ts';
import type { DossierInput, DossierResult, DossierTopicGroup, DossierAppearance } from './tapeTypes.ts';

export async function getDossier(input: DossierInput): Promise<DossierResult> {
  if (USE_MOCK_TAPE) {
    await new Promise(r => setTimeout(r, 700 + Math.random() * 900));
    return mockDossier(input.person);
  }

  const text = await runPull(dossierPrompt(input.person));
  const topics: DossierTopicGroup[] = [];
  const appearances: DossierAppearance[] = [];

  const sections = text.split(/\n(?=##\s)/);
  for (const section of sections) {
    const topicMatch = section.match(/^##\s*TOPIC:\s*(.+)/i);
    const appsMatch = section.match(/^##\s*APPEARANCES/i);
    if (topicMatch) {
      const body = section.replace(/^##.*\n?/, '');
      topics.push({
        topic: topicMatch[1].trim(),
        positionSummary: body.replace(/\{\{clip:[^}]+\}\}/g, '').trim(),
        citations: await hydrateCitations(section),
      });
    } else if (appsMatch) {
      for (const line of section.split('\n')) {
        const m = line.match(/^-\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+)$/);
        if (m) appearances.push({ show: m[1].trim(), episodeTitle: m[2].trim(), publishedDate: m[3].trim(), citationCount: 0 });
      }
    }
  }

  return { person: input.person, topics, appearances, generatedAt: new Date().toISOString() };
}
