import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddressEntryScreen } from '@/components/address-entry-screen';
import { PropertyVisualsScreen } from '@/components/property-visuals-screen';
import { StartScreen } from '@/components/start-screen';
import { SvyrInterface } from '@/components/svyr-interface';
import { Colors } from '@/constants/theme';
import { useSvyrController } from '@/hooks/use-workspace';
import type { StructuredAddress } from '@/types/workspace';

/**
 * Landscape-only Power User workspace.
 * Portrait learner mode has been removed; native orientation is locked
 * to landscape in app.json. Web always renders this same surface.
 */
export default function HomeScreen() {
  const [screen, setScreen] = useState<
    'start' | 'address' | 'visuals' | 'workspace'
  >('start');
  const [addressMode, setAddressMode] = useState<'live' | 'demo'>('live');
  const [selectedProperty, setSelectedProperty] =
    useState<StructuredAddress | null>(null);
  const svyr = useSvyrController();

  const handleAddressComplete = (address: StructuredAddress) => {
    svyr.setActiveProperty({
      displayAddress: address.formattedAddress,
      address,
    });
    setSelectedProperty(address);
    setScreen('visuals');
  };

  const handlePrepContinue = () => {
    const prepSuggestion = svyr.suggestions.find(
      (suggestion) =>
        suggestion.type === 'token' &&
        suggestion.commandPath.length === 1 &&
        suggestion.commandPath[0] === 'prep',
    );
    if (!prepSuggestion) return;

    svyr.selectSuggestion(prepSuggestion);
    setScreen('workspace');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {screen === 'workspace' ? (
        <SvyrInterface
          controller={svyr}
          onNavigateBack={() => setScreen('visuals')}
        />
      ) : (
        <>
          {screen === 'start' ? (
            <StartScreen
              onStart={() => {
                setAddressMode('live');
                setSelectedProperty(null);
                setScreen('address');
              }}
              onDemo={() => {
                setAddressMode('demo');
                setSelectedProperty(null);
                setScreen('address');
              }}
            />
          ) : null}

          {screen === 'address' || screen === 'visuals' ? (
            <View
              style={
                screen === 'address'
                  ? styles.addressVisible
                  : styles.addressHidden
              }>
              <AddressEntryScreen
                onComplete={handleAddressComplete}
                demoMode={addressMode === 'demo'}
                onBack={() => {
                  setSelectedProperty(null);
                  setScreen('start');
                }}
              />
            </View>
          ) : null}

          {screen === 'visuals' && selectedProperty ? (
            <PropertyVisualsScreen
              property={{
                displayAddress: selectedProperty.formattedAddress,
                address: selectedProperty,
              }}
              onBack={() => setScreen('address')}
              onContinue={handlePrepContinue}
            />
          ) : null}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  addressVisible: {
    flex: 1,
  },
  addressHidden: {
    display: 'none',
  },
});
