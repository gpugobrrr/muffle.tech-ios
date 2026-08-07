export type BriefInstruction = {
  instructingParty: string | null;
  client: string | null;
  reference: string | null;
  source: string | null;
};

/**
 * Per-field flags that affect completion counts. Keys are slash paths such as
 * `prep/brief/instr/party`. Values never invent registry structure — they only
 * annotate the live job record.
 */
export type FieldCompletionMeta = {
  notApplicable?: boolean;
  /** Populated but not acceptable — counts toward total, not completed. */
  invalid?: boolean;
};

export type InspectionBrief = {
  instruction: BriefInstruction;
  purpose: string | null;
  deliverable: string | null;
  limitation: string | null;
  fieldMeta?: Record<string, FieldCompletionMeta>;
};

/** Active survey site shown in the workspace header — never product branding. */
export type ActiveProperty = {
  displayAddress: string;
  instructionType?: string;
};

export type ActiveJob = {
  property: ActiveProperty | null;
};

/** Typed terminal response model */
export type TerminalMessage =
  | {
      type: 'error';
      primary: string;
      secondary?: string;
    }
  | {
      type: 'info';
      primary: string;
      secondary?: string;
    }
  | null;
