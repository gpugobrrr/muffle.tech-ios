import { useSingleAndDoubleTap } from '@/hooks/use-single-and-double-tap';
import { Pressable, StyleSheet, Text } from 'react-native';

type TabAutocompleteButtonProps = {
  onSingleTap: () => void;
  onDoubleTap: () => void;
};

export function TabAutocompleteButton({
  onSingleTap,
  onDoubleTap,
}: TabAutocompleteButtonProps) {
  const { onPress, feedback } = useSingleAndDoubleTap({
    onSingleTap,
    onDoubleTap,
  });

  return (
    <Pressable
      accessibilityLabel="Autocomplete command"
      accessibilityHint="Single tap completes. Double tap completes and runs."
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        feedback === 'single' && styles.singleFeedback,
        feedback === 'double' && styles.doubleFeedback,
      ]}>
      <Text style={styles.symbol}>↹</Text>
      <Text style={styles.label}>TAB</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#77729B',
    borderRadius: 6,
    backgroundColor: '#EFEDF5',
  },
  pressed: {
    backgroundColor: '#D9D5E8',
    transform: [{ scale: 0.96 }],
  },
  singleFeedback: {
    backgroundColor: '#D9D5E8',
  },
  doubleFeedback: {
    backgroundColor: '#514B78',
    borderWidth: 2,
  },
  symbol: {
    color: '#373256',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 21,
  },
  label: {
    color: '#514B78',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
