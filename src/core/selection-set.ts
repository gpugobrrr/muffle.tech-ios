/** Domain-neutral membership helpers for multi-select working sets. */

export function toggleSelectionValue(
  selected: readonly string[],
  canonicalValue: string,
): string[] {
  if (selected.includes(canonicalValue)) {
    return selected.filter((value) => value !== canonicalValue);
  }
  return [...selected, canonicalValue];
}

/**
 * Project a selection into an authoritative option order.
 * Caller-supplied order wins; insertion/tap order is ignored.
 */
export function orderSelectionValues(
  canonicalOrder: readonly string[],
  selected: readonly string[],
): string[] {
  const selectedSet = new Set(selected);
  return canonicalOrder.filter((value) => selectedSet.has(value));
}
