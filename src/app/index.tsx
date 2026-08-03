import { COMMAND_REGISTRY } from '@/commands/command-registry';
import { CommandTerminal } from '@/components/command-terminal';
import { useTerminalController } from '@/hooks/use-terminal-controller';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const terminal = useTerminalController();
  const { state } = terminal;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardLayout}>
        <View style={styles.header}>
          <View style={styles.headerColumn}>
            <Text style={styles.address}>14 Oakfield Road</Text>
            <Text style={styles.section}>External Walls</Text>
          </View>
          <View style={[styles.headerColumn, styles.headerColumnRight]}>
            <Text style={styles.progress}>
              {state.progressIndex} / 10
            </Text>
            <Text style={styles.saved}>✓ Saved</Text>
          </View>
        </View>

        <View
          accessibilityLiveRegion="polite"
          accessible
          style={styles.canvas}>
          {state.canvasMode === 'help' ? (
            <>
              <Text style={styles.eyebrow}>AVAILABLE COMMANDS</Text>
              <Text style={styles.canvasTitle}>Terminal help</Text>
              <Text style={styles.helpList}>
                {COMMAND_REGISTRY.map(({ name }) => name).join('  ·  ')}
              </Text>
            </>
          ) : state.activeCommand ? (
            <>
              <Text style={styles.eyebrow}>ACTIVE COMMAND</Text>
              <Text style={styles.canvasTitle}>
                {titleCase(state.activeCommand)}
              </Text>
              <Text style={styles.canvasHint}>
                The command canvas is ready for its future workflow.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.eyebrow}>INSPECTION TERMINAL</Text>
              <Text style={styles.canvasTitle}>Type a command to begin.</Text>
              <Text style={styles.canvasHint}>
                Use a suggestion, Tab, or Enter to move quickly.
              </Text>
            </>
          )}
        </View>

        <CommandTerminal controller={terminal} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F2EB',
  },
  keyboardLayout: {
    flex: 1,
  },
  header: {
    minHeight: 88,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#C9C5BB',
    backgroundColor: '#FBF9F4',
  },
  headerColumn: {
    justifyContent: 'space-between',
  },
  headerColumnRight: {
    alignItems: 'flex-end',
  },
  address: {
    color: '#22211F',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  section: {
    color: '#69655E',
    fontSize: 14,
    fontWeight: '600',
  },
  progress: {
    color: '#292735',
    fontSize: 17,
    fontWeight: '800',
  },
  saved: {
    color: '#4F6255',
    fontSize: 13,
    fontWeight: '700',
  },
  canvas: {
    flex: 1,
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
    backgroundColor: '#F5F2EB',
  },
  eyebrow: {
    marginBottom: 12,
    color: '#6B6685',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  canvasTitle: {
    maxWidth: 420,
    color: '#242321',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  canvasHint: {
    maxWidth: 360,
    marginTop: 10,
    color: '#6D6962',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  helpList: {
    maxWidth: 420,
    marginTop: 16,
    color: '#514B78',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 25,
    textAlign: 'center',
  },
});
