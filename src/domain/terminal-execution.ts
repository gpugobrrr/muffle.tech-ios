import { parseCommand } from '@/commands/command-parser';
import type {
  CommandDefinition,
  ParsedCommand,
} from '@/commands/command-types';

type ExecutableInput = {
  inputValue: string;
  matchingSuggestions: CommandDefinition[];
  highlightedSuggestionIndex: number;
  suggestionExplicitlySelected: boolean;
};

export function resolveExecutableCommand({
  inputValue,
  matchingSuggestions,
  highlightedSuggestionIndex,
  suggestionExplicitlySelected,
}: ExecutableInput): ParsedCommand | null {
  const trimmed = inputValue.trim();

  if (trimmed) {
    const parsed = parseCommand(trimmed);
    if (parsed.type !== 'UNKNOWN_COMMAND') return parsed;

    const highlighted = matchingSuggestions[highlightedSuggestionIndex];
    return highlighted ? (parseCommand(highlighted.name) as ParsedCommand) : null;
  }

  if (!suggestionExplicitlySelected) return null;
  const highlighted = matchingSuggestions[highlightedSuggestionIndex];
  return highlighted ? (parseCommand(highlighted.name) as ParsedCommand) : null;
}
