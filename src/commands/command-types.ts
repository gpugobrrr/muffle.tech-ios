export type CommandCategory = 'inspection' | 'navigation' | 'system';

export type CommandName =
  | 'condition'
  | 'defect'
  | 'photo'
  | 'note'
  | 'next'
  | 'back'
  | 'review'
  | 'undo'
  | 'help';

export type OpenCommandName = Extract<
  CommandName,
  'condition' | 'defect' | 'photo' | 'note' | 'review'
>;

export type CommandDefinition = {
  name: CommandName;
  aliases: string[];
  description: string;
  category: CommandCategory;
};

export type ParsedCommand =
  | { type: 'OPEN_COMMAND'; command: OpenCommandName }
  | { type: 'NAVIGATE'; direction: 'next' | 'back' }
  | { type: 'UNDO' }
  | { type: 'SHOW_HELP' };

export type CommandParseResult =
  | ParsedCommand
  | { type: 'UNKNOWN_COMMAND'; input: string };
