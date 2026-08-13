import { createJsonStateStore } from '@/core/persisted-state';
import type { ActiveJob, InspectionBrief } from '@/types/workspace';
import { createEmptyInspectionRecord } from '@/lib/inspection-record';

export const ACTIVE_JOB_STORAGE_KEY = 'muffle:active-job';

const DEFAULT_JOB_ID = 'job.demo.18-market-street';

export function createEmptyInspectionBrief(): InspectionBrief {
  return {
    instruction: {
      instructingParty: null,
      client: null,
      reference: null,
      source: null,
    },
    purpose: null,
    deliverable: null,
    limitation: null,
  };
}

export function createInitialActiveJob(): ActiveJob {
  return {
    id: DEFAULT_JOB_ID,
    property: {
      displayAddress: '18 Market Street',
      instructionType: 'Level 2 Building Survey',
    },
    inspection: createEmptyInspectionRecord(),
    brief: createEmptyInspectionBrief(),
  };
}

export function readActiveJobBrief(job: ActiveJob): InspectionBrief {
  return job.brief ?? createEmptyInspectionBrief();
}

export function withInspectionBrief(
  job: ActiveJob,
  brief: InspectionBrief,
): ActiveJob {
  return { ...job, brief };
}

function asInspectionBrief(value: unknown): InspectionBrief | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as InspectionBrief;
  if (!candidate.instruction || typeof candidate.instruction !== 'object') {
    return undefined;
  }
  return candidate;
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
  const brief = asInspectionBrief(candidate.brief);
  if (brief) return { ...candidate, brief };
  if (candidate.brief !== undefined) {
    const { brief: _dropped, ...rest } = candidate;
    return rest;
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
