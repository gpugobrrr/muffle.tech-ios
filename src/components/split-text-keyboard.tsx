import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { Colors, Fonts, Spacing, Type } from '@/constants/theme';

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  showNumericMode?: boolean;
};

const ALPHA_LEFT_ROWS = ['QWERT', 'ASDFG', 'ZXCV'];
const ALPHA_RIGHT_ROWS = ['YUIOP', 'HJKL', 'BNM'];
const NUMERIC_LEFT_ROWS = ['12345', '-/:;(', '.,?!\''];
const NUMERIC_RIGHT_ROWS = ['67890', ')$&@"', '#%+=*'];
const KEYBOARD_BOTTOM_COMFORT_PADDING = Spacing.md;
const KEYBOARD_BOTTOM_LIFT = Spacing.md;
const LEFT_PANEL_PATH =
  'M 4 0 H 88 C 98 0 103 22 103 50 C 103 78 98 100 88 100 H 4 Q 0 100 0 96 V 4 Q 0 0 4 0 Z';

export function SplitTextKeyboard({
  value,
  onChangeText,
  onSubmit,
  disabled = false,
  showNumericMode = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const [shift, setShift] = useState(false);
  const [mode, setMode] = useState<'alpha' | 'numeric'>('alpha');
  const appendText = (text: string) => {
    if (disabled) return;
    const next = `${value}${text}`;
    onChangeText(next);
  };

  const appendLetter = (letter: string) => {
    if (mode === 'alpha') {
      appendText(shift ? letter : letter.toLowerCase());
    } else {
      appendText(letter);
    }
    setShift(false);
  };

  const leftRows = mode === 'alpha' ? ALPHA_LEFT_ROWS : NUMERIC_LEFT_ROWS;
  const rightRows = mode === 'alpha' ? ALPHA_RIGHT_ROWS : NUMERIC_RIGHT_ROWS;

  const renderLetterRow = (
    letters: string,
    rowIndex: number,
    side: 'left' | 'right',
  ) => (
    <View
      key={`${side}-row-${letters}`}
      style={[
        styles.keyRow,
        side === 'left' ? LEFT_ROW_OFFSETS[rowIndex] : RIGHT_ROW_OFFSETS[rowIndex],
      ]}>
      {letters.split('').map((letter) => (
        <Key
          key={letter}
          label={shift ? letter : letter.toLowerCase()}
          disabled={disabled}
          feedback="letter"
          style={styles.letterKey}
          onPress={() => appendLetter(letter)}
        />
      ))}
    </View>
  );

  return (
    <View
        style={[
          styles.keyboard,
          {
            paddingLeft: Spacing.md + insets.left,
            paddingRight: Spacing.md + insets.right,
            paddingBottom: insets.bottom + KEYBOARD_BOTTOM_COMFORT_PADDING,
          },
        ]}
        accessibilityLabel="Split text keyboard">
        <View style={styles.keyboardHalf}>
          <PanelSurface side="left" />
          <View style={styles.leftControlRow}>
            <View style={styles.controlSurface}>
              {mode === 'alpha' ? (
                <Key
                  label="SHIFT"
                  disabled={disabled}
                  active={shift}
                  accessibilityLabel={shift ? 'Shift on' : 'Shift off'}
                  style={styles.centerKey}
                  onPress={() => setShift((current) => !current)}
                />
              ) : null}
              <Key
                label={mode === 'alpha' ? '123' : 'ABC'}
                disabled={disabled || !showNumericMode}
                accessibilityLabel={
                  mode === 'alpha' ? 'Switch to numeric mode' : 'Switch to alphabet mode'
                }
                style={styles.centerKey}
                onPress={() => {
                  setMode((current) => (current === 'alpha' ? 'numeric' : 'alpha'));
                  setShift(false);
                }}
              />
            </View>
          </View>
          <View style={styles.letterArea}>
            {leftRows.map((row, index) => renderLetterRow(row, index, 'left'))}
          </View>
        </View>

        <View style={styles.keyboardHalf}>
          <PanelSurface side="right" />
          <View style={styles.enterRow}>
            <View style={styles.enterControlSurface}>
              <Key
                label="ENTER"
                disabled={disabled}
                style={styles.enterKey}
                onPress={onSubmit}
              />
            </View>
          </View>
          <View style={styles.letterArea}>
            {rightRows.map((row, index) => renderLetterRow(row, index, 'right'))}
          </View>
        </View>
    </View>
  );
}

function PanelSurface({ side }: { side: 'left' | 'right' }) {
  return (
    <Svg
      pointerEvents="none"
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      overflow="visible"
      style={styles.panelSurface}>
      <Path
        d={LEFT_PANEL_PATH}
        fill={Colors.concrete}
        transform={side === 'right' ? 'translate(100 0) scale(-1 1)' : undefined}
      />
    </Svg>
  );
}

type KeyProps = {
  label: string;
  onPress: () => void;
  disabled: boolean;
  active?: boolean;
  feedback?: 'letter' | 'control';
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

function Key({
  label,
  onPress,
  disabled,
  active = false,
  feedback = 'control',
  accessibilityLabel,
  style,
}: KeyProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.key,
        style,
        active ? styles.keyActive : null,
        pressed && feedback === 'control' ? styles.keyPressed : null,
        disabled ? styles.keyDisabled : null,
      ]}>
      {({ pressed }) =>
        feedback === 'letter' ? (
          <View
            style={[
              styles.letterFeedback,
              pressed && !disabled ? styles.letterFeedbackPressed : null,
            ]}>
            <Text style={styles.letterText}>{label}</Text>
          </View>
        ) : (
          <Text style={styles.keyText}>{label}</Text>
        )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'relative',
    flexShrink: 0,
    marginBottom: KEYBOARD_BOTTOM_LIFT,
  },
  keyboardHalf: {
    width: '44%',
    flexDirection: 'column',
    position: 'relative',
    padding: Spacing.xs,
    paddingBottom: KEYBOARD_BOTTOM_COMFORT_PADDING,
  },
  panelSurface: {
    ...StyleSheet.absoluteFillObject,
  },
  letterArea: {
    flexDirection: 'column',
    gap: 0,
  },
  keyRow: {
    flexDirection: 'row',
    gap: 0,
    minHeight: 44,
  },
  leftControlRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  controlSurface: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  rowStart: {
    paddingRight: Spacing.sm,
  },
  rowInset: {
    paddingLeft: Spacing.sm,
    paddingRight: Spacing.sm,
  },
  rowDoubleInset: {
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.sm,
  },
  rowEnd: {
    paddingLeft: Spacing.sm,
  },
  rowEndInset: {
    paddingLeft: Spacing.sm,
    paddingRight: Spacing.sm,
  },
  rowEndDoubleInset: {
    paddingLeft: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  key: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterKey: {
    flex: 1,
  },
  letterFeedback: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  letterFeedbackPressed: {
    backgroundColor: Colors.accentSoft,
  },
  enterSpacer: {
    minHeight: 44,
  },
  enterRow: {
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  enterControlSurface: {
    minHeight: 44,
    width: 64,
  },
  centerKey: {
    width: 44,
  },
  enterKey: {
    width: 64,
  },
  keyActive: {
    backgroundColor: Colors.accentSoft,
  },
  keyPressed: {
    backgroundColor: Colors.accentSoft,
  },
  keyDisabled: {
    opacity: 0.5,
  },
  keyText: {
    fontFamily: Fonts.mono,
    fontSize: Type.body,
    color: Colors.text,
  },
  letterText: {
    fontFamily: Fonts.mono,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
});

const LEFT_ROW_OFFSETS = [
  styles.rowStart,
  styles.rowInset,
  styles.rowDoubleInset,
] as const;

const RIGHT_ROW_OFFSETS = [
  styles.rowEnd,
  styles.rowEndInset,
  styles.rowEndDoubleInset,
] as const;
