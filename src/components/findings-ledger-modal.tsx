import React from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import type { LoftFindingFeedItem } from '@/screens/LoftInspectionScreen';

const PAPER = '#F4F4F0';
const INK = '#20262B';
const INK_MUTED = '#737A7D';

export type FindingsLedgerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  findings: readonly LoftFindingFeedItem[];
  onSelectFinding?: (finding: LoftFindingFeedItem) => void;
};

export function FindingsLedgerModal({
  isOpen,
  onClose,
  findings,
  onSelectFinding,
}: FindingsLedgerModalProps) {
  const insets = useSafeAreaInsets();

  if (!isOpen) return null;

  return (
    <Modal
      visible={isOpen}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}>
      <View style={[styles.modalRoot, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            [LOG LEDGER: {findings.length} committed]
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close ledger"
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.closeButtonPressed,
            ]}>
            <Text style={styles.closeButtonText}>[close ✕]</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}>
          {findings.length === 0 ? (
            <Text style={styles.emptyText}>[no committed findings yet]</Text>
          ) : (
            findings.map((item, index) => (
              <Pressable
                key={item.id || index}
                onPress={() => onSelectFinding?.(item)}
                style={({ pressed }) => [
                  styles.entryCard,
                  pressed && styles.entryCardPressed,
                ]}>
                <View style={styles.entryHeader}>
                  <View style={styles.ratingBadge}>
                    <Text style={styles.ratingText}>
                      [{item.conditionRating}]
                    </Text>
                  </View>
                  <Text style={styles.entryIndex}>
                    #{index + 1} • {item.id}
                  </Text>
                </View>

                {item.photoUris && item.photoUris.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.thumbnailRow}>
                    {item.photoUris.map((uri) => (
                      <Image
                        key={uri}
                        source={{ uri }}
                        style={styles.thumbnail}
                        accessibilityLabel="Committed finding thumbnail"
                      />
                    ))}
                  </ScrollView>
                ) : null}

                <View style={styles.clauseBlock}>
                  {item.clause.observation ? (
                    <Text style={styles.clauseLine}>
                      <Text style={styles.clauseTag}>[obs] </Text>
                      <Text style={styles.clauseText}>
                        {item.clause.observation}
                      </Text>
                    </Text>
                  ) : null}

                  {item.clause.implication ? (
                    <Text style={styles.clauseLine}>
                      <Text style={styles.clauseTag}>[imp] </Text>
                      <Text style={styles.clauseText}>
                        {item.clause.implication}
                      </Text>
                    </Text>
                  ) : null}

                  {item.clause.recommendation ? (
                    <Text style={styles.clauseLine}>
                      <Text style={styles.clauseTag}>[rec] </Text>
                      <Text style={styles.clauseText}>
                        {item.clause.recommendation}
                      </Text>
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: PAPER,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D5D2CA',
  },
  headerTitle: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: INK,
    fontWeight: '600',
  },
  closeButton: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  closeButtonPressed: {
    opacity: 0.5,
  },
  closeButtonText: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: Colors.accent,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  emptyText: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: INK_MUTED,
    paddingTop: Spacing.xl,
  },
  entryCard: {
    backgroundColor: '#F0EFEA',
    borderWidth: 1,
    borderColor: '#E2E0D8',
    borderRadius: 2,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  entryCardPressed: {
    backgroundColor: '#E5E3DC',
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  entryIndex: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: INK_MUTED,
  },
  thumbnailRow: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  thumbnail: {
    width: 44,
    height: 44,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#D5D2CA',
    backgroundColor: '#FAFAF7',
  },
  clauseBlock: {
    gap: Spacing.xs,
  },
  clauseLine: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    lineHeight: 18,
  },
  clauseTag: {
    color: INK_MUTED,
  },
  clauseText: {
    color: INK,
  },
});
