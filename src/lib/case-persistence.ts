import { createEmptyInspectionRecord } from '@/lib/inspection-record';
import type { SvyrNotesByPath } from '@/lib/svyr-notes';
import type {
  ActiveJob,
  ActiveProperty,
  InspectionBrief,
  InspectionEvidenceReference,
  InspectionFinding,
  StructuredAddress,
} from '@/types/workspace';

/** Current serialized case envelope version. */
export const CASE_PERSISTENCE_SCHEMA_VERSION = 1 as const;

export type CasePersistenceSchemaVersion =
  typeof CASE_PERSISTENCE_SCHEMA_VERSION;

/**
 * Workspace case payload persisted as one unit. Matches the live workspace
 * split between `activeJob` and `inspectionBrief` without reshaping either.
 */
export type InspectionCase = {
  job: ActiveJob;
  brief: InspectionBrief;
  notesByPath: SvyrNotesByPath;
  /** Unknown top-level envelope keys preserved across load/save. */
  envelopeExtensions?: Readonly<Record<string, unknown>>;
};

/** Versioned on-disk / adapter payload for one inspection case. */
export type SerializedCaseEnvelopeV1 = {
  schemaVersion: CasePersistenceSchemaVersion;
  job: ActiveJob;
  brief: InspectionBrief;
  notesByPath: SvyrNotesByPath;
};

/** Platform-neutral persistence boundary for serialized case envelopes. */
export type CaseStorageAdapter = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
};

export const DEFAULT_CASE_STORAGE_KEY = 'muffle.case';

const KNOWN_ENVELOPE_KEYS = new Set([
  'schemaVersion',
  'job',
  'brief',
  'notesByPath',
]);

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'string' ? value : null;
}

function normalizeInstruction(
  raw: unknown,
): InspectionBrief['instruction'] | null {
  if (!isRecord(raw)) return null;
  return {
    instructingParty: nullableString(raw.instructingParty),
    client: nullableString(raw.client),
    reference: nullableString(raw.reference),
    source: nullableString(raw.source),
  };
}

function normalizeStructuredAddress(raw: unknown): StructuredAddress | undefined {
  if (!isRecord(raw)) return undefined;
  if (typeof raw.formattedAddress !== 'string') return undefined;
  const address: StructuredAddress = { formattedAddress: raw.formattedAddress };
  for (const key of [
    'placeId',
    'line1',
    'line2',
    'line3',
    'line4',
    'streetNumber',
    'buildingName',
    'subBuildingName',
    'subBuildingNumber',
    'route',
    'locality',
    'townOrCity',
    'administrativeArea',
    'district',
    'postalCode',
    'country',
    'countryCode',
  ] as const) {
    const value = raw[key];
    if (typeof value === 'string') {
      address[key] = value;
    }
  }
  if (typeof raw.latitude === 'number' && Number.isFinite(raw.latitude)) {
    address.latitude = raw.latitude;
  }
  if (typeof raw.longitude === 'number' && Number.isFinite(raw.longitude)) {
    address.longitude = raw.longitude;
  }
  return address;
}

function normalizeProperty(raw: unknown): ActiveProperty | null | undefined {
  if (raw === null) return null;
  if (!isRecord(raw)) return undefined;
  if (typeof raw.displayAddress !== 'string') return undefined;
  const property: ActiveProperty = { displayAddress: raw.displayAddress };
  const address = normalizeStructuredAddress(raw.address);
  if (address) property.address = address;
  if (typeof raw.instructionType === 'string') {
    property.instructionType = raw.instructionType;
  }
  return property;
}

function normalizeEvidence(
  raw: unknown,
): readonly InspectionEvidenceReference[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const evidence = raw
    .map((entry) => {
      if (!isRecord(entry) || typeof entry.id !== 'string' || !entry.id.trim()) {
        return null;
      }
      return { id: entry.id };
    })
    .filter((entry): entry is InspectionEvidenceReference => entry !== null);
  return evidence.length > 0 ? evidence : undefined;
}

function normalizeFinding(raw: unknown): InspectionFinding | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== 'string' || !raw.id.trim()) return null;
  if (typeof raw.elementConceptId !== 'string' || !raw.elementConceptId.trim()) {
    return null;
  }
  if (typeof raw.observation !== 'string') return null;

  const finding: InspectionFinding = {
    ...raw,
    id: raw.id,
    elementConceptId: raw.elementConceptId as InspectionFinding['elementConceptId'],
    observation: raw.observation,
  };

  if (typeof raw.location === 'string') finding.location = raw.location;
  if (typeof raw.condition === 'string') finding.condition = raw.condition;
  if (typeof raw.defect === 'string') finding.defect = raw.defect;
  if (typeof raw.recommendation === 'string') {
    finding.recommendation = raw.recommendation;
  }
  const evidence = normalizeEvidence(raw.evidence);
  if (evidence) finding.evidence = evidence;

  return finding;
}

function normalizeFindings(
  raw: unknown,
): InspectionCase['job']['inspection']['findings'] | null {
  if (!isRecord(raw)) return null;
  const findings: Record<string, InspectionFinding> = {};
  for (const [findingId, value] of Object.entries(raw)) {
    const finding = normalizeFinding(value);
    if (!finding) return null;
    findings[findingId] = finding;
  }
  return findings;
}

function normalizeNotesByPath(raw: unknown): SvyrNotesByPath | null {
  if (raw === undefined) return {};
  if (!isRecord(raw)) return null;
  const notes: Record<string, string> = {};
  for (const [path, value] of Object.entries(raw)) {
    if (typeof value !== 'string') return null;
    notes[path] = value;
  }
  return notes;
}

function normalizeBrief(raw: unknown): InspectionBrief | null {
  if (!isRecord(raw)) return null;
  const instruction = normalizeInstruction(raw.instruction);
  if (!instruction) return null;

  const brief: InspectionBrief = {
    ...raw,
    instruction,
    purpose: nullableString(raw.purpose),
    deliverable: nullableString(raw.deliverable),
    limitation: nullableString(raw.limitation),
  };

  if (isRecord(raw.fieldMeta)) {
    brief.fieldMeta = raw.fieldMeta as InspectionBrief['fieldMeta'];
  }
  if (isRecord(raw.controlledFacts)) {
    const controlledFacts: Record<string, string> = {};
    for (const [fieldId, value] of Object.entries(raw.controlledFacts)) {
      if (typeof value === 'string') controlledFacts[fieldId] = value;
    }
    if (Object.keys(controlledFacts).length > 0) {
      brief.controlledFacts = controlledFacts;
    }
  }
  if (isRecord(raw.controlledFactSets)) {
    const controlledFactSets: Record<string, readonly string[]> = {};
    for (const [fieldId, value] of Object.entries(raw.controlledFactSets)) {
      if (!Array.isArray(value)) continue;
      const values = value.filter((entry): entry is string => typeof entry === 'string');
      if (values.length > 0) controlledFactSets[fieldId] = values;
    }
    if (Object.keys(controlledFactSets).length > 0) {
      brief.controlledFactSets = controlledFactSets;
    }
  }

  return brief;
}

function normalizeJob(raw: unknown): ActiveJob | null {
  if (!isRecord(raw)) return null;

  let property: ActiveProperty | null = null;
  if ('property' in raw) {
    const normalizedProperty = normalizeProperty(raw.property);
    if (normalizedProperty === undefined) return null;
    property = normalizedProperty;
  }

  let inspection: ActiveJob['inspection'];
  if (raw.inspection === undefined) {
    inspection = createEmptyInspectionRecord();
  } else if (!isRecord(raw.inspection)) {
    return null;
  } else {
    const findings = normalizeFindings(raw.inspection.findings);
    if (findings === null) return null;
    inspection = { findings };
  }

  const job: ActiveJob = {
    ...raw,
    property,
    inspection,
  };

  return job;
}

function extractEnvelopeExtensions(
  raw: Record<string, unknown>,
): Readonly<Record<string, unknown>> | undefined {
  const extensions: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!KNOWN_ENVELOPE_KEYS.has(key)) extensions[key] = value;
  }
  return Object.keys(extensions).length > 0 ? extensions : undefined;
}

function normalizeEnvelope(
  raw: unknown,
): (SerializedCaseEnvelopeV1 & {
  envelopeExtensions?: Readonly<Record<string, unknown>>;
}) | null {
  if (!isRecord(raw)) return null;
  if (raw.schemaVersion !== CASE_PERSISTENCE_SCHEMA_VERSION) return null;

  const job = normalizeJob(raw.job);
  const brief = normalizeBrief(raw.brief);
  const notesByPath = normalizeNotesByPath(raw.notesByPath);
  if (!job || !brief || notesByPath === null) return null;

  const envelopeExtensions = extractEnvelopeExtensions(raw);

  return {
    schemaVersion: CASE_PERSISTENCE_SCHEMA_VERSION,
    job,
    brief,
    notesByPath,
    ...(envelopeExtensions ? { envelopeExtensions } : {}),
  };
}

/** Safe empty case used when callers need a default workspace snapshot. */
export function createEmptyInspectionCase(): InspectionCase {
  return {
    job: {
      property: null,
      inspection: createEmptyInspectionRecord(),
    },
    brief: {
      instruction: {
        instructingParty: null,
        client: null,
        reference: null,
        source: null,
      },
      purpose: null,
      deliverable: null,
      limitation: null,
    },
    notesByPath: {},
  };
}

/** Serialize one case into a versioned JSON envelope without mutating input. */
export function serializeCase(inspectionCase: InspectionCase): string {
  const envelope = {
    schemaVersion: CASE_PERSISTENCE_SCHEMA_VERSION,
    job: cloneJson(inspectionCase.job),
    brief: cloneJson(inspectionCase.brief),
    notesByPath: cloneJson(inspectionCase.notesByPath),
    ...(inspectionCase.envelopeExtensions
      ? cloneJson(inspectionCase.envelopeExtensions)
      : {}),
  };
  return JSON.stringify(envelope);
}

/** Parse a serialized envelope into domain objects, or null when unsafe. */
export function deserializeCase(payload: string): InspectionCase | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }

  const envelope = normalizeEnvelope(parsed);
  if (!envelope) return null;

  return {
    job: envelope.job,
    brief: envelope.brief,
    notesByPath: envelope.notesByPath,
    ...(envelope.envelopeExtensions
      ? { envelopeExtensions: envelope.envelopeExtensions }
      : {}),
  };
}

export async function saveCase(
  adapter: CaseStorageAdapter,
  key: string,
  inspectionCase: InspectionCase,
): Promise<void> {
  await adapter.set(key, serializeCase(inspectionCase));
}

export async function loadCase(
  adapter: CaseStorageAdapter,
  key: string,
): Promise<InspectionCase | null> {
  const payload = await adapter.get(key);
  if (payload === null) return null;
  return deserializeCase(payload);
}

export async function removeCase(
  adapter: CaseStorageAdapter,
  key: string,
): Promise<void> {
  await adapter.remove(key);
}

/** In-memory adapter for tests and non-platform wiring. */
export function createMemoryCaseStorageAdapter(
  initial: Record<string, string> = {},
): CaseStorageAdapter {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    async get(key) {
      return store.has(key) ? (store.get(key) ?? null) : null;
    },
    async set(key, value) {
      store.set(key, value);
    },
    async remove(key) {
      store.delete(key);
    },
  };
}
