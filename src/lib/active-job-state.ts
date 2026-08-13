import {
  applyStateTransition,
  resolveHydratedState,
  resolveStateUpdate,
  shouldPersistHydratedState,
  type StateUpdate,
} from '@/core/persisted-state';
import type { ActiveJob } from '@/types/workspace';

export type ActiveJobUpdate = StateUpdate<ActiveJob>;

/**
 * Resolve the next ActiveJob from a value or updater.
 * Pure helper — no React state. Used by the workspace hook and unit tests.
 */
export function resolveActiveJobUpdate(
  current: ActiveJob,
  update: ActiveJobUpdate,
): ActiveJob {
  return resolveStateUpdate(current, update);
}

/**
 * Apply one ActiveJob transition against an imperative current holder.
 * The holder is updated synchronously before the caller pushes React state,
 * so native/camera callbacks that read the ref see the new job immediately.
 */
export function applyActiveJobTransition(
  current: ActiveJob,
  update: ActiveJobUpdate,
  assignCurrent: (next: ActiveJob) => void,
): ActiveJob {
  return applyStateTransition(current, update, assignCurrent);
}

/** Whether AsyncStorage persistence may run for the live job. */
export function shouldPersistActiveJob(jobHydrated: boolean): boolean {
  return shouldPersistHydratedState(jobHydrated);
}

/**
 * Choose whether a restored job should replace the in-memory job.
 * Local mutations that happened before hydration completes win.
 */
export function resolveHydratedActiveJob(input: {
  restored: ActiveJob | null;
  mutatedBeforeHydration: boolean;
}): ActiveJob | null {
  return resolveHydratedState(input);
}
