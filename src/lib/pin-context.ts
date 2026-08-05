import {
  COMMAND_REGISTRY,
  formatCommandPath,
  findCommandNode,
  isPinnableNode,
  parseSvyrInput,
} from '@/lib/command-registry';

/** Dock pin control visual/interaction state */
export type PinState = 'inactive' | 'armed' | 'active';

export function pinUiState(
  isPinArmed: boolean,
  pinnedCommandPrefix: string[],
): PinState {
  if (isPinArmed) return 'armed';
  if (pinnedCommandPrefix.length > 0) return 'active';
  return 'inactive';
}

export function pathKey(path: string[]): string {
  return path.map((t) => t.toLowerCase()).join('/');
}

/** Branch paths inside the visible hierarchy may be pinned. */
export function isPinnablePath(path: string[]): boolean {
  const node = findCommandNode(path);
  return Boolean(node && isPinnableNode(node));
}

/** Value-bearing paths must never become a pinned prefix. */
export function isValueCommandPath(path: string[]): boolean {
  const node = findCommandNode(path);
  return Boolean(node?.requiresValue);
}

/**
 * Whether the suffix already begins with a root keyword or a global verb,
 * so the pinned prefix must not be prepended.
 */
export function isGlobalCommand(rawSuffix: string): boolean {
  const trimmed = rawSuffix.trim();
  if (!trimmed) return false;

  const lower = trimmed.toLowerCase();
  if (lower === 'unpin' || lower === 'pin' || lower.startsWith('lookup')) {
    return true;
  }

  const { path } = parseSvyrInput(trimmed);
  const first = path[0];
  if (!first) return false;

  return COMMAND_REGISTRY.some((node) => node.token === first);
}

/**
 * Build the full command string for parsing.
 * Global suffixes replace (do not prepend) the pinned prefix.
 */
export function composeFullCommand(
  pinnedCommandPrefix: string[],
  commandSuffix: string,
): string {
  const trimmed = commandSuffix.trim();
  if (!trimmed) {
    return formatCommandPath(pinnedCommandPrefix);
  }
  if (isGlobalCommand(trimmed)) {
    return trimmed;
  }
  if (pinnedCommandPrefix.length === 0) {
    return trimmed;
  }

  const prefix = formatCommandPath(pinnedCommandPrefix);
  if (trimmed.startsWith('/') || trimmed.startsWith(' ')) {
    return `${prefix}${trimmed}`;
  }
  return `${prefix}/${trimmed}`;
}

/** Strip a leading pinned prefix from an assistance replacement. */
export function suffixFromReplacement(
  replacement: string,
  pinnedCommandPrefix: string[],
): string {
  if (pinnedCommandPrefix.length === 0) return replacement;

  const prefix = formatCommandPath(pinnedCommandPrefix);
  const lowerReplacement = replacement.toLowerCase();
  const lowerPrefix = prefix.toLowerCase();

  if (lowerReplacement === lowerPrefix) {
    return '';
  }

  if (lowerReplacement.startsWith(`${lowerPrefix}/`)) {
    return replacement.slice(prefix.length + 1);
  }

  if (lowerReplacement.startsWith(`${lowerPrefix} `)) {
    return replacement.slice(prefix.length);
  }

  return replacement;
}

/**
 * Editable suffix that keeps `path` visible in the continuous command line,
 * honouring whatever is already protected by the pinned prefix.
 *
 * Branches restore without a trailing separator. Value-bearing field paths
 * keep a trailing space so the info bar stays resolved.
 */
export function suffixForPath(
  path: string[],
  pinnedCommandPrefix: string[],
): string {
  const isPinned =
    pinnedCommandPrefix.length > 0 &&
    pinnedCommandPrefix.length <= path.length &&
    pathKey(pinnedCommandPrefix) ===
      pathKey(path.slice(0, pinnedCommandPrefix.length));

  const visible = isPinned ? path.slice(pinnedCommandPrefix.length) : path;
  if (visible.length === 0) return '';

  const node = findCommandNode(path);
  const formatted = formatCommandPath(visible);
  return node?.requiresValue ? `${formatted} ` : formatted;
}

export function pinCommandForPath(path: string[]): string {
  return `${formatCommandPath(path)} pin`;
}
