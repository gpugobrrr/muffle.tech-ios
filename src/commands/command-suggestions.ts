import {
  COMMAND_BY_NAME,
  COMMAND_REGISTRY,
} from './command-registry';
import type {
  CommandDefinition,
  CommandName,
  OpenCommandName,
} from './command-types';

const DEFAULT_CONTEXT: readonly CommandName[] = [
  'condition',
  'defect',
  'photo',
  'note',
  'next',
];

type SuggestionContext = {
  activeElement: string;
  activeCommand: OpenCommandName | null;
};

export function getContextualSuggestions(
  _context: SuggestionContext,
): CommandDefinition[] {
  return DEFAULT_CONTEXT.map((name) => COMMAND_BY_NAME.get(name)).filter(
    (definition): definition is CommandDefinition => Boolean(definition),
  );
}

function matchRank(definition: CommandDefinition, query: string): number | null {
  if (definition.name === query) return 0;
  if (definition.aliases.includes(query)) return 1;
  if (definition.name.startsWith(query)) return 2;
  if (definition.aliases.some((alias) => alias.startsWith(query))) return 3;
  return null;
}

export function getMatchingSuggestions(
  input: string,
  context: SuggestionContext,
): CommandDefinition[] {
  const query = input.trim().toLowerCase();

  if (!query) {
    return getContextualSuggestions(context);
  }

  return COMMAND_REGISTRY.map((definition, registryIndex) => ({
    definition,
    rank: matchRank(definition, query),
    registryIndex,
  }))
    .filter(
      (
        item,
      ): item is {
        definition: CommandDefinition;
        rank: number;
        registryIndex: number;
      } => item.rank !== null,
    )
    .sort((left, right) => left.rank - right.rank || left.registryIndex - right.registryIndex)
    .slice(0, 5)
    .map(({ definition }) => definition);
}

function editDistance(left: string, right: string): number {
  const rows = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let previous = rows[0];
    rows[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const current = rows[rightIndex];
      rows[rightIndex] = Math.min(
        rows[rightIndex] + 1,
        rows[rightIndex - 1] + 1,
        previous + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
      previous = current;
    }
  }

  return rows[right.length];
}

export function getClosestSuggestions(input: string): CommandDefinition[] {
  const query = input.trim().toLowerCase();
  if (!query) return [];

  return COMMAND_REGISTRY.map((definition, registryIndex) => {
    const terms = [definition.name, ...definition.aliases];
    return {
      definition,
      registryIndex,
      distance: Math.min(...terms.map((term) => editDistance(query, term))),
    };
  })
    .sort(
      (left, right) =>
        left.distance - right.distance || left.registryIndex - right.registryIndex,
    )
    .slice(0, 3)
    .map(({ definition }) => definition);
}

export function getNextSuggestionIndex(
  suggestionCount: number,
  currentIndex: number,
): number {
  if (suggestionCount === 0) return -1;
  return (currentIndex + 1 + suggestionCount) % suggestionCount;
}
