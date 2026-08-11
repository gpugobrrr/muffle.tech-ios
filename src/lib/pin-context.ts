import {
  formatCommandPath,
  findCommandNode,
} from '@/lib/command-registry';

export function pathKey(path: string[]): string {
  return path.map((t) => t.toLowerCase()).join('/');
}

/**
 * Editable suffix that keeps `path` visible in the continuous command line.
 *
 * Branches restore without a trailing separator. Value-bearing field paths
 * keep a trailing space so the info bar stays resolved.
 */
export function suffixForPath(path: string[]): string {
  if (path.length === 0) return '';

  const node = findCommandNode(path);
  const formatted = formatCommandPath(path);
  return node?.requiresValue ? `${formatted} ` : formatted;
}
