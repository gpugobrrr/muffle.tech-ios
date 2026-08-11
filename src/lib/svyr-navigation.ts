import { childNodes } from '@/lib/command-registry';
import type {
  CommandSuggestion,
  TokenSuggestion,
} from '@/lib/command-parser';
import { resolveSvyrTokenLabelPresentation } from '@/lib/svyr-label-presentation';

export type SvyrNavigationItemModel = {
  id: string;
  label: string;
  description: string;
  available: boolean;
  selected?: boolean;
  kind: 'navigation' | 'hint';
  /** Destination punctuation for command rows; ignored for hints. */
  presentation?: 'navigation' | 'entry';
};

export type NavigationRow<T> = readonly [T] | readonly [T, T];

export const SCROLL_EDGE_EPSILON = 2;

/**
 * Balanced row-major pairing: consecutive items form left/right rows.
 * Flattening rows in order reproduces the original input sequence.
 */
export function toNavigationRows<T>(items: readonly T[]): readonly NavigationRow<T>[] {
  const rows: NavigationRow<T>[] = [];
  for (let index = 0; index < items.length; index += 2) {
    const left = items[index];
    const right = items[index + 1];
    if (right === undefined) {
      rows.push([left]);
      continue;
    }
    rows.push([left, right]);
  }
  return rows;
}

export function flattenNavigationRows<T>(
  rows: readonly NavigationRow<T>[],
): readonly T[] {
  return rows.flatMap((row) => [...row]);
}

/**
 * Derive independent column item lists from row-major rows.
 * Flattening left/right in lockstep reproduces the original sequence.
 */
export function toNavigationColumns<T>(items: readonly T[]): {
  left: readonly T[];
  right: readonly T[];
} {
  const rows = toNavigationRows(items);
  const left: T[] = [];
  const right: T[] = [];

  for (const row of rows) {
    left.push(row[0]);
    if (row.length === 2) {
      right.push(row[1]);
    }
  }

  return { left, right };
}

export function interleaveNavigationColumns<T>({
  left,
  right,
}: {
  left: readonly T[];
  right: readonly T[];
}): readonly T[] {
  const items: T[] = [];
  for (let index = 0; index < left.length; index += 1) {
    items.push(left[index]);
    if (right[index] !== undefined) {
      items.push(right[index]);
    }
  }
  return items;
}

export function getNavigationScrollState({
  offsetY,
  viewportHeight,
  contentHeight,
  epsilon = SCROLL_EDGE_EPSILON,
}: {
  offsetY: number;
  viewportHeight: number;
  contentHeight: number;
  epsilon?: number;
}): { canScrollUp: boolean; canScrollDown: boolean } {
  if (contentHeight <= viewportHeight + epsilon) {
    return { canScrollUp: false, canScrollDown: false };
  }

  return {
    canScrollUp: offsetY > epsilon,
    canScrollDown: offsetY + viewportHeight < contentHeight - epsilon,
  };
}

export function rootNavigationTokens(): string[] {
  return childNodes([]).map((node) => node.token);
}

export function navigationChildTokens(path: string[]): string[] {
  return childNodes(path).map((node) => node.token);
}

export function isTokenSuggestion(
  suggestion: CommandSuggestion,
): suggestion is TokenSuggestion {
  return suggestion.type === 'token';
}

export function navigableTokenSuggestions(
  suggestions: readonly CommandSuggestion[],
): readonly TokenSuggestion[] {
  return suggestions.filter(isTokenSuggestion);
}

export function navigationItemsFromSuggestions(
  suggestions: readonly CommandSuggestion[],
): readonly SvyrNavigationItemModel[] {
  return suggestions.map((suggestion) => {
    if (suggestion.type === 'input-hint') {
      return {
        id: suggestion.id,
        label: suggestion.label,
        description: suggestion.description ?? suggestion.label,
        available: true,
        kind: 'hint',
      };
    }

    return {
      id: suggestion.id,
      label: suggestion.label,
      description: suggestion.description,
      available: suggestion.available,
      kind: 'navigation',
      presentation: resolveSvyrTokenLabelPresentation(suggestion),
    };
  });
}
