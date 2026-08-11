import type { InspectionRecord } from '@/types/workspace';

export function createEmptyInspectionRecord(): InspectionRecord {
  return { findings: {}, evidence: {} };
}
