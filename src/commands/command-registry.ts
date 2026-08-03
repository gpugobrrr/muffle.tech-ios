import type { CommandDefinition, CommandName } from './command-types';

export const COMMAND_REGISTRY: readonly CommandDefinition[] = [
  {
    name: 'condition',
    aliases: ['cond'],
    description: 'Record the element condition',
    category: 'inspection',
  },
  {
    name: 'defect',
    aliases: ['def'],
    description: 'Record a defect',
    category: 'inspection',
  },
  {
    name: 'photo',
    aliases: ['p'],
    description: 'Add a photograph',
    category: 'inspection',
  },
  {
    name: 'note',
    aliases: [],
    description: 'Add an inspection note',
    category: 'inspection',
  },
  {
    name: 'next',
    aliases: ['n'],
    description: 'Move to the next element',
    category: 'navigation',
  },
  {
    name: 'back',
    aliases: ['b'],
    description: 'Move to the previous element',
    category: 'navigation',
  },
  {
    name: 'review',
    aliases: ['r'],
    description: 'Review the current element',
    category: 'inspection',
  },
  {
    name: 'undo',
    aliases: ['u'],
    description: 'Undo the last supported action',
    category: 'system',
  },
  {
    name: 'help',
    aliases: ['h'],
    description: 'Show available commands',
    category: 'system',
  },
] as const;

export const COMMAND_BY_NAME = new Map<CommandName, CommandDefinition>(
  COMMAND_REGISTRY.map((definition) => [definition.name, definition]),
);

export function findCommandDefinition(value: string): CommandDefinition | undefined {
  const normalized = value.trim().toLowerCase();

  return COMMAND_REGISTRY.find(
    ({ name, aliases }) => name === normalized || aliases.includes(normalized),
  );
}
