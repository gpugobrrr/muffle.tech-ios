import type { CommandNode } from '@/lib/command-registry';
import type { TokenSuggestion } from '@/lib/command-parser';

/**
 * Visual grammar for SVYR selectable labels.
 *
 * - navigation → [label] — opens another menu/container
 * - entry → (label) — opens a data-entry/capture surface
 * - choice → <label> — selects/commits a canonical value
 *
 * Formatting is presentation-only — canonical values and route tokens stay plain.
 */
export type SvyrLabelPresentation = 'navigation' | 'entry' | 'choice';

/** Punctuation used by route/command rows in navigation surfaces. */
export type SvyrCommandLabelPresentation = Extract<
  SvyrLabelPresentation,
  'navigation' | 'entry'
>;

export function formatSvyrDisplayedLabel(
  label: string,
  presentation: SvyrLabelPresentation,
): string {
  const trimmed = label.trim();
  if (!trimmed) return trimmed;
  switch (presentation) {
    case 'choice':
      return `<${trimmed}>`;
    case 'entry':
      return `(${trimmed})`;
    case 'navigation':
    default:
      return `[${trimmed}]`;
  }
}

/**
 * Derive punctuation from registry node capabilities.
 * Value-bearing and compound-capture destinations are entry; everything else
 * (including blocked workflow-only leaves) stays navigation so `( )` never
 * implies a writable capture surface.
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
