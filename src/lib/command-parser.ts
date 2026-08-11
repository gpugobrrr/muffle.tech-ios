import {
    appendCommandSegment,
    childNodes,
    findCommandNode,
    formatCommandPath,
    isBranchNode,
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
  /** Navigable Level 2 coverage destination with no canonical write. */
  workflowOnly?: boolean;
  /** Opens grouped controlled capture for registered child fields. */
  compoundCapture?: boolean;
  /** Visible but cannot be selected when the registry marks it unavailable. */
  available: boolean;
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
    const prompt =
      fieldDefinition?.valueType === 'number'
        ? 'Enter a valid number'
        : fieldDefinition?.valuePrompt ??
          (node ? valuePromptFor(node) : INCOMPLETE_BRANCH_PROMPT);
    return {
      type: 'incomplete',
      path,
      prompt,
    };
  }

  const operationId = node?.operationId ?? fieldDefinition?.operationId;
  if (operationId) {
    const operationArguments =
      fieldDefinition?.valueType === 'controlledStatus'
        ? {
            fieldId: fieldDefinition.fieldId,
            value: normalizedValue,
          }
        : { value: normalizedValue };

    return {
      type: 'operation',
      path,
      operation: {
        operationId,
        arguments: operationArguments,
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
    const operationArguments =
      fieldDefinition?.valueType === 'controlledStatus'
        ? { fieldId: fieldDefinition.fieldId }
        : fieldDefinition?.valueType === 'multiSelect'
          ? { fieldId: fieldDefinition.fieldId }
          : {};

    return {
      type: 'operation',
      path,
      operation: {
        operationId,
        arguments: operationArguments,
      },
    };
  }
  return {
    type: 'incomplete',
    path,
    prompt: node ? valuePromptFor(node) : INCOMPLETE_BRANCH_PROMPT,
  };
}

/**
 * Parse a full SVYR command.
 * Structural segments are slash-separated; free text follows one space.
 */
export function parseCommand(rawCommand: string): ParsedCommand {
  const trimmed = rawCommand.trim();
  if (!trimmed) return { type: 'unknown' };

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

  if (walk.node.workflowOnly || walk.node.available === false) {
    return { type: 'placeholder', path: walk.path };
  }

  return writeCommand(walk.path, '');
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
): TokenSuggestion {
  const commandPath = [...parentPath, node.token];

  return {
    type: 'token',
    id: `cmd-${commandPath.join('-')}`,
    label: node.label,
    insertion: absoluteInsertionFor(commandPath, node),
    commandPath,
    isTerminal: isTerminalNode(node),
    requiresValue: node.requiresValue,
    workflowOnly: node.workflowOnly,
    compoundCapture: node.compoundCapture,
    available: node.available !== false,
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
 * Contextual autocomplete beneath SVYR >.
 * Resolves slash-separated paths from the editable command suffix.
 */
export function getCommandAssistance(
  commandSuffix: string,
): CommandSuggestion[] {
  const assistInput = commandSuffix;
  if (!assistInput.trim()) {
    return childNodes([]).map((child) => tokenSuggestion([], child));
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
    return childNodes([]).map((child) => tokenSuggestion([], child));
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
      tokenSuggestion(walk.path, child),
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
    return [tokenSuggestion(parentWalk.path, exact)];
  }

  // Exact complete segment → reveal its children (or value hint).
  if (exact) {
    const completedPath = [...parentWalk.path, exact.token];
    if (exact.requiresValue) {
      return [inputHintSuggestion(exact)];
    }
    if (isBranchNode(exact)) {
      return childNodes(completedPath).map((child) =>
        tokenSuggestion(completedPath, child),
      );
    }
    if (exact.workflowOnly) return [];
    // Exact terminal leaf — keep the match so tap-to-execute still works.
    return [tokenSuggestion(parentWalk.path, exact)];
  }

  return candidates
    .filter((child) => child.token.startsWith(lowerLast))
    .map((child) => tokenSuggestion(parentWalk.path, child));
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
export function completeAssistance(commandSuffix: string): string | null {
  const suggestions = getCommandAssistance(commandSuffix);
  const token = suggestions.find((item) => item.type === 'token');
  return token && token.type === 'token' ? token.insertion : null;
}
