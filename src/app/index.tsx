import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.brand}>muffle.tech</Text>
        <Text style={styles.title}>iOS Demo</Text>
        <Text style={styles.subtitle}>
          Running in Expo Go. Edit src/app/index.tsx and the app will reload.
        </Text>

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={() => {}}>
          <Text style={styles.buttonText}>Get started</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F4EF',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  brand: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#1A1A1A',
    textTransform: 'lowercase',
  },
  title: {
    fontSize: 40,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: '#5A5A5A',
    marginBottom: 16,
    maxWidth: 320,
  },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: '#111111',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
