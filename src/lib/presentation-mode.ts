/**
 * Presentation-mode resolution for input chrome.
 *
 * Laptop is not inferred from web alone. Automatic laptop mode requires a web
 * platform, a wide viewport, and known fine pointer plus hover capability.
 * Unavailable matchMedia or unknown pointer/hover falls back to touch.
 * Native apps and landscape phones stay on touch.
 *
 * An explicit preference overrides automatic detection so a future settings
 * control can pin either mode without changing this resolver.
 */

export const LAPTOP_MIN_VIEWPORT_WIDTH = 1024;

export type PresentationMode = 'touch' | 'laptop';

/** `null` means automatic detection. */
export type PresentationModePreference = PresentationMode | null;

export type PointerCapability = 'fine' | 'coarse' | 'none';
export type HoverCapability = 'hover' | 'none';

export type CssInputCapabilities = {
  pointer: PointerCapability | null;
  hover: HoverCapability | null;
};

export type MatchMediaLike = (query: string) => { matches: boolean };

export type PresentationModeInput = {
  platform: string;
  viewportWidth: number;
  pointer?: PointerCapability | null;
  hover?: HoverCapability | null;
  preference?: PresentationModePreference;
};

export function readCssInputCapabilities(
  matchMedia?: MatchMediaLike | null,
): CssInputCapabilities {
  if (!matchMedia) {
    return { pointer: null, hover: null };
  }

  try {
    const pointer = matchMedia('(pointer: fine)').matches
      ? 'fine'
      : matchMedia('(pointer: coarse)').matches
        ? 'coarse'
        : matchMedia('(pointer: none)').matches
          ? 'none'
          : null;
    const hover = matchMedia('(hover: hover)').matches
      ? 'hover'
      : matchMedia('(hover: none)').matches
        ? 'none'
        : null;
    return { pointer, hover };
  } catch {
    return { pointer: null, hover: null };
  }
}

export function resolvePresentationMode(
  input: PresentationModeInput,
): PresentationMode {
  if (input.preference === 'touch' || input.preference === 'laptop') {
    return input.preference;
  }

  if (input.platform !== 'web') {
    return 'touch';
  }

  if (input.viewportWidth < LAPTOP_MIN_VIEWPORT_WIDTH) {
    return 'touch';
  }

  if (input.pointer == null || input.pointer !== 'fine') {
    return 'touch';
  }

  if (input.hover == null || input.hover !== 'hover') {
    return 'touch';
  }

  return 'laptop';
}
