import { Platform, useWindowDimensions } from 'react-native';

import {
  readCssInputCapabilities,
  resolvePresentationMode,
  type PresentationMode,
  type PresentationModePreference,
} from '@/lib/presentation-mode';

function browserMatchMedia():
  | ((query: string) => { matches: boolean })
  | null {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return null;
  }
  return (query: string) => window.matchMedia(query);
}

/**
 * Resolve touch vs laptop chrome from live viewport signals.
 * Pass `preference` later to override automatic detection; no settings UI yet.
 */
export function usePresentationMode(
  preference: PresentationModePreference = null,
): PresentationMode {
  const { width } = useWindowDimensions();
  const capabilities = readCssInputCapabilities(browserMatchMedia());

  return resolvePresentationMode({
    platform: Platform.OS,
    viewportWidth: width,
    pointer: capabilities.pointer,
    hover: capabilities.hover,
    preference,
  });
}
