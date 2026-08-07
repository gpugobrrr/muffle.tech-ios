import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SvyrInterface } from '@/components/svyr-interface';
import { Colors } from '@/constants/theme';
import { useSvyrController } from '@/hooks/use-workspace';

/**
 * Landscape-only Power User workspace.
 * Portrait learner mode has been removed; native orientation is locked
 * to landscape in app.json. Web always renders this same surface.
 */
export default function HomeScreen() {
  const svyr = useSvyrController();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <SvyrInterface controller={svyr} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
});
