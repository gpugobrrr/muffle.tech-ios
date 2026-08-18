import {
  CANONICAL_DEFECT_LIST,
  type CanonicalDefectId,
  type ConditionRating,
} from '@/domain/ontology/canonical-defects';

export type AliasEntry = {
  phrase: string;
  canonicalId: Exclude<CanonicalDefectId, 'unclassified'>;
};

export type DeterministicMatch = {
  defectId: Exclude<CanonicalDefectId, 'unclassified'>;
  phrase: string;
  startToken: number;
  tokenLength: number;
};

export type ExtractedSlots = Record<string, string>;

type TrieNode = {
  children: Map<string, TrieNode>;
  terminal: AliasEntry | null;
};

const WAKE_WORD_PATTERN =
  /^(?:macro\s*:|muffle\s+go|muffle\s+stop)\s*/i;

function createTrieNode(): TrieNode {
  return { children: new Map(), terminal: null };
}

const staticTrie: TrieNode = createTrieNode();
let staticTrieSeeded = false;

export function normalizePhrase(input: string): string {
  return input
    .trim()
    .replace(WAKE_WORD_PATTERN, '')
    .toLowerCase()
    .replace(/[.,;:!?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(input: string): string[] {
  const normalized = normalizePhrase(input);
  if (!normalized) return [];
  return normalized.split(' ').filter((token) => token.length > 0);
}

export function stemToken(token: string): string {
  if (token.endsWith('ing') && token.length > 5) return token.slice(0, -3);
  if (token.endsWith('ed') && token.length > 4) return token.slice(0, -2);
  if (token.endsWith('ies') && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.endsWith('s') && !token.endsWith('ss') && token.length > 3) {
    return token.slice(0, -1);
  }
  return token;
}

function insertPhrase(root: TrieNode, entry: AliasEntry): void {
  const tokens = tokenize(entry.phrase);
  if (tokens.length === 0) return;

  let node = root;
  for (const token of tokens) {
    let child = node.children.get(token);
    if (!child) {
      child = createTrieNode();
      node.children.set(token, child);
    }
    node = child;
  }
  node.terminal = entry;
}

function seedStaticTrie(): void {
  if (staticTrieSeeded) return;
  for (const defect of CANONICAL_DEFECT_LIST) {
    for (const alias of defect.aliases) {
      insertPhrase(staticTrie, { phrase: alias, canonicalId: defect.id });
    }
  }
  staticTrieSeeded = true;
}

export function buildAliasTrie(entries: readonly AliasEntry[]): TrieNode {
  const root = createTrieNode();
  for (const entry of entries) {
    insertPhrase(root, entry);
  }
  return root;
}

function longestMatchFrom(
  tokens: readonly string[],
  start: number,
  root: TrieNode,
): DeterministicMatch | null {
  let node: TrieNode | undefined = root;
  let best: DeterministicMatch | null = null;

  for (let index = start; index < tokens.length; index += 1) {
    node = node.children.get(tokens[index] ?? '');
    if (!node) break;
    if (node.terminal) {
      best = {
        defectId: node.terminal.canonicalId,
        phrase: node.terminal.phrase,
        startToken: start,
        tokenLength: index - start + 1,
      };
    }
  }

  return best;
}

function collectMatches(
  tokens: readonly string[],
  root: TrieNode,
): DeterministicMatch[] {
  const matches: DeterministicMatch[] = [];
  for (let start = 0; start < tokens.length; start += 1) {
    const match = longestMatchFrom(tokens, start, root);
    if (match) matches.push(match);
  }
  return matches;
}

function pickBestMatch(
  matches: readonly DeterministicMatch[],
): DeterministicMatch | null {
  if (matches.length === 0) return null;
  return [...matches].sort((left, right) => {
    if (right.tokenLength !== left.tokenLength) {
      return right.tokenLength - left.tokenLength;
    }
    return left.startToken - right.startToken;
  })[0] ?? null;
}

export function matchDeterministic(
  input: string,
  extraTrie?: TrieNode,
): DeterministicMatch | null {
  seedStaticTrie();
  const tokens = tokenize(input);
  if (tokens.length === 0) return null;

  const extraMatches = extraTrie ? collectMatches(tokens, extraTrie) : [];
  const staticMatches = collectMatches(tokens, staticTrie);
  const extraBest = pickBestMatch(extraMatches);
  const staticBest = pickBestMatch(staticMatches);

  if (extraBest && staticBest) {
    return extraBest.tokenLength >= staticBest.tokenLength
      ? extraBest
      : staticBest;
  }
  return extraBest ?? staticBest;
}

const LOCATION_PATTERNS: ReadonlyArray<{ pattern: RegExp; value: string }> = [
  { pattern: /\brear\s+slope\s+bitumen\s+felt\b/i, value: 'rear slope bitumen felt' },
  { pattern: /\brear\s+pitch\b/i, value: 'rear pitch' },
  { pattern: /\brear\s+slope\b/i, value: 'rear slope' },
  { pattern: /\bfront\s+slope\b/i, value: 'front slope' },
  { pattern: /\bfront\s+pitch\b/i, value: 'front pitch' },
  { pattern: /\bmain\s+stack\b/i, value: 'main stack' },
  { pattern: /\bparty\s+wall\b/i, value: 'party wall' },
  { pattern: /\bchimney\s+top\b/i, value: 'chimney top' },
  { pattern: /\bground\s+floor\b/i, value: 'ground floor' },
  { pattern: /\broof\s+void\b/i, value: 'roof void' },
];

const MATERIAL_PATTERNS: ReadonlyArray<{ pattern: RegExp; value: string }> = [
  { pattern: /\bmineral\s+wool\b/i, value: 'mineral wool' },
  { pattern: /\bconcrete\s+tile\b/i, value: 'concrete tile' },
  { pattern: /\bslate\b/i, value: 'slate' },
  { pattern: /\blead\b/i, value: 'lead' },
];

const REFERRAL_PATTERNS: ReadonlyArray<{ pattern: RegExp; value: string }> = [
  { pattern: /\bse\s+referral\b/i, value: 'SE referral' },
  { pattern: /\bstructural\s+engineer\b/i, value: 'structural engineer' },
  { pattern: /\broofing\s+contractor\b/i, value: 'roofing contractor' },
  { pattern: /\bdamp\s+specialist\b/i, value: 'damp specialist' },
  { pattern: /\bse\b/i, value: 'SE referral' },
];

const DEFECT_TYPE_PATTERNS: ReadonlyArray<{ pattern: RegExp; value: string }> = [
  { pattern: /\bblown\s+bricks?\b/i, value: 'blown brickwork' },
  { pattern: /\bspall(?:ing)?\b/i, value: 'spalling' },
  { pattern: /\blean(?:ing)?\b/i, value: 'lean' },
];

const ACTIVITY_PATTERNS: ReadonlyArray<{ pattern: RegExp; value: string }> = [
  { pattern: /\bactive\b/i, value: 'active' },
  { pattern: /\bhistoric\b/i, value: 'historic' },
  { pattern: /\bflight\s+holes?\b/i, value: 'active' },
  { pattern: /\bindeterminate\b/i, value: 'indeterminate' },
];

const CONDITION_RATING_PATTERN = /\b(CR[123])\b/i;
const MEASUREMENT_PATTERN =
  /\b(?:depth\s*(?:of\s*)?)?(\d+(?:\.\d+)?)\s*(mm|cm)\b/i;
const METER_READING_PATTERN =
  /\b(\d+(?:\.\d+)?\s*(?:%|wme|protimeter))\b/i;

function extractFirstMatch(
  text: string,
  patterns: ReadonlyArray<{ pattern: RegExp; value: string }>,
): string | undefined {
  for (const entry of patterns) {
    if (entry.pattern.test(text)) {
      return entry.value;
    }
  }
  return undefined;
}

export function extractConditionRating(text: string): ConditionRating | null {
  const match = CONDITION_RATING_PATTERN.exec(text);
  if (!match) return null;
  return match[1].toUpperCase() as ConditionRating;
}

export function extractSlots(text: string): ExtractedSlots {
  const slots: ExtractedSlots = {};

  const location = extractFirstMatch(text, LOCATION_PATTERNS);
  if (location) slots.location = location;

  const material = extractFirstMatch(text, MATERIAL_PATTERNS);
  if (material) slots.material = material;

  const referral = extractFirstMatch(text, REFERRAL_PATTERNS);
  if (referral) slots.referral = referral;

  const measurement = MEASUREMENT_PATTERN.exec(text);
  if (measurement) {
    const value = Number.parseFloat(measurement[1]);
    const unit = measurement[2].toLowerCase();
    const depthMm = unit === 'cm' ? value * 10 : value;
    const rounded = Number.isInteger(depthMm)
      ? String(depthMm)
      : String(depthMm);
    slots.measurement = `${measurement[1].replace(/\s+/g, '')}${unit}`;
    slots.depth_mm = rounded;
  }

  const defectType = extractFirstMatch(text, DEFECT_TYPE_PATTERNS);
  if (defectType) slots.defect_type = defectType;

  const activity = extractFirstMatch(text, ACTIVITY_PATTERNS);
  if (activity) slots.activity_status = activity;

  const meter = METER_READING_PATTERN.exec(text);
  if (meter) {
    slots.meter_reading = meter[1].replace(/\s+/g, ' ').trim();
  }

  return slots;
}

export function filterSlotsForDefect(
  defectId: CanonicalDefectId,
  slots: ExtractedSlots,
): ExtractedSlots {
  if (defectId === 'unclassified') {
    return { ...slots };
  }
  if (defectId === 'insulation_deficit') {
    return slots.measurement ? { measurement: slots.measurement } : {};
  }
  if (defectId === 'insulation_depth_deficit') {
    return slots.depth_mm ? { depth_mm: slots.depth_mm } : {};
  }

  const filtered: ExtractedSlots = {};
  if (slots.location) filtered.location = slots.location;
  if (slots.referral) filtered.referral = slots.referral;
  if (slots.material) filtered.material = slots.material;
  if (slots.defect_type) filtered.defect_type = slots.defect_type;
  if (slots.activity_status) filtered.activity_status = slots.activity_status;
  if (slots.meter_reading) filtered.meter_reading = slots.meter_reading;
  if (slots.measurement) filtered.measurement = slots.measurement;
  if (slots.depth_mm) filtered.depth_mm = slots.depth_mm;
  return filtered;
}
