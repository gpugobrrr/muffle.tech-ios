import { findCommandDefinition } from './command-registry';
import type { CommandParseResult, OpenCommandName } from './command-types';

const OPEN_COMMANDS = new Set<OpenCommandName>([
  'condition',
  'defect',
  'photo',
  'note',
  'review',
]);

export function parseCommand(input: string): CommandParseResult {
  const definition = findCommandDefinition(input);

  if (!definition) {
    return { type: 'UNKNOWN_COMMAND', input: input.trim() };
  }

  if (OPEN_COMMANDS.has(definition.name as OpenCommandName)) {
    return {
      type: 'OPEN_COMMAND',
      command: definition.name as OpenCommandName,
    };
  }

  if (definition.name === 'next' || definition.name === 'back') {
    return { type: 'NAVIGATE', direction: definition.name };
  }

  return definition.name === 'undo' ? { type: 'UNDO' } : { type: 'SHOW_HELP' };
}
