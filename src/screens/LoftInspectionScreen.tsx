import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActiveFindingFocus } from '@/components/active-finding-focus';
import { CommandDock } from '@/components/command-dock';
import { FindingsLedgerModal } from '@/components/findings-ledger-modal';
import { GoldenZonePttSurface } from '@/components/golden-zone-ptt-surface';
import { OntologyDictionaryHUD } from '@/components/ontology-dictionary-hud';
import { Colors, Fonts, Spacing, Type } from '@/constants/theme';
import {
  useVoiceFindingPipeline,
  type AcousticState,
} from '@/hooks/use-voice-finding-pipeline';
import type { InspectionFinding } from '@/lib/inspection-findings';
import { photoCountForFinding } from '@/lib/inspection-findings';
import {
  formatSlotCommand,
  SLOT_VALUE_SUGGESTIONS,
  slotValueFromCommand,
} from '@/lib/slot-command';
import {
  DEFAULT_COMMAND_PLACEHOLDER,
  HELP_TEXT,
  parseEnglishCommand,
  type ParsedEnglishCommand,
} from '@/lib/cli/english-command-parser';
import { SVYR_BAR_LAYOUT } from '@/lib/svyr-bar-navigation';
import { selectOntologySamplePhrase } from '@/domain/ontology/room-registry';

/** SVYR paper field — loft voice HUD uses this exclusively. */
const PAPER = '#F4F4F0';
const INK = '#20262B';
const INK_MUTED = '#737A7D';

export type { AcousticState };

export type LoftFindingFeedItem = {
  id: string;
  conditionRating: InspectionFinding['conditionRating'];
  clause: {
    observation: string;
    implication: string;
    recommendation: string;
  };
  missingSlots: readonly string[];
  photoCount: number;
  photoUris: readonly string[];
};

export function toLoftFindingFeedItem(
  finding: InspectionFinding,
): LoftFindingFeedItem {
  return {
    id: finding.id,
    conditionRating: finding.conditionRating,
    clause: {
      observation: finding.observation,
      implication: finding.implication,
      recommendation: finding.recommendation,
    },
    missingSlots: finding.missingSlots,
    photoUris: finding.photoUris ?? [],
    photoCount: photoCountForFinding(finding),
  };
}

export type LoftInspectionScreenProps = {
  caseId: string;
  findings: readonly LoftFindingFeedItem[];
  acousticState: AcousticState;
  onBack: () => void;
  mutateFindingSlot: (
    caseId: string,
    findingId: string,
    slotName: string,
    value: string,
  ) => void | Promise<InspectionFinding>;
  processTranscript?: (
    caseId: string,
    transcript: string,
  ) => void | Promise<InspectionFinding>;
  onPhotoPress?: () => void;
  photoFlash?: boolean;
  onPttPressIn?: () => void;
  onPttPressOut?: () => void;
  transcribedText?: string | null;
  latestTranscript?: string | null;
  streamingTranscript?: string;
  activeRoom?: string;
};

export type LoftInspectionScreenConnectedProps = {
  caseId: string;
  onBack: () => void;
};

/**
 * Voice-pipeline-backed loft screen — wires findings feed, slot mutation, and PTT.
 */
export function LoftInspectionScreenConnected({
  caseId,
  onBack,
}: LoftInspectionScreenConnectedProps) {
  const {
    acousticState,
    streamingTranscript,
    latestTranscript,
    findings,
    processTranscript,
    mutateFindingSlot,
    handlePttPressIn,
    handlePttPressOut,
    captureAndAttachPhoto,
  } = useVoiceFindingPipeline(caseId, { activeRoom: 'roof void' });
  const [photoFlash, setPhotoFlash] = useState(false);

  const handlePhotoPress = useCallback(async () => {
    const attached = await captureAndAttachPhoto();
    if (!attached) return;
    setPhotoFlash(true);
    setTimeout(() => {
      setPhotoFlash(false);
    }, 700);
  }, [captureAndAttachPhoto]);

  return (
    <LoftInspectionScreen
      caseId={caseId}
      findings={findings.map(toLoftFindingFeedItem)}
      acousticState={acousticState}
      streamingTranscript={streamingTranscript}
      transcribedText={latestTranscript}
      latestTranscript={latestTranscript}
      activeRoom="roof_void"
      onBack={onBack}
      mutateFindingSlot={mutateFindingSlot}
      processTranscript={processTranscript}
      onPhotoPress={() => {
        void handlePhotoPress();
      }}
      photoFlash={photoFlash}
      onPttPressIn={() => {
        void handlePttPressIn();
      }}
      onPttPressOut={() => {
        void handlePttPressOut();
      }}
    />
  );
}

type ActiveSlotTarget = {
  findingId: string;
  slotName: string;
};

function BracketLabel({
  children,
  muted = false,
  accent = false,
}: {
  children: string;
  muted?: boolean;
  accent?: boolean;
}) {
  return (
    <Text
      style={[
        styles.bracket,
        muted ? styles.bracketMuted : null,
        accent ? styles.bracketAccent : null,
      ]}>
      [{children}]
    </Text>
  );
}

function BracketButton({
  label,
  onPress,
  accessibilityLabel,
  accent = false,
}: {
  label: string;
  onPress?: () => void;
  accessibilityLabel: string;
  accent?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={SVYR_BAR_LAYOUT.hitSlop}
      style={({ pressed }) => [
        styles.bracketButton,
        pressed ? styles.bracketButtonPressed : null,
      ]}>
      <Text style={[styles.bracket, accent ? styles.bracketAccent : null]}>
        {`[${label}]`}
      </Text>
    </Pressable>
  );
}

/**
 * Minimalist SVYR Voice HUD for loft / roof-void inspection.
 * Single Active Finding HUD (State A), Committed Log Ledger, and pinned dock.
 */
export function LoftInspectionScreen({
  caseId,
  findings,
  acousticState,
  onBack,
  mutateFindingSlot,
  processTranscript,
  onPhotoPress,
  photoFlash = false,
  onPttPressIn,
  onPttPressOut,
  transcribedText = null,
  latestTranscript = null,
  streamingTranscript,
  activeRoom = 'roof_void',
}: LoftInspectionScreenProps) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [commandValue, setCommandValue] = useState('');
  const [dockFocusToken, setDockFocusToken] = useState(0);
  const [dockFeedback, setDockFeedback] = useState<string | null>(null);
  const [isDictOpen, setIsDictOpen] = useState(false);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [activeSlotTarget, setActiveSlotTarget] =
    useState<ActiveSlotTarget | null>(null);
  const resolvedTranscribedText = transcribedText ?? latestTranscript ?? null;

  // Auto-commit partitioning: latest finding is active, earlier findings are committed
  const activeFinding = findings.length > 0 ? findings[findings.length - 1] : null;
  const committedFindings = findings.length > 1 ? findings.slice(0, -1) : [];

  const commandSuggestions = useMemo(() => {
    if (!activeSlotTarget) return [];
    return SLOT_VALUE_SUGGESTIONS[activeSlotTarget.slotName] ?? [];
  }, [activeSlotTarget]);

  const resetDockPrompt = useCallback(() => {
    setActiveSlotTarget(null);
    setCommandValue('');
  }, []);

  const submitSlotValue = useCallback(
    async (findingId: string, slotName: string, rawValue: string) => {
      const value = slotValueFromCommand(rawValue, slotName);
      if (!value) return;
      await mutateFindingSlot(caseId, findingId, slotName, value);
      resetDockPrompt();
    },
    [caseId, mutateFindingSlot, resetDockPrompt],
  );

  const handleNudgeSlotKeyword = useCallback((slotName: string) => {
    if (slotName === 'photo') {
      onPhotoPress?.();
      return;
    }
    const keyword = slotName === 'recommendation' ? 'recommend' : slotName;
    setCommandValue(`${keyword} `);
    setDockFocusToken((token) => token + 1);
  }, [onPhotoPress]);

  const handleCommandSubmit = useCallback(
    async (parsedCmd?: ParsedEnglishCommand) => {
      const trimmed = commandValue.trim();
      if (!trimmed) return;

      if (activeSlotTarget) {
        await submitSlotValue(
          activeSlotTarget.findingId,
          activeSlotTarget.slotName,
          trimmed,
        );
        setDockFeedback(`✓ ${activeSlotTarget.slotName.toUpperCase()} UPDATED`);
        return;
      }

      const cmd = parsedCmd ?? parseEnglishCommand(trimmed);

      switch (cmd.type) {
        case 'invalid': {
          setDockFeedback(cmd.message);
          break;
        }
        case 'help': {
          setDockFeedback(HELP_TEXT);
          setCommandValue('');
          break;
        }
        case 'list': {
          const count = findings.length;
          const roomName = activeRoom.replace(/_/g, ' ');
          setDockFeedback(
            count === 0
              ? `No findings in ${roomName}`
              : `${count} finding${count > 1 ? 's' : ''} in ${roomName} (${committedFindings.length} committed)`,
          );
          setCommandValue('');
          break;
        }
        case 'room': {
          setDockFeedback(
            `✓ ROOM → ${cmd.room.replace(/_/g, ' ').toUpperCase()}`,
          );
          setCommandValue('');
          break;
        }
        case 'finding': {
          if (processTranscript) {
            await processTranscript(
              caseId,
              `Macro: ${cmd.severity} ${cmd.text}`,
            );
            setDockFeedback(
              `✓ ${cmd.severity} FINDING ADDED\n${cmd.text}`,
            );
          }
          resetDockPrompt();
          break;
        }
        case 'slot': {
          const targetFinding = activeFinding ?? findings[findings.length - 1] ?? findings[0];
          if (!targetFinding) {
            setDockFeedback(
              `SVYR > No finding available for "${cmd.slot}".\nAdd one first with urgent, defect, or routine.`,
            );
            break;
          }
          const slotKey =
            cmd.slot === 'recommendation' ? 'referral' : cmd.slot;
          await mutateFindingSlot(caseId, targetFinding.id, slotKey, cmd.value);
          setDockFeedback(
            `✓ ${cmd.slot.toUpperCase()} → ${targetFinding.id}\n${cmd.value}`,
          );
          resetDockPrompt();
          break;
        }
        case 'photo': {
          for (let i = 0; i < cmd.count; i++) {
            onPhotoPress?.();
          }
          setDockFeedback(
            `✓ ${cmd.count} PHOTO${cmd.count > 1 ? 'S' : ''} CAPTURED`,
          );
          resetDockPrompt();
          break;
        }
        case 'tag': {
          setDockFeedback(`✓ TAG ADDED: ${cmd.value}`);
          resetDockPrompt();
          break;
        }
        case 'undo': {
          setDockFeedback('✓ LAST ENTRY REMOVED');
          resetDockPrompt();
          break;
        }
      }
    },
    [
      activeFinding,
      activeRoom,
      activeSlotTarget,
      caseId,
      commandValue,
      committedFindings.length,
      findings,
      mutateFindingSlot,
      onPhotoPress,
      processTranscript,
      resetDockPrompt,
      submitSlotValue,
    ],
  );

  const handleApplySuggestion = useCallback(
    (suggestion: string) => {
      if (!activeSlotTarget) return;
      void submitSlotValue(
        activeSlotTarget.findingId,
        activeSlotTarget.slotName,
        formatSlotCommand(activeSlotTarget.slotName) + suggestion,
      );
    },
    [activeSlotTarget, submitSlotValue],
  );

  const handleSelectSamplePhrase = useCallback((phrase: string) => {
    const next = selectOntologySamplePhrase(phrase);
    setActiveSlotTarget(null);
    setCommandValue(next.dockBuffer);
    setIsDictOpen(next.isDictOpen);
    setDockFocusToken((token) => token + 1);
  }, []);

  const handleSelectCommand = useCallback((val: string) => {
    setCommandValue((prev) => {
      const trimmed = prev.trim();
      const firstWord = trimmed.split(/\s+/)[0]?.toLowerCase();
      const keywords = ['urgent', 'defect', 'routine', 'location', 'recommend', 'material', 'room', 'photo'];
      
      if (firstWord && keywords.includes(firstWord)) {
        return `${firstWord} ${val}`;
      }
      return val;
    });
  }, []);

  const listening =
    acousticState === 'LISTENING' || acousticState === 'PARSING';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.upper}>
        <View style={styles.header}>
          <BracketButton
            label="< back"
            onPress={onBack}
            accessibilityLabel="Go back"
          />
          <View style={styles.headerMeta}>
            <BracketLabel>{`room: ${activeRoom.replace(/_/g, ' ')}`}</BracketLabel>
            <BracketButton
              label={`log: ${committedFindings.length}`}
              accent={isLedgerOpen}
              onPress={() => setIsLedgerOpen(true)}
              accessibilityLabel="View findings ledger"
            />
          </View>
        </View>

        <ActiveFindingFocus
          finding={activeFinding}
          onNudgeSlot={handleNudgeSlotKeyword}
          onPhotoPress={onPhotoPress}
        />

        <FindingsLedgerModal
          isOpen={isLedgerOpen}
          onClose={() => setIsLedgerOpen(false)}
          findings={committedFindings}
        />

        <OntologyDictionaryHUD
          isOpen={isDictOpen}
          activeRoom={activeRoom}
          onSelectSamplePhrase={handleSelectSamplePhrase}
          onClose={() => setIsDictOpen(false)}
        />
      </View>

      {onPttPressIn || onPttPressOut ? (
        <GoldenZonePttSurface
          onPttStart={() => onPttPressIn?.()}
          onPttEnd={() => onPttPressOut?.()}
          currentInputText={commandValue}
          onHelpPress={() => setIsDictOpen((open) => !open)}
          onSelectCommand={handleSelectCommand}
          cliOutputRows={dockFeedback ? dockFeedback.split('\n') : []}
        />
      ) : null}

      <View
        style={[
          styles.dockHost,
          { paddingBottom: Math.max(insets.bottom, Spacing.xs) },
        ]}>
        <CommandDock
          variant="terminal"
          infoBarText={null}
          commandValue={commandValue}
          onCommandValueChange={setCommandValue}
          onCommandSubmit={(parsed) => {
            void handleCommandSubmit(parsed);
          }}
          commandSuggestions={commandSuggestions}
          onApplyCommandSuggestion={handleApplySuggestion}
          acousticState={acousticState}
          pttActive={listening}
          focusToken={dockFocusToken}
          inputRef={inputRef}
          commandPlaceholder={
            activeSlotTarget
              ? formatSlotCommand(activeSlotTarget.slotName)
              : DEFAULT_COMMAND_PLACEHOLDER
          }
          transcribedText={resolvedTranscribedText}
          streamingTranscript={streamingTranscript}
          onReset={resetDockPrompt}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PAPER,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D5D2CA',
    zIndex: 50,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  upper: {
    flex: 1,
  },
  dockHost: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#D5D2CA',
    backgroundColor: PAPER,
    zIndex: 50,
  },
  bracket: {
    fontFamily: Fonts.mono,
    fontSize: Type.mono,
    color: INK,
  },
  bracketMuted: {
    color: INK_MUTED,
  },
  bracketAccent: {
    color: Colors.accent,
  },
  bracketButton: {
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  bracketButtonPressed: {
    opacity: 0.65,
  },
});
