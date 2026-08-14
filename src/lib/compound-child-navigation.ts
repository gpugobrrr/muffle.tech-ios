import {
  readEntryDraft,
  readMultiChoiceEntryDraft,
  stashEntryDraft,
  stashMultiChoiceEntryDraft,
  type SvyrEntryDraftsByPath,
} from '@/lib/svyr-entry-drafts';

export type CompoundChildNavigation = {
  isChildActive: boolean;
  fieldKey: string | null;
  value: string;
  onChangeText: (value: string) => void;
  navigateBackFromChild: () => boolean;
};

/** Restore a compound child text/number field from drafts, then canonical value. */
export function resolveCompoundChildTextDraft(
  drafts: SvyrEntryDraftsByPath,
  path: string[],
  canonicalValue: string | null,
): string {
  return readEntryDraft(drafts, path) ?? canonicalValue ?? '';
}

/** Restore a compound child multi-select from drafts, then canonical set. */
export function resolveCompoundChildMultiDraft(
  drafts: SvyrEntryDraftsByPath,
  path: string[],
  canonicalValues: readonly string[],
): readonly string[] {
  const draft = readMultiChoiceEntryDraft(drafts, path);
  return draft ? [...draft] : [...canonicalValues];
}

export function stashCompoundChildTextDraft(
  drafts: SvyrEntryDraftsByPath,
  path: string[],
  draft: string,
): SvyrEntryDraftsByPath {
  return stashEntryDraft(drafts, path, draft);
}

export function stashCompoundChildMultiDraft(
  drafts: SvyrEntryDraftsByPath,
  path: string[],
  values: readonly string[],
): SvyrEntryDraftsByPath {
  return stashMultiChoiceEntryDraft(drafts, path, values);
}
