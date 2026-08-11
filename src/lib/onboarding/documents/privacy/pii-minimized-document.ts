import type { ParsedDocumentBlockType } from '@/lib/onboarding/documents/parsed-document';

export type PiiCategory =
  | 'email'
  | 'phone'
  | 'postcode'
  | 'person_name'
  | 'postal_address'
  | 'report_reference'
  | 'signature'
  | 'professional_identifier';

export type PiiPlaceholder =
  | '[EMAIL]'
  | '[PHONE]'
  | '[POSTCODE]'
  | '[PERSON]'
  | '[ADDRESS]'
  | '[REFERENCE]'
  | '[SIGNATURE]'
  | '[PROFESSIONAL_ID]';

export type PiiMinimizationAction = {
  category: PiiCategory;
  replacement: PiiPlaceholder;
  count: number;
};

export type PiiMinimizedBlock = {
  sourceBlockId: string;
  page: number;
  type: ParsedDocumentBlockType;
  text?: string;
  actions: PiiMinimizationAction[];
  repeatedAcrossPages?: boolean;
  likelyPageFurniture?: boolean;
};

export type PiiMinimizationSummary = Record<PiiCategory, number>;

/**
 * Derived onboarding evidence. It intentionally excludes source filenames,
 * raw PDF.js items, original text, bounds, fonts, and source-item details.
 */
export type PiiMinimizedDocument = {
  minimizerVersion: 1;
  sourceParserVersion: 1;
  pageCount: number;
  parsedPages?: number[];
  blocks: PiiMinimizedBlock[];
  summary: PiiMinimizationSummary;
};
