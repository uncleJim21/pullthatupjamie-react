// Source-language badge helpers.
//
// Jamie answers in the user's language and translates non-English clip quotes
// into that language. When the displayed quote is (say) English but the audio
// is German, we show a small "Translated from German" chip on the clip pill so
// the user isn't surprised to hear a foreign language on play.
//
// The badge compares two ISO 639-1 codes:
//   • clip language    — the audio's language, from the podcast feed metadata
//   • answer language  — the language Jamie replied in (`responseLanguage`)
// and shows only when they differ. See the Clip Source-Language Badge spec.

export interface LanguageBadge {
  /** Best-effort flag emoji. Language ≠ country, so this is the most-associated
   *  flag, not an authoritative one. May be '' for codes we don't map. */
  flag: string;
  /** English display name, e.g. "German". Falls back to the uppercased code. */
  name: string;
}

// Codes we expect to see across the indexed feeds. Anything not listed still
// renders (name = uppercased code, no flag) so a newly-supported feed language
// degrades gracefully rather than disappearing.
const LANGUAGE_LABELS: Record<string, LanguageBadge> = {
  en: { flag: '🇬🇧', name: 'English' },
  de: { flag: '🇩🇪', name: 'German' },
  es: { flag: '🇪🇸', name: 'Spanish' },
  fr: { flag: '🇫🇷', name: 'French' },
  it: { flag: '🇮🇹', name: 'Italian' },
  pt: { flag: '🇵🇹', name: 'Portuguese' },
  nl: { flag: '🇳🇱', name: 'Dutch' },
  sv: { flag: '🇸🇪', name: 'Swedish' },
  no: { flag: '🇳🇴', name: 'Norwegian' },
  da: { flag: '🇩🇰', name: 'Danish' },
  fi: { flag: '🇫🇮', name: 'Finnish' },
  pl: { flag: '🇵🇱', name: 'Polish' },
  ru: { flag: '🇷🇺', name: 'Russian' },
  uk: { flag: '🇺🇦', name: 'Ukrainian' },
  cs: { flag: '🇨🇿', name: 'Czech' },
  tr: { flag: '🇹🇷', name: 'Turkish' },
  ja: { flag: '🇯🇵', name: 'Japanese' },
  ko: { flag: '🇰🇷', name: 'Korean' },
  zh: { flag: '🇨🇳', name: 'Chinese' },
  hi: { flag: '🇮🇳', name: 'Hindi' },
  ar: { flag: '🇸🇦', name: 'Arabic' },
};

/**
 * Normalize a language tag to a lowercase ISO 639-1 base code: strips region
 * subtags and whitespace ("en-US" → "en", "DE" → "de"). Returns undefined for
 * empty/non-string input so callers can treat "no signal" uniformly.
 */
export function normalizeLang(code?: string | null): string | undefined {
  if (!code || typeof code !== 'string') return undefined;
  const base = code.trim().toLowerCase().split(/[-_]/)[0];
  return base || undefined;
}

/** Resolve a language code to its { flag, name } for display. */
export function getLanguageBadge(code?: string | null): LanguageBadge | undefined {
  const norm = normalizeLang(code);
  if (!norm) return undefined;
  return LANGUAGE_LABELS[norm] || { flag: '', name: norm.toUpperCase() };
}

/**
 * Whether a "translated from" badge should be shown for a clip. True only when
 * both languages are known and they differ — so an unknown/missing signal (the
 * default "en" feed, a same-language read) never produces a wrong badge.
 */
export function shouldShowLanguageBadge(
  clipLang?: string | null,
  answerLang?: string | null
): boolean {
  const clip = normalizeLang(clipLang);
  const answer = normalizeLang(answerLang);
  return !!clip && !!answer && clip !== answer;
}
