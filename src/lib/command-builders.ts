import { formatCommandPath } from '@/lib/command-registry';

/**
 * Central command string builders — the visible SVYR hierarchy.
 * Used for previews and contract checks.
 * Not a parser — parsing stays in command-parser.ts.
 */
export const commands = {
  preparation: () => 'prep',

  openBrief: () => 'prep/brief',
  openScope: () => 'prep/scope',
  openAccess: () => 'prep/access',
  openEquipment: () => 'prep/equipment',
  openPlan: () => 'prep/plan',
  openReady: () => 'prep/ready',

  /** Level 3 — Brief instruction section */
  briefInstruction: () => 'prep/brief/instr',

  /** Level 4 — Instructing party field (read when submitted without a value) */
  briefInstructingParty: () => 'prep/brief/instr/party',

  /** Level 5 — Complete instructing-party command */
  setInstructingParty: (value: string) =>
    `prep/brief/instr/party ${value.trim()}`,

  pin: (path: string) => `${path.trim()} pin`,
  unpin: () => 'unpin',

  lookup: (path: string) => `lookup ${path.trim()}`,
  lookupInstructingParty: () => 'lookup instr party',

  /** Format a token path for display / pin commands. */
  path: (tokens: string[]) => formatCommandPath(tokens),
} as const;

export type BuiltCommand = ReturnType<(typeof commands)[keyof typeof commands]>;
