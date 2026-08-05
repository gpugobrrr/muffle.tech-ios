import { GestureDetector } from 'react-native-gesture-handler';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AutocompleteArea } from '@/components/autocomplete-area';
import { SvyrOutputLine } from '@/components/svyr-output-line';
import { WorkspaceTerminal } from '@/components/workspace-terminal';
import { Colors } from '@/constants/theme';
import { useDirectorySwipe } from '@/hooks/use-directory-swipe';
import type { CommandSuggestion } from '@/lib/command-parser';
import { formatCommandPath } from '@/lib/command-registry';
import type { PinState } from '@/lib/pin-context';

type Props = {
  infoBarText: string | null;
  commandSuffix: string;
  onChangeSuffix: (value: string) => void;
  pinnedCommandPrefix: string[];
  focusToken: number;
  persistFocus?: boolean;
  autocompleteSuggestions: CommandSuggestion[];
  temporaryAutocompleteContent: string | null;
  pinState: PinState;
  onRun: () => void;
  onDeletePreviousPart: () => void;
  onApplySuggestion: (suggestion: CommandSuggestion) => void;
  onTogglePin: () => void;
  /** Right-swipe: remove one editable structural directory. */
  onNavigateUpDirectory: () => boolean;
};

/**
 * SVYR command dock:
 * optional single-line output → SVYR > → contextual autocomplete + pin.
 * Right-swipe on the gesture region moves up one command directory.
 */
export function CommandDock({
  infoBarText,
  commandSuffix,
  onChangeSuffix,
  pinnedCommandPrefix,
  focusToken,
  persistFocus = false,
  autocompleteSuggestions,
  temporaryAutocompleteContent,
  pinState,
  onRun,
  onDeletePreviousPart,
  onApplySuggestion,
  onTogglePin,
  onNavigateUpDirectory,
}: Props) {
  const { gesture, animatedStyle } = useDirectorySwipe(onNavigateUpDirectory);

  return (
    <View style={styles.dock}>
      {infoBarText ? <SvyrOutputLine text={infoBarText} /> : null}

      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.svyrGestureRegion, animatedStyle]}>
          <WorkspaceTerminal
            value={commandSuffix}
            onChangeText={onChangeSuffix}
            onRun={onRun}
            onDeletePreviousPart={onDeletePreviousPart}
            pinnedCommandPrefix={pinnedCommandPrefix}
            focusToken={focusToken}
            persistFocus={persistFocus}
            autoFocus={persistFocus}
          />

          <AutocompleteArea
            suggestions={autocompleteSuggestions}
            temporaryContent={temporaryAutocompleteContent}
            pinState={pinState}
            pinnedPrefixLabel={formatCommandPath(pinnedCommandPrefix)}
            onApplySuggestion={onApplySuggestion}
            onTogglePin={onTogglePin}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    backgroundColor: Colors.canvas,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  /**
   * Gesture is scoped to the command line + autocomplete only —
   * not the full screen, and not the info bar above.
   */
  svyrGestureRegion: {
    backgroundColor: Colors.canvas,
  },
});
