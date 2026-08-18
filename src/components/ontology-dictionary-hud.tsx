import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import type { CanonicalDefectDefinition } from '@/domain/ontology/canonical-defects';
import {
  buildSampleMacro,
  getRoomDefects,
} from '@/domain/ontology/room-registry';
import { SVYR_BAR_LAYOUT } from '@/lib/svyr-bar-navigation';

export type OntologyDictionaryHUDProps = {
  isOpen: boolean;
  activeRoom: string;
  onSelectSamplePhrase: (phrase: string) => void;
  onClose: () => void;
};

function slotNames(
  definition: CanonicalDefectDefinition,
  required: boolean,
): string[] {
  return Object.values(definition.slots)
    .filter((slot) => slot.required === required)
    .map((slot) => slot.name);
}

function DefectCard({
  definition,
  onSelectSamplePhrase,
}: {
  definition: CanonicalDefectDefinition;
  onSelectSamplePhrase: (phrase: string) => void;
}) {
  const required = slotNames(definition, true);
  const optional = slotNames(definition, false);
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.defectId}>{definition.id}</Text>
        <Text style={styles.ratingBadge}>{definition.defaultRating}</Text>
      </View>
      <Text style={styles.slotLine}>
        <Text style={styles.slotLabel}>slots: </Text>
        {required.map((name) => (
          <Text key={`${definition.id}:req:${name}`} style={styles.requiredSlot}>
            {`${name}* `}
          </Text>
        ))}
        {optional.map((name) => (
          <Text key={`${definition.id}:opt:${name}`} style={styles.optionalSlot}>
            {`${name} `}
          </Text>
        ))}
      </Text>
      <Text style={styles.aliasLine}>{`aliases: ${definition.aliases.join(', ')}`}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Tap to test ${definition.id}`}
        onPress={() => onSelectSamplePhrase(buildSampleMacro(definition))}
        hitSlop={SVYR_BAR_LAYOUT.hitSlop}
        style={({ pressed }) => [
          styles.testButton,
          pressed ? styles.pressed : null,
        ]}>
        <Text style={styles.testLabel}>TAP TO TEST {'>'}</Text>
      </Pressable>
    </View>
  );
}

/**
 * Dark diagnostic overlay for the active room's canonical ontology.
 * Anchored above the pinned SVYR dock so the prompt stays interactive.
 */
export function OntologyDictionaryHUD({
  isOpen,
  activeRoom,
  onSelectSamplePhrase,
  onClose,
}: OntologyDictionaryHUDProps) {
  if (!isOpen) return null;
  const defects = getRoomDefects(activeRoom);

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <View style={styles.header}>
        <Text style={styles.title}>{`[dict] ${activeRoom}`}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close dictionary"
          onPress={onClose}
          hitSlop={SVYR_BAR_LAYOUT.hitSlop}
          style={({ pressed }) => [styles.closeButton, pressed ? styles.pressed : null]}>
          <Text style={styles.closeLabel}>[close ✕]</Text>
        </Pressable>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        {defects.map((definition) => (
          <DefectCard
            key={definition.id}
            definition={definition}
            onSelectSamplePhrase={onSelectSamplePhrase}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 56,
    backgroundColor: 'rgba(18, 18, 18, 0.96)',
    zIndex: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  title: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: '#F4F4F0',
  },
  closeButton: { paddingVertical: 2, paddingHorizontal: 2 },
  closeLabel: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: Colors.accent,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  card: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#333',
    paddingBottom: Spacing.sm,
    gap: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  defectId: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: '#F4F4F0',
  },
  ratingBadge: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: Colors.accent,
  },
  slotLine: { fontFamily: Fonts.mono, fontSize: Type.mono },
  slotLabel: { color: '#8A8A8A' },
  requiredSlot: { color: Colors.amber },
  optionalSlot: { color: '#8A8A8A' },
  aliasLine: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: '#C8C8C8',
  },
  testButton: { paddingVertical: 4, alignSelf: 'flex-start' },
  testLabel: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: Colors.amber,
  },
  pressed: { opacity: 0.65 },
});
