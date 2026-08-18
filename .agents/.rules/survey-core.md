# MUFFLETECH MOBILE & SURVEY ENGINE ARCHITECTURE RULES

You are an expert Principal Mobile Engineer and RICS Chartered Building Pathology Specialist. You build and maintain MuffleTech's high-speed, voice-first residential survey companion app (React Native, Expo, TypeScript).

---

## 1. CORE ARCHITECTURAL PRINCIPLES

- **In-Stream Continuity:** Surveyors must never leave the primary inspection stream. All operations (voice macros, slot repairs, photo captures) execute via the pinned monospace dock and live feed without modal full-screen interruptions.
- **Strict Decoupling:** Maintain a 3-layer semantic separation across the entire stack:
  1. *Input Layer:* Ingests regional/colloquial surveyor shorthand and voice transcripts via alias dictionaries.
  2. *Canonical Layer:* Normalizes findings into fixed, structured RICS Level 2 domain objects `defectId`, `conditionRating`, structured `slots`).
  3. *Output Layer:* Renders legally compliant 3-part RICS clauses `[obs]`, `[imp]`, `[rec]`) customizable via firm-specific phrasebooks.
- **Zero-Error Type Standard:** All changes must satisfy `npx tsc --noEmit` with zero errors and maintain 100% green status across Vitest suites `npm test`).

---

## 2. CANONICAL DOMAIN TYPES & SCHEMAS

```typescript

export type ConditionRating = 'CR1' | 'CR2' | 'CR3';

export type RoomContext = 

  | 'roof_void'

  | 'chimneys_roof_external'

  | 'external_walls'

  | 'rainwater_goods'

  | 'internal_ceilings_walls'

  | 'floors_joinery'

  | 'services_electrics_gas_water'

  | 'grounds_outbuildings';

export interface RICSClause {

  observation: string;     // [obs] Physical symptom + location/materials

  implication: string;     // [imp] Building pathology risk, structural, or damp impact

  recommendation: string;  // [rec] Required trade, timeframe, contractor referral

}

export interface FindingSlotDefinition {

  name: string;

  required: boolean;

  type: 'string' | 'number' | 'enum';

  allowedValues?: string[];

  aliasTriggers?: string[];

}

export interface CanonicalDefectDefinition {

  id: string;

  element: string;

  title: string;

  defaultRating: ConditionRating;

  slots: Record<string, FindingSlotDefinition>;

  clauseTemplate: RICSClause;

  aliases: string[];

}

export interface InspectionFinding {

  id: string;

  caseId: string;

  roomContext: RoomContext;

  defectId: string;

  conditionRating: ConditionRating;

  slots: Record<string, string | undefined>;

  missingSlots: string[];

  clause: RICSClause;

  photoUris: string[];

  photoCount: number;

  timestamp: number;

  syncStatus: 'pending' | 'persisted' | 'synced';

}

export interface FirmPhrasebookConfig {

  firmId: string;

  firmName: string;

  defaultTone: 'Corporate' | 'Traditional' | 'Direct';

  disclaimerSuffix: string;

  clauseOverrides: Record<string, Partial<RICSClause>>;

}
```

