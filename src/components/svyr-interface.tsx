import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CommandDock } from '@/components/command-dock';
import { DirectoryCompletionSurface } from '@/components/directory-completion-surface';
import { PartyNotesSurface } from '@/components/party-notes-surface';
import { SvyrDataEntryPanel } from '@/components/svyr-data-entry-panel';
import { WorkspaceHeader } from '@/components/workspace-header';
import { Colors, Spacing } from '@/constants/theme';
import { useSvyrHints } from '@/hooks/use-svyr-hints';
import type { SvyrController } from '@/hooks/use-workspace';
import type { CommandSuggestion } from '@/lib/command-parser';
import { resolveDirectoryCompletion } from '@/lib/completion';
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
};

/**
 * The SVYR command console — landscape Power User only.
 *
 * The command dock remains mounted at the bottom of the workspace while
 * data entry is active; the dedicated entry panel sits above it without
 * overlaying the existing SVYR line.
 */
export function SvyrInterface({ controller }: SvyrInterfaceProps) {
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
  const directoryCompletion = useMemo(
    () =>
      showPartyNotes
        ? null
        : resolveDirectoryCompletion(
            controller.fullCommandPath,
            controller.inspectionBrief,
          ),
    [
      controller.fullCommandPath,
      controller.inspectionBrief,
      showPartyNotes,
    ],
  );
  /**
   * The underline marks the active suggestion group while a command must be
   * chosen: navigation only,
   * keyboard down, suggestions present, and no guidance replacing them.
   */
  const showReadyUnderline =
    !isDataEntry &&
    !keyboardVisible &&
    controller.temporaryAutocompleteContent === null &&
    controller.suggestions.length > 0;

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

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}>
      <View style={styles.shell}>
        <View style={styles.headerPad}>
          <WorkspaceHeader
            address={controller.activeJob?.property?.displayAddress}
            onPressBackground={Keyboard.dismiss}
            onResetInteractionHints={handleResetHints}
          />
        </View>

        {/*
          Workspace above the dock: directories show numeric x / y completion.
          Party notes live in the active field content column.
        */}
        <View style={styles.stageSpacer}>
          {!showPartyNotes && directoryCompletion ? (
            <DirectoryCompletionSurface completion={directoryCompletion} />
          ) : null}
        </View>

        <View style={[styles.commandDock, { paddingBottom: dockBottomPad }]}>
          {controller.activeEntryField ? (
            <SvyrDataEntryPanel
              field={controller.activeEntryField}
              value={controller.entryValue}
              error={controller.entryError}
              onChangeText={controller.setEntryValue}
              onSubmit={handleSubmitDataEntry}
              onDeletePreviousPart={controller.deletePreviousPart}
              onCancelEntry={controller.cancelCurrentInteraction}
              focusToken={controller.focusToken}
              pinnedCommandPrefix={controller.pinnedCommandPrefix}
              editablePath={controller.editablePath}
              canPinCurrentPath={controller.canPinCurrentPath}
              isCurrentPathPinned={controller.isCurrentPathPinned}
              onToggleCurrentPathPin={handleTogglePin}
              notesSurface={
                showPartyNotes ? (
                  <PartyNotesSurface
                    active
                    inline
                    note={controller.notesByPath[PARTY_NOTES_PATH] ?? ''}
                    onChangeNote={(value) =>
                      controller.setPathNote(PARTY_NOTES_PATH, value)
                    }
                    onEditorClosed={controller.requestTerminalFocus}
                    onOpenChange={handleNotesOpenChange}
                  />
                ) : null
              }
              activeHintId={
                activeHint === 'executeValue' ? 'executeValue' : null
              }
              onDismissHint={hints.dismissHint}
            />
          ) : null}

          <CommandDock
            infoBarText={controller.infoBarText}
            transientFeedbackText={controller.transientFeedbackText}
            editablePath={controller.editablePath}
            pinnedCommandPrefix={controller.pinnedCommandPrefix}
            canPinCurrentPath={controller.canPinCurrentPath}
            isCurrentPathPinned={controller.isCurrentPathPinned}
            onToggleCurrentPathPin={handleTogglePin}
            autocompleteSuggestions={
              controller.activeEntryField ? [] : controller.suggestions
            }
            temporaryAutocompleteContent={
              controller.activeEntryField
                ? null
                : controller.temporaryAutocompleteContent
            }
            showCommandReadyUnderline={showReadyUnderline}
            onApplySuggestion={handleSelectSuggestion}
            onNavigateUpDirectory={controller.moveUpDirectory}
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
    </KeyboardAvoidingView>
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
  },
  /** Sits above unrelated content so suggestions always receive touches. */
  commandDock: {
    zIndex: 10,
  },
});
