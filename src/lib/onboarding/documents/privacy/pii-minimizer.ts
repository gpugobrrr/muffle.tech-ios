import type {
  ParsedDocumentBlock,
  ParsedFirmDocument,
} from '@/lib/onboarding/documents/parsed-document';
import type {
  PiiCategory,
  PiiMinimizationAction,
  PiiMinimizationSummary,
  PiiMinimizedDocument,
  PiiPlaceholder,
} from '@/lib/onboarding/documents/privacy/pii-minimized-document';

const EMAIL_PATTERN =
  /\b[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+\b/gi;
const PHONE_PATTERN =
  /(^|[^\w])((?:\+44(?:\s*\(0\))?|0)(?:[\s().-]*\d){9,10})(?![\d\w])/g;
const POSTCODE_PATTERN =
  /\b(?:GIR\s?0AA|[A-Z]{1,2}\d[0-9A-Z]?\s?\d[A-Z]{2})\b/gi;

const PLACEHOLDERS: Record<PiiCategory, PiiPlaceholder> = {
  email: '[EMAIL]',
  phone: '[PHONE]',
  postcode: '[POSTCODE]',
  person_name: '[PERSON]',
  postal_address: '[ADDRESS]',
  report_reference: '[REFERENCE]',
  signature: '[SIGNATURE]',
  professional_identifier: '[PROFESSIONAL_ID]',
};

const LABEL_PATTERNS: readonly {
  category: PiiCategory;
  pattern: RegExp;
}[] = [
  {
    category: 'person_name',
    pattern:
      /^(?:client(?:'s)? name|name of (?:the )?client|surveyor(?:'s)? name|name of (?:the )?surveyor)$/,
  },
  {
    category: 'postal_address',
    pattern:
      /^(?:property address|address of (?:the )?property|full address and postcode of (?:the )?property|surveyor(?:'s)? address)$/,
  },
  {
    category: 'report_reference',
    pattern:
      /^(?:report ref(?:erence)?(?: number)?|reference number|job reference|our reference)$/,
  },
  {
    category: 'signature',
    pattern: /^(?:signature|surveyor(?:'s)? signature|signed by)$/,
  },
  {
    category: 'professional_identifier',
    pattern:
      /^(?:surveyor(?:'s)? rics number|rics (?:membership )?number|professional registration number)$/,
  },
];

const NON_VALUE_FIELD_LABELS = new Set([
  'company name',
  'consultation date (if applicable)',
  'email',
  'inspection date',
  'phone number',
  'related party disclosure',
]);

type MinimizedText = {
  text: string;
  actions: PiiMinimizationAction[];
};

function action(
  category: PiiCategory,
  count = 1,
): PiiMinimizationAction {
  return {
    category,
    replacement: PLACEHOLDERS[category],
    count,
  };
}

function addAction(
  actions: PiiMinimizationAction[],
  category: PiiCategory,
  count: number,
): void {
  if (count === 0) return;
  const existing = actions.find((candidate) => candidate.category === category);
  if (existing) {
    existing.count += count;
    return;
  }
  actions.push(action(category, count));
}

function normalizeLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll('’', "'")
    .replace(/[:\s]+$/, '')
    .replace(/\s+/g, ' ');
}

function labelCategory(value: string): PiiCategory | undefined {
  const normalized = normalizeLabel(value);
  return LABEL_PATTERNS.find(({ pattern }) => pattern.test(normalized))?.category;
}

function isLikelyFieldLabel(value: string): boolean {
  return (
    labelCategory(value) !== undefined ||
    NON_VALUE_FIELD_LABELS.has(normalizeLabel(value))
  );
}

function isPlausibleContextualValue(
  category: PiiCategory,
  value: string,
): boolean {
  const candidate = value.trim();
  if (
    !candidate ||
    Object.values(PLACEHOLDERS).includes(candidate as PiiPlaceholder) ||
    isLikelyFieldLabel(candidate)
  ) {
    return false;
  }
  if (category === 'professional_identifier') {
    return /^\d{5,10}$/.test(candidate);
  }
  if (category === 'report_reference') {
    return (
      candidate.length <= 80 &&
      /^[A-Z0-9][A-Z0-9 ./_-]*$/i.test(candidate) &&
      /[A-Z]/i.test(candidate) &&
      /\d/.test(candidate)
    );
  }
  return true;
}

function replaceInlineLabelValue(value: string): MinimizedText | undefined {
  const delimiter = value.match(/^(.{2,80}?)(\s*:\s+|\s+[–—-]\s+)(.+)$/);
  if (!delimiter) return undefined;
  const category = labelCategory(delimiter[1]);
  if (!category || !isPlausibleContextualValue(category, delimiter[3])) {
    return undefined;
  }
  return {
    text: `${delimiter[1]}${delimiter[2]}${PLACEHOLDERS[category]}`,
    actions: [action(category)],
  };
}

function replacePattern(
  value: string,
  pattern: RegExp,
  category: PiiCategory,
): MinimizedText {
  let count = 0;
  const text = value.replace(pattern, () => {
    count += 1;
    return PLACEHOLDERS[category];
  });
  return { text, actions: count > 0 ? [action(category, count)] : [] };
}

function replacePhones(value: string): MinimizedText {
  let count = 0;
  const text = value.replace(
    PHONE_PATTERN,
    (_match, prefix: string, candidate: string) => {
      const normalized = candidate.startsWith('+44')
        ? candidate.replace(/^\+44\s*(?:\(0\)\s*)?/, '').replace(/\D/g, '')
        : candidate.replace(/\D/g, '').slice(1);
      if (normalized.length < 9 || normalized.length > 10) {
        return `${prefix}${candidate}`;
      }
      count += 1;
      return `${prefix}${PLACEHOLDERS.phone}`;
    },
  );
  return { text, actions: count > 0 ? [action('phone', count)] : [] };
}

export function minimizePiiText(value: string): MinimizedText {
  const inlineLabelValue = replaceInlineLabelValue(value);
  if (inlineLabelValue) return inlineLabelValue;

  const actions: PiiMinimizationAction[] = [];
  let text = value;
  for (const [pattern, category] of [
    [EMAIL_PATTERN, 'email'],
    [POSTCODE_PATTERN, 'postcode'],
  ] as const) {
    const result = replacePattern(text, pattern, category);
    text = result.text;
    for (const finding of result.actions) {
      addAction(actions, finding.category, finding.count);
    }
  }
  const phoneResult = replacePhones(text);
  text = phoneResult.text;
  for (const finding of phoneResult.actions) {
    addAction(actions, finding.category, finding.count);
  }
  return { text, actions };
}

function canBeContextualValue(
  label: ParsedDocumentBlock,
  value: ParsedDocumentBlock,
  category: PiiCategory,
): boolean {
  const plausibleValue =
    value.text !== undefined &&
    isPlausibleContextualValue(category, value.text);
  const permitsCompactMarker =
    value.type === 'marker' &&
    (category === 'professional_identifier' ||
      category === 'report_reference');
  const permitsRepeatedProfessionalIdentifier =
    value.repeatedAcrossPages === true &&
    category === 'professional_identifier' &&
    plausibleValue;
  if (
    label.page !== value.page ||
    !label.bounds ||
    !value.bounds ||
    !value.text ||
    value.text.trim().length === 0 ||
    value.text.length > 180 ||
    value.likelyPageFurniture ||
    (value.repeatedAcrossPages &&
      !permitsRepeatedProfessionalIdentifier) ||
    (!['paragraph', 'unknown'].includes(value.type) &&
      !permitsCompactMarker) ||
    !plausibleValue
  ) {
    return false;
  }

  const fontSize = Math.max(
    label.font?.size ?? label.bounds.height,
    value.font?.size ?? value.bounds.height,
  );
  const sameBaseline =
    Math.abs(label.bounds.y - value.bounds.y) <= Math.max(2, fontSize * 0.35);
  const horizontalGap =
    value.bounds.x - (label.bounds.x + label.bounds.width);
  const alignedRight =
    sameBaseline && horizontalGap >= -2 && horizontalGap <= 300;
  const verticalGap =
    label.bounds.y - (value.bounds.y + value.bounds.height);
  const stackedBelow =
    verticalGap >= -2 &&
    verticalGap <= Math.max(24, fontSize * 2.5) &&
    Math.abs(value.bounds.x - label.bounds.x) <= Math.max(18, fontSize * 1.5);
  return alignedRight || stackedBelow;
}

function contextualValues(
  blocks: readonly ParsedDocumentBlock[],
): Map<number, PiiCategory> {
  const values = new Map<number, PiiCategory>();
  for (let index = 0; index < blocks.length - 1; index += 1) {
    const label = blocks[index];
    const category = label.text ? labelCategory(label.text) : undefined;
    if (!category) continue;
    const value = blocks[index + 1];
    if (canBeContextualValue(label, value, category)) {
      values.set(index + 1, category);
    }
  }
  return values;
}

function emptySummary(): PiiMinimizationSummary {
  return {
    email: 0,
    phone: 0,
    postcode: 0,
    person_name: 0,
    postal_address: 0,
    report_reference: 0,
    signature: 0,
    professional_identifier: 0,
  };
}

export function minimizeParsedDocument(
  source: ParsedFirmDocument,
): PiiMinimizedDocument {
  const summary = emptySummary();
  const values = contextualValues(source.blocks);
  const blocks = source.blocks.map((block, index) => {
    let result: MinimizedText | undefined;
    const contextualCategory = values.get(index);
    if (contextualCategory && block.text) {
      result = {
        text: PLACEHOLDERS[contextualCategory],
        actions: [action(contextualCategory)],
      };
    } else if (block.text !== undefined) {
      result = minimizePiiText(block.text);
    }

    for (const finding of result?.actions ?? []) {
      summary[finding.category] += finding.count;
    }
    return {
      sourceBlockId: block.id,
      page: block.page,
      type: block.type,
      ...(result ? { text: result.text } : {}),
      actions: result?.actions ?? [],
      ...(block.repeatedAcrossPages !== undefined
        ? { repeatedAcrossPages: block.repeatedAcrossPages }
        : {}),
      ...(block.likelyPageFurniture !== undefined
        ? { likelyPageFurniture: block.likelyPageFurniture }
        : {}),
    };
  });

  return {
    minimizerVersion: 1,
    sourceParserVersion: source.parserVersion,
    pageCount: source.pageCount,
    ...(source.parsedPages ? { parsedPages: [...source.parsedPages] } : {}),
    blocks,
    summary,
  };
}
