import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AutocompleteArea } from '@/components/autocomplete-area';
import { MultiChoiceEntryPage } from '@/components/multi-choice-entry-page';
import { NumericEntryPage } from '@/components/numeric-entry-page';
import { TextEntryPage } from '@/components/text-entry-page';
import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import type { ActiveEntryField } from '@/hooks/use-workspace';
import type { CompoundGroupRow } from '@/lib/controlled-group';
import type { FieldDefinition } from '@/lib/field-schema';
import { orderMultiChoiceValues, toggleMultiChoiceValue } from '@/lib/multi-choice';
import {
  buildSingleChoiceSuggestions,
  type SingleChoiceSuggestion,
} from '@/lib/single-choice';

type Props = {
  rows: CompoundGroupRow[];
  error: string | null;
  notesPath?: string;
  notesValue?: string;
  onChangeNotes?: (value: string) => void;
  resolveStoredValue: (field: FieldDefinition) => string | null;
  resolveStoredSet: (field: FieldDefinition) => readonly string[];
  onCommitScalar: (path: string[], value: string) => boolean;
  onCommitSet: (path: string[], values: readonly string[]) => boolean;
  onNavigateUpDirectory: () => boolean;
};

function syntheticEntryField(field: FieldDefinition): ActiveEntryField {
  return {
    path: field.path,
    node: {
      token: field.token,
      label: field.label,
      description: field.description,
      requiresValue: true,
      entryLabel: field.entryLabel ?? field.label.toUpperCase(),
      valuePrompt: field.valuePrompt,
    },
  };
}

/**
 * Grouped compound capture for registered child fields of mixed value types.
 */
export function CompoundCaptureEntryPage({
  rows,
  error,
  notesPath,
  notesValue = '',
  onChangeNotes,
  resolveStoredValue,
  resolveStoredSet,
  onCommitScalar,
  onCommitSet,
  onNavigateUpDirectory,
}: Props) {
  const [activeFieldPath, setActiveFieldPath] = useState<string[] | null>(null);
  const [textDraft, setTextDraft] = useState('');
  const [multiDraft, setMultiDraft] = useState<string[]>([]);
  const [notesOpen, setNotesOpen] = useState(false);

  const activeRow = useMemo(
    () =>
      activeFieldPath
        ? rows.find((row) => row.path.join('/') === activeFieldPath.join('/')) ??
          null
        : null,
    [activeFieldPath, rows],
  );

  const activeField = activeRow?.field ?? null;

  const choiceSuggestions = useMemo(() => {
    if (!activeField) return [];
    if (
      activeField.valueType !== 'singleSelect' &&
      activeField.valueType !== 'controlledStatus'
    ) {
      return [];
    }
    return buildSingleChoiceSuggestions(
      activeField,
      resolveStoredValue(activeField),
    );
  }, [activeField, resolveStoredValue]);

  const openRow = (row: CompoundGroupRow) => {
    setActiveFieldPath(row.path);
    if (row.field.valueType === 'text' || row.field.valueType === 'number') {
      setTextDraft(resolveStoredValue(row.field) ?? '');
    }
    if (row.field.valueType === 'multiSelect') {
      setMultiDraft([...resolveStoredSet(row.field)]);
    }
  };

  if (notesOpen && notesPath && onChangeNotes) {
    return (
      <View style={styles.page}>
        <TextEntryPage
          field={{
            path: notesPath.split('/'),
            node: {
              token: 'notes',
              label: 'Heating notes',
              description: 'Non-canonical surveyor notes for heating.',
              requiresValue: true,
              entryLabel: 'HEATING NOTES',
            },
          }}
          value={notesValue}
          error={error}
          onChangeText={onChangeNotes}
          onSubmit={() => setNotesOpen(false)}
          onCancelEntry={() => {
            setNotesOpen(false);
            return true;
          }}
          noteEditing={false}
        />
      </View>
    );
  }

  if (activeField?.valueType === 'text' || activeField?.valueType === 'number') {
    const entryField = syntheticEntryField(activeField);
    const submit = () => {
      if (onCommitScalar(activeField.path, textDraft)) {
        setActiveFieldPath(null);
        setTextDraft('');
      }
    };

    if (activeField.valueType === 'number') {
      return (
        <View style={styles.page}>
          <NumericEntryPage
            field={entryField}
            fieldDefinition={activeField}
            value={textDraft}
            error={error}
            onChangeText={setTextDraft}
            onSubmit={submit}
            onCancelEntry={() => {
              setActiveFieldPath(null);
              return true;
            }}
          />
        </View>
      );
    }

    return (
      <View style={styles.page}>
        <TextEntryPage
          field={entryField}
          value={textDraft}
          error={error}
          onChangeText={setTextDraft}
          onSubmit={submit}
          onCancelEntry={() => {
            setActiveFieldPath(null);
            return true;
          }}
        />
      </View>
    );
  }

  if (activeField?.valueType === 'multiSelect') {
    return (
      <View style={styles.page}>
        <MultiChoiceEntryPage
          fieldDefinition={activeField}
          selectedValues={multiDraft}
          error={error}
          onToggleValue={(canonicalValue) => {
            setMultiDraft((current) =>
              orderMultiChoiceValues(
                activeField,
                toggleMultiChoiceValue(current, canonicalValue),
              ),
            );
          }}
          onCommit={() => {
            if (onCommitSet(activeField.path, multiDraft)) {
              setActiveFieldPath(null);
              setMultiDraft([]);
            }
          }}
          onNavigateUpDirectory={() => {
            setActiveFieldPath(null);
            return true;
          }}
        />
      </View>
    );
  }

  if (
    activeField &&
    (activeField.valueType === 'singleSelect' ||
      activeField.valueType === 'controlledStatus')
  ) {
    return (
      <View style={styles.page}>
        {error ? (
          <Text
            style={styles.error}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
        <AutocompleteArea
          suggestions={choiceSuggestions}
          onApplySuggestion={(suggestion: SingleChoiceSuggestion) => {
            if (onCommitScalar(activeField.path, suggestion.canonicalValue)) {
              setActiveFieldPath(null);
            }
          }}
          onNavigateUpDirectory={() => {
            setActiveFieldPath(null);
            return true;
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      {error ? (
        <Text
          style={styles.error}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled">
        {rows.map((row) => (
          <Pressable
            key={row.path.join('/')}
            accessibilityRole="button"
            accessibilityLabel={`${row.field.label}${row.required ? ', required' : ''}, ${row.currentLabel}`}
            onPress={() => openRow(row)}
            style={({ pressed }) => [
              styles.row,
              pressed ? styles.rowPressed : null,
            ]}>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>
                {row.field.label}
                {row.required ? ' *' : ''}
              </Text>
            </View>
            <Text style={styles.rowValue}>{row.currentLabel}</Text>
          </Pressable>
        ))}
        {notesPath && onChangeNotes ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Heating notes"
            onPress={() => setNotesOpen(true)}
            style={({ pressed }) => [
              styles.row,
              pressed ? styles.rowPressed : null,
            ]}>
            <Text style={styles.rowLabel}>Notes</Text>
            <Text style={styles.rowValue}>
              {notesValue.trim() ? 'Recorded' : 'Not recorded'}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Leave grouped capture"
        onPress={() => onNavigateUpDirectory()}
        style={styles.backHint}
      />
    </View>
  );
}

/** @deprecated Use CompoundCaptureEntryPage */
export const ControlledGroupEntryPage = CompoundCaptureEntryPage;

export type ControlledGroupRow = CompoundGroupRow;

const styles = StyleSheet.create({
  page: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    position: 'relative',
  },
  error: {
    position: 'absolute',
    top: 0,
    right: Spacing.xxl,
    left: Spacing.xxl,
    zIndex: 1,
    textAlign: 'center',
    fontFamily: Fonts.mono,
    fontSize: Type.label,
    color: Colors.danger,
    letterSpacing: 0.4,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  list: {
    flexGrow: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  row: {
    width: '100%',
    maxWidth: 560,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  rowPressed: {
    opacity: 0.72,
  },
  rowText: {
    flexShrink: 1,
    paddingRight: Spacing.md,
  },
  rowLabel: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: Colors.text,
  },
  rowValue: {
    flexShrink: 0,
    maxWidth: '46%',
    textAlign: 'right',
    fontFamily: Fonts.mono,
    fontSize: Type.label,
    color: Colors.textSecondary,
  },
  backHint: {
    height: 1,
    width: 1,
    opacity: 0,
  },
});
