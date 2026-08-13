import { createJsonStateStore } from '@/core/persisted-state';
import type { ActiveJob } from '@/types/workspace';
import { createEmptyInspectionRecord } from '@/lib/inspection-record';

export const ACTIVE_JOB_STORAGE_KEY = 'muffle:active-job';

const DEFAULT_JOB_ID = 'job.demo.18-market-street';

export function createInitialActiveJob(): ActiveJob {
  return {
    id: DEFAULT_JOB_ID,
    property: {
      displayAddress: '18 Market Street',
      instructionType: 'Level 2 Building Survey',
    },
    inspection: createEmptyInspectionRecord(),
  };
}

function asActiveJob(parsed: unknown): ActiveJob | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const candidate = parsed as ActiveJob;
  if (typeof candidate.id !== 'string' || !candidate.id.trim()) return null;
  if (!candidate.inspection || typeof candidate.inspection !== 'object') return null;
  if (!candidate.inspection.findings || typeof candidate.inspection.findings !== 'object') {
    return null;
  }
  if (
    candidate.inspection.evidence &&
    typeof candidate.inspection.evidence !== 'object'
  ) {
    return null;
  }
  return candidate;
}

const activeJobStore = createJsonStateStore(asActiveJob);

export function serializeActiveJob(job: ActiveJob): string {
  return activeJobStore.serialize(job);
}

export function deserializeActiveJob(raw: string): ActiveJob | null {
  return activeJobStore.deserialize(raw);
}

export function activeJobContainsEmbeddedImageData(job: ActiveJob): boolean {
  const serialized = serializeActiveJob(job);
  return /data:image\//.test(serialized) || serialized.includes('"base64"');
}
