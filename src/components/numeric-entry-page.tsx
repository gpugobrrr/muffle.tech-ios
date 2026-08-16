import type { ReactNode } from 'react';

import { TextEntryPage } from '@/components/text-entry-page';
import type { ActiveEntryField } from '@/hooks/use-workspace';
import type { FieldDefinition } from '@/lib/field-schema';
import type { SvyrHintId } from '@/lib/hint-repository';
import type { PresentationMode } from '@/lib/presentation-mode';

type Props = {
  field: ActiveEntryField;
  fieldDefinition: FieldDefinition;
  value: string;
  error: string | null;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
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

/**
 * Reusable scalar numeric capture. Raw draft remains a string; validation and
 * Engine writes happen only on explicit ENTER through the shared commit path.
 * Fixed units are display metadata only.
 */
export function NumericEntryPage({
  field,
  fieldDefinition,
  value,
  error,
  onChangeText,
  onSubmit,
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
      initialKeyboardMode="numeric"
      displayUnit={fieldDefinition.numeric?.displayUnit ?? null}
      allowSpaceGesture={false}
      presentationMode={presentationMode}
    />
  );
}
