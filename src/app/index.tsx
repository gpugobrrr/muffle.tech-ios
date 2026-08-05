import { useEffect } from 'react';
import { Keyboard, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PortraitLearnerWorkspace } from '@/components/portrait-learner-workspace';
import { SvyrInterface } from '@/components/svyr-interface';
import { Colors } from '@/constants/theme';
import { useInteractionMode } from '@/hooks/use-interaction-mode';
import { useSvyrController } from '@/hooks/use-workspace';

export default function HomeScreen() {
  const { isLandscape } = useInteractionMode();
  const svyr = useSvyrController();

  // Portrait must not keep the Power User keyboard open after rotation.
  useEffect(() => {
    if (!isLandscape) {
      Keyboard.dismiss();
    }
  }, [isLandscape]);

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={
        isLandscape
          ? ['top', 'left', 'right']
          : ['top', 'left', 'right', 'bottom']
      }>
      {isLandscape ? (
        <SvyrInterface controller={svyr} />
      ) : (
        <PortraitLearnerWorkspace controller={svyr} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
});
