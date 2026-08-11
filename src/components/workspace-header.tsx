import { Alert, Pressable, StyleSheet, Text } from 'react-native';

import { Colors, Fonts, Spacing } from '@/constants/theme';
import { getCompactPropertyLabel } from '@/lib/property-label';
import type { ActiveProperty } from '@/types/workspace';

type Props = {
  property?: ActiveProperty | null;
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
  property,
  onPressBackground,
  onResetInteractionHints,
}: Props) {
  const propertyLabel = getCompactPropertyLabel(property);

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
      {propertyLabel ? (
        <Text
          style={styles.propertyAddress}
          numberOfLines={1}
          accessibilityRole="text"
          accessibilityLabel={`Active property ${propertyLabel}`}>
          {propertyLabel}
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
