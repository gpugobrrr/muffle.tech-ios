import {
    appendCommandSegment,
    childNodes,
    findCommandNode,
    formatCommandPath,
    isBranchNode,
    isPinnableNode,
    isTerminalNode,
    normalizeCommandToken,
    parseSvyrInput,
    walkCommandPath,
    type CommandNode,
} from '@/lib/command-registry';
import { findFieldDefinition, normalizeFieldInputValue } from '@/lib/field-schema';
import type { SurveyOperation } from '@/lib/survey-operations';

export type ParsedCommand =
  | {
      type: 'operation';
      path: string[];
      operation: SurveyOperation;
    }
  | {
      type: 'placeholder';
      path: string[];
    }
  | {
      type: 'pin-context';
      path: string[];
    }
  | {
      type: 'unpin-context';
    }
  | {
      type: 'cannot-pin';
    }
  | {
      type: 'lookup';
      query: string;
    }
  | {
      type: 'incomplete';
      path: string[];
      prompt: string;
    }
  | {
      type: 'unknown';
    };

export type TokenSuggestion = {
  type: 'token';
  id: string;
  /** Display label — may include placeholders like `party <name>` */
  label: string;
  /** Suffix-relative insert text — never includes `<placeholders>` */
  insertion: string;
  /** Absolute command path for this suggestion */
  commandPath: string[];
  /** Final executable step with no further segments */
  isTerminal: boolean;
  /** Needs a free-text value before it can execute */
  requiresValue?: boolean;
  pinnable?: boolean;
  description: string;
};

export type InputHintSuggestion = {
  type: 'input-hint';
  id: string;
  label: string;
  description?: string;
};

export type CommandSuggestion = TokenSuggestion | InputHintSuggestion;

export const INCOMPLETE_BRANCH_PROMPT = 'ADDITIONAL INPUT REQUIRED';

function valuePromptFor(node: CommandNode): string {
  return node.valuePrompt ?? `ENTER ${node.token.toUpperCase()}`;
}

function writeCommand(path: string[], value: string): ParsedCommand {
  const node = findCommandNode(path);
  const fieldDefinition = findFieldDefinition(path);
  const normalizedValue = normalizeFieldInputValue(fieldDefinition, value);

  if (!normalizedValue) {
    return {
      type: 'incomplete',
      path,
      prompt: fieldDefinition?.valuePrompt ?? (node ? valuePromptFor(node) : INCOMPLETE_BRANCH_PROMPT),
    };
  }

  const operationId = node?.operationId ?? fieldDefinition?.operationId;
  if (operationId) {
    return {
      type: 'operation',
      path,
      operation: {
        operationId,
        arguments: { value: normalizedValue },
      },
    };
  }
  return { type: 'placeholder', path };
}

function readCommand(path: string[]): ParsedCommand {
  const node = findCommandNode(path);
  const fieldDefinition = findFieldDefinition(path);
  const operationId = node?.readOperationId ?? fieldDefinition?.readOperationId;
  if (operationId) {
    return {
      type: 'operation',
      path,
      operation: {
        operationId,
        arguments: {},
      },
    };
  }
  return {
    type: 'incomplete',
    path,
    prompt: node ? valuePromptFor(node) : INCOMPLETE_BRANCH_PROMPT,
  };
}

function stripTrailingPin(rawCommand: string): {
  remainder: string;
  isPin: boolean;
} {
  const trimmed = rawCommand.trim();
  const match = trimmed.match(/^(.*)\spin$/i);
  if (!match) {
    return { remainder: trimmed, isPin: false };
  }
  return { remainder: match[1].trimEnd(), isPin: true };
}

/**
 * Parse a full SVYR command (pinned prefix already merged in).
 * Structural segments are slash-separated; free text follows one space.
 */
export function parseCommand(rawCommand: string): ParsedCommand {
  const trimmed = rawCommand.trim();
  if (!trimmed) return { type: 'unknown' };

  if (trimmed.toLowerCase() === 'unpin') {
    return { type: 'unpin-context' };
  }

  if (/^lookup(?:\s|$)/i.test(trimmed)) {
    const query = trimmed.replace(/^lookup\s*/i, '').trim();
    if (!query) {
      return {
        type: 'incomplete',
        path: [],
        prompt: 'ENTER LOOKUP PATH',
      };
    }
    return { type: 'lookup', query };
  }

  const { remainder, isPin } = stripTrailingPin(trimmed);
  if (isPin) {
    if (!remainder) {
      return { type: 'cannot-pin' };
    }
    const { path, value } = parseSvyrInput(remainder);
    if (value.trim()) {
      return { type: 'cannot-pin' };
    }
    const walk = walkCommandPath(path);
    if (
      walk.consumed === path.length &&
      walk.node &&
      isPinnableNode(walk.node)
    ) {
      return { type: 'pin-context', path: walk.path };
    }
    return { type: 'cannot-pin' };
  }

  const { path, value } = parseSvyrInput(trimmed);
  const walk = walkCommandPath(path);

  if (walk.path.length === 0 || !walk.node) {
    return { type: 'unknown' };
  }

  if (walk.consumed < path.length) {
    return { type: 'unknown' };
  }

  if (value) {
    if (!walk.expectsValue) {
      return { type: 'unknown' };
    }
    return writeCommand(walk.path, value);
  }

  if (walk.node.requiresValue) {
    // Bare field path: execute the registered read when one exists.
    return readCommand(walk.path);
  }

  if (isBranchNode(walk.node)) {
    return {
      type: 'incomplete',
      path: walk.path,
      prompt: INCOMPLETE_BRANCH_PROMPT,
    };
  }

  return writeCommand(walk.path, '');
}

/**
 * Strip a pinned structural prefix from an absolute insertion,
 * leaving a suffix-relative fragment (no leading `/`).
 */
function relativeInsertion(
  absoluteInsertion: string,
  pinnedPrefix: string[],
): string {
  if (pinnedPrefix.length === 0) return absoluteInsertion;

  const prefix = formatCommandPath(pinnedPrefix);
  const lowerAbsolute = absoluteInsertion.toLowerCase();
  const lowerPrefix = prefix.toLowerCase();

  if (lowerAbsolute === lowerPrefix) {
    return '';
  }

  if (lowerAbsolute.startsWith(`${lowerPrefix}/`)) {
    return absoluteInsertion.slice(prefix.length + 1);
  }

  // Value-bearing absolute ends with a trailing space after the path.
  if (lowerAbsolute.startsWith(`${lowerPrefix} `)) {
    return absoluteInsertion.slice(prefix.length);
  }

  return absoluteInsertion;
}

function absoluteInsertionFor(
  commandPath: string[],
  node: CommandNode,
): string {
  const pathText = formatCommandPath(commandPath);
  if (node.requiresValue) {
    return `${pathText} `;
  }
  // Branches and argument-free leaves — no trailing slash or space.
  return pathText;
}

function tokenSuggestion(
  parentPath: string[],
  node: CommandNode,
  pinnedPrefix: string[],
): TokenSuggestion {
  const commandPath = [...parentPath, node.token];

  return {
    type: 'token',
    id: `cmd-${commandPath.join('-')}`,
    label: node.label,
    insertion: relativeInsertion(
      absoluteInsertionFor(commandPath, node),
      pinnedPrefix,
    ),
    commandPath,
    isTerminal: isTerminalNode(node),
    requiresValue: node.requiresValue,
    pinnable: isPinnableNode(node),
    description: node.description,
  };
}

function inputHintSuggestion(node: CommandNode): InputHintSuggestion {
  return {
    type: 'input-hint',
    id: `hint-${node.token}`,
    label: valuePromptFor(node),
    description: node.description,
  };
}

/**
 * Compose the absolute visible command from pin + editable suffix.
 */
export function composeAssistanceInput(
  commandSuffix: string,
  pinnedPrefix: string[],
): string {
  if (pinnedPrefix.length === 0) return commandSuffix;
  const prefix = formatCommandPath(pinnedPrefix);
  if (!commandSuffix) return prefix;
  if (commandSuffix.startsWith(' ') || commandSuffix.startsWith('/')) {
    return `${prefix}${commandSuffix}`;
  }
  return `${prefix}/${commandSuffix}`;
}

/**
 * Contextual autocomplete beneath SVYR >.
 * Resolves slash-separated paths from the pinned prefix + editable suffix.
 */
export function getCommandAssistance(
  commandSuffix: string,
  pinnedPrefix: string[] = [],
): CommandSuggestion[] {
  const assistInput = composeAssistanceInput(commandSuffix, pinnedPrefix);
  if (!assistInput.trim()) {
    return childNodes([]).map((child) =>
      tokenSuggestion([], child, pinnedPrefix),
    );
  }

  const firstSpaceIndex = assistInput.indexOf(' ');
  const hasValueSpace = firstSpaceIndex !== -1;
  const pathPortion = hasValueSpace
    ? assistInput.slice(0, firstSpaceIndex)
    : assistInput;
  const valuePortion = hasValueSpace
    ? assistInput.slice(firstSpaceIndex + 1)
    : '';

  const trailingSeparator = pathPortion.endsWith('/');
  const segments = pathPortion
    .split('/')
    .map((token) => token.trim())
    .filter(Boolean);

  // Free-text value region after a complete value-bearing path.
  if (hasValueSpace) {
    const walk = walkCommandPath(segments.map((s) => s.toLowerCase()));
    if (
      walk.consumed === segments.length &&
      walk.node?.requiresValue &&
      !valuePortion.trim()
    ) {
      return [inputHintSuggestion(walk.node)];
    }
    return [];
  }

  if (segments.length === 0) {
    return childNodes([]).map((child) =>
      tokenSuggestion([], child, pinnedPrefix),
    );
  }

  // Trailing `/` → empty partial after a complete path.
  if (trailingSeparator) {
    const walk = walkCommandPath(segments.map((s) => s.toLowerCase()));
    if (walk.consumed < segments.length) return [];
    if (walk.node?.requiresValue) {
      return [inputHintSuggestion(walk.node)];
    }
    if (walk.node && !isBranchNode(walk.node)) return [];
    return childNodes(walk.path).map((child) =>
      tokenSuggestion(walk.path, child, pinnedPrefix),
    );
  }

  const last = segments[segments.length - 1];
  const parentSegments = segments.slice(0, -1);
  const parentWalk = walkCommandPath(
    parentSegments.map((s) => s.toLowerCase()),
  );

  if (parentWalk.consumed < parentSegments.length) {
    return [];
  }

  if (parentWalk.node?.requiresValue) {
    return [];
  }

  const candidates = childNodes(parentWalk.path);
  const lowerLast = last.toLowerCase();
  const normalizedLast = normalizeCommandToken(lowerLast);
  const exact = candidates.find((child) => child.token === normalizedLast);

  // A complete legacy alias remains selectable as its canonical short token.
  // This migrates the visible input without ever advertising aliases.
  if (exact && lowerLast !== normalizedLast) {
    return [tokenSuggestion(parentWalk.path, exact, pinnedPrefix)];
  }

  // Exact complete segment → reveal its children (or value hint).
  if (exact) {
    const completedPath = [...parentWalk.path, exact.token];
    if (exact.requiresValue) {
      return [inputHintSuggestion(exact)];
    }
    if (isBranchNode(exact)) {
      return childNodes(completedPath).map((child) =>
        tokenSuggestion(completedPath, child, pinnedPrefix),
      );
    }
    // Exact terminal leaf — keep the match so tap-to-execute still works.
    return [tokenSuggestion(parentWalk.path, exact, pinnedPrefix)];
  }

  return candidates
    .filter((child) => child.token.startsWith(lowerLast))
    .map((child) => tokenSuggestion(parentWalk.path, child, pinnedPrefix));
}

/**
 * Selectable commands within a suggestion list, in registry order.
 * The Power User dock projects shared suggestions through this helper, so
 * presentation cannot add, hide, or reorder commands on its own.
 */
export function tokenSuggestions(
  suggestions: CommandSuggestion[],
): TokenSuggestion[] {
  return suggestions.filter(
    (suggestion): suggestion is TokenSuggestion => suggestion.type === 'token',
  );
}

/** Trailing keyword of each selectable command — used by contract checks. */
export function suggestionTokens(suggestions: CommandSuggestion[]): string[] {
  return tokenSuggestions(suggestions).map(
    (suggestion) => suggestion.commandPath[suggestion.commandPath.length - 1],
  );
}

/** Compose the absolute command string for a token suggestion. */
export function composeSuggestionCommand(suggestion: TokenSuggestion): string {
  return formatCommandPath(suggestion.commandPath);
}

/** Build the next editable insertion for a suggestion token. */
export function insertionForSuggestionToken(
  currentPathText: string,
  token: string,
  requiresValue?: boolean,
): string {
  const next = appendCommandSegment(currentPathText, token);
  return requiresValue ? `${next} ` : next;
}

/** TAB helper — apply the first token suggestion insertion when available. */
export function completeAssistance(
  commandSuffix: string,
  pinnedPrefix: string[] = [],
): string | null {
  const suggestions = getCommandAssistance(commandSuffix, pinnedPrefix);
  const token = suggestions.find((item) => item.type === 'token');
  return token && token.type === 'token' ? token.insertion : null;
}
