import { Pressable, StyleSheet, Text } from 'react-native';

type EnterCommandButtonProps = {
  disabled: boolean;
  onPress: () => void;
};

export function EnterCommandButton({
  disabled,
  onPress,
}: EnterCommandButtonProps) {
  return (
    <Pressable
      accessibilityLabel="Run command"
      accessibilityHint="Executes the command currently entered in the terminal."
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}>
      <Text style={[styles.symbol, disabled && styles.disabledSymbol]}>↵</Text>
      <Text style={[styles.label, disabled && styles.disabledSymbol]}>
        RUN
      </Text>
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
    borderColor: '#514B78',
    borderRadius: 6,
    backgroundColor: '#514B78',
  },
  pressed: {
    backgroundColor: '#393450',
    transform: [{ scale: 0.96 }],
  },
  disabled: {
    borderColor: '#B8B5AE',
    backgroundColor: '#E5E2DA',
  },
  symbol: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 22,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  disabledSymbol: {
    color: '#716E68',
  },
});
