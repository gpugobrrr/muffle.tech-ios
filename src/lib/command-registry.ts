import { LEVEL_2_COMMAND_NODES } from '@/lib/level-2-capture';
import type {
  InspectionElementConceptId,
  InspectionFindingField,
} from '@/lib/inspection-finding-elements';

export type Level2CaptureStatus =
  | 'interactive'
  | 'navigation-only'
  | 'pre-populated'
  | 'derived-publication'
  | 'blocked';

export type Level2CaptureCoverage = {
  requirement: string;
  status: Level2CaptureStatus;
  canonicalConceptId?: string;
  engineBinding?: string;
  blocker?: string;
  recommendedLaterWork: string;
};

export type InspectionFindingCaptureTarget = {
  findingId: string;
  elementConceptId: InspectionElementConceptId;
  field: InspectionFindingField;
};

export type CommandNode = {
  /** Keyword as typed in SVYR > (always lowercase). */
  token: string;
  /** Autocomplete label — may carry a `<value>` placeholder. */
  label: string;
  /**
   * Human-readable title for directory completion and similar surfaces.
   * Falls back to `label` when omitted. Never used by the parser.
   */
  learnerLabel?: string;
  description: string;
  children?: CommandNode[];
  /** Leaf that needs free text before it can execute. */
  requiresValue?: boolean;
  /**
   * Selection availability. Unavailable nodes remain visible in suggestions
   * but cannot be selected or executed.
   */
  available?: boolean;
  /** Guidance shown while the value is being typed (autocomplete hint). */
  valuePrompt?: string;
  /**
   * Label for the dedicated Power User data-entry panel.
   * Sourced from the registry — never hard-coded in the renderer.
   */
  entryLabel?: string;
  /** Placeholder inside the dedicated value input. */
  valuePlaceholder?: string;
  /** Canonical Muffle write operation applied when a value is submitted. */
  operationId?: string;
  /** Canonical Muffle read operation applied when the path is submitted alone. */
  readOperationId?: string;
  /**
   * A terminal workflow destination with no canonical write. It remains
   * navigable so coverage gaps are visible without pretending to be a field.
   */
  workflowOnly?: boolean;
  /** Grouped controlled capture surface for registered child fields. */
  compoundCapture?: boolean;
  /** Level 2 requirements traceability; never a canonical record binding. */
  coverage?: Level2CaptureCoverage;
  /** Existing finding-field context resolved by the controller at commit. */
  findingTarget?: InspectionFindingCaptureTarget;
  /**
   * Counts toward directory completion. Defaults to `requiresValue` when
   * omitted. Explicit `false` / `optional: true` excludes the field.
   */
  required?: boolean;
  /** Excluded from completion totals unless also marked required. */
  optional?: boolean;
  /**
   * Live job-record key used by the shared completion resolver.
   * Required leaves without a fieldId cannot be completed.
   */
  fieldId?: string;
};

/** Display title for a registry node (completion rows, guidance headers). */
export function learnerDisplayLabel(node: CommandNode): string {
  return node.learnerLabel ?? node.label;
}

/**
 * The single SVYR command graph. Parsing, autocomplete, atomic Backspace,
 * autocomplete, and stored-value resolution all derive from this hierarchy.
 * Availability is owned here alone: neither renderer may filter, truncate,
 * or extend what this graph offers for a given path.
 */
export const COMMAND_REGISTRY: CommandNode[] = [
  {
    token: 'prep',
    label: 'prep',
    learnerLabel: 'Preparation',
    description: 'Inspection preparation commands.',
    children: [
      {
        token: 'brief',
        label: 'brief',
        learnerLabel: 'Brief',
        description: 'Record the inspection instruction and requirements.',
        children: [
          {
            token: 'instr',
            label: 'instr',
            learnerLabel: 'Instruction',
            description: 'Instruction section of the brief.',
            children: [
              {
                token: 'party',
                label: 'party <name>',
                learnerLabel: 'Instructing party',
                description: 'Set the instructing party name.',
                requiresValue: true,
                valuePrompt: 'ENTER INSTRUCTING PARTY',
                entryLabel: 'INSTRUCTING PARTY',
                valuePlaceholder: 'Enter name',
                operationId: 'survey.brief.instruction.party.set',
                readOperationId: 'survey.brief.instruction.party.read',
                fieldId: 'instruction.instructingParty',
              },
              {
                token: 'client',
                label: 'client <name>',
                learnerLabel: 'Client',
                description: 'Client field — not yet implemented.',
                requiresValue: true,
                valuePrompt: 'ENTER CLIENT',
                entryLabel: 'CLIENT',
                valuePlaceholder: 'Enter name',
                fieldId: 'instruction.client',
              },
              {
                token: 'ref',
                label: 'ref <ref>',
                learnerLabel: 'Instruction reference',
                description: 'Instruction reference — not yet implemented.',
                requiresValue: true,
                valuePrompt: 'ENTER INSTRUCTION REFERENCE',
                entryLabel: 'INSTRUCTION REFERENCE',
                valuePlaceholder: 'Enter reference',
                fieldId: 'instruction.reference',
              },
              {
                token: 'source',
                label: 'source',
                learnerLabel: 'Source',
                description: 'Instruction source — not yet implemented.',
                requiresValue: true,
                valuePrompt: 'ENTER SOURCE',
                entryLabel: 'SOURCE',
                valuePlaceholder: 'Enter source',
                operationId: 'survey.brief.instruction.source.set',
                readOperationId: 'survey.brief.instruction.source.read',
                required: true,
                fieldId: 'instruction.source',
              },
            ],
          },
          {
            token: 'purp',
            label: 'purp',
            learnerLabel: 'Purpose',
            description: 'Purpose of the inspection brief.',
            requiresValue: true,
            valuePrompt: 'ENTER PURPOSE',
            entryLabel: 'PURPOSE',
            valuePlaceholder: 'Enter purpose',
            fieldId: 'purpose',
          },
          {
            token: 'deliv',
            label: 'deliv',
            learnerLabel: 'Deliverables',
            description: 'Deliverable for the inspection brief.',
            requiresValue: true,
            valuePrompt: 'ENTER DELIVERABLE',
            entryLabel: 'DELIVERABLE',
            valuePlaceholder: 'Enter deliverable',
            fieldId: 'deliverable',
          },
          {
            token: 'limit',
            label: 'limit',
            learnerLabel: 'Limitations',
            description: 'Limitation recorded in the brief.',
            requiresValue: true,
            valuePrompt: 'ENTER LIMITATION',
            entryLabel: 'LIMITATION',
            valuePlaceholder: 'Enter limitation',
            fieldId: 'limitation',
          },
        ],
      },
      {
        token: 'scope',
        label: 'scope',
        learnerLabel: 'Scope',
        description: 'Define the areas and elements included in the inspection.',
        available: false,
      },
      {
        token: 'access',
        label: 'access',
        learnerLabel: 'Access',
        description: 'Review access arrangements and site contacts.',
        available: false,
      },
      {
        token: 'equipment',
        label: 'equipment',
        learnerLabel: 'Equipment',
        description: 'Review the required inspection equipment.',
        available: false,
      },
      {
        token: 'plan',
        label: 'plan',
        learnerLabel: 'Plan',
        description: 'Define the intended inspection sequence.',
        available: false,
      },
      {
        token: 'ready',
        label: 'ready',
        learnerLabel: 'Ready',
        description: 'Check whether inspection preparation is complete.',
        available: false,
      },
    ],
  },
  ...LEVEL_2_COMMAND_NODES,
];

/**
 * Temporary migration aliases accepted as input only. Suggestions and stored
 * paths always use the canonical short tokens from COMMAND_REGISTRY.
 */
export const COMMAND_ALIASES: Readonly<Record<string, string>> = {
  instruction: 'instr',
  instructions: 'instr',
  purpose: 'purp',
  deliverable: 'deliv',
  limitation: 'limit',
  limitations: 'limit',
  reference: 'ref',
};

export function normalizeCommandToken(rawToken: string): string {
  const token = rawToken.trim().toLowerCase();
  return COMMAND_ALIASES[token] ?? token;
}

export function isBranchNode(node: CommandNode): boolean {
  return (node.children?.length ?? 0) > 0;
}

/** Final executable step in its chain. */
export function isTerminalNode(node: CommandNode): boolean {
  return !isBranchNode(node);
}

export function findCommandNode(path: string[]): CommandNode | null {
  let level = COMMAND_REGISTRY;
  let found: CommandNode | null = null;

  for (const rawToken of path) {
    const token = normalizeCommandToken(rawToken);
    const next = level.find((node) => node.token === token);
    if (!next) return null;
    found = next;
    level = next.children ?? [];
  }

  return found;
}

/** Valid next keywords after `path`; registry roots for an empty path. */
export function childNodes(path: string[]): CommandNode[] {
  if (path.length === 0) return COMMAND_REGISTRY;
  const node = findCommandNode(path);
  if (!node || node.requiresValue) return [];
  return node.children ?? [];
}

export type CommandWalk = {
  /** Recognised keywords, lowercased. */
  path: string[];
  /** Node at the end of `path`; null at the registry root. */
  node: CommandNode | null;
  /** Number of input tokens recognised as keywords. */
  consumed: number;
  /** True when `path` ends on a value-bearing leaf. */
  expectsValue: boolean;
};

/** Match tokens against the graph, stopping at the first non-keyword. */
export function walkCommandPath(tokens: string[]): CommandWalk {
  const path: string[] = [];
  let node: CommandNode | null = null;
  let consumed = 0;

  for (const rawToken of tokens) {
    if (node?.requiresValue) break;

    const token = normalizeCommandToken(rawToken);
    const next = childNodes(path).find((child) => child.token === token);
    if (!next) break;

    path.push(next.token);
    node = next;
    consumed += 1;
  }

  return {
    path,
    node,
    consumed,
    expectsValue: Boolean(node?.requiresValue),
  };
}

/** Visible / composable structural path: `prep/brief/instr`. */
export const PATH_SEPARATOR = '/';

/**
 * Presentation-only separator (U+2215 DIVISION SLASH) — taller and steeper
 * than ASCII `/`, so nested paths read as directories on screen.
 * Never parsed, typed, stored, or sent to the engine.
 */
export const DISPLAY_SEPARATOR = '\u2215';

export function formatCommandPath(path: string[]): string {
  return path.map((token) => token.trim()).filter(Boolean).join(PATH_SEPARATOR);
}

/** Read-only rendering of a structural path — no spaces around separators. */
export function formatSvyrPathForDisplay(path: string): string {
  return path.split(PATH_SEPARATOR).join(DISPLAY_SEPARATOR);
}

/**
 * Read-only rendering of a full command. Only the structural portion before
 * the first space is converted, so slashes inside free text stay literal.
 */
export function formatSvyrCommandForDisplay(raw: string): string {
  const firstSpaceIndex = raw.indexOf(' ');
  if (firstSpaceIndex === -1) {
    return formatSvyrPathForDisplay(raw);
  }
  return `${formatSvyrPathForDisplay(raw.slice(0, firstSpaceIndex))}${raw.slice(
    firstSpaceIndex,
  )}`;
}

/**
 * Append a structural segment with `/` and no surrounding spaces.
 * Does not add a trailing separator.
 */
export function appendCommandSegment(
  currentPath: string,
  nextToken: string,
): string {
  const normalizedPath = currentPath.replace(/\/+$/, '');
  const token = nextToken.trim();
  if (!token) return normalizedPath;
  return normalizedPath ? `${normalizedPath}/${token}` : token;
}

export type ParsedSvyrInput = {
  /** Lowercased structural keywords. */
  path: string[];
  /** Free-text after the first space — original casing preserved. */
  value: string;
  /** Path text before the first space (may end with `/`). */
  rawPath: string;
  /** True when the structural portion ended with `/`. */
  trailingSeparator: boolean;
};

/**
 * Split a SVYR command into slash-separated path tokens and an optional value.
 * Does not split the free-text value on whitespace.
 */
export function parseSvyrInput(rawInput: string): ParsedSvyrInput {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      path: [],
      value: '',
      rawPath: '',
      trailingSeparator: false,
    };
  }

  const firstSpaceIndex = trimmed.indexOf(' ');
  const rawPath =
    firstSpaceIndex === -1 ? trimmed : trimmed.slice(0, firstSpaceIndex);
  const value =
    firstSpaceIndex === -1 ? '' : trimmed.slice(firstSpaceIndex + 1);

  const trailingSeparator = rawPath.endsWith(PATH_SEPARATOR);
  const path = rawPath
    .split(PATH_SEPARATOR)
    .map(normalizeCommandToken)
    .filter(Boolean);

  return {
    path,
    value,
    rawPath,
    trailingSeparator,
  };
}

/** Structural path segments from a slash-separated string (preserves casing). */
export function commandTokens(raw: string): string[] {
  const firstSpaceIndex = raw.indexOf(' ');
  const rawPath =
    firstSpaceIndex === -1 ? raw.trim() : raw.slice(0, firstSpaceIndex).trim();

  return rawPath
    .split(PATH_SEPARATOR)
    .map((token) => token.trim())
    .filter(Boolean);
}
