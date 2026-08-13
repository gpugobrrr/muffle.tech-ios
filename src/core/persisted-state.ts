/**
 * Domain-neutral persisted-state mechanics.
 *
 * Hydration, mutation protection, and JSON store plumbing. The caller supplies
 * the serializable document and any schema validation.
 */

export type StateUpdate<T> = T | ((current: T) => T);

export function resolveStateUpdate<T>(current: T, update: StateUpdate<T>): T {
  return typeof update === 'function' ? (update as (current: T) => T)(current) : update;
}

/**
 * Apply one transition against an imperative current holder before React state
 * is pushed, so later callbacks that read the holder see the new value.
 */
export function applyStateTransition<T>(
  current: T,
  update: StateUpdate<T>,
  assignCurrent: (next: T) => void,
): T {
  const next = resolveStateUpdate(current, update);
  assignCurrent(next);
  return next;
}

/** Persistence must not run until hydration has finished. */
export function shouldPersistHydratedState(hydrated: boolean): boolean {
  return hydrated;
}

/**
 * Restored state replaces in-memory state only when nothing mutated first.
 * Local mutations that happened before hydration completes win.
 */
export function resolveHydratedState<T>(input: {
  restored: T | null;
  mutatedBeforeHydration: boolean;
}): T | null {
  if (!input.restored || input.mutatedBeforeHydration) {
    return null;
  }
  return input.restored;
}

export type JsonStateStore<T> = {
  serialize(state: T): string;
  deserialize(raw: string): T | null;
};

export function createJsonStateStore<T>(
  validate: (parsed: unknown) => T | null,
): JsonStateStore<T> {
  return {
    serialize(state: T): string {
      return JSON.stringify(state);
    },
    deserialize(raw: string): T | null {
      try {
        return validate(JSON.parse(raw));
      } catch {
        return null;
      }
    },
  };
}
