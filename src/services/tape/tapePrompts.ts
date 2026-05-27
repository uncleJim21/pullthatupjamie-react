// Tape skin — /api/pull message templates.
//
// Each template instructs the agent to (a) emit deterministic section markers
// so the client can split the synthesized text into typed groups, and (b) cite
// every claim inline with the existing `{{clip:<pineconeId>}}` token convention
// (resolved later via get-hierarchy). See docs/tape-api.md for the full contract.

export const dossierPrompt = (person: string): string =>
  `You are building a research dossier on ${person} from the podcast corpus.
List ${person}'s stated positions, grouped by topic. For EACH topic:
- Begin a section with a line exactly: "## TOPIC: <topic name>"
- Summarize their stance in 2-3 sentences.
- Cite every claim inline using a {{clip:<pineconeId>}} token immediately after the sentence it supports.
Use ONLY positions actually stated by ${person} in the corpus.
After all topics, add one final section "## APPEARANCES" listing each show/episode where ${person} appears, one per line as: "- <show> | <episode title> | <YYYY-MM-DD>".`;

export const timelineDrilldownPrompt = (topic: string, weekStart: string, weekEnd: string): string =>
  `Find every place in the corpus where "${topic}" was discussed between ${weekStart} and ${weekEnd}.
Summarize what was said in 2-3 sentences, then cite each underlying paragraph inline with {{clip:<pineconeId>}} tokens.`;

export const briefPrompt = (topic: string, asOfDate: string): string =>
  `Write a brief on what was said about "${topic}" across the podcast corpus in the 7 days ending ${asOfDate}.
Start with one line exactly: "# HEADLINE: <one sentence>".
Then group by publisher/show. For each: a line "## PUBLISHER: <show name>", a 2-3 sentence summary, and inline {{clip:<pineconeId>}} citations.`;

export const splitPrompt = (a: string, b: string, topic: string): string =>
  `Compare the stated positions of ${a} and ${b} on "${topic}" using the corpus.
Output two sections: "## PERSON: ${a}" and "## PERSON: ${b}", each with a 2-3 sentence stance summary and inline {{clip:<pineconeId>}} citations.
End with a section "## CONTRAST" describing where they diverge in 1-2 sentences.`;
