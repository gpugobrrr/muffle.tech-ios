import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import { SvyrBar } from '@/components/svyr-bar';
import { SvyrHint } from '@/components/svyr-hint';
import { SvyrOutputLine } from '@/components/svyr-output-line';
import { Colors } from '@/constants/theme';
import { useDirectorySwipe } from '@/hooks/use-directory-swipe';
import type { SvyrHintId } from '@/lib/hint-repository';

type DockHintId = Extract<
  SvyrHintId,
  'selectBranch' | 'swipeBack' | 'pinPath'
>;

type Props = {
  infoBarText: string | null;
  /** Brief pin acknowledgement — takes the line only while it lives. */
  transientFeedbackText: string | null;
  /** Structural SVYR path shown in the shared bar (no free-text value). */
  path: string[];
  pinnedCommandPrefix: string[];
  canPinCurrentPath: boolean;
  isCurrentPathPinned: boolean;
  onToggleCurrentPathPin: () => void;
  /** Editable segment index relative to the unpinned path. */
  onSegmentPress?: (index: number) => void;
  /** Navigate to the editable SVYR root. */
  onRootPress?: () => void;
  /** Right-swipe: remove one editable structural directory. */
  onNavigateUpDirectory: () => boolean;
  /** Fired only after a committed swipe removes one structural segment. */
  onSwipeBackCommitted?: () => void;
  /** Temporary input guidance for the final data-entry directory token. */
  finalCommandDescription?: string;
  onFinalCommandHoldChange?: (description: string | null) => void;
  /** Single active dock-scoped hint, if any. */
  activeHintId?: DockHintId | null;
  onDismissHint?: (id: SvyrHintId) => void;
};

/**
 * Power User navigation dock — mounted at the bottom of the SVYR workspace.
 * Hosts the one shared SVYR bar for every navigation and capture page.
 */
export function CommandDock({
  infoBarText,
  transientFeedbackText,
  path,
  pinnedCommandPrefix,
  canPinCurrentPath,
  isCurrentPathPinned,
  onToggleCurrentPathPin,
  onSegmentPress,
  onRootPress,
  onNavigateUpDirectory,
  onSwipeBackCommitted,
  finalCommandDescription,
  onFinalCommandHoldChange,
  activeHintId = null,
  onDismissHint,
}: Props) {
  const handleSwipeNavigateUp = useCallback(() => {
    const removed = onNavigateUpDirectory();
    if (removed) {
      onSwipeBackCommitted?.();
    }
    return removed;
  }, [onNavigateUpDirectory, onSwipeBackCommitted]);

  const { gesture, commandLineStyle } = useDirectorySwipe(
    handleSwipeNavigateUp,
  );
  // Pin acknowledgement is transient and outranks the last execution result.
  const lineText = transientFeedbackText ?? infoBarText;
  const dismiss = onDismissHint ?? (() => undefined);

  return (
    <View style={styles.dock}>
      {lineText ? <SvyrOutputLine text={lineText} /> : null}

      <GestureDetector gesture={gesture}>
        <View style={styles.svyrGestureRegion}>
          {/*
            Path-adjacent tips sit above the command line and never claim
            permanent layout when absent. pointerEvents box-none keeps
            swipe + long-press pin available through empty regions.
          */}
          {(activeHintId === 'swipeBack' || activeHintId === 'pinPath') && (
            <View pointerEvents="box-none">
              <SvyrHint id={activeHintId} onDismiss={dismiss} />
            </View>
          )}

          {/* Only the command line carries the swipe transform. */}
          <Animated.View style={commandLineStyle}>
            <SvyrBar
              path={path}
              pinnedCommandPrefix={pinnedCommandPrefix}
              onToggleCurrentPathPin={onToggleCurrentPathPin}
              onSegmentPress={onSegmentPress}
              onRootPress={onRootPress}
              canPinCurrentPath={canPinCurrentPath}
              isCurrentPathPinned={isCurrentPathPinned}
              finalCommandDescription={finalCommandDescription}
              onFinalCommandHoldChange={onFinalCommandHoldChange}
            />
          </Animated.View>

          {/* Branch tip remains adjacent to the navigation surface. */}
          {activeHintId === 'selectBranch' ? (
            <View pointerEvents="box-none">
              <SvyrHint id="selectBranch" onDismiss={dismiss} />
            </View>
          ) : null}
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    backgroundColor: Colors.canvas,
  },
  /**
   * Capture area only: the gesture is scoped to the command line, never the
   * full screen or the info bar above.
   */
  svyrGestureRegion: {
    backgroundColor: Colors.canvas,
  },
});
