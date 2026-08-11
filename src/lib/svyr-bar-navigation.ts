/**
 * Pure navigation targets for the shared SVYR bar.
 *
 * Earlier segments jump directly to that path level.
 * The final segment always means one-level BACK.
 * Neither path writes Engine state — callers apply the target through
 * existing controller navigation helpers.
 */

/**
 * Stable dock geometry for the shared SVYR bar. Central content must never
 * influence these values — every page mounts the same bottom-left contract.
 * Numeric values match `Spacing.md` / `Spacing.xs` from the theme tokens.
 */
export const SVYR_BAR_LAYOUT = {
  minHeight: 36,
  paddingHorizontal: 12,
  paddingVertical: 4,
  pathMinHeight: 28,
  pathGap: 6,
  hitSlop: 8,
} as const;

/** Resolve the structural path produced by pressing an editable segment. */
export function resolveSvyrBarSegmentTarget(
  path: string[],
  segmentIndex: number,
): string[] | null {
  if (segmentIndex < 0 || segmentIndex >= path.length) return null;
  if (segmentIndex === path.length - 1) {
    return path.slice(0, -1);
  }
  return path.slice(0, segmentIndex + 1);
}

/** Root label press — never pops below an empty path. */
export function resolveSvyrBarRootTarget(path: string[]): string[] {
  return path.length === 0 ? path : [];
}
