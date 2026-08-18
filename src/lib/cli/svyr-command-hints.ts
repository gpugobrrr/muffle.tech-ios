/**
 * Pure executable command entries for the Golden Zone HUD reference.
 * Category headings (FINDINGS, DETAIL, CONTROL) are omitted so only actionable
 * commands render in the surveyor's peripheral field of view.
 */

export const SVYR_COMMAND_HINTS_LEFT: readonly string[] = [
  'urgent <text> CR3',
  'defect <text> CR2',
  'routine <text> CR1',
  'location <text>',
  'material <text>',
  'recommend <text>',
  'tag <text>',
  'room <name>',
];

export const SVYR_COMMAND_HINTS_RIGHT: readonly string[] = [
  'photo [count]',
  'undo',
  'list',
  'help',
];

export const SVYR_COMMAND_HINTS: readonly string[] = [
  ...SVYR_COMMAND_HINTS_LEFT,
  ...SVYR_COMMAND_HINTS_RIGHT,
];
