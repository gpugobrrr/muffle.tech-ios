import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import { formatSvyrCommandForDisplay } from '@/lib/command-registry';

type Props = {
  /** Shared canonical command text. Internal separators remain ASCII `/`. */
  commandText: string;
};

/**
 * Read-only SVYR directory bar for portrait learner mode.
 * Never focuses, never opens the keyboard, never accepts typing.
 */
export function PortraitSvyrDirectory({ commandText }: Props) {
  const displayText = formatSvyrCommandForDisplay(commandText);

  return (
    <View
      style={styles.portraitSvyrDirectory}
      accessibilityRole="text"
      accessibilityLabel={
        commandText
          ? `SVYR command path ${commandText}`
          : 'SVYR command path empty'
      }>
      <Text style={styles.portraitSvyrPrompt}>SVYR {'>'}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.portraitSvyrPath}
        keyboardShouldPersistTaps="handled">
        {displayText ? (
          <Text numberOfLines={1} style={styles.portraitSvyrPathText}>
            {displayText}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  portraitSvyrDirectory: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  portraitSvyrPrompt: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: Colors.text,
    marginRight: Spacing.sm,
  },
  portraitSvyrPath: {
    alignItems: 'center',
    paddingRight: Spacing.md,
  },
  portraitSvyrPathText: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: Colors.textSecondary,
  },
});
