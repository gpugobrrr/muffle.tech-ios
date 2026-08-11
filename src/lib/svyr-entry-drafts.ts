import { pathKey } from '@/lib/pin-context';

/** Transient text draft for one value-bearing path. */
export type SvyrTextEntryDraft = {
  kind: 'text';
  text: string;
};

/** Transient multi-choice working set for one value-bearing path. */
export type SvyrMultiChoiceEntryDraft = {
  kind: 'multiSelect';
  values: readonly string[];
};

export type SvyrEntryDraft = SvyrTextEntryDraft | SvyrMultiChoiceEntryDraft;

/** Path-keyed uncommitted drafts — never canonical Engine state. */
export type SvyrEntryDraftsByPath = Record<string, SvyrEntryDraft>;

export function entryDraftPathKey(path: string[]): string {
  return pathKey(path);
}

/** Store or clear a transient text draft. Empty clears the key. */
export function stashEntryDraft(
  drafts: SvyrEntryDraftsByPath,
  path: string[],
  draft: string,
): SvyrEntryDraftsByPath {
  const key = entryDraftPathKey(path);
  if (!draft) {
    if (!(key in drafts)) return drafts;
    const next = { ...drafts };
    delete next[key];
    return next;
  }
  const existing = drafts[key];
  if (existing?.kind === 'text' && existing.text === draft) return drafts;
  return { ...drafts, [key]: { kind: 'text', text: draft } };
}

export function readEntryDraft(
  drafts: SvyrEntryDraftsByPath,
  path: string[],
): string | undefined {
  const draft = drafts[entryDraftPathKey(path)];
  return draft?.kind === 'text' ? draft.text : undefined;
}

export function clearEntryDraft(
  drafts: SvyrEntryDraftsByPath,
  path: string[],
): SvyrEntryDraftsByPath {
  const key = entryDraftPathKey(path);
  if (!(key in drafts)) return drafts;
  const next = { ...drafts };
  delete next[key];
  return next;
}

/** Store or clear a transient multi-choice draft (schema-ordered values). */
export function stashMultiChoiceEntryDraft(
  drafts: SvyrEntryDraftsByPath,
  path: string[],
  values: readonly string[],
): SvyrEntryDraftsByPath {
  const key = entryDraftPathKey(path);
  const existing = drafts[key];
  if (
    existing?.kind === 'multiSelect' &&
    existing.values.length === values.length &&
    existing.values.every((value, index) => value === values[index])
  ) {
    return drafts;
  }
  return {
    ...drafts,
    [key]: { kind: 'multiSelect', values: [...values] },
  };
}

export function readMultiChoiceEntryDraft(
  drafts: SvyrEntryDraftsByPath,
  path: string[],
): readonly string[] | undefined {
  const draft = drafts[entryDraftPathKey(path)];
  return draft?.kind === 'multiSelect' ? draft.values : undefined;
}

/**
 * Rebuild the editable suffix for text data-entry re-entry.
 * Restores a stashed text draft when present; otherwise uses the suggestion insertion.
 */
export function suffixForDataEntryReentry(options: {
  path: string[];
  pinnedPrefix: string[];
  draft: string | undefined;
  defaultInsertion: string;
  suffixForPath: (path: string[], pinnedPrefix: string[]) => string;
}): string {
  const { path, pinnedPrefix, draft, defaultInsertion, suffixForPath } = options;
  if (!draft) return defaultInsertion;
  const base = suffixForPath(path, pinnedPrefix).replace(/\s+$/, '');
  return `${base} ${draft}`;
}
