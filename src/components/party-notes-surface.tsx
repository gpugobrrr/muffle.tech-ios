import { useEffect, useRef, useState } from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import { hasSavedNote } from '@/lib/svyr-notes';

type Props = {
  /** False when the path leaves party — closes the editor, keeps the note. */
  active: boolean;
  note: string;
  onChangeNote: (value: string) => void;
  /** Restore SVYR focus when the editor closes. */
  onEditorClosed?: () => void;
  /** Fired when the diamond opens or closes the notes editor. */
  onOpenChange?: (open: boolean) => void;
  inline?: boolean;
};

/**
 * Optional party notes. The diamond toggles a blank multiline editor —
 * never instructional copy, never the formal instructing-party value.
 */
export function PartyNotesSurface({
  active,
  note,
  onChangeNote,
  onEditorClosed,
  onOpenChange,
  inline = false,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const noteExists = hasSavedNote(note);

  useEffect(() => {
    if (active) return;
    setIsOpen(false);
    onOpenChange?.(false);
  }, [active, onOpenChange]);

  useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [isOpen]);

  if (!active) return null;

  const openEditor = () => {
    setIsOpen(true);
    onOpenChange?.(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const handleChangeNote = (value: string) => {
    onChangeNote(value);
    if (!value.trim()) {
      setIsOpen(false);
      onOpenChange?.(false);
    }
  };

  return (
    <View
      style={[styles.surface, inline ? styles.inlineSurface : null]}
      pointerEvents="box-none">
      <View
        style={[styles.headerRow, inline ? styles.inlineHeaderRow : null]}
        pointerEvents="box-none">
        {!inline && (isOpen ? <View style={styles.titleSpacer} /> : <View />)}
        <View
          style={[
            styles.diamondCluster,
            inline ? styles.inlineDiamondCluster : null,
          ]}
          pointerEvents="box-none">
          <Pressable
            onPress={openEditor}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={
              isOpen ? 'Edit party note' : 'Add party note'
            }
            style={({ pressed }) => [
              styles.diamondHit,
              inline ? styles.inlineDiamondHit : null,
              pressed && styles.pressed,
            ]}>
            <View style={inline ? styles.diamondContainer : undefined}>
              <Text style={styles.diamond}>◇</Text>
            </View>
            {inline ? (
              isOpen ? (
                <TextInput
                  ref={inputRef}
                  value={note}
                  onChangeText={handleChangeNote}
                  placeholder="Add note"
                  placeholderTextColor={Colors.textMuted}
                  multiline={false}
                  scrollEnabled
                  returnKeyType="done"
                  style={styles.inlineInput}
                  accessibilityLabel="Party note"
                />
              ) : (
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={styles.inlineLabel}>
                  {noteExists ? note : 'Add note'}
                </Text>
              )
            ) : null}
          </Pressable>
        </View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    minHeight: 0,
    paddingLeft: Spacing.xl + Spacing.md,
    paddingRight: Spacing.xl,
    paddingTop: Spacing.md,
  },
  inlineSurface: {
    flex: 0,
    width: '100%',
    padding: 0,
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  inlineHeaderRow: {
    width: '100%',
    justifyContent: 'flex-start',
  },
  titleSpacer: {
    flex: 1,
  },
  diamondCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexShrink: 1,
    gap: Spacing.xs,
  },
  diamondHit: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineDiamondHit: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    minWidth: 0,
    gap: Spacing.xs,
  },
  inlineDiamondCluster: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'flex-start',
  },
  diamondContainer: {
    width: 44,
    flexShrink: 0,
    alignItems: 'flex-start',
  },
  diamond: {
    fontFamily: Fonts.mono,
    fontSize: 16,
    color: Colors.accent,
    opacity: 0.55,
  },
  inlineLabel: {
    fontFamily: Fonts.sans,
    fontSize: Type.body,
    color: Colors.textSecondary,
  },
  inlineInput: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    fontFamily: Fonts.sans,
    fontSize: Type.body,
    color: Colors.text,
  },
  pressed: {
    opacity: 0.7,
  },
});
