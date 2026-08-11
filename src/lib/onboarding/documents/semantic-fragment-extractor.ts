import type { ParsedDocumentBlockType } from '@/lib/onboarding/documents/parsed-document';
import type { PiiMinimizedDocument } from '@/lib/onboarding/documents/privacy/pii-minimized-document';
import type { FirmSemanticFragment } from '@/lib/onboarding/semantic-mapping';

export type SemanticFragmentType = Extract<
  ParsedDocumentBlockType,
  'paragraph' | 'list'
>;

export type SemanticFragment = {
  id: string;
  page: number;
  type: SemanticFragmentType;
  text: string;
  sectionHeading?: string;
  elementHeading?: string;
  headingPath: string[];
  sourceBlockIds: string[];
};

type HeadingContext = {
  text: string;
  sourceBlockId: string;
};

const ELEMENT_HEADING_PATTERN = /^[A-Z]\d+\b/;
const PRIVACY_PLACEHOLDER_PATTERN =
  /\[(?:EMAIL|PHONE|POSTCODE|PERSON|ADDRESS|REFERENCE|SIGNATURE|PROFESSIONAL_ID)\]/g;

function normalizedText(value: string | undefined): string {
  return value?.trim().replace(/\s+/g, ' ') ?? '';
}

export function isSemanticElementHeading(value: string): boolean {
  return ELEMENT_HEADING_PATTERN.test(normalizedText(value));
}

function isMeaningfulText(value: string): boolean {
  if (/^\d{1,4}[.)]?$/.test(value) || /^[A-Z]$/.test(value)) return false;
  const withoutPlaceholders = value
    .replace(PRIVACY_PLACEHOLDER_PATTERN, '')
    .trim();
  return /[\p{L}\p{N}]/u.test(withoutPlaceholders);
}

function sourceBlockIds(
  section: HeadingContext | undefined,
  element: HeadingContext | undefined,
  contentBlockId: string,
): string[] {
  return [
    ...new Set([
      ...(section ? [section.sourceBlockId] : []),
      ...(element ? [element.sourceBlockId] : []),
      contentBlockId,
    ]),
  ];
}

export function extractSemanticFragments(
  document: PiiMinimizedDocument,
): SemanticFragment[] {
  const fragments: SemanticFragment[] = [];
  let section: HeadingContext | undefined;
  let element: HeadingContext | undefined;

  for (const block of document.blocks) {
    const text = normalizedText(block.text);
    if (block.likelyPageFurniture || !text) continue;

    if (block.type === 'heading') {
      if (!isMeaningfulText(text)) continue;
      const heading = { text, sourceBlockId: block.sourceBlockId };
      if (isSemanticElementHeading(text)) {
        element = heading;
      } else {
        section = heading;
        element = undefined;
      }
      continue;
    }

    if (
      (block.type !== 'paragraph' && block.type !== 'list') ||
      !isMeaningfulText(text)
    ) {
      continue;
    }

    const headingPath = [
      ...(section ? [section.text] : []),
      ...(element ? [element.text] : []),
    ];
    fragments.push({
      id: `sf-${block.page}-${block.sourceBlockId}`,
      page: block.page,
      type: block.type,
      text,
      ...(section ? { sectionHeading: section.text } : {}),
      ...(element ? { elementHeading: element.text } : {}),
      headingPath,
      sourceBlockIds: sourceBlockIds(
        section,
        element,
        block.sourceBlockId,
      ),
    });
  }

  return fragments;
}

export function toFirmSemanticFragment(
  fragment: SemanticFragment,
): FirmSemanticFragment {
  const firmTerm =
    fragment.elementHeading ?? fragment.sectionHeading ?? fragment.text;
  return {
    firmTerm,
    ...(fragment.elementHeading && fragment.sectionHeading
      ? { nearbyHeading: fragment.sectionHeading }
      : {}),
    representativeText: fragment.text,
  };
}
