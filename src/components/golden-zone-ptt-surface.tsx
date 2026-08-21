import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';

import {
  getSubCommandHints,
} from '@/lib/cli/command-sub-contexts';
import { SVYR_COMMAND_HINTS } from '@/lib/cli/svyr-command-hints';
import {
  CORE_SIZE,
  createGoldenZoneRuntime,
  getGoldenZoneHeight,
  USE_NATIVE_DRIVER,
  type GoldenZoneRuntime,
} from '@/lib/golden-zone-ptt';

let Haptics: any = null;
try {
  Haptics = require('expo-haptics');
} catch (e) {
  // no-op
}

const triggerHaptic = () => {
  if (Haptics && Haptics.impactAsync && Haptics.ImpactFeedbackStyle) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
};

export const SONAR_SCALE_TO = 2.2;
const RING_MS = 1800;
const STAGGER_MS = 600;
const REC_BG = '#2C2C2C';
export const LINE_HEIGHT = 15;
export const ROW_HEIGHT = 26;
export const PADDING_TOP = 3;
export const PADDING_BOTTOM = 4;

export const MORE_NEXT_LABEL = '[▼ MORE]';
export const MORE_PREV_LABEL = '[▲ MORE]';

export function clampAnchor(
  locationX: number,
  locationY: number,
  zoneWidth: number,
  zoneHeight: number,
) {
  const r = CORE_SIZE / 2;
  const cx = Math.max(r, Math.min(locationX, zoneWidth - r));
  const cy = Math.max(r, Math.min(locationY, zoneHeight - r));
  return { x: cx - r, y: cy - r };
}

function nativeTiming(
  value: Animated.Value,
  toValue: number,
  duration: number,
) {
  return Animated.timing(value, {
    toValue,
    duration,
    easing: duration > 0 ? Easing.bezier(0.25, 0.1, 0.25, 1) : Easing.linear,
    useNativeDriver: USE_NATIVE_DRIVER,
  });
}

export function createSonarLoop(
  scale: Animated.Value,
  opacity: Animated.Value,
  delayMs = 0,
): Animated.CompositeAnimation {
  const pulse = Animated.loop(
    Animated.sequence([
      Animated.parallel([
        nativeTiming(scale, SONAR_SCALE_TO, RING_MS),
        nativeTiming(opacity, 0, RING_MS),
      ]),
      Animated.parallel([
        nativeTiming(scale, 1, 0),
        nativeTiming(opacity, 0.4, 0),
      ]),
    ]),
  );
  return delayMs > 0
    ? Animated.sequence([Animated.delay(delayMs), pulse])
    : pulse;
}

export function paginateRows(
  allRows: readonly string[],
  capacity: number,
): string[][] {
  if (allRows.length <= capacity) {
    return [[...allRows]];
  }
  const pages: string[][] = [];
  let cursor = 0;
  while (cursor < allRows.length) {
    const isFirstPage = pages.length === 0;
    const remaining = allRows.length - cursor;

    if (isFirstPage) {
      if (remaining <= capacity) {
        pages.push(allRows.slice(cursor));
        break;
      } else {
        const count = Math.max(1, capacity - 1);
        const slice = allRows.slice(cursor, cursor + count);
        pages.push([...slice, MORE_NEXT_LABEL]);
        cursor += count;
      }
    } else {
      if (remaining <= capacity - 1) {
        const slice = allRows.slice(cursor);
        pages.push([MORE_PREV_LABEL, ...slice]);
        break;
      } else {
        const count = Math.max(1, capacity - 2);
        const slice = allRows.slice(cursor, cursor + count);
        pages.push([MORE_PREV_LABEL, ...slice, MORE_NEXT_LABEL]);
        cursor += count;
      }
    }
  }
  return pages;
}

export type GoldenZonePttSurfaceProps = {
  onPttStart: () => void;
  onPttEnd: () => void;
  height?: number;
  cliOutputRows?: readonly string[] | string[];
  currentInputText?: string;
  onHelpPress?: () => void;
  onSelectCommand?: (command: string) => void;
};

export function GoldenZonePttSurface({
  onPttStart,
  onPttEnd,
  height = getGoldenZoneHeight(Dimensions.get('window').height),
  cliOutputRows = [],
  currentInputText,
  onSelectCommand,
}: GoldenZonePttSurfaceProps) {
  const windowWidth = Dimensions.get('window').width;
  const width = windowWidth > 0 ? windowWidth : 390;

  const coreScale = useRef(new Animated.Value(0)).current;
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const ringA = useRef({
    s: new Animated.Value(1),
    o: new Animated.Value(0.4),
  }).current;
  const ringB = useRef({
    s: new Animated.Value(1),
    o: new Animated.Value(0.4),
  }).current;
  const startRef = useRef(onPttStart);
  const endRef = useRef(onPttEnd);
  startRef.current = onPttStart;
  endRef.current = onPttEnd;

  const [active, setActive] = useState(false);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const scrubIndexRef = useRef<number | null>(null);
  const touchModeRef = useRef<'NONE' | 'BOX' | 'PTT'>('NONE');

  const [pageIndex, setPageIndex] = useState(0);

  const boxLayoutRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const runtimeRef = useRef<GoldenZoneRuntime | null>(null);
  if (!runtimeRef.current) {
    runtimeRef.current = createGoldenZoneRuntime({
      onPttStart: () => startRef.current(),
      onPttEnd: () => endRef.current(),
      startSonar: () => {
        coreScale.setValue(0);
        ringA.s.setValue(1);
        ringA.o.setValue(0.4);
        ringB.s.setValue(1);
        ringB.o.setValue(0.4);
        const core = Animated.spring(coreScale, {
          toValue: 1,
          friction: 5,
          tension: 140,
          useNativeDriver: USE_NATIVE_DRIVER,
        });
        const rings = [
          createSonarLoop(ringA.s, ringA.o, 0),
          createSonarLoop(ringB.s, ringB.o, STAGGER_MS),
        ];
        core.start();
        rings.forEach((ring) => ring.start());
        return {
          stop() {
            core.stop();
            rings.forEach((ring) => ring.stop());
            coreScale.setValue(0);
          },
        };
      },
    });
  }

  useEffect(() => () => runtimeRef.current?.dispose(), []);

  // Reset page and clear highlighted scrub index when input context changes or becomes empty
  useEffect(() => {
    setPageIndex(0);
    setScrubIndex(null);
    scrubIndexRef.current = null;
  }, [currentInputText]);

  const subHints = getSubCommandHints(currentInputText);
  const activeRows =
    subHints ??
    (cliOutputRows && cliOutputRows.length > 0
      ? cliOutputRows
      : SVYR_COMMAND_HINTS);

  // Height buffer: capacity keeps a clear 38px buffer above bottom edge so mic icon at bottom: 10 is untouched.
  const capacity = Math.max(
    2,
    Math.floor((height - 38 - (PADDING_TOP + PADDING_BOTTOM)) / ROW_HEIGHT),
  );

  const pages = useMemo(
    () => paginateRows(activeRows, capacity),
    [activeRows, capacity],
  );
  const safePageIndex = Math.min(pages.length - 1, Math.max(0, pageIndex));
  const displayedRows = pages[safePageIndex] ?? [];

  const isInsideBox = useCallback(
    (x: number, y: number): boolean => {
      if (displayedRows.length === 0) return false;
      const layout = boxLayoutRef.current;
      const boxWidth = layout && layout.width > 0 ? layout.width : width * 0.75;
      const boxHeight =
        layout && layout.height > 0
          ? layout.height
          : PADDING_TOP + PADDING_BOTTOM + displayedRows.length * ROW_HEIGHT;
      const boxX = layout?.x ?? 0;
      const boxY = layout?.y ?? 0;

      return (
        x >= boxX &&
        x <= boxX + boxWidth &&
        y >= boxY &&
        y <= boxY + boxHeight
      );
    },
    [displayedRows.length, width],
  );

  const getIndexFromLocationY = useCallback(
    (locationY: number) => {
      const boxY = boxLayoutRef.current?.y ?? 0;
      const relativeY = locationY - boxY;
      const idx = Math.floor((relativeY - PADDING_TOP) / ROW_HEIGHT);
      if (idx >= 0 && idx < displayedRows.length) {
        return idx;
      }
      return null;
    },
    [displayedRows.length],
  );

  const grant = useCallback(
    (event: GestureResponderEvent) => {
      try {
        Keyboard.dismiss();
      } catch {
        /* no-op in node tests */
      }
      const { locationX, locationY } = event.nativeEvent;

      if (isInsideBox(locationX, locationY)) {
        touchModeRef.current = 'BOX';
        const idx = getIndexFromLocationY(locationY);
        if (idx !== null && idx < displayedRows.length) {
          scrubIndexRef.current = idx;
          setScrubIndex(idx);
          triggerHaptic();
        }
        return;
      }

      touchModeRef.current = 'PTT';
      pan.setValue(clampAnchor(locationX, locationY, width, height));
      runtimeRef.current?.grant(locationX, locationY);
      setActive(true);
    },
    [pan, width, height, isInsideBox, getIndexFromLocationY, displayedRows.length],
  );

  const handleMove = useCallback(
    (event: GestureResponderEvent) => {
      const { locationX, locationY } = event.nativeEvent;

      if (touchModeRef.current === 'BOX') {
        const idx = getIndexFromLocationY(locationY);
        if (
          idx !== null &&
          idx < displayedRows.length &&
          scrubIndexRef.current !== idx
        ) {
          scrubIndexRef.current = idx;
          setScrubIndex(idx);
          triggerHaptic();
        }
        return;
      }

      if (touchModeRef.current === 'PTT') {
        pan.setValue(clampAnchor(locationX, locationY, width, height));
      }
    },
    [pan, width, height, getIndexFromLocationY, displayedRows.length],
  );

  const release = useCallback(() => {
    if (touchModeRef.current === 'BOX') {
      const selected = scrubIndexRef.current;
      scrubIndexRef.current = null;
      setScrubIndex(null);
      touchModeRef.current = 'NONE';

      if (selected !== null && displayedRows[selected]) {
        const selectedItem = displayedRows[selected];
        if (selectedItem === MORE_NEXT_LABEL) {
          setPageIndex((prev) => Math.min(pages.length - 1, prev + 1));
          triggerHaptic();
          return;
        }
        if (selectedItem === MORE_PREV_LABEL) {
          setPageIndex((prev) => Math.max(0, prev - 1));
          triggerHaptic();
          return;
        }
        onSelectCommand?.(selectedItem);
      }
      return;
    }

    if (touchModeRef.current === 'PTT') {
      runtimeRef.current?.release();
      setActive(false);
      touchModeRef.current = 'NONE';
    }
  }, [displayedRows, pages.length, onSelectCommand]);

  const handleBoxLayout = useCallback((event: LayoutChangeEvent) => {
    boxLayoutRef.current = event.nativeEvent.layout;
  }, []);

  return (
    <View
      accessibilityRole="button"
      accessibilityLabel="Hold anywhere in thumb zone to dictate"
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={grant}
      onResponderMove={handleMove}
      onResponderRelease={release}
      onResponderTerminate={release}
      style={[styles.zone, { height }]}>
      {displayedRows && displayedRows.length > 0 ? (
        <View
          pointerEvents="none"
          onLayout={handleBoxLayout}
          style={styles.unifiedBoxContainer}>
          {displayedRows.map((row, index) => {
            const isHighlighted = scrubIndex === index;
            const isMoreItem = row === MORE_NEXT_LABEL || row === MORE_PREV_LABEL;
            return (
              <View
                key={`${row}-${index}`}
                style={[
                  styles.clickableRow,
                  isHighlighted && styles.clickableRowActive,
                ]}>
                <Text
                  style={[
                    styles.outputRow,
                    isMoreItem && styles.moreRowText,
                    isHighlighted && styles.outputRowActive,
                  ]}>
                  {row}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {!active ? (
        <View pointerEvents="none" style={styles.micGlyphContainer}>
          <Text style={styles.idleGlyph}>⍜</Text>
        </View>
      ) : (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.anchorHost,
            { transform: pan.getTranslateTransform() },
          ]}>
          <Animated.View
            style={[
              styles.ring,
              { opacity: ringA.o, transform: [{ scale: ringA.s }] },
            ]}
          />
          <Animated.View
            style={[
              styles.ring,
              { opacity: ringB.o, transform: [{ scale: ringB.s }] },
            ]}
          />
          <Animated.View
            style={[
              styles.core,
              { transform: [{ scale: coreScale }] },
            ]}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  zone: {
    width: '100%',
    overflow: 'visible',
    backgroundColor: '#F8F7F4',
    borderTopWidth: 1,
    borderColor: '#E5E3DC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  anchorHost: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: CORE_SIZE,
    height: CORE_SIZE,
    pointerEvents: 'none',
    zIndex: 10,
  },
  unifiedBoxContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignSelf: 'flex-start',
    width: 'auto',
    backgroundColor: '#F0EFEA',
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#D8D6CE',
    paddingTop: PADDING_TOP,
    paddingBottom: PADDING_BOTTOM,
    paddingLeft: 4,
    paddingRight: 10,
    zIndex: 1,
  },
  singleColumnContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignSelf: 'flex-start',
    width: 'auto',
    backgroundColor: '#F0EFEA',
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#D8D6CE',
    paddingTop: PADDING_TOP,
    paddingBottom: PADDING_BOTTOM,
    paddingLeft: 4,
    paddingRight: 10,
    zIndex: 1,
  },
  clickableRow: {
    height: ROW_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  clickableRowActive: {
    backgroundColor: '#2C2C2C',
  },
  clickableRowPressed: {
    backgroundColor: '#2C2C2C',
  },
  outputRow: {
    fontSize: 11,
    lineHeight: LINE_HEIGHT,
    color: '#73716B',
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    includeFontPadding: false,
  },
  moreRowText: {
    color: '#A09E96',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  outputRowActive: {
    color: '#FFFFFF',
  },
  micGlyphContainer: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  idleGlyph: {
    color: '#A09E96',
    fontSize: 22,
    opacity: 0.6,
  },
  core: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: CORE_SIZE,
    height: CORE_SIZE,
    borderRadius: CORE_SIZE / 2,
    backgroundColor: REC_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: CORE_SIZE,
    height: CORE_SIZE,
    borderRadius: CORE_SIZE / 2,
    borderWidth: 1,
    borderColor: 'rgba(44, 44, 44, 0.25)',
  },
});
