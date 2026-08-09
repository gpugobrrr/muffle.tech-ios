const UK_POSTCODE_PATTERN =
  /^(GIR 0AA|[A-Z]{1,2}\d[A-Z\d]?\s\d[A-Z]{2})$/;

export function normalizeUkPostcodeInput(value: string): string {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (compact.length < 5) return compact;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

export function isValidUkPostcode(value: string): boolean {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (compact.length < 5) return false;
  return UK_POSTCODE_PATTERN.test(
    `${compact.slice(0, -3)} ${compact.slice(-3)}`,
  );
}

export function normalizeUkPostcodeForComparison(value: string): string {
  return normalizeUkPostcodeInput(value).replace(/\s/g, '');
}
