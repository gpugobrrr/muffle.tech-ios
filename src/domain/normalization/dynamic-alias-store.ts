import type { CanonicalDefectId } from '@/domain/ontology/canonical-defects';
import {
  buildAliasTrie,
  normalizePhrase,
  type AliasEntry,
} from '@/domain/normalization/deterministic-matcher';

type FirmAliasRecord = {
  phrase: string;
  canonicalId: Exclude<CanonicalDefectId, 'unclassified'>;
  learnedAt: number;
};

const EMPTY_ALIASES: readonly AliasEntry[] = [];
const firmAliases = new Map<string, Map<string, FirmAliasRecord>>();
const firmTries = new Map<
  string,
  ReturnType<typeof buildAliasTrie>
>();
const firmSnapshots = new Map<string, readonly AliasEntry[]>();
const listeners = new Set<() => void>();

function emitDynamicAliasStore(): void {
  for (const listener of listeners) {
    listener();
  }
}

function rebuildFirmTrie(firmId: string): void {
  const records = firmAliases.get(firmId);
  if (!records || records.size === 0) {
    firmTries.delete(firmId);
    firmSnapshots.set(firmId, EMPTY_ALIASES);
    emitDynamicAliasStore();
    return;
  }
  const entries: AliasEntry[] = [...records.values()].map((record) => ({
    phrase: record.phrase,
    canonicalId: record.canonicalId,
  }));
  firmTries.set(firmId, buildAliasTrie(entries));
  firmSnapshots.set(firmId, entries);
  emitDynamicAliasStore();
}

/**
 * Promote a confirmed novel phrase into the per-firm Tier 1 deterministic index.
 */
export function learnAlias(
  firmId: string,
  novelPhrase: string,
  canonicalId: CanonicalDefectId,
): void {
  if (!firmId.trim()) {
    throw new Error('firmId is required to learn an alias');
  }
  if (canonicalId === 'unclassified') {
    throw new Error('Cannot promote an unclassified phrase into the deterministic index');
  }

  const phrase = normalizePhrase(novelPhrase);
  if (!phrase) {
    throw new Error('novelPhrase is required to learn an alias');
  }

  let records = firmAliases.get(firmId);
  if (!records) {
    records = new Map();
    firmAliases.set(firmId, records);
  }

  records.set(phrase, {
    phrase,
    canonicalId,
    learnedAt: Date.now(),
  });
  rebuildFirmTrie(firmId);
}

export function getLearnedAliases(firmId: string): readonly AliasEntry[] {
  return firmSnapshots.get(firmId) ?? EMPTY_ALIASES;
}

export function subscribeDynamicAliasStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getFirmAliasTrie(
  firmId: string,
): ReturnType<typeof buildAliasTrie> | undefined {
  return firmTries.get(firmId);
}

export function resetDynamicAliasStore(): void {
  firmAliases.clear();
  firmTries.clear();
  firmSnapshots.clear();
  emitDynamicAliasStore();
}
