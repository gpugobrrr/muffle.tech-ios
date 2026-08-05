import { useCallback, useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CommandDock } from '@/components/command-dock';
import { WorkspaceHeader } from '@/components/workspace-header';
import { Colors, Spacing } from '@/constants/theme';
import type { SvyrController } from '@/hooks/use-workspace';

export type SvyrInterfaceProps = {
  controller: SvyrController;
};

/**
 * The SVYR command console. Orientation changes the available height only —
 * command state, registry, parser, and autocomplete are identical in both.
 */
export function SvyrInterface({ controller }: SvyrInterfaceProps) {
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

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

  const focusTerminal = useCallback(() => {
    controller.requestTerminalFocus();
  }, [controller]);

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
          <WorkspaceHeader onPressBackground={focusTerminal} />
        </View>

        <Pressable
          onPress={focusTerminal}
          accessibilityRole="none"
          style={styles.stageSpacer}
        />

        <View style={[styles.commandDock, { paddingBottom: dockBottomPad }]}>
          <CommandDock
            infoBarText={controller.infoBarText}
            commandSuffix={controller.commandSuffix}
            onChangeSuffix={controller.setCommandSuffix}
            pinnedCommandPrefix={controller.pinnedCommandPrefix}
            focusToken={controller.focusToken}
            persistFocus
            autocompleteSuggestions={controller.suggestions}
            temporaryAutocompleteContent={
              controller.temporaryAutocompleteContent
            }
            pinState={controller.pinState}
            onRun={controller.submitCommand}
            onDeletePreviousPart={controller.deletePreviousPart}
            onApplySuggestion={controller.selectSuggestion}
            onTogglePin={controller.togglePin}
            onNavigateUpDirectory={controller.moveUpDirectory}
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
    paddingHorizontal: Spacing.xl,
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
