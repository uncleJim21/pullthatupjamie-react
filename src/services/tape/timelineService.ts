import { USE_MOCK_TAPE } from '../../config/tapeConfig.ts';
import { mockTimeline, mockTimelineDrilldown } from '../../data/mockTapeData.ts';
import { runPull, hydrateCitations, fetchTimeline, stripCitationTokens } from './tapeClient.ts';
import { timelineDrilldownPrompt } from './tapePrompts.ts';
import type {
  TimelineInput,
  TimelineResult,
  TimelineDrilldownInput,
  TimelineDrilldownResult,
} from './tapeTypes.ts';

/** Weekly mention counts — the one action backed by a dedicated endpoint
 *  (an NL agent can't be trusted to produce quantitative aggregations). */
export async function getTimeline(input: TimelineInput): Promise<TimelineResult> {
  if (USE_MOCK_TAPE) {
    await new Promise(r => setTimeout(r, 350 + Math.random() * 350));
    return mockTimeline(input.topic, input.startDate, input.endDate);
  }
  return fetchTimeline(input);
}

/** Drill-down hits for a clicked week — retrieval + synthesis, so it rides /pull. */
export async function getTimelineDrilldown(input: TimelineDrilldownInput): Promise<TimelineDrilldownResult> {
  if (USE_MOCK_TAPE) {
    await new Promise(r => setTimeout(r, 600 + Math.random() * 700));
    return mockTimelineDrilldown(input.topic, input.weekStart, input.weekEnd);
  }
  const text = await runPull(timelineDrilldownPrompt(input.topic, input.weekStart, input.weekEnd));
  return {
    weekStart: input.weekStart,
    summary: stripCitationTokens(text),
    citations: await hydrateCitations(text),
  };
}
