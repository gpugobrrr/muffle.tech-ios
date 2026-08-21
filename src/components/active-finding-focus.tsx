import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import { SVYR_BAR_LAYOUT } from '@/lib/svyr-bar-navigation';

const INK = '#20262B';
const INK_MUTED = '#737A7D';

export type ActiveFindingItem = {
  id: string;
  conditionRating: string;
  clause: {
    observation: string;
    implication: string;
    recommendation: string;
  };
  missingSlots: readonly string[];
  photoCount: number;
  photoUris: readonly string[];
};

export type ActiveFindingFocusProps = {
  finding: ActiveFindingItem | null;
  onNudgeSlot: (slotName: string) => void;
  onPhotoPress?: () => void;
};

export function ActiveFindingFocus({
  finding,
  onNudgeSlot,
  onPhotoPress,
}: ActiveFindingFocusProps) {
  if (!finding) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.badgeRow}>
          <Text style={styles.emptyBadge}>[active finding: none]</Text>
        </View>
        <Text style={styles.emptyPrompt}>
          SVYR {'>'} ready for finding (urgent, defect, routine)
        </Text>
      </View>
    );
  }

  // Derive standard interactive slot nudges: combine known RICS slots with missing slots
  const standardSlots = ['location', 'material', 'recommend'];
  const missingSlots = finding.missingSlots && finding.missingSlots.length > 0
    ? finding.missingSlots
    : standardSlots;

  return (
    <View style={styles.container}>
      <View style={styles.cardHeader}>
        <View style={styles.ratingBadge}>
          <Text style={styles.ratingText}>[{finding.conditionRating}]</Text>
        </View>

        {finding.photoCount > 0 ? (
          <View style={styles.photoCountBadge}>
            <Text style={styles.photoCountText}>
              [photo × {finding.photoCount}]
            </Text>
          </View>
        ) : null}
      </View>

      {finding.photoUris && finding.photoUris.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbnailRow}>
          {finding.photoUris.map((uri) => (
            <Image
              key={uri}
              source={{ uri }}
              style={styles.thumbnail}
              accessibilityLabel="Finding photo thumbnail"
            />
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.clauseSection}>
        {finding.clause.observation ? (
          <Text style={styles.clauseLine}>
            <Text style={styles.clauseTag}>[obs] </Text>
            <Text style={styles.clauseText}>{finding.clause.observation}</Text>
          </Text>
        ) : null}

        {finding.clause.implication ? (
          <Text style={styles.clauseLine}>
            <Text style={styles.clauseTag}>[imp] </Text>
            <Text style={styles.clauseText}>{finding.clause.implication}</Text>
          </Text>
        ) : null}

        {finding.clause.recommendation ? (
          <Text style={styles.clauseLine}>
            <Text style={styles.clauseTag}>[rec] </Text>
            <Text style={styles.clauseText}>
              {finding.clause.recommendation}
            </Text>
          </Text>
        ) : null}
      </View>

      <View style={styles.nudgeSection}>
        <Text style={styles.nudgeHeader}>[nudge slots]</Text>
        <View style={styles.nudgeRow}>
          {missingSlots.map((slotName) => (
            <Pressable
              key={`${finding.id}:${slotName}`}
              accessibilityRole="button"
              accessibilityLabel={`Add ${slotName}`}
              onPress={() => onNudgeSlot(slotName)}
              hitSlop={SVYR_BAR_LAYOUT.hitSlop}
              style={({ pressed }) => [
                styles.nudgeChip,
                pressed && styles.nudgeChipPressed,
              ]}>
              <Text style={styles.nudgeText}>
                {`[+ ${slotName}]`}
              </Text>
            </Pressable>
          ))}

          {onPhotoPress ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add photo"
              onPress={onPhotoPress}
              hitSlop={SVYR_BAR_LAYOUT.hitSlop}
              style={({ pressed }) => [
                styles.nudgeChip,
                pressed && styles.nudgeChipPressed,
              ]}>
              <Text style={styles.nudgeText}>[+ photo]</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E0D8',
  },
  ratingBadge: {
    backgroundColor: '#ECEAE4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  ratingText: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    fontWeight: '600',
    color: Colors.accent,
  },
  photoCountBadge: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  photoCountText: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: INK_MUTED,
  },
  thumbnailRow: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  thumbnail: {
    width: 52,
    height: 52,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#D5D2CA',
    backgroundColor: '#FAFAF7',
  },
  clauseSection: {
    gap: Spacing.sm,
    backgroundColor: '#F0EFEA',
    borderWidth: 1,
    borderColor: '#E2E0D8',
    borderRadius: 2,
    padding: Spacing.md,
  },
  clauseLine: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    lineHeight: 18,
  },
  clauseTag: {
    color: INK_MUTED,
    fontWeight: '500',
  },
  clauseText: {
    color: INK,
  },
  nudgeSection: {
    gap: Spacing.xs,
    paddingTop: Spacing.xs,
  },
  nudgeHeader: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: INK_MUTED,
    letterSpacing: 0.5,
  },
  nudgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  nudgeChip: {
    backgroundColor: '#ECEAE4',
    borderWidth: 1,
    borderColor: '#D8D6CE',
    borderRadius: 2,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  nudgeChipPressed: {
    backgroundColor: '#2C2C2C',
    borderColor: '#2C2C2C',
  },
  nudgeText: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: Colors.amber,
    fontWeight: '500',
  },
  emptyContainer: {
    padding: Spacing.xl,
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  badgeRow: {
    flexDirection: 'row',
  },
  emptyBadge: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: INK_MUTED,
  },
  emptyPrompt: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: INK_MUTED,
  },
});
