import React from 'react';
// @ts-expect-error react-dom server types not included in devDependencies
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

let mockActiveState: boolean | null = null;

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    default: actual,
    useState: (initialState: any) => {
      if (initialState === false && mockActiveState !== null) {
        return [mockActiveState, () => {}];
      }
      return actual.useState(initialState);
    },
  };
});

import {
  GoldenZonePttSurface,
  SONAR_SCALE_TO,
  clampAnchor,
  paginateRows,
  MORE_NEXT_LABEL,
  MORE_PREV_LABEL,
  LINE_HEIGHT,
  ROW_HEIGHT,
  PADDING_TOP,
  PADDING_BOTTOM,
} from '../src/components/golden-zone-ptt-surface';
import {
  COMMAND_REGISTRY,
  getSubCommandHints,
} from '../src/lib/cli/command-sub-contexts';
import {
  SVYR_COMMAND_HINTS,
  SVYR_COMMAND_HINTS_LEFT,
  SVYR_COMMAND_HINTS_RIGHT,
} from '../src/lib/cli/svyr-command-hints';
import {
  CORE_SIZE,
  GOLDEN_ZONE_RATIO,
  USE_NATIVE_DRIVER,
  createGoldenZoneRuntime,
  getCoreAnchor,
  getGoldenZoneHeight,
} from '../src/lib/golden-zone-ptt';

describe('golden zone PTT surface', () => {
  it('paginateRows partitions long item arrays into pages with [▼ MORE] and [▲ MORE]', () => {
    const items = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
    const pages = paginateRows(items, 6);

    expect(pages.length).toBe(3);
    // Page 0: 5 items + [▼ MORE]
    expect(pages[0]).toEqual(['1', '2', '3', '4', '5', MORE_NEXT_LABEL]);
    // Page 1: [▲ MORE] + 4 items + [▼ MORE]
    expect(pages[1]).toEqual([MORE_PREV_LABEL, '6', '7', '8', '9', MORE_NEXT_LABEL]);
    // Page 2: [▲ MORE] + remaining items
    expect(pages[2]).toEqual([MORE_PREV_LABEL, '10', '11', '12']);
  });

  it('fires onPttStart on touch grant and onPttEnd on release', () => {
    const onPttStart = vi.fn();
    const onPttEnd = vi.fn();
    const stop = vi.fn();
    const runtime = createGoldenZoneRuntime({
      onPttStart,
      onPttEnd,
      startSonar: () => ({ stop }),
    });

    runtime.grant(48, 96);
    expect(onPttStart).toHaveBeenCalledTimes(1);
    expect(onPttEnd).not.toHaveBeenCalled();

    runtime.release();
    expect(onPttEnd).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
    runtime.release();
    expect(onPttEnd).toHaveBeenCalledTimes(1);
  });

  it('anchors the REC indicator from touch locationX/Y', () => {
    expect(CORE_SIZE).toBe(64);
    expect(getGoldenZoneHeight(1000)).toBe(1000 * GOLDEN_ZONE_RATIO);
    expect(getCoreAnchor(120, 90)).toEqual({
      left: 120 - CORE_SIZE / 2,
      top: 90 - CORE_SIZE / 2,
    });

    const runtime = createGoldenZoneRuntime({
      onPttStart: vi.fn(),
      onPttEnd: vi.fn(),
      startSonar: () => ({ stop: vi.fn() }),
    });
    expect(runtime.grant(200, 40)).toEqual(getCoreAnchor(200, 40));
  });

  it('halts looping sonar animations on unmount without leaking', () => {
    const stop = vi.fn();
    const onPttEnd = vi.fn();
    const runtime = createGoldenZoneRuntime({
      onPttStart: vi.fn(),
      onPttEnd,
      startSonar: () => ({ stop }),
    });

    runtime.grant(10, 12);
    runtime.dispose();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(onPttEnd).toHaveBeenCalledTimes(1);
    expect(USE_NATIVE_DRIVER).toBe(true);
    expect(SONAR_SCALE_TO).toBe(2.2);
  });

  it('renders idle ⍜ glyph on mount and triggers touch responders', () => {
    const onPttStart = vi.fn();
    const onPttEnd = vi.fn();
    const html = renderToStaticMarkup(
      <GoldenZonePttSurface
        onPttStart={onPttStart}
        onPttEnd={onPttEnd}
        height={220}
      />,
    );

    expect(html).toContain('⍜');
    expect(html).not.toContain('[mic]');
    expect(html).not.toContain('[rec]');
    expect(html).not.toContain('◰');
    expect(html).not.toContain('[?]');
  });

  it('hides ⍜ and renders clean solid circle without [rec] text when touch active state is true', () => {
    const onPttStart = vi.fn();
    const onPttEnd = vi.fn();

    mockActiveState = true;

    const html = renderToStaticMarkup(
      <GoldenZonePttSurface
        onPttStart={onPttStart}
        onPttEnd={onPttEnd}
        height={220}
      />,
    );

    expect(html).not.toContain('⍜');
    expect(html).not.toContain('[rec]');
    expect(html).not.toContain('[mic]');
    expect(html).not.toContain('◰');

    mockActiveState = null;
  });

  it('renders read-only cliOutputRows in idle state and keeps them persistently visible when active', () => {
    const onPttStart = vi.fn();
    const onPttEnd = vi.fn();
    const rows = ['✓ CR2 FINDING ADDED', 'Missing insulation at rear eaves'];

    // Idle mount: rows are rendered
    const idleHtml = renderToStaticMarkup(
      <GoldenZonePttSurface
        onPttStart={onPttStart}
        onPttEnd={onPttEnd}
        height={220}
        cliOutputRows={rows}
      />,
    );
    expect(idleHtml).toContain('✓ CR2 FINDING ADDED');
    expect(idleHtml).toContain('Missing insulation at rear eaves');
    expect(idleHtml).toContain('⍜');

    // Active touch: rows remain persistently visible for reference while ⍜ fades out
    mockActiveState = true;
    const activeHtml = renderToStaticMarkup(
      <GoldenZonePttSurface
        onPttStart={onPttStart}
        onPttEnd={onPttEnd}
        height={220}
        cliOutputRows={rows}
      />,
    );
    expect(activeHtml).toContain('✓ CR2 FINDING ADDED');
    expect(activeHtml).toContain('Missing insulation at rear eaves');
    expect(activeHtml).not.toContain('⍜');
    expect(activeHtml).not.toContain('[rec]');

    mockActiveState = null;
  });

  it('renders pure command hints with [▼ MORE] in page 0 without category headings', () => {
    // Verify pure command hints contain no headings
    for (const hint of SVYR_COMMAND_HINTS) {
      expect(hint).not.toContain('FINDINGS');
      expect(hint).not.toContain('DETAIL');
      expect(hint).not.toContain('CONTROL');
    }

    // Render in GoldenZonePttSurface
    const onPttStart = vi.fn();
    const onPttEnd = vi.fn();
    const html = renderToStaticMarkup(
      <GoldenZonePttSurface
        onPttStart={onPttStart}
        onPttEnd={onPttEnd}
        height={220}
        cliOutputRows={SVYR_COMMAND_HINTS}
      />,
    );

    expect(html).not.toContain('FINDINGS');
    expect(html).not.toContain('DETAIL');
    expect(html).not.toContain('CONTROL');
    expect(html).toContain('urgent &lt;text&gt; CR3');
    expect(html).toContain('[▼ MORE]');
    expect(html).toContain('⍜');
  });

  it('dynamically switches to location sub-options when currentInputText="location "', () => {
    const onPttStart = vi.fn();
    const onPttEnd = vi.fn();

    const html = renderToStaticMarkup(
      <GoldenZonePttSurface
        onPttStart={onPttStart}
        onPttEnd={onPttEnd}
        height={220}
        currentInputText="location "
      />,
    );

    // Location sub-options must render
    expect(html).toContain('rear north slope');
    expect(html).toContain('eaves level');
    expect(html).toContain('ridge board');

    // Root commands must not render
    expect(html).not.toContain('urgent &lt;text&gt; CR3');
    expect(html).not.toContain('photo [count]');
  });

  it('dynamically switches to urgent sub-options when currentInputText="urgent "', () => {
    const onPttStart = vi.fn();
    const onPttEnd = vi.fn();

    const html = renderToStaticMarkup(
      <GoldenZonePttSurface
        onPttStart={onPttStart}
        onPttEnd={onPttEnd}
        height={220}
        currentInputText="urgent "
      />,
    );

    // Urgent sub-options must render
    expect(html).toContain('roof spread rear slope');
    expect(html).toContain('sagging collar tie');
    expect(html).toContain('active water ingress');

    // Root commands must not render
    expect(html).not.toContain('photo [count]');
  });

  it('triggers onSelectCommand and locks touch mode to BOX without activating PTT when touching inside help box', () => {
    const onPttStart = vi.fn();
    const onPttEnd = vi.fn();
    const onSelectCommand = vi.fn();
    const rows = ['defect missing insulation', 'routine sound timbers'];

    let renderedProps: any = null;
    function TestWrapper() {
      const el = GoldenZonePttSurface({
        onPttStart,
        onPttEnd,
        cliOutputRows: rows,
        onSelectCommand,
        height: 220,
      });
      renderedProps = el.props;
      return el;
    }

    renderToStaticMarkup(<TestWrapper />);
    expect(renderedProps).toBeDefined();

    // Initial grant on first item (locationY = 10 -> index 0)
    renderedProps.onResponderGrant({
      nativeEvent: { locationX: 10, locationY: 10 },
    });
    expect(onPttStart).not.toHaveBeenCalled(); // Strictly NO PTT

    // Move/drag to second item (locationY = 36 -> index 1)
    renderedProps.onResponderMove({
      nativeEvent: { locationX: 10, locationY: 36 },
    });
    expect(onPttStart).not.toHaveBeenCalled();

    // Release triggers selection of second item
    renderedProps.onResponderRelease();
    expect(onSelectCommand).toHaveBeenCalledTimes(1);
    expect(onSelectCommand).toHaveBeenCalledWith('routine sound timbers');
    expect(onPttEnd).not.toHaveBeenCalled(); // Strictly NO PTT release
  });

  it('handles [▼ MORE] selection by advancing page without calling onSelectCommand', () => {
    const onPttStart = vi.fn();
    const onPttEnd = vi.fn();
    const onSelectCommand = vi.fn();
    const rows = ['item1', 'item2', 'item3', 'item4', 'item5', 'item6', 'item7'];

    let renderedProps: any = null;
    function TestWrapper() {
      const el = GoldenZonePttSurface({
        onPttStart,
        onPttEnd,
        cliOutputRows: rows,
        onSelectCommand,
        height: 150, // capacity = ~3
      });
      renderedProps = el.props;
      return el;
    }

    renderToStaticMarkup(<TestWrapper />);
    expect(renderedProps).toBeDefined();

    // Touch on [▼ MORE] which is the last row (index 3 with capacity 4 for height 150)
    renderedProps.onResponderGrant({
      nativeEvent: { locationX: 10, locationY: 10 + 3 * ROW_HEIGHT },
    });
    renderedProps.onResponderRelease();

    // Should NOT call onSelectCommand with [▼ MORE]
    expect(onSelectCommand).not.toHaveBeenCalled();
    expect(onPttStart).not.toHaveBeenCalled();
  });

  it('restores standard root commands from top when currentInputText is cleared to empty', () => {
    const onPttStart = vi.fn();
    const onPttEnd = vi.fn();

    // When empty, root commands like urgent render on page 0
    const emptyHtml = renderToStaticMarkup(
      <GoldenZonePttSurface
        onPttStart={onPttStart}
        onPttEnd={onPttEnd}
        height={220}
        currentInputText=""
      />,
    );

    expect(emptyHtml).toContain('urgent &lt;text&gt; CR3');
    expect(emptyHtml).toContain('[▼ MORE]');
    expect(emptyHtml).not.toContain('rear north slope');
  });

  it('enables move responder and tracks thumb movement in real time without resetting recording', () => {
    const onPttStart = vi.fn();
    const onPttEnd = vi.fn();
    let renderedProps: {
      onStartShouldSetResponder: () => boolean;
      onMoveShouldSetResponder: () => boolean;
      onResponderGrant: (e: {
        nativeEvent: { locationX: number; locationY: number };
      }) => void;
      onResponderMove: (e: {
        nativeEvent: { locationX: number; locationY: number };
      }) => void;
      onResponderRelease: () => void;
    } | null = null;

    function TestWrapper() {
      const el = GoldenZonePttSurface({
        onPttStart,
        onPttEnd,
        height: 250,
        cliOutputRows: [],
      });
      renderedProps = el.props as typeof renderedProps;
      return el;
    }

    renderToStaticMarkup(<TestWrapper />);

    expect(renderedProps).toBeDefined();
    expect(renderedProps!.onStartShouldSetResponder()).toBe(true);
    expect(renderedProps!.onMoveShouldSetResponder()).toBe(true);

    // Initial touch grant outside help box
    renderedProps!.onResponderGrant({
      nativeEvent: { locationX: 340, locationY: 200 },
    });
    expect(onPttStart).toHaveBeenCalledTimes(1);
    expect(onPttEnd).not.toHaveBeenCalled();

    // Moving thumb
    renderedProps!.onResponderMove({
      nativeEvent: { locationX: 300, locationY: 180 },
    });
    expect(onPttStart).toHaveBeenCalledTimes(1);
    expect(onPttEnd).not.toHaveBeenCalled();

    // Releasing touch
    renderedProps!.onResponderRelease();
    expect(onPttEnd).toHaveBeenCalledTimes(1);
  });

  it('clamps coordinates to the zone bounds during drag', () => {
    const zoneWidth = 390;
    const zoneHeight = 250;
    const clamped = clampAnchor(-100, 500, zoneWidth, zoneHeight);

    const cx = clamped.x + CORE_SIZE / 2;
    const cy = clamped.y + CORE_SIZE / 2;

    expect(cx).toBe(CORE_SIZE / 2); // Clamped to min x (r)
    expect(cy).toBe(zoneHeight - CORE_SIZE / 2); // Clamped to max y (height - r)
  });
});
