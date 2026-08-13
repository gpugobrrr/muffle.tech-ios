import {
  childNodes,
  findCommandNode,
  formatCommandPath,
  isBranchNode,
  resolveCommandToken,
} from '@/lib/command-registry';

export type ParsedEditableCommand = {
  /** Structured keywords in the editable suffix (original casing preserved). */
  structuredTokens: string[];
  /** Free-text value after a value-bearing path (original casing preserved). */
  valueText: string;
  /** True when the structured path is waiting for a free-text value. */
  expectsValue: boolean;
  /**
   * Unrecognised / incomplete trailing text that is not yet a value.
   * Deleted character-by-character (native Backspace).
   */
  trailingPartial: string;
};

/**
 * Valid next structured tokens after `pathSoFar` (absolute, lowercased),
 * or `'value'` when free-text begins, or `'none'` when the path is closed.
 */
export function nextEditableStep(
  pathSoFar: string[],
): string[] | 'value' | 'none' {
  if (pathSoFar.length === 0) {
    return childNodes([]).map((node) => node.token);
  }

  const node = findCommandNode(pathSoFar);
  if (!node) return 'none';
  if (node.requiresValue) return 'value';
  if (isBranchNode(node)) return childNodes(pathSoFar).map((c) => c.token);

  return 'none';
}

function formatStructuredSuffix(tokens: string[]): string {
  return formatCommandPath(tokens);
}

/**
 * Parse the editable suffix against the slash-separated command grammar.
 */
export function parseEditableCommand(
  commandSuffix: string,
): ParsedEditableCommand {
  const pathBase: string[] = [];

  if (!commandSuffix) {
    const step = nextEditableStep(pathBase);
    return {
      structuredTokens: [],
      valueText: '',
      expectsValue: step === 'value',
      trailingPartial: '',
    };
  }

  const firstSpaceIndex = commandSuffix.indexOf(' ');
  const hasSpace = firstSpaceIndex !== -1;
  const structuralPart = hasSpace
    ? commandSuffix.slice(0, firstSpaceIndex)
    : commandSuffix;
  const afterSpace = hasSpace ? commandSuffix.slice(firstSpaceIndex + 1) : null;

  const trailingSeparator = structuralPart.endsWith('/');
  const rawSegments = structuralPart.split('/').filter((segment) => segment.length > 0);

  const structuredTokens: string[] = [];
  let consumedThrough = 0;

  for (let i = 0; i < rawSegments.length; i += 1) {
    const rawToken = rawSegments[i];
    const absolutePath = [...pathBase, ...structuredTokens];
    const step = nextEditableStep(absolutePath);

    if (step === 'value') {
      // Value belongs after a space — treat remaining structural text as partial.
      const remainderStart = commandSuffix.indexOf(rawToken, consumedThrough);
      return {
        structuredTokens,
        valueText: '',
        expectsValue: true,
        trailingPartial:
          remainderStart >= 0
            ? commandSuffix.slice(remainderStart)
            : commandSuffix.slice(consumedThrough),
      };
    }

    const resolvedToken = Array.isArray(step)
      ? resolveCommandToken(rawToken, step)
      : undefined;
    if (resolvedToken) {
      structuredTokens.push(resolvedToken);
      const tokenIndex = commandSuffix.indexOf(rawToken, consumedThrough);
      consumedThrough =
        tokenIndex >= 0 ? tokenIndex + rawToken.length : consumedThrough;
      continue;
    }

    // Incomplete / unknown token — character deletion territory.
    const remainderStart = commandSuffix.indexOf(rawToken, consumedThrough);
    return {
      structuredTokens,
      valueText: '',
      expectsValue: false,
      trailingPartial:
        remainderStart >= 0
          ? commandSuffix.slice(remainderStart)
          : commandSuffix.slice(consumedThrough),
    };
  }

  const absolutePath = [...pathBase, ...structuredTokens];
  const step = nextEditableStep(absolutePath);

  if (step === 'value') {
    return {
      structuredTokens,
      valueText: afterSpace ?? '',
      expectsValue: true,
      trailingPartial: '',
    };
  }

  if (trailingSeparator) {
    return {
      structuredTokens,
      valueText: '',
      expectsValue: false,
      trailingPartial: '/',
    };
  }

  if (afterSpace !== null) {
    // Space after a non-value path — treat as free trailing text.
    return {
      structuredTokens,
      valueText: '',
      expectsValue: false,
      trailingPartial: commandSuffix.slice(firstSpaceIndex),
    };
  }

  return {
    structuredTokens,
    valueText: '',
    expectsValue: false,
    trailingPartial: '',
  };
}

function removeLastStructuredToken(parsed: ParsedEditableCommand): string {
  if (parsed.structuredTokens.length === 0) {
    return '';
  }
  const remaining = parsed.structuredTokens.slice(0, -1);
  return formatStructuredSuffix(remaining);
}

function removeLastCharacterFromValue(parsed: ParsedEditableCommand): string {
  const nextValue = parsed.valueText.slice(0, -1);
  const head =
    parsed.structuredTokens.length > 0
      ? `${formatStructuredSuffix(parsed.structuredTokens)} `
      : '';
  return `${head}${nextValue}`;
}

/**
 * Compute the suffix after one semantic Backspace.
 * Prefer calling this only for atomic structured deletion; free-text
 * values should use native character deletion.
 */
export function deletePreviousCommandPart(
  commandSuffix: string,
): string {
  const parsed = parseEditableCommand(commandSuffix);

  if (parsed.valueText.length > 0) {
    return removeLastCharacterFromValue(parsed);
  }

  if (parsed.trailingPartial.length > 0) {
    const head =
      parsed.structuredTokens.length > 0
        ? formatStructuredSuffix(parsed.structuredTokens)
        : '';
    const nextPartial = parsed.trailingPartial.slice(0, -1);
    if (!head) return nextPartial;
    if (!nextPartial) return head;
    // Preserve `/` between structured path and a remaining partial segment.
    if (nextPartial.startsWith('/') || nextPartial.startsWith(' ')) {
      return `${head}${nextPartial}`;
    }
    return `${head}/${nextPartial}`;
  }

  return removeLastStructuredToken(parsed);
}

/**
 * Whether Backspace should remove the last structured keyword atomically.
 * False → allow native one-character deletion (values, partials, selections).
 */
export function shouldAtomicallyDeleteOnBackspace(
  commandSuffix: string,
): boolean {
  if (!commandSuffix) {
    return false;
  }

  const parsed = parseEditableCommand(commandSuffix);

  if (parsed.valueText.length > 0) {
    return false;
  }

  if (parsed.trailingPartial.length > 0) {
    return false;
  }

  return parsed.structuredTokens.length > 0;
}

/**
 * Whether one editable structural segment may be removed atomically.
 * False when a free-text value is present. Shared by atomic Backspace and
 * the directory-up swipe.
 */
export function canRemoveLastEditableCommandSegment(
  commandSuffix: string,
): boolean {
  return shouldAtomicallyDeleteOnBackspace(commandSuffix);
}

/**
 * Remove the final editable structural directory — the single structural
 * helper behind both atomic Backspace and swipe-right, so both always
 * produce the same path. Free-text values are untouched.
 */
export function removeLastEditableCommandSegment(
  commandSuffix: string,
): string {
  if (!canRemoveLastEditableCommandSegment(commandSuffix)) {
    return commandSuffix;
  }
  return deletePreviousCommandPart(commandSuffix);
}
