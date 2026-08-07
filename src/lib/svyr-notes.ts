import { formatCommandPath } from '@/lib/command-registry';

/** Internal ASCII path key — never the display division slash. */
export const PARTY_NOTES_PATH = 'prep/brief/instr/party';

export const PARTY_NOTES_PATH_SEGMENTS = [
  'prep',
  'brief',
  'instr',
  'party',
] as const;

/** Path-keyed freeform notes — separate from formal job-record values. */
export type SvyrNotesByPath = Record<string, string>;

export function isPartyNotesPath(path: string[]): boolean {
  if (path.length !== PARTY_NOTES_PATH_SEGMENTS.length) return false;
  return PARTY_NOTES_PATH_SEGMENTS.every(
    (token, index) => path[index]?.toLowerCase() === token,
  );
}

export function notesPathKey(path: string[]): string {
  return formatCommandPath(path.map((token) => token.toLowerCase()));
}

export function hasSavedNote(note: string | undefined | null): boolean {
  return Boolean(note?.trim());
}
