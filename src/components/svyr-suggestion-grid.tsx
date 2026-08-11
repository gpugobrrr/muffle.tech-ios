import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';

type Props = {
  children: ReactNode;
  /** Optional top inset for ergonomic thumb reach in landscape. */
  paddingTop?: number;
};

/**
 * Layout-only two-column suggestion grid. Presentation (brackets vs parentheses)
 * is owned by the item renderer passed as children.
 */
export function SvyrSuggestionGrid({ children, paddingTop = 0 }: Props) {
  return (
    <View style={[styles.autocompleteRow, { paddingTop }]}>
      <View style={styles.suggestionsWrap}>{children}</View>
    </View>
  );
}

type ColumnProps = {
  children: ReactNode;
};

export function SvyrSuggestionColumn({ children }: ColumnProps) {
  return <View style={styles.suggestionColumn}>{children}</View>;
}

const styles = StyleSheet.create({
  autocompleteRow: {
    flex: 1,
    width: '100%',
  },
  suggestionsWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  suggestionColumn: {
    width: '32%',
    gap: Spacing.xs,
  },
});
