import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AutocompleteArea } from '@/components/autocomplete-area';
import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import type { FieldDefinition } from '@/lib/field-schema';
import {
  buildMultiChoiceSuggestions,
  type MultiChoiceSuggestion,
} from '@/lib/multi-choice';

type Props = {
  fieldDefinition: FieldDefinition;
  selectedValues: readonly string[];
  error: string | null;
  onToggleValue: (canonicalValue: string) => void;
  onCommit: () => void;
  onNavigateUpDirectory: () => boolean;
};

/**
 * Toggle multi-select capture on the shared sparse suggestion surface.
 * Path chrome lives in CommandDock/SvyrBar — this page never renders a bar.
 * Commit is explicit via [done]; toggles never Engine-write.
 */
export function MultiChoiceEntryPage({
  fieldDefinition,
  selectedValues,
  error,
  onToggleValue,
  onCommit,
  onNavigateUpDirectory,
}: Props) {
  const suggestions = useMemo(
    () => buildMultiChoiceSuggestions(fieldDefinition, selectedValues),
    [fieldDefinition, selectedValues],
  );

  const handleSelect = (suggestion: MultiChoiceSuggestion) => {
    if (!suggestion.available) return;
    if (suggestion.type === 'multi-commit') {
      onCommit();
      return;
    }
    onToggleValue(suggestion.canonicalValue);
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
