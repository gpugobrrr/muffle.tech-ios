import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import type { SvyrController } from '@/hooks/use-workspace';
import { findFieldDefinition, normalizeFieldInputValue } from '@/lib/field-schema';
import { useMemo, useState } from 'react';

export type SourceInputMode = 'select' | 'text';

type Props = {
  controller: SvyrController;
};

const SOURCE_PATH = ['prep', 'brief', 'instr', 'source'];

function isSourcePath(path: string[]): boolean {
  return path.length === SOURCE_PATH.length && path.every((token, index) => token === SOURCE_PATH[index]);
}

export function SourceSelector({ controller }: Props) {
  const [inputMode, setInputMode] = useState<SourceInputMode>('select');
  const [draftText, setDraftText] = useState('');

  const fieldDefinition = useMemo(() => findFieldDefinition(SOURCE_PATH), []);
  const currentValue = controller.inspectionBrief.instruction.source;
  const options = fieldDefinition?.options ?? [];
  const isActive = isSourcePath(controller.fullCommandPath);

  if (!isActive || !fieldDefinition) {
    return null;
  }

  const handleSelectOption = (value: string) => {
    const normalized = normalizeFieldInputValue(fieldDefinition, value);
    if (!normalized) return;
    controller.commitFieldValue(SOURCE_PATH, normalized);
  };

  const handleCommitText = () => {
    const normalized = normalizeFieldInputValue(fieldDefinition, draftText);
    if (!normalized) return;
    controller.commitFieldValue(SOURCE_PATH, normalized);
    setDraftText('');
    setInputMode('select');
  };

  const toggleMode = () => {
    setInputMode((mode) => (mode === 'select' ? 'text' : 'select'));
    setDraftText('');
  };

  return (
    <View style={styles.surface} pointerEvents="box-none">
      {inputMode === 'select' ? (
        <View style={styles.listShell}>
          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => {
              const isSelected = currentValue === item.value;
              return (
                <Pressable
                  onPress={() => handleSelectOption(item.value)}
                  style={styles.optionRow}
                  hitSlop={6}>
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                    {item.label}
                  </Text>
                  {isSelected ? <Text style={styles.selectionMark}>•</Text> : null}
                </Pressable>
              );
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.optionList}
            style={styles.list}
          />
        </View>
      ) : (
        <View style={styles.inputRow}>
          <TextInput
            value={draftText}
            onChangeText={setDraftText}
            onSubmitEditing={handleCommitText}
            placeholder="Type source…"
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
            returnKeyType="done"
            autoCapitalize="sentences"
            autoCorrect={false}
            autoFocus
            multiline={false}
          />
        </View>
      )}

      <Pressable
        onPress={toggleMode}
        hitSlop={10}
        style={styles.modeButton}>
        <Text style={styles.modeButtonText}>Aa</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    flexDirection: 'row',
    alignItems: 'stretch',
    flex: 1,
    minHeight: 0,
    paddingLeft: Spacing.xl + Spacing.md,
    paddingRight: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  listShell: {
    flex: 1,
    minHeight: 0,
    marginRight: Spacing.sm,
  },
  list: {
    flex: 1,
  },
  optionList: {
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  optionRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  optionText: {
    fontFamily: Fonts.sans,
    fontSize: Type.body,
    color: Colors.text,
    flex: 1,
  },
  optionTextSelected: {
    color: Colors.accent,
    fontWeight: '600',
  },
  selectionMark: {
    color: Colors.accent,
    marginLeft: Spacing.sm,
    fontSize: Type.body,
  },
  inputRow: {
    flex: 1,
    minHeight: 0,
    marginRight: Spacing.sm,
    justifyContent: 'center',
  },
  input: {
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderMuted,
    paddingVertical: Spacing.xs,
    fontFamily: Fonts.sans,
    fontSize: Type.body,
    color: Colors.text,
  },
  modeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderMuted,
    borderRadius: 4,
  },
  modeButtonText: {
    fontFamily: Fonts.sans,
    fontSize: Type.body,
    color: Colors.textSecondary,
  },
});
