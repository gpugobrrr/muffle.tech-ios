export type BriefInstruction = {
  instructingParty: string | null;
  client: string | null;
  reference: string | null;
};

export type InspectionBrief = {
  instruction: BriefInstruction;
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
