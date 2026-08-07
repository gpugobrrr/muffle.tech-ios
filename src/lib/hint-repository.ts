import AsyncStorage from '@react-native-async-storage/async-storage';

export type SvyrHintId =
  | 'selectBranch'
  | 'swipeBack'
  | 'executeValue'
  | 'openNotes'
  | 'pinPath';

/**
 * `true` means the hint has been completed or dismissed and must not reappear
 * until the user resets interaction hints.
 */
export type SvyrHintState = Record<SvyrHintId, boolean>;

export const SVYR_HINT_IDS: readonly SvyrHintId[] = [
  'selectBranch',
  'executeValue',
  'swipeBack',
  'openNotes',
  'pinPath',
] as const;

/** Display priority — only the first eligible incomplete hint is shown. */
export const SVYR_HINT_PRIORITY: readonly SvyrHintId[] = [
  'selectBranch',
  'executeValue',
  'swipeBack',
  'openNotes',
  'pinPath',
] as const;

export const SVYR_HINT_COPY: Record<SvyrHintId, string> = {
  selectBranch: 'Tap a command to continue',
  executeValue: 'Type a value, then press Return',
  swipeBack: 'Swipe right to go up one level',
  openNotes: 'Add note',
  pinPath: 'Pin this path for repeated entry',
};

const STORAGE_KEY = 'muffle.svyr.interactionHints.v1';

export function createEmptyHintState(): SvyrHintState {
  return {
    selectBranch: false,
    swipeBack: false,
    executeValue: false,
    openNotes: false,
    pinPath: false,
  };
}

function normalizeHintState(raw: unknown): SvyrHintState {
  const empty = createEmptyHintState();
  if (!raw || typeof raw !== 'object') return empty;
  const source = raw as Record<string, unknown>;
  for (const id of SVYR_HINT_IDS) {
    empty[id] = Boolean(source[id]);
  }
  return empty;
}

/**
 * Tiny local repository for interaction-hint completion.
 * Device preference only — never written into the job record.
 */
export const hintRepository = {
  async load(): Promise<SvyrHintState> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return createEmptyHintState();
      return normalizeHintState(JSON.parse(raw));
    } catch {
      return createEmptyHintState();
    }
  },

  async save(state: SvyrHintState): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Preference write failures must never interrupt surveying.
    }
  },

  async reset(): Promise<SvyrHintState> {
    const empty = createEmptyHintState();
    await this.save(empty);
    return empty;
  },
};
