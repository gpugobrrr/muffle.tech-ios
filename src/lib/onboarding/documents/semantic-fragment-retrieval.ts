import {
  toFirmSemanticFragment,
  type SemanticFragment,
} from '@/lib/onboarding/documents/semantic-fragment-extractor';
import type { FirmSemanticFragment } from '@/lib/onboarding/semantic-mapping';

const ADMINISTRATIVE_FIELD_LABELS = new Set([
  'property address',
  "client's name",
  'client name',
  'consultation date',
  'consultation date (if applicable)',
  'inspection date',
  'date of the inspection',
  "surveyor's name",
  'surveyor name',
  "surveyor's rics number",
  'rics number',
  'report reference number',
  'report reference',
  'company name',
  'phone number',
  'telephone',
  'email',
  'email address',
  "surveyor's address",
  'website',
  'signature',
]);

const PRIVACY_PLACEHOLDER =
  '\\[(?:PERSON|ADDRESS|EMAIL|PHONE|POSTCODE|REFERENCE|SIGNATURE|PROFESSIONAL_ID)\\]';
const INLINE_ADMINISTRATIVE_VALUE_PATTERN = new RegExp(
  `^(.+?)(?:\\s*:\\s*|\\s+[–—-]\\s+)(${PRIVACY_PLACEHOLDER})$`,
  'i',
);

function normalizeLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll('’', "'")
    .replace(/[:\s]+$/, '')
    .replace(/\s+/g, ' ');
}

export function isAdministrativeSemanticFieldLabel(value: string): boolean {
  return ADMINISTRATIVE_FIELD_LABELS.has(normalizeLabel(value));
}

function isAdministrativeInlineValue(value: string): boolean {
  const match = INLINE_ADMINISTRATIVE_VALUE_PATTERN.exec(value.trim());
  return Boolean(match && isAdministrativeSemanticFieldLabel(match[1]));
}

export function isAdministrativeSemanticText(value: string): boolean {
  return (
    isAdministrativeSemanticFieldLabel(value) ||
    isAdministrativeInlineValue(value)
  );
}

function contentBlockPosition(
  fragment: SemanticFragment,
): { page: number; block: number } | undefined {
  const sourceBlockId = fragment.sourceBlockIds.at(-1);
  const match = sourceBlockId ? /^p(\d+)-b(\d+)$/.exec(sourceBlockId) : null;
  return match
    ? { page: Number(match[1]), block: Number(match[2]) }
    : undefined;
}

function hasSameHeadingContext(
  left: SemanticFragment,
  right: SemanticFragment,
): boolean {
  return (
    left.sectionHeading === right.sectionHeading &&
    left.elementHeading === right.elementHeading &&
    left.headingPath.length === right.headingPath.length &&
    left.headingPath.every(
      (heading, index) => heading === right.headingPath[index],
    )
  );
}

function isAdjacentAdministrativeValue(
  label: SemanticFragment,
  value: SemanticFragment,
): boolean {
  if (
    label.page !== value.page ||
    label.type !== 'paragraph' ||
    value.type !== 'paragraph' ||
    !hasSameHeadingContext(label, value) ||
    isAdministrativeSemanticFieldLabel(value.text) ||
    isAdministrativeInlineValue(value.text)
  ) {
    return false;
  }
  const labelPosition = contentBlockPosition(label);
  const valuePosition = contentBlockPosition(value);
  return Boolean(
    labelPosition &&
      valuePosition &&
      labelPosition.page === valuePosition.page &&
      valuePosition.block === labelPosition.block + 1,
  );
}

export function isSemanticFragmentRetrievalEligible(
  fragment: SemanticFragment,
): boolean {
  return !isAdministrativeSemanticText(fragment.text);
}

export function selectRetrievalEligibleFragments(
  fragments: readonly SemanticFragment[],
): SemanticFragment[] {
  const excludedIndexes = new Set<number>();

  for (let index = 0; index < fragments.length; index += 1) {
    const fragment = fragments[index];
    if (!isSemanticFragmentRetrievalEligible(fragment)) {
      excludedIndexes.add(index);
    }
    if (!isAdministrativeSemanticFieldLabel(fragment.text)) continue;

    const next = fragments[index + 1];
    if (next && isAdjacentAdministrativeValue(fragment, next)) {
      excludedIndexes.add(index + 1);
    }
  }

  return fragments.filter((_fragment, index) => !excludedIndexes.has(index));
}

export function toRetrievalFirmSemanticFragments(
  fragments: readonly SemanticFragment[],
): FirmSemanticFragment[] {
  return selectRetrievalEligibleFragments(fragments).map(
    toFirmSemanticFragment,
  );
}
