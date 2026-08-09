import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureDetector } from 'react-native-gesture-handler';

import { CommandDock } from '@/components/command-dock';
import { AutocompleteArea } from '@/components/autocomplete-area';
import { SvyrDataEntryPanel } from '@/components/svyr-data-entry-panel';
import { WorkspaceHeader } from '@/components/workspace-header';
import { Colors, Spacing } from '@/constants/theme';
import { useSvyrHints } from '@/hooks/use-svyr-hints';
import { useDataEntrySwipe } from '@/hooks/use-data-entry-swipe';
import type { SvyrController } from '@/hooks/use-workspace';
import type {
  CommandSuggestion,
  TokenSuggestion,
} from '@/lib/command-parser';
import {
    isBranchSuggestion,
    resolveActiveHint,
} from '@/lib/resolve-active-hint';
import {
    isPartyNotesPath,
    PARTY_NOTES_PATH,
} from '@/lib/svyr-notes';

export type SvyrInterfaceProps = {
  controller: SvyrController;
  onNavigateBack?: () => void;
};

/**
 * The visible top-level workflow vocabulary is intentionally broader than
 * today's canonical command graph. Future entries are presentation-only until
 * their workflows have real registry/parser handlers.
 */
const TOP_LEVEL_WORKFLOW_TOKENS = [
  'prep',
  'property',
  'external',
  'internal',
  'services',
  'structure',
  'environment',
  'grounds',
  'evidence',
  'summary',
  'report',
] as const;

function topLevelWorkflowSuggestions(
  suggestions: CommandSuggestion[],
): CommandSuggestion[] {
  const canonicalByToken = new Map(
    suggestions
      .filter(
        (suggestion): suggestion is TokenSuggestion =>
          suggestion.type === 'token',
      )
      .map((suggestion) => [suggestion.commandPath.at(-1), suggestion]),
  );

  return TOP_LEVEL_WORKFLOW_TOKENS.map((token) => {
    const canonicalSuggestion = canonicalByToken.get(token);
    if (canonicalSuggestion) return canonicalSuggestion;

    return {
      type: 'token',
      id: `future-workflow-${token}`,
      label: token,
      insertion: token,
      commandPath: [token],
      isTerminal: true,
      available: false,
      pinnable: false,
      description: 'Future workflow section — not currently available.',
    } satisfies TokenSuggestion;
  });
}

/**
 * The SVYR command console — landscape Power User only.
 *
 * The command dock remains mounted at the bottom of the workspace while
 * data entry is active; the dedicated entry panel sits above it without
 * overlaying the existing SVYR line.
 */
export function SvyrInterface({
  controller,
  onNavigateBack,
}: SvyrInterfaceProps) {
  const entrance = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const hints = useSvyrHints();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const isDataEntry = controller.inputMode === 'data-entry';
  const showPartyNotes =
    isPartyNotesPath(controller.fullCommandPath) ||
    Boolean(
      controller.activeEntryField &&
        isPartyNotesPath(controller.activeEntryField.path),
    );
  const noteEditing = showPartyNotes && notesOpen;
  const noteValue = controller.notesByPath[PARTY_NOTES_PATH] ?? '';
  const visibleSuggestions = useMemo(() => {
    const isTopLevelWorkspace =
      controller.inputMode === 'navigation' &&
      controller.commandSuffix.trim() === '' &&
      controller.pinnedCommandPrefix.length === 0;

    return isTopLevelWorkspace
      ? topLevelWorkflowSuggestions(controller.suggestions)
      : controller.suggestions;
  }, [
    controller.commandSuffix,
    controller.inputMode,
    controller.pinnedCommandPrefix.length,
    controller.suggestions,
  ]);
  const activeHint = useMemo(
    () =>
      resolveActiveHint({
        inputMode: controller.inputMode,
        fullCommandPath: controller.fullCommandPath,
        editablePath: controller.editablePath,
        pinnedCommandPrefix: controller.pinnedCommandPrefix,
        commandSuffix: controller.commandSuffix,
        suggestions: controller.suggestions,
        temporaryAutocompleteContent: controller.temporaryAutocompleteContent,
        canPinCurrentPath: controller.canPinCurrentPath,
        isCurrentPathPinned: controller.isCurrentPathPinned,
        notesOpen: showPartyNotes && notesOpen,
        isHintIncomplete: hints.isHintVisible,
      }),
    [
      controller.canPinCurrentPath,
      controller.commandSuffix,
      controller.editablePath,
      controller.fullCommandPath,
      controller.inputMode,
      controller.isCurrentPathPinned,
      controller.pinnedCommandPrefix,
      controller.suggestions,
      controller.temporaryAutocompleteContent,
      hints.isHintVisible,
      notesOpen,
      showPartyNotes,
    ],
  );

  useEffect(() => {
    if (showPartyNotes) return;
    setNotesOpen(false);
  }, [showPartyNotes]);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Leave data entry: release the keyboard so navigation stays keyboard-free.
  useEffect(() => {
    if (!isDataEntry) {
      Keyboard.dismiss();
    }
  }, [isDataEntry]);

  const handleSelectSuggestion = useCallback(
    (suggestion: CommandSuggestion) => {
      controller.selectSuggestion(suggestion);
      if (isBranchSuggestion(suggestion)) {
        hints.completeHint('selectBranch');
      }
    },
    [controller, hints],
  );

  const handleSubmitDataEntry = useCallback(() => {
    if (controller.submitDataEntry()) {
      hints.completeHint('executeValue');
    }
  }, [controller, hints]);

  const handleTogglePin = useCallback(() => {
    if (controller.toggleCurrentPathPin()) {
      hints.completeHint('pinPath');
    }
  }, [controller, hints]);

  const handleSwipeBackCommitted = useCallback(() => {
    hints.completeHint('swipeBack');
  }, [hints]);

  const handleNavigateUpDirectory = useCallback(() => {
    if (
      onNavigateBack &&
      controller.fullCommandPath.length === 1 &&
      controller.fullCommandPath[0] === 'prep'
    ) {
      onNavigateBack();
      return true;
    }
    return controller.moveUpDirectory();
  }, [controller, onNavigateBack]);

  const handleNotesOpenChange = useCallback(
    (open: boolean) => {
      setNotesOpen(open);
      if (open) {
        hints.completeHint('openNotes');
      }
    },
    [hints],
  );

  const handleResetHints = useCallback(() => {
    void hints.resetHints();
  }, [hints]);

  // Keyboard already owns the bottom inset when visible — avoid double padding.
  const dockBottomPad = keyboardVisible
    ? Spacing.xs
    : Math.max(insets.bottom, Spacing.xs);
  const dataEntryGesture = useDataEntrySwipe({
    enabled: isDataEntry,
    fieldKey: noteEditing
      ? PARTY_NOTES_PATH
      : controller.activeEntryField?.path.join('/') ?? null,
    value: noteEditing ? noteValue : controller.entryValue,
    onChangeText: noteEditing
      ? (value: string) => controller.setPathNote(PARTY_NOTES_PATH, value)
      : controller.setEntryValue,
    onNavigateBack: controller.cancelCurrentInteraction,
  });

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  return (
    <Animated.View
      style={[
        styles.flex,
        {
          opacity: entrance,
          transform: [
            {
              translateY: entrance.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0],
              }),
            },
          ],
        },
      ]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
        <GestureDetector gesture={dataEntryGesture}>
          <View style={styles.shell}>
        <View style={styles.headerPad}>
          <WorkspaceHeader
            property={controller.activeJob?.property}
            onPressBackground={Keyboard.dismiss}
            onResetInteractionHints={handleResetHints}
          />
        </View>

        {/* Party notes live in the active field content column. */}
        <View style={styles.stageSpacer}>
          {controller.activeEntryField ? (
            <SvyrDataEntryPanel
              field={controller.activeEntryField}
              value={controller.entryValue}
              error={controller.entryError}
              onChangeText={controller.setEntryValue}
              onSubmit={handleSubmitDataEntry}
              onCancelEntry={controller.cancelCurrentInteraction}
              focusToken={controller.focusToken}
              pinnedCommandPrefix={controller.pinnedCommandPrefix}
              svyrDirectory={controller.dataEntryDirectory}
              canPinCurrentPath={controller.canPinCurrentPath}
              isCurrentPathPinned={controller.isCurrentPathPinned}
              onToggleCurrentPathPin={handleTogglePin}
              onSegmentPress={controller.navigateToDataEntrySegment}
              noteEditing={noteEditing}
              noteValue={noteValue}
              onChangeNote={(value) =>
                controller.setPathNote(PARTY_NOTES_PATH, value)
              }
              activeHintId={
                activeHint === 'executeValue' ? 'executeValue' : null
              }
              onDismissHint={hints.dismissHint}
            />
          ) : null}
          {!isDataEntry ? (
            <AutocompleteArea
              suggestions={visibleSuggestions}
              temporaryContent={controller.temporaryAutocompleteContent}
              onApplySuggestion={handleSelectSuggestion}
              onNavigateUpDirectory={handleNavigateUpDirectory}
              onSwipeBackCommitted={handleSwipeBackCommitted}
            />
          ) : null}
        </View>

        <View style={[styles.commandDock, { paddingBottom: dockBottomPad }]}>
          <CommandDock
            infoBarText={controller.infoBarText}
            transientFeedbackText={controller.transientFeedbackText}
            editablePath={controller.editablePath}
            pinnedCommandPrefix={controller.pinnedCommandPrefix}
            canPinCurrentPath={controller.canPinCurrentPath}
            isCurrentPathPinned={controller.isCurrentPathPinned}
            onToggleCurrentPathPin={handleTogglePin}
            onNavigateUpDirectory={handleNavigateUpDirectory}
            onSwipeBackCommitted={handleSwipeBackCommitted}
            dataEntryActive={Boolean(controller.activeEntryField)}
            showTerminal={!controller.activeEntryField}
            activeHintId={
              activeHint === 'selectBranch' ||
              activeHint === 'swipeBack' ||
              activeHint === 'pinPath'
                ? activeHint
                : null
            }
            onDismissHint={hints.dismissHint}
          />
        </View>
          </View>
        </GestureDetector>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  shell: {
    flex: 1,
    paddingTop: Spacing.md,
    backgroundColor: Colors.canvas,
  },
  headerPad: {
    marginBottom: Spacing.sm,
  },
  /** Remaining workspace above the dock — no fake keyboard spacer. */
  stageSpacer: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  /** Sits above unrelated content so suggestions always receive touches. */
  commandDock: {
    zIndex: 10,
  },
});
