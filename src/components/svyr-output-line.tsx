import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Spacing, Type } from '@/constants/theme';

type Props = {
  text: string;
};

/**
 * Compact single-line SVYR output above the command prompt.
 * Collapses entirely when unused — never a card or multi-line panel.
 */
export function SvyrOutputLine({ text }: Props) {
  return (
    <View style={styles.svyrOutputLine}>
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={styles.svyrOutputText}
        accessibilityRole="text"
        accessibilityLabel={text}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  svyrOutputLine: {
    height: 28,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  svyrOutputText: {
    fontFamily: Fonts.mono,
    fontSize: Type.body,
    color: Colors.textSecondary,
  },
});
