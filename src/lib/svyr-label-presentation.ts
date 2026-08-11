import type { CommandNode } from '@/lib/command-registry';
import type { TokenSuggestion } from '@/lib/command-parser';

/**
 * Visual grammar for SVYR selectable labels.
 *
 * - navigation → delimited menu/container target
 * - entry → delimited data-entry/capture destination
 * - choice → delimited selectable canonical value
 *
 * Formatting is presentation-only — canonical values and route tokens stay plain.
 * Punctuation pairs are owned by `SVYR_LABEL_DELIMITERS` so the grammar can be
 * retuned in one place without touching classification or renderers.
 */
export type SvyrLabelPresentation = 'navigation' | 'entry' | 'choice';

/** Punctuation used by route/command rows in navigation surfaces. */
export type SvyrCommandLabelPresentation = Extract<
  SvyrLabelPresentation,
  'navigation' | 'entry'
>;

export type SvyrLabelDelimiterPair = {
  open: string;
  close: string;
};

/**
 * Central visual-language punctuation for SVYR labels.
 * Change these pairs to retune the grammar; do not hardcode punctuation in UI.
 */
export const SVYR_LABEL_DELIMITERS = {
  navigation: {
    open: '[',
    close: ']',
  },
  entry: {
    open: '(',
    close: ')',
  },
  choice: {
    open: '<',
    close: '>',
  },
} as const satisfies Record<SvyrLabelPresentation, SvyrLabelDelimiterPair>;

export function formatSvyrDisplayedLabel(
  label: string,
  presentation: SvyrLabelPresentation,
): string {
  const trimmed = label.trim();
  if (!trimmed) return trimmed;
  const delimiters = SVYR_LABEL_DELIMITERS[presentation];
  return `${delimiters.open}${trimmed}${delimiters.close}`;
}

/**
 * Derive punctuation from registry node capabilities.
 * Value-bearing and compound-capture destinations are entry; everything else
 * (including blocked workflow-only leaves) stays navigation so entry delimiters
 * never imply a writable capture surface for unsupported leaves.
 */
export function resolveSvyrNodeLabelPresentation(
  node: Pick<CommandNode, 'requiresValue' | 'compoundCapture'>,
): SvyrCommandLabelPresentation {
  if (node.requiresValue || node.compoundCapture) {
    return 'entry';
  }
  return 'navigation';
}

/**
 * Same classification for autocomplete/navigation token suggestions.
 * Driven by destination semantics already copied onto TokenSuggestion.
 */
export function resolveSvyrTokenLabelPresentation(
  suggestion: Pick<
    TokenSuggestion,
    'requiresValue' | 'compoundCapture'
  >,
): SvyrCommandLabelPresentation {
  return resolveSvyrNodeLabelPresentation({
    requiresValue: suggestion.requiresValue,
    compoundCapture: suggestion.compoundCapture,
  });
}
