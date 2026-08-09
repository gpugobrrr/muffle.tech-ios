import type { ActiveProperty } from '@/types/workspace';

export function getCompactPropertyLabel(
  property: ActiveProperty | null | undefined,
): string {
  const address = property?.address;
  const firstLine =
    address?.line1?.trim() ||
    address?.formattedAddress.split(',')[0]?.trim() ||
    property?.displayAddress.trim() ||
    '';
  const postcode = address?.postalCode?.trim() || '';

  if (firstLine && postcode) return `${firstLine}, ${postcode}`;
  return firstLine || postcode;
}
