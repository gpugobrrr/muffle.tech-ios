import { Platform, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import type { DirectoryCompletion } from '@/lib/completion';

type Props = {
  completion: DirectoryCompletion;
};

/**
 * Numeric directory completion: `x / y` only.
 * No percentages, rings, bars, or status words as the primary display.
 */
export function DirectoryCompletionSurface({ completion }: Props) {
  return (
    <View style={styles.surface} pointerEvents="none">
      <View style={styles.list}>
        {completion.children.map((child) => (
          <View key={child.token} style={styles.completionRow}>
            <Text style={styles.childLabel} numberOfLines={1}>
              {child.label}
            </Text>
            <View pointerEvents="none" style={styles.completionLeader} />
            <Text style={styles.completionCount}>
              {child.completed} / {child.total}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.totalRule} />
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>
          {completion.completed} / {completion.total}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    minHeight: 0,
    paddingLeft: Spacing.xl + Spacing.md,
    paddingRight: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  list: {
    gap: Spacing.md,
  },
  completionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  childLabel: {
    flexShrink: 0,
    minWidth: 0,
    fontFamily: Fonts.sans,
    fontSize: Type.body,
    color: Colors.text,
  },
  completionLeader: {
    flex: 1,
    minWidth: 20,
    height: Platform.OS === 'web' ? 1 : StyleSheet.hairlineWidth,
    marginHorizontal: 12,
    backgroundColor: Colors.borderMuted,
    opacity: 0.35,
  },
  completionCount: {
    flexShrink: 0,
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  totalRule: {
    height: 0,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  totalLabel: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
});
