import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AutocompleteArea } from '@/components/autocomplete-area';
import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import type { FieldDefinition } from '@/lib/field-schema';
import {
  buildSingleChoiceSuggestions,
  type SingleChoiceSuggestion,
} from '@/lib/single-choice';

type Props = {
  fieldDefinition: FieldDefinition;
  currentValue: string | null;
  error: string | null;
  onSelectValue: (canonicalValue: string) => void;
  onNavigateUpDirectory: () => boolean;
};

/**
 * Tap-only controlled capture using the same sparse suggestion surface as
 * structural SVYR navigation. Path chrome lives exclusively in the shared
 * bottom command dock — this page never renders a breadcrumb of its own.
 */
export function SingleChoiceEntryPage({
  fieldDefinition,
  currentValue,
  error,
  onSelectValue,
  onNavigateUpDirectory,
}: Props) {
  const suggestions = useMemo(
    () => buildSingleChoiceSuggestions(fieldDefinition, currentValue),
    [currentValue, fieldDefinition],
  );

  const handleSelect = (suggestion: SingleChoiceSuggestion) => {
    if (!suggestion.available) return;
    onSelectValue(suggestion.canonicalValue);
  };

  return (
    <View style={styles.page}>
      {error ? (
        <Text
          style={styles.error}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <AutocompleteArea
        suggestions={suggestions}
        onApplySuggestion={handleSelect}
        onNavigateUpDirectory={onNavigateUpDirectory}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    position: 'relative',
  },
  error: {
    position: 'absolute',
    top: 0,
    right: Spacing.xxl,
    left: Spacing.xxl,
    zIndex: 1,
    textAlign: 'center',
    fontFamily: Fonts.mono,
    fontSize: Type.label,
    color: Colors.danger,
    letterSpacing: 0.4,
  },
});
