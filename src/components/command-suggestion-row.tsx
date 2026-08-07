import type { CommandDefinition } from '@/commands/command-types';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type CommandSuggestionRowProps = {
  suggestions: CommandDefinition[];
  highlightedIndex: number;
  onHighlight: (index: number) => void;
  onSelect: (suggestion: CommandDefinition) => void;
};

export function CommandSuggestionRow({
  suggestions,
  highlightedIndex,
  onHighlight,
  onSelect,
}: CommandSuggestionRowProps) {
  return (
    <ScrollView
      horizontal
      keyboardShouldPersistTaps="always"
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      style={styles.scroll}>
      {suggestions.map((suggestion, index) => {
        const highlighted = index === highlightedIndex;
        return (
          <Pressable
            key={suggestion.name}
            accessibilityLabel={`${suggestion.name} command`}
            accessibilityHint="Tap to complete. Tap again to run."
            accessibilityRole="button"
            accessibilityState={{ selected: highlighted }}
            onFocus={() => onHighlight(index)}
            onPress={() => onSelect(suggestion)}
            style={({ pressed }) => [
              styles.suggestion,
              highlighted && styles.highlighted,
              pressed && styles.pressed,
            ]}>
            <View>
              <Text
                style={[
                  styles.name,
                  highlighted && styles.highlightedName,
                ]}>
                {suggestion.name}
              </Text>
              {suggestion.aliases[0] ? (
                <Text style={styles.alias}>alias: {suggestion.aliases[0]}</Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
  },
  content: {
    minWidth: '100%',
    gap: 8,
    paddingVertical: 8,
  },
  suggestion: {
    minHeight: 46,
    minWidth: 78,
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: '#C8C4BA',
    borderRadius: 5,
    backgroundColor: '#F8F6F1',
  },
  highlighted: {
    borderColor: '#514B78',
    borderWidth: 2,
    backgroundColor: '#EFEDF5',
  },
  pressed: {
    backgroundColor: '#DDD9E9',
  },
  name: {
    color: '#242321',
    fontSize: 14,
    fontWeight: '700',
  },
  highlightedName: {
    color: '#373256',
  },
  alias: {
    marginTop: 2,
    color: '#6D6962',
    fontSize: 9,
    fontWeight: '600',
  },
});
