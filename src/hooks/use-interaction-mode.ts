/**
 * Orientation is the sole determinant of interaction mode.
 * Portrait → Guided learner. Landscape → Power User (CLI).
 */
import { useWindowDimensions } from 'react-native';

export function useInteractionMode() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  return {
    width,
    height,
    isLandscape,
    isPowerUserMode: isLandscape,
  };
}
