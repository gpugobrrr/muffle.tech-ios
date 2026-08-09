import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import { SvyrHint } from '@/components/svyr-hint';
import { SvyrOutputLine } from '@/components/svyr-output-line';
import { WorkspaceTerminal } from '@/components/workspace-terminal';
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
  editablePath: string[];
  pinnedCommandPrefix: string[];
  canPinCurrentPath: boolean;
  isCurrentPathPinned: boolean;
  onToggleCurrentPathPin: () => void;
  /** Right-swipe: remove one editable structural directory. */
  onNavigateUpDirectory: () => boolean;
  /** Fired only after a committed swipe removes one structural segment. */
  onSwipeBackCommitted?: () => void;
  /** The full-width dock becomes the data-entry surface when active. */
  dataEntryActive?: boolean;
  /** Data entry renders the same path inside its darker entry surface. */
  showTerminal?: boolean;
  /** Single active dock-scoped hint, if any. */
  activeHintId?: DockHintId | null;
  onDismissHint?: (id: SvyrHintId) => void;
};

/**
 * Power User navigation dock — mounted at the bottom of the SVYR workspace.
 * Optional result → SVYR > navigation line. No permanent controls;
 * long-press pins, swipe moves up one directory.
 */
export function CommandDock({
  infoBarText,
  transientFeedbackText,
  editablePath,
  pinnedCommandPrefix,
  canPinCurrentPath,
  isCurrentPathPinned,
  onToggleCurrentPathPin,
  onNavigateUpDirectory,
  onSwipeBackCommitted,
  dataEntryActive = false,
  showTerminal = true,
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
    <View style={[styles.dock, dataEntryActive && styles.dataEntryDock]}>
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
          {showTerminal ? (
            <Animated.View style={commandLineStyle}>
              <WorkspaceTerminal
                editablePath={editablePath}
                pinnedCommandPrefix={pinnedCommandPrefix}
                onToggleCurrentPathPin={onToggleCurrentPathPin}
                canPinCurrentPath={canPinCurrentPath}
                isCurrentPathPinned={isCurrentPathPinned}
              />
            </Animated.View>
          ) : null}

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
  dataEntryDock: {
    width: '100%',
    backgroundColor: Colors.surface,
  },
  /**
   * Capture area only: the gesture is scoped to the command line, never the
   * full screen or the info bar above.
   */
  svyrGestureRegion: {
    backgroundColor: Colors.canvas,
  },
});
