import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts, Spacing, Type } from '@/constants/theme';

type Props = {
  onStart: () => void;
  onDemo: () => void;
};

export function StartScreen({ onStart, onDemo }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <View style={styles.brandLockup}>
        <Image
          accessibilityLabel="muffle.tech"
          source={require('@/assets/expo.icon/Assets/muffle_logo_wordmark.png')}
          style={styles.wordmarkImage}
          resizeMode="contain"
        />
        <View pointerEvents="none" style={styles.logoFlowSpacer} />
      </View>

      <Pressable
        accessibilityLabel="Start"
        accessibilityRole="button"
        onPress={onStart}
        style={({ pressed }) => [
          styles.startButton,
          { right: Spacing.xxl, bottom: insets.bottom + Spacing.xl },
          pressed ? styles.startButtonPressed : null,
        ]}>
        <Text style={styles.startLabel}>START</Text>
      </Pressable>

      {__DEV__ ? (
        <Pressable
          accessibilityLabel="Start local address demo"
          accessibilityRole="button"
          onPress={onDemo}
          style={({ pressed }) => [
            styles.demoButton,
            {
              left: insets.left + Spacing.xxl,
              bottom: insets.bottom + Spacing.xl,
            },
            pressed ? styles.demoButtonPressed : null,
          ]}>
          <Text style={styles.demoLabel}>DEMO</Text>
        </Pressable>
      ) : null}

      <Text style={styles.footer}>muffle.tech</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.canvas,
    padding: Spacing.xxl,
  },
  brandLockup: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmarkImage: {
    width: 420,
    height: 260,
    maxWidth: '90%',
  },
  logoFlowSpacer: {
    width: 164,
    height: 52,
    marginTop: 48,
  },
  startButton: {
    position: 'absolute',
    minWidth: 164,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.section,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  startButtonPressed: {
    opacity: 0.78,
  },
  startLabel: {
    color: '#FFFFFF',
    fontFamily: Fonts.mono,
    fontSize: Type.body,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  demoButton: {
    position: 'absolute',
    minWidth: 44,
    minHeight: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  demoButtonPressed: {
    opacity: 0.65,
  },
  demoLabel: {
    color: Colors.textSecondary,
    fontFamily: Fonts.mono,
    fontSize: Type.label,
    letterSpacing: 0.8,
  },
  footer: {
    position: 'absolute',
    bottom: Spacing.xxl,
    color: Colors.textMuted,
    fontFamily: Fonts.mono,
    fontSize: Type.label,
    letterSpacing: 0.8,
  },
});
