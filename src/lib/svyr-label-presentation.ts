/**
 * Visual grammar for SVYR selectable labels.
 *
 * Navigation targets use square brackets; data-entry choices use parentheses.
 * Formatting is presentation-only — canonical values and route tokens stay plain.
 */
export type SvyrLabelPresentation = 'navigation' | 'choice';

export function formatSvyrDisplayedLabel(
  label: string,
  presentation: SvyrLabelPresentation,
): string {
  const trimmed = label.trim();
  if (!trimmed) return trimmed;
  return presentation === 'navigation' ? `[${trimmed}]` : `(${trimmed})`;
}
