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

export function serializeActiveJob(job: ActiveJob): string {
  return JSON.stringify(job);
}

export function deserializeActiveJob(raw: string): ActiveJob | null {
  try {
    const parsed = JSON.parse(raw) as ActiveJob;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.id !== 'string' || !parsed.id.trim()) return null;
    if (!parsed.inspection || typeof parsed.inspection !== 'object') return null;
    if (!parsed.inspection.findings || typeof parsed.inspection.findings !== 'object') {
      return null;
    }
    if (
      parsed.inspection.evidence &&
      typeof parsed.inspection.evidence !== 'object'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function activeJobContainsEmbeddedImageData(job: ActiveJob): boolean {
  const serialized = serializeActiveJob(job);
  return /data:image\//.test(serialized) || serialized.includes('"base64"');
}
