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

import { DerivedSurveyView } from '@/components/derived-survey-view';
import { CommandDock } from '@/components/command-dock';
import { SvyrNavigationPage } from '@/components/svyr-navigation-page';
import { CompoundCaptureEntryPage } from '@/components/controlled-group-entry-page';
import { EvidencePhotoCapturePage } from '@/components/evidence-photo-capture-page';
import { SvyrDataEntryPanel } from '@/components/svyr-data-entry-panel';
import { inputInstructionForField } from '@/components/text-entry-page';
import { WorkspaceHeader } from '@/components/workspace-header';
import { Colors, Spacing } from '@/constants/theme';
import { useSvyrHints } from '@/hooks/use-svyr-hints';
import { useDataEntrySwipe } from '@/hooks/use-data-entry-swipe';
import type { SvyrController } from '@/hooks/use-workspace';
import type { CommandSuggestion } from '@/lib/command-parser';
import type { CompoundChildNavigation } from '@/lib/compound-child-navigation';
import { usesSingleChoicePresentation } from '@/lib/data-entry-types';
import { compoundGroupRows } from '@/lib/controlled-group';
import {
    findFieldDefinition,
    resolveFieldSetValue,
    resolveFieldValue,
} from '@/lib/field-schema';
import { buildSurveyReport } from '@/lib/report/build-survey-report';
import { HEATING_NOTES_PATH } from '@/lib/property-energy-heating';
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
 * The SVYR command console — landscape Power User only.
 *
 * One shared bottom SvyrBar (via CommandDock) is mounted for every navigation
 * and capture page. Central content changes; the bar position does not.
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
  const [heldCommandDescription, setHeldCommandDescription] = useState<
    string | null
  >(null);
  const isDataEntry = controller.inputMode === 'data-entry';
  const showPartyNotes =
    isPartyNotesPath(controller.fullCommandPath) ||
    Boolean(
      controller.activeEntryField &&
        isPartyNotesPath(controller.activeEntryField.path),
    );
  const noteEditing = showPartyNotes && notesOpen;
  const noteValue = controller.notesByPath[PARTY_NOTES_PATH] ?? '';
  const activeFieldDefinition = useMemo(
    () =>
      controller.activeEntryField
        ? findFieldDefinition(controller.activeEntryField.path)
        : null,
    [controller.activeEntryField],
  );
  const isSingleChoiceEntry = usesSingleChoicePresentation(activeFieldDefinition);
  const isMultiChoiceEntry =
    activeFieldDefinition?.valueType === 'multiSelect';
  const isChoiceCaptureEntry = isSingleChoiceEntry || isMultiChoiceEntry;
  const activeStoredValue = useMemo(() => {
    if (!activeFieldDefinition) return null;
    return resolveFieldValue(
      controller.inspectionBrief,
      activeFieldDefinition.fieldId,
    );
  }, [activeFieldDefinition, controller.inspectionBrief]);
  const compoundRows = useMemo(() => {
    if (!controller.activeCompoundCapture) return [];
    return compoundGroupRows(
      controller.activeCompoundCapture.path,
      controller.inspectionBrief,
    );
  }, [controller.activeCompoundCapture, controller.inspectionBrief]);
  const compoundNotesPath =
    controller.activeCompoundCapture?.path.join('/') === HEATING_NOTES_PATH
      ? HEATING_NOTES_PATH
      : undefined;
  /** Canonical path fed to the shared SVYR bar on every page. */
  const svyrBarPath =
    controller.activeEntryField || controller.activeCompoundCapture
      ? controller.dataEntryDirectory
      : controller.editablePath;
  const finalCommandDescription =
    controller.activeEntryField && !isChoiceCaptureEntry
      ? inputInstructionForField(controller.activeEntryField)
      : undefined;
  const activeHint = useMemo(
    () =>
      resolveActiveHint({
        inputMode: controller.inputMode,
        fullCommandPath: controller.fullCommandPath,
        editablePath: controller.editablePath,
        commandSuffix: controller.commandSuffix,
        suggestions: controller.suggestions,
        temporaryAutocompleteContent: controller.temporaryAutocompleteContent,
        notesOpen: showPartyNotes && notesOpen,
        isHintIncomplete: hints.isHintVisible,
      }),
    [
      controller.commandSuffix,
      controller.editablePath,
      controller.fullCommandPath,
      controller.inputMode,
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

  const svyrBarPathKey = svyrBarPath.join('/');
  const derivedRoute =
    !isDataEntry &&
    controller.fullCommandPath.length === 1 &&
    (controller.fullCommandPath[0] === 'summary' ||
      controller.fullCommandPath[0] === 'report')
      ? controller.fullCommandPath[0]
      : null;
  const derivedReport = useMemo(
    () => (derivedRoute ? buildSurveyReport(controller.activeJob) : null),
    [controller.activeJob, derivedRoute],
  );

  useEffect(() => {
    setHeldCommandDescription(null);
  }, [svyrBarPathKey]);

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

  const handleSelectChoice = useCallback(
    (canonicalValue: string) => {
      const field = controller.activeEntryField;
      if (!field) return;
      if (controller.commitFieldValue(field.path, canonicalValue)) {
        hints.completeHint('executeValue');
      }
    },
    [controller, hints],
  );

  const handleToggleMultiChoice = useCallback(
    (canonicalValue: string) => {
      controller.toggleMultiChoiceDraft(canonicalValue);
    },
    [controller],
  );

  const handleCommitMultiChoice = useCallback(() => {
    controller.commitMultiChoiceField();
  }, [controller]);

  const handleSwipeBackCommitted = useCallback(() => {
    hints.completeHint('swipeBack');
  }, [hints]);

  const handleNavigateUpDirectory = useCallback(() => {
    if (
      onNavigateBack &&
      controller.fullCommandPath.length === 0
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

  const [compoundChildNavigation, setCompoundChildNavigation] =
    useState<CompoundChildNavigation | null>(null);

  const handleDataEntryNavigateBack = useCallback(() => {
    if (compoundChildNavigation?.isChildActive) {
      return compoundChildNavigation.navigateBackFromChild();
    }
    return controller.cancelCurrentInteraction();
  }, [compoundChildNavigation, controller]);

  // Keyboard already owns the bottom inset when visible — avoid double padding.
  const dockBottomPad = keyboardVisible
    ? Spacing.xs
    : Math.max(insets.bottom, Spacing.xs);
  const dataEntryGesture = useDataEntrySwipe({
    enabled: isDataEntry,
    fieldKey: noteEditing
      ? PARTY_NOTES_PATH
      : compoundChildNavigation?.isChildActive && compoundChildNavigation.fieldKey
        ? compoundChildNavigation.fieldKey
        : controller.activeEntryField?.path.join('/') ?? null,
    value: noteEditing
      ? noteValue
      : compoundChildNavigation?.isChildActive
        ? compoundChildNavigation.value
        : controller.entryValue,
    onChangeText: noteEditing
      ? (value: string) => controller.setPathNote(PARTY_NOTES_PATH, value)
      : compoundChildNavigation?.isChildActive
        ? compoundChildNavigation.onChangeText
        : controller.setEntryValue,
    onNavigateBack: handleDataEntryNavigateBack,
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
          {controller.activeEvidenceCapture ? (
            <EvidencePhotoCapturePage
              target={controller.activeEvidenceCapture.target}
              inspection={controller.activeJob.inspection}
              error={controller.entryError}
              onCapturePhoto={controller.commitEvidencePhoto}
              onNavigateUpDirectory={controller.cancelCurrentInteraction}
            />
          ) : controller.activeCompoundCapture ? (
            <CompoundCaptureEntryPage
              rows={compoundRows}
              error={controller.entryError}
              notesPath={compoundNotesPath}
              notesValue={
                compoundNotesPath
                  ? controller.notesByPath[compoundNotesPath] ?? ''
                  : undefined
              }
              onChangeNotes={
                compoundNotesPath
                  ? (value) => controller.setPathNote(compoundNotesPath, value)
                  : undefined
              }
              resolveStoredValue={(field) =>
                resolveFieldValue(controller.inspectionBrief, field.fieldId)
              }
              resolveStoredSet={(field) =>
                resolveFieldSetValue(controller.inspectionBrief, field.fieldId)
              }
              onCommitScalar={controller.commitControlledFieldValue}
              onCommitSet={controller.commitControlledSetFieldValue}
              onNavigateUpDirectory={controller.cancelCurrentInteraction}
              entryDraftsByPath={controller.entryDraftsByPath}
              updateEntryDraftsByPath={controller.updateEntryDraftsByPath}
              onNavigationChange={setCompoundChildNavigation}
            />
          ) : controller.activeEntryField ? (
            <SvyrDataEntryPanel
              field={controller.activeEntryField}
              value={controller.entryValue}
              storedValue={activeStoredValue}
              multiChoiceValues={controller.activeMultiChoiceValues}
              error={controller.entryError}
              onChangeText={controller.setEntryValue}
              onSubmit={handleSubmitDataEntry}
              onSelectChoice={handleSelectChoice}
              onToggleMultiChoice={handleToggleMultiChoice}
              onCommitMultiChoice={handleCommitMultiChoice}
              onCancelEntry={controller.cancelCurrentInteraction}
              focusToken={controller.focusToken}
              heldCommandDescription={heldCommandDescription}
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
          {derivedRoute && derivedReport ? (
            <DerivedSurveyView
              mode={derivedRoute}
              report={derivedReport}
              onNavigateUpDirectory={handleNavigateUpDirectory}
              onSwipeBackCommitted={handleSwipeBackCommitted}
            />
          ) : !isDataEntry ? (
            <SvyrNavigationPage
              path={controller.editablePath}
              suggestions={controller.suggestions}
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
            path={svyrBarPath}
            onSegmentPress={controller.navigateToDataEntrySegment}
            onRootPress={controller.navigateToSvyrRoot}
            onNavigateUpDirectory={handleNavigateUpDirectory}
            onSwipeBackCommitted={handleSwipeBackCommitted}
            finalCommandDescription={finalCommandDescription}
            onFinalCommandHoldChange={setHeldCommandDescription}
            activeHintId={
              activeHint === 'selectBranch' || activeHint === 'swipeBack'
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
