import type { ReactNode } from 'react';

import { MultiChoiceEntryPage } from '@/components/multi-choice-entry-page';
import { NumericEntryPage } from '@/components/numeric-entry-page';
import { SingleChoiceEntryPage } from '@/components/single-choice-entry-page';
import { TextEntryPage } from '@/components/text-entry-page';
import type { ActiveEntryField } from '@/hooks/use-workspace';
import { findFieldDefinition } from '@/lib/field-schema';
import type { SvyrHintId } from '@/lib/hint-repository';
import type { PresentationMode } from '@/lib/presentation-mode';

type Props = {
  field: ActiveEntryField;
  value: string;
  storedValue?: string | null;
  multiChoiceValues?: readonly string[];
  error: string | null;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
  onSelectChoice: (canonicalValue: string) => void;
  onToggleMultiChoice: (canonicalValue: string) => void;
  onCommitMultiChoice: () => void;
  onCancelEntry: () => boolean;
  focusToken?: number;
  activeHintId?: Extract<SvyrHintId, 'executeValue'> | null;
  onDismissHint?: (id: SvyrHintId) => void;
  heldCommandDescription?: string | null;
  notesSurface?: ReactNode;
  noteEditing?: boolean;
  noteValue?: string;
  onChangeNote?: (value: string) => void;
  presentationMode?: PresentationMode;
};

/** Select the reusable capture primitive declared by the canonical field schema. */
export function SvyrDataEntryPanel({
  field,
  value,
  storedValue = null,
  multiChoiceValues = [],
  error,
  onChangeText,
  onSubmit,
  onSelectChoice,
  onToggleMultiChoice,
  onCommitMultiChoice,
  onCancelEntry,
  focusToken = 0,
  activeHintId = null,
  onDismissHint,
  heldCommandDescription = null,
  notesSurface,
  noteEditing = false,
  noteValue = '',
  onChangeNote,
  presentationMode = 'touch',
}: Props) {
  const fieldDefinition = findFieldDefinition(field.path);

  if (fieldDefinition?.valueType === 'singleSelect' || fieldDefinition?.valueType === 'controlledStatus') {
    return (
      <SingleChoiceEntryPage
        fieldDefinition={fieldDefinition}
        currentValue={storedValue}
        error={error}
        onSelectValue={onSelectChoice}
        onNavigateUpDirectory={onCancelEntry}
      />
    );
  }

  if (fieldDefinition?.valueType === 'multiSelect') {
    return (
      <MultiChoiceEntryPage
        fieldDefinition={fieldDefinition}
        selectedValues={multiChoiceValues}
        error={error}
        onToggleValue={onToggleMultiChoice}
        onCommit={onCommitMultiChoice}
        onNavigateUpDirectory={onCancelEntry}
      />
    );
  }

  if (fieldDefinition?.valueType === 'number') {
    return (
      <NumericEntryPage
        field={field}
        fieldDefinition={fieldDefinition}
        value={value}
        error={error}
        onChangeText={onChangeText}
        onSubmit={onSubmit}
        onCancelEntry={onCancelEntry}
        focusToken={focusToken}
        activeHintId={activeHintId}
        onDismissHint={onDismissHint}
        heldCommandDescription={heldCommandDescription}
        notesSurface={notesSurface}
        noteEditing={noteEditing}
        noteValue={noteValue}
        onChangeNote={onChangeNote}
        presentationMode={presentationMode}
      />
    );
  }

  return (
    <TextEntryPage
      field={field}
      value={value}
      error={error}
      onChangeText={onChangeText}
      onSubmit={onSubmit}
      onCancelEntry={onCancelEntry}
      focusToken={focusToken}
      activeHintId={activeHintId}
      onDismissHint={onDismissHint}
      heldCommandDescription={heldCommandDescription}
      notesSurface={notesSurface}
      noteEditing={noteEditing}
      noteValue={noteValue}
      onChangeNote={onChangeNote}
      presentationMode={presentationMode}
    />
  );
}
