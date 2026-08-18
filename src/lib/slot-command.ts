/** Canonical slot value hints for loft voice macros. */
export const SLOT_VALUE_SUGGESTIONS: Readonly<
  Record<string, readonly string[]>
> = {
  location: [
    'rear slope',
    'front pitch',
    'party wall',
    'rear slope bitumen felt',
  ],
  referral: ['SE referral', 'structural engineer'],
  measurement: ['50mm', '100mm', '150mm', '270mm'],
};

export function formatSlotCommand(slotName: string): string {
  return `${slotName}: `;
}

export function parseSlotCommand(
  input: string,
): { slotName: string; value: string } | null {
  const trimmed = input.trim();
  const bracketed = /^\[?([a-z_]+):\s*(.+?)\]?$/i.exec(trimmed);
  if (bracketed) {
    return {
      slotName: bracketed[1].toLowerCase(),
      value: bracketed[2].trim(),
    };
  }
  return null;
}

export function slotValueFromCommand(
  input: string,
  expectedSlotName?: string,
): string | null {
  const parsed = parseSlotCommand(input);
  if (parsed) {
    if (expectedSlotName && parsed.slotName !== expectedSlotName) {
      return parsed.value;
    }
    return parsed.value;
  }

  if (expectedSlotName) {
    const prefix = `${expectedSlotName}:`;
    if (input.toLowerCase().startsWith(prefix)) {
      return input.slice(prefix.length).trim();
    }
  }

  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
}
