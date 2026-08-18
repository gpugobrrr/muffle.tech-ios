import { ROOM_REGISTRY } from '@/domain/ontology/room-registry';

export type EnglishCommand =
  | { type: 'room'; room: string }
  | {
      type: 'finding';
      severity: 'CR1' | 'CR2' | 'CR3';
      text: string;
    }
  | {
      type: 'slot';
      slot: 'location' | 'recommendation' | 'material';
      value: string;
    }
  | { type: 'photo'; count: number }
  | { type: 'tag'; value: string }
  | { type: 'undo' }
  | { type: 'list' }
  | { type: 'help' }
  | {
      type: 'invalid';
      command?: string;
      message: string;
      suggestion?: string;
    };

export type ParsedEnglishCommand = EnglishCommand;

export const DEFAULT_COMMAND_PLACEHOLDER =
  'room, urgent, defect, photo, help...';

export const HELP_TEXT = `urgent <text>       CR3
defect <text>       CR2
routine <text>      CR1
location <text>
material <text>
recommend <text>
tag <text>
room <name>
photo [count]
undo
list
help`;

const CANONICAL_KEYWORDS = [
  'room',
  'urgent',
  'defect',
  'routine',
  'location',
  'recommend',
  'material',
  'photo',
  'tag',
  'undo',
  'list',
  'help',
] as const;

type CanonicalKeyword = (typeof CANONICAL_KEYWORDS)[number];

const KEYWORD_ALIASES: Record<string, CanonicalKeyword> = {
  rooms: 'room',
  critical: 'urgent',
  cr3: 'urgent',
  issue: 'defect',
  cr2: 'defect',
  note: 'routine',
  cr1: 'routine',
  loc: 'location',
  recommendation: 'recommend',
  rec: 'recommend',
  mat: 'material',
  photos: 'photo',
  pic: 'photo',
  picture: 'photo',
  tags: 'tag',
  summary: 'list',
  ls: 'list',
  '?': 'help',
};

function levenshteinDistance(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix: number[][] = [];
  for (let i = 0; i <= bn; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= an; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }
  return matrix[bn][an];
}

function findSuggestion(word: string): string | undefined {
  const lower = word.toLowerCase();
  let bestMatch: string | undefined;
  let minDistance = 3;

  for (const canonical of CANONICAL_KEYWORDS) {
    const dist = levenshteinDistance(lower, canonical);
    if (dist < minDistance) {
      minDistance = dist;
      bestMatch = canonical;
    }
  }
  return bestMatch;
}

export function normalizeRoomName(rawName: string): string {
  const key = rawName.trim().toLowerCase().replace(/[\s\-_]+/g, '_');
  const registeredRooms = Object.keys(ROOM_REGISTRY);
  if (registeredRooms.includes(key)) {
    return key;
  }
  return key;
}

export function parseEnglishCommand(input: string): EnglishCommand {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      type: 'invalid',
      message: 'SVYR > Type a command (room, urgent, defect, photo, help)...',
    };
  }

  const spaceMatch = /\s+/.exec(trimmed);
  const firstWord = spaceMatch
    ? trimmed.slice(0, spaceMatch.index).toLowerCase()
    : trimmed.toLowerCase();
  const rest = spaceMatch
    ? trimmed.slice(spaceMatch.index + spaceMatch[0].length).trim()
    : '';

  const canonical =
    KEYWORD_ALIASES[firstWord] ??
    (CANONICAL_KEYWORDS.includes(firstWord as CanonicalKeyword)
      ? (firstWord as CanonicalKeyword)
      : undefined);

  if (!canonical) {
    const suggestion = findSuggestion(firstWord);
    if (suggestion) {
      return {
        type: 'invalid',
        command: firstWord,
        suggestion,
        message: `SVYR > "${firstWord}" isn't recognised. Did you mean "${suggestion}"?`,
      };
    }
    return {
      type: 'invalid',
      command: firstWord,
      message: `SVYR > "${firstWord}" is not a recognised command. Type "help" for a list of commands.`,
    };
  }

  switch (canonical) {
    case 'room': {
      if (!rest) {
        return {
          type: 'invalid',
          command: 'room',
          message:
            'SVYR > Specify a room name after "room".\nExample: room roof void',
        };
      }
      return { type: 'room', room: normalizeRoomName(rest) };
    }

    case 'urgent': {
      if (!rest) {
        return {
          type: 'invalid',
          command: 'urgent',
          message:
            'SVYR > Add some detail after "urgent".\nExample: urgent severe rafter spread at rear slope',
        };
      }
      return { type: 'finding', severity: 'CR3', text: rest };
    }

    case 'defect': {
      if (!rest) {
        return {
          type: 'invalid',
          command: 'defect',
          message:
            'SVYR > Add some detail after "defect".\nExample: defect insulation missing at rear eaves',
        };
      }
      return { type: 'finding', severity: 'CR2', text: rest };
    }

    case 'routine': {
      if (!rest) {
        return {
          type: 'invalid',
          command: 'routine',
          message:
            'SVYR > Add some detail after "routine".\nExample: routine 100mm mineral wool insulation adequate',
        };
      }
      return { type: 'finding', severity: 'CR1', text: rest };
    }

    case 'location': {
      if (!rest) {
        return {
          type: 'invalid',
          command: 'location',
          message:
            'SVYR > Specify a location after "location".\nExample: location rear slope bitumen felt',
        };
      }
      return { type: 'slot', slot: 'location', value: rest };
    }

    case 'recommend': {
      if (!rest) {
        return {
          type: 'invalid',
          command: 'recommend',
          message:
            'SVYR > Add a recommendation after "recommend".\nExample: recommend replace damaged insulation',
        };
      }
      return { type: 'slot', slot: 'recommendation', value: rest };
    }

    case 'material': {
      if (!rest) {
        return {
          type: 'invalid',
          command: 'material',
          message:
            'SVYR > Specify a material after "material".\nExample: material mineral wool',
        };
      }
      return { type: 'slot', slot: 'material', value: rest };
    }

    case 'photo': {
      if (!rest) {
        return { type: 'photo', count: 1 };
      }
      if (!/^\d+$/.test(rest) && !/^-\d+$/.test(rest)) {
        return {
          type: 'invalid',
          command: 'photo',
          message: `SVYR > Invalid photo count "${rest}". Specify a number between 1 and 10.\nExample: photo 3`,
        };
      }
      const count = parseInt(rest, 10);
      if (count <= 0) {
        return {
          type: 'invalid',
          command: 'photo',
          message: 'SVYR > Photo count must be at least 1.\nExample: photo 1',
        };
      }
      if (count > 10) {
        return {
          type: 'invalid',
          command: 'photo',
          message:
            'SVYR > Maximum 10 photos can be captured at once.\nExample: photo 10',
        };
      }
      return { type: 'photo', count };
    }

    case 'tag': {
      if (!rest) {
        return {
          type: 'invalid',
          command: 'tag',
          message:
            'SVYR > Add a tag label after "tag".\nExample: tag condensation risk',
        };
      }
      return { type: 'tag', value: rest };
    }

    case 'undo': {
      if (rest) {
        return {
          type: 'invalid',
          command: 'undo',
          message:
            'SVYR > "undo" does not take additional arguments. Type "undo" alone to remove the last entry.',
        };
      }
      return { type: 'undo' };
    }

    case 'list': {
      if (rest) {
        return {
          type: 'invalid',
          command: 'list',
          message:
            'SVYR > "list" does not take additional arguments. Type "list" alone to show the current-room summary.',
        };
      }
      return { type: 'list' };
    }

    case 'help': {
      if (rest) {
        return {
          type: 'invalid',
          command: 'help',
          message:
            'SVYR > "help" does not take additional arguments. Type "help" alone to view the command reference.',
        };
      }
      return { type: 'help' };
    }
  }
}
