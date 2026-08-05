import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOutRight,
  LinearTransition,
} from 'react-native-reanimated';

import { PortraitSvyrDirectory } from '@/components/portrait-svyr-directory';
import { SvyrOutputLine } from '@/components/svyr-output-line';
import { WorkspaceHeader } from '@/components/workspace-header';
import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import {
  findCommandNode,
  formatCommandPath,
  formatSvyrPathForDisplay,
  isBranchNode,
  learnerDisplayLabel,
  parseSvyrInput,
  type CommandNode,
} from '@/lib/command-registry';
import type { SvyrController } from '@/hooks/use-workspace';
import { useDirectorySwipe } from '@/hooks/use-directory-swipe';
import {
  tokenSuggestions,
  type CommandSuggestion,
  type TokenSuggestion,
} from '@/lib/command-parser';

const ACCENT_WIDTH = 2;
/** Learner hierarchy transition — deep enough to read, short enough to feel direct. */
const LEARNER_ENTER_MS = 160;
const LEARNER_EXIT_MS = 140;
const LEARNER_LAYOUT_MS = 180;

type Props = {
  controller: SvyrController;
};

/**
 * Portrait / Guided Mode — touch-first learner interface.
 * Large options navigate the shared command registry; the SVYR bar is read-only.
 */
export function PortraitLearnerWorkspace({ controller }: Props) {
  // Same recognition and same shared action as the Power User dock.
  const { gesture, animatedStyle } = useDirectorySwipe(
    controller.moveUpDirectory,
  );

  return (
    <View style={styles.shell}>
      <View style={styles.headerPad}>
        <WorkspaceHeader onPressBackground={Keyboard.dismiss} />
      </View>

      {controller.infoBarText ? (
        <SvyrOutputLine text={controller.infoBarText} />
      ) : null}

      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.learnerGestureRegion, animatedStyle]}>
          <PortraitSvyrDirectory commandText={controller.fullCommandText} />

          <View style={styles.workspaceStage}>
            <PortraitLearnerArea
              commandPath={controller.fullCommandPath}
              commandSuffix={controller.commandSuffix}
              suggestions={controller.suggestions}
              onCommandChange={controller.setCommandSuffix}
              onSuggestionPress={controller.selectSuggestion}
              onMoveUpDirectory={controller.moveUpDirectory}
              onSubmit={controller.submitCommand}
            />
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

type PortraitLearnerAreaProps = {
  commandPath: string[];
  commandSuffix: string;
  suggestions: CommandSuggestion[];
  onCommandChange: (value: string) => void;
  onSuggestionPress: (suggestion: CommandSuggestion) => void;
  onMoveUpDirectory: () => boolean;
  onSubmit: () => void;
};

/**
 * Grey portrait teaching surface. Every command-facing prop comes directly
 * from the shared SVYR controller; local state is presentation-only.
 */
export function PortraitLearnerArea({
  commandPath,
  commandSuffix,
  suggestions,
  onCommandChange,
  onSuggestionPress,
  onMoveUpDirectory,
  onSubmit,
}: PortraitLearnerAreaProps) {
  const currentNode =
    commandPath.length === 0 ? null : findCommandNode(commandPath);
  // Shared projection — never a portrait-specific list or fallback.
  const options = tokenSuggestions(suggestions);
  const isValueEntry = Boolean(currentNode?.requiresValue);
  /**
   * Only the structural directory keys the transition, so typing a value
   * never remounts the field entry.
   */
  const directoryKey = `${formatCommandPath(commandPath)}#${
    isValueEntry ? 'value' : 'options'
  }`;

  return (
    <View style={styles.learnerArea}>
      <View pointerEvents="none" style={styles.panelAccentRail} />
      <View style={styles.panelBody}>
        <View style={styles.panelChrome}>
          <View style={styles.contextBlock}>
            <Text style={styles.panelLabel}>
              {currentNode ? currentNode.token.toUpperCase() : 'WORKSPACE'}
            </Text>
            {commandPath.length > 0 ? (
              <Text numberOfLines={1} style={styles.hierarchyPath}>
                {formatSvyrPathForDisplay(formatCommandPath(commandPath))}
              </Text>
            ) : null}
          </View>
          {commandPath.length > 0 ? (
            <Pressable
              onPress={onMoveUpDirectory}
              accessibilityRole="button"
              accessibilityLabel="Go back one command directory"
              hitSlop={8}
              style={({ pressed }) => [
                styles.backBtn,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.backText}>BACK</Text>
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.panelContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}>
          {/*
            Keyed by the shared directory: the previous depth fades out to the
            right while the new options fade in. The panel chrome above stays
            stationary, and the shared state changes immediately.
          */}
          <Animated.View
            key={directoryKey}
            entering={FadeIn.duration(LEARNER_ENTER_MS)}
            exiting={FadeOutRight.duration(LEARNER_EXIT_MS)}
            layout={LinearTransition.duration(LEARNER_LAYOUT_MS)}>
            {isValueEntry && currentNode ? (
              <LearnerFieldEntry
                commandPath={commandPath}
                commandSuffix={commandSuffix}
                node={currentNode}
                onCommandChange={onCommandChange}
                onSubmit={onSubmit}
              />
            ) : options.length > 0 ? (
              <View style={styles.optionList}>
                {options.map((suggestion) => {
                  const node = findCommandNode(suggestion.commandPath);
                  if (!node) return null;

                  return (
                    <LearnerOptionRow
                      key={suggestion.id}
                      node={node}
                      suggestion={suggestion}
                      onPress={onSuggestionPress}
                    />
                  );
                })}
              </View>
            ) : currentNode ? (
              <UnimplementedLeaf node={currentNode} />
            ) : null}
          </Animated.View>
        </ScrollView>
      </View>
    </View>
  );
}

function LearnerOptionRow({
  node,
  suggestion,
  onPress,
}: {
  node: CommandNode;
  suggestion: TokenSuggestion;
  onPress: (suggestion: TokenSuggestion) => void;
}) {
  const accessibleTitle = learnerDisplayLabel(node);

  return (
    <Pressable
      onPress={() => onPress(suggestion)}
      accessibilityRole="button"
      accessibilityLabel={`${accessibleTitle}. Command ${suggestion.label}.`}
      style={({ pressed }) => [styles.optionRow, pressed && styles.pressed]}>
      <View style={styles.optionHeader}>
        <Text style={styles.optionTitle}>{suggestion.label}</Text>
      </View>
      <View style={styles.optionRule} />
      <Text style={styles.optionDetail}>{node.description}</Text>
      {isBranchNode(node) || node.requiresValue ? (
        <Text style={styles.optionHint}>
          {node.requiresValue ? 'ENTER VALUE' : 'OPEN'}
        </Text>
      ) : null}
    </Pressable>
  );
}

function LearnerFieldEntry({
  commandPath,
  commandSuffix,
  node,
  onCommandChange,
  onSubmit,
}: {
  commandPath: string[];
  commandSuffix: string;
  node: CommandNode;
  onCommandChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const parsedInput = parseSvyrInput(commandSuffix);
  const draft = parsedInput.value;
  const title = learnerDisplayLabel(node);
  const hasDraft = draft.trim().length > 0;
  const canRead = Boolean(node.readOperationId);
  const canSubmit = hasDraft || canRead;
  const actionLabel = hasDraft ? 'SAVE' : 'READ';

  if (!node.operationId && !node.readOperationId) {
    return (
      <View style={styles.fieldSection}>
        <Text style={styles.fieldTitle}>{node.label}</Text>
        <Text style={styles.fieldDetail}>{node.description}</Text>
        <Text style={styles.placeholder}>WORKFLOW NOT YET IMPLEMENTED</Text>
      </View>
    );
  }

  return (
    <View style={styles.fieldSection}>
      <Text style={styles.fieldTitle}>{node.label}</Text>
      <Text style={styles.fieldDetail}>{node.description}</Text>
      <TextInput
        value={draft}
        onChangeText={(value) => {
          const structuralPath =
            parsedInput.rawPath || formatCommandPath(commandPath);
          onCommandChange(
            value.length > 0 ? `${structuralPath} ${value}` : structuralPath,
          );
        }}
        placeholder={node.valuePrompt ?? `Enter ${title.toLowerCase()}`}
        placeholderTextColor={Colors.textMuted}
        autoCapitalize="words"
        autoCorrect
        returnKeyType="done"
        onSubmitEditing={() => {
          if (canSubmit) onSubmit();
        }}
        style={styles.fieldInput}
        accessibilityLabel={title}
      />
      <Pressable
        disabled={!canSubmit}
        onPress={onSubmit}
        accessibilityRole="button"
        accessibilityLabel={`${actionLabel} ${title}`}
        style={({ pressed }) => [
          styles.saveBtn,
          !canSubmit && styles.saveBtnDisabled,
          pressed && canSubmit && styles.pressed,
        ]}>
        <Text style={[styles.saveText, !canSubmit && styles.saveTextDisabled]}>
          {actionLabel}
        </Text>
      </Pressable>
    </View>
  );
}

function UnimplementedLeaf({ node }: { node: CommandNode }) {
  return (
    <View style={styles.fieldSection}>
      <Text style={styles.fieldTitle}>{node.label}</Text>
      <Text style={styles.fieldDetail}>{node.description}</Text>
      <Text style={styles.placeholder}>WORKFLOW NOT YET IMPLEMENTED</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  headerPad: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  flex: {
    flex: 1,
  },
  /** Swipe region: SVYR directory bar + learner panel, never the whole screen. */
  learnerGestureRegion: {
    flex: 1,
  },
  workspaceStage: {
    flex: 1,
    minHeight: 180,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    alignItems: 'flex-start',
  },
  learnerArea: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  panelAccentRail: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: ACCENT_WIDTH,
    backgroundColor: Colors.accent,
    zIndex: 1,
  },
  panelBody: {
    flex: 1,
    paddingLeft: ACCENT_WIDTH,
  },
  panelChrome: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    minHeight: 44,
  },
  contextBlock: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.xs,
  },
  panelLabel: {
    fontFamily: Fonts.sans,
    fontSize: Type.label,
    fontWeight: '600',
    color: Colors.text,
    letterSpacing: 1.4,
  },
  hierarchyPath: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: Colors.textSecondary,
  },
  backBtn: {
    minHeight: 32,
    paddingHorizontal: Spacing.sm,
    justifyContent: 'center',
  },
  backText: {
    fontFamily: Fonts.mono,
    fontSize: Type.label,
    color: Colors.accent,
    letterSpacing: 1.2,
  },
  panelContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  optionList: {
    gap: Spacing.md,
  },
  optionRow: {
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  optionTitle: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    letterSpacing: 0.2,
  },
  optionRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderMuted,
  },
  optionDetail: {
    fontFamily: Fonts.sans,
    fontSize: Type.body,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  optionHint: {
    fontFamily: Fonts.mono,
    fontSize: Type.label,
    color: Colors.accent,
    letterSpacing: 1,
    marginTop: Spacing.xs,
  },
  fieldSection: {
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  fieldTitle: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  fieldDetail: {
    fontFamily: Fonts.sans,
    fontSize: Type.body,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  fieldInput: {
    marginTop: Spacing.md,
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontFamily: Fonts.sans,
    fontSize: 16,
    color: Colors.text,
  },
  saveBtn: {
    alignSelf: 'flex-start',
    marginTop: Spacing.md,
    minHeight: 44,
    paddingHorizontal: Spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.45,
  },
  saveText: {
    fontFamily: Fonts.mono,
    fontSize: Type.label,
    color: Colors.accent,
    letterSpacing: 1.2,
  },
  saveTextDisabled: {
    color: Colors.textMuted,
  },
  placeholder: {
    marginTop: Spacing.md,
    fontFamily: Fonts.mono,
    fontSize: Type.label,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
