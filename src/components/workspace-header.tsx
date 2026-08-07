import { Alert, Pressable, StyleSheet, Text } from 'react-native';

import { Colors, Fonts, Spacing } from '@/constants/theme';

type Props = {
  /** Active property street address — empty when none is recorded. */
  address?: string | null;
  onPressBackground?: () => void;
  /**
   * Secondary overflow action — long-press the address (or empty header)
   * to reset one-time interaction hints. Never a prominent Help control.
   */
  onResetInteractionHints?: () => void;
};

/**
 * Compact landscape workspace header — property address only, top-left.
 * No branding, identity, subtitle, or right-side content.
 */
export function WorkspaceHeader({
  address,
  onPressBackground,
  onResetInteractionHints,
}: Props) {
  const propertyAddress = address?.trim() ?? '';

  const openOverflow = () => {
    if (!onResetInteractionHints) return;
    Alert.alert('Workspace', undefined, [
      {
        text: 'Reset interaction hints',
        onPress: onResetInteractionHints,
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <Pressable
      onPress={onPressBackground}
      onLongPress={onResetInteractionHints ? openOverflow : undefined}
      delayLongPress={500}
      accessibilityRole="none"
      accessibilityHint={
        onResetInteractionHints
          ? 'Long press for workspace options'
          : undefined
      }
      style={styles.workspaceHeader}>
      {propertyAddress ? (
        <Text
          style={styles.propertyAddress}
          numberOfLines={1}
          accessibilityRole="text"
          accessibilityLabel={`Active property ${propertyAddress}`}>
          {propertyAddress}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  workspaceHeader: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.sm,
  },
  propertyAddress: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    textAlign: 'left',
  },
});
