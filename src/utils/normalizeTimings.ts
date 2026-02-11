type AnyRecord = Record<string, any>;

const coerceNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

/**
 * Normalize timing keys that may arrive in either snake_case or camelCase.
 * - start_time / startTime -> startTime
 * - end_time / endTime     -> endTime
 * - duration              -> duration (coerced to number if present)
 *
 * Returns a shallow copy; does not mutate the input.
 */
export const normalizeTimingFields = <T extends AnyRecord>(obj: T | null | undefined): T => {
  const source: AnyRecord = obj ?? {};

  const startTime = coerceNumber(source.startTime ?? source.start_time);
  const endTime = coerceNumber(source.endTime ?? source.end_time);
  const duration = coerceNumber(source.duration);

  return {
    ...source,
    ...(startTime !== undefined ? { startTime } : {}),
    ...(endTime !== undefined ? { endTime } : {}),
    ...(duration !== undefined ? { duration } : {}),
  } as T;
};

/**
 * Normalize "chapter-like" objects that may carry timings either at the root,
 * inside metadata, or in snake_case.
 */
export const normalizeChapterLike = <T extends AnyRecord>(chapter: T | null | undefined): T => {
  const source: AnyRecord = chapter ?? {};
  const metadata = normalizeTimingFields(source.metadata);

  const startTime = coerceNumber(
    source.startTime ?? source.start_time ?? metadata.startTime ?? (metadata as AnyRecord).start_time,
  );
  const endTime = coerceNumber(
    source.endTime ?? source.end_time ?? metadata.endTime ?? (metadata as AnyRecord).end_time,
  );

  return {
    ...source,
    ...(startTime !== undefined ? { startTime } : {}),
    ...(endTime !== undefined ? { endTime } : {}),
    metadata,
  } as T;
};


