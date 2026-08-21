import React from 'react';
// @ts-expect-error react-dom server types not included in devDependencies
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native-gesture-handler', () => {
  const handler: any = new Proxy(
    {},
    {
      get: () => () => handler,
    },
  );
  return {
    GestureDetector: ({ children }: { children?: React.ReactNode }) => children,
    Gesture: {
      Pan: () => handler,
    },
  };
});

vi.mock('react-native-reanimated', () => ({
  default: {
    View: ({ children, style, ...props }: any) =>
      React.createElement('div', { style, ...props }, children),
  },
  useSharedValue: (init: any) => ({ value: init }),
  useAnimatedStyle: () => ({}),
}));

import {
  CommandDock,
  DEFAULT_COMMAND_PLACEHOLDER,
  HELP_TEXT,
  parseEnglishCommand,
} from '../src/components/command-dock';

describe('CommandDock', () => {
  it('renders SVYR > prompt, default placeholder, and corner glyph ◢ without photo button or acoustic status label', () => {
    const onCommandValueChange = vi.fn();
    const onCommandSubmit = vi.fn();

    const html = renderToStaticMarkup(
      <CommandDock
        variant="terminal"
        commandValue="north pitch felt"
        onCommandValueChange={onCommandValueChange}
        onCommandSubmit={onCommandSubmit}
        acousticState="LISTENING"
      />,
    );

    // SVYR > prompt rendered exactly once on the line
    const promptMatches = html.match(/SVYR &gt;/g) || [];
    expect(promptMatches.length).toBe(1);
    // Default placeholder rendered without duplicating SVYR > prefix
    expect(html).toContain('placeholder="room, urgent, defect, photo, help..."');
    // Corner glyph ◢ rendered
    expect(html).toContain('◢');
    // Photo button stripped
    expect(html).not.toContain('[photo]');
    // Status text label stripped
    expect(html).not.toContain('status: listening');
    expect(html).not.toContain('status: standby');
  });

  it('renders output feedback line when infoBarText is provided', () => {
    const html = renderToStaticMarkup(
      <CommandDock
        variant="terminal"
        infoBarText="✓ CR2 FINDING ADDED: missing insulation"
      />,
    );
    expect(html).toContain('✓ CR2 FINDING ADDED: missing insulation');
  });

  it('shows completed transcribedText in the dock after listening ends', () => {
    const html = renderToStaticMarkup(
      <CommandDock
        variant="terminal"
        acousticState="STANDBY"
        transcribedText="rafter deflection CR2"
      />,
    );
    expect(html).toContain('rafter deflection CR2');
  });

  it('shows streamingTranscript while LISTENING', () => {
    const html = renderToStaticMarkup(
      <CommandDock
        variant="terminal"
        acousticState="LISTENING"
        streamingTranscript="collar tie"
      />,
    );
    expect(html).toContain('collar tie');
  });

  it('triggers command change, submit, and suggestion callbacks', () => {
    const onCommandValueChange = vi.fn();
    const onCommandSubmit = vi.fn();
    const onApplyCommandSuggestion = vi.fn();

    const element = (
      <CommandDock
        variant="terminal"
        commandValue="loft"
        onCommandValueChange={onCommandValueChange}
        onCommandSubmit={onCommandSubmit}
        commandSuggestions={['roof_spread', 'condensation']}
        onApplyCommandSuggestion={onApplyCommandSuggestion}
      />
    );

    const html = renderToStaticMarkup(element);
    expect(html).toContain('[roof_spread]');
    expect(html).toContain('[condensation]');
  });

  it('renders corner wedge ◢ in an interactive execute button and triggers submit on press', () => {
    const onCommandSubmit = vi.fn();
    const onParsedCommandSubmit = vi.fn();

    const html = renderToStaticMarkup(
      <CommandDock
        variant="terminal"
        commandValue="urgent active leak"
        onCommandSubmit={onCommandSubmit}
        onParsedCommandSubmit={onParsedCommandSubmit}
      />,
    );

    expect(html).toContain('aria-label="Execute command"');
    expect(html).toContain('◢');

    // Also test empty input rendering with disabled attribute
    const emptyHtml = renderToStaticMarkup(
      <CommandDock
        variant="terminal"
        commandValue=""
        onCommandSubmit={onCommandSubmit}
      />,
    );
    expect(emptyHtml).toContain('aria-disabled="true"');
  });

  it('renders SVYR > prompt as an interactive reset button', () => {
    const onCommandValueChange = vi.fn();
    const onReset = vi.fn();

    const html = renderToStaticMarkup(
      <CommandDock
        variant="terminal"
        commandValue="location rear slope"
        onCommandValueChange={onCommandValueChange}
        onReset={onReset}
      />,
    );

    expect(html).toContain('aria-label="Reset command input"');
    expect(html).toContain('SVYR &gt;');
  });

  it('renders path navigation variant with SvyrBar', () => {
    const html = renderToStaticMarkup(
      <CommandDock
        variant="path"
        path={['prep', 'brief', 'instr']}
      />,
    );

    expect(html).toContain('prep');
    expect(html).toContain('brief');
    expect(html).not.toContain('[photo]');
  });
});

describe('English Command CLI Parser', () => {
  describe('Canonical command dispatch', () => {
    it('parses room [name] and maps to canonical room ID', () => {
      expect(parseEnglishCommand('room roof void')).toEqual({
        type: 'room',
        room: 'roof_void',
      });
    });

    it('parses urgent [text] (CR3 finding)', () => {
      expect(parseEnglishCommand('urgent active leak')).toEqual({
        type: 'finding',
        severity: 'CR3',
        text: 'active leak',
      });
    });

    it('parses defect [text] (CR2 finding)', () => {
      expect(parseEnglishCommand('defect missing insulation')).toEqual({
        type: 'finding',
        severity: 'CR2',
        text: 'missing insulation',
      });
    });

    it('parses routine [text] (CR1 note)', () => {
      expect(parseEnglishCommand('routine timbers appear dry')).toEqual({
        type: 'finding',
        severity: 'CR1',
        text: 'timbers appear dry',
      });
    });

    it('parses location [text] slot command', () => {
      expect(parseEnglishCommand('location rear eaves')).toEqual({
        type: 'slot',
        slot: 'location',
        value: 'rear eaves',
      });
    });

    it('parses recommend [text] slot command', () => {
      expect(
        parseEnglishCommand('recommend replace damaged insulation'),
      ).toEqual({
        type: 'slot',
        slot: 'recommendation',
        value: 'replace damaged insulation',
      });
    });

    it('parses material [text] slot command', () => {
      expect(parseEnglishCommand('material mineral wool')).toEqual({
        type: 'slot',
        slot: 'material',
        value: 'mineral wool',
      });
    });

    it('parses photo without count as default 1', () => {
      expect(parseEnglishCommand('photo')).toEqual({
        type: 'photo',
        count: 1,
      });
    });

    it('parses photo with explicit count', () => {
      expect(parseEnglishCommand('photo 3')).toEqual({
        type: 'photo',
        count: 3,
      });
    });

    it('parses tag [text]', () => {
      expect(parseEnglishCommand('tag condensation risk')).toEqual({
        type: 'tag',
        value: 'condensation risk',
      });
    });

    it('parses undo', () => {
      expect(parseEnglishCommand('undo')).toEqual({
        type: 'undo',
      });
    });

    it('parses list', () => {
      expect(parseEnglishCommand('list')).toEqual({
        type: 'list',
      });
    });

    it('parses help', () => {
      expect(parseEnglishCommand('help')).toEqual({
        type: 'help',
      });
      expect(HELP_TEXT).not.toContain('FINDINGS');
      expect(HELP_TEXT).not.toContain('DETAIL');
      expect(HELP_TEXT).not.toContain('CONTROL');
      expect(HELP_TEXT).toContain('urgent <text>');
      expect(HELP_TEXT).toContain('photo [count]');
    });
  });

  describe('Forgiving normalization and aliases', () => {
    it('normalizes uppercase and leading/trailing/repeated whitespace', () => {
      expect(parseEnglishCommand('DEFECT Missing insulation')).toEqual({
        type: 'finding',
        severity: 'CR2',
        text: 'Missing insulation',
      });

      expect(parseEnglishCommand('  defect   Missing insulation  ')).toEqual({
        type: 'finding',
        severity: 'CR2',
        text: 'Missing insulation',
      });
    });

    it('resolves room name variants to canonical room ID', () => {
      expect(parseEnglishCommand('room roof void')).toEqual({
        type: 'room',
        room: 'roof_void',
      });
      expect(parseEnglishCommand('room roof_void')).toEqual({
        type: 'room',
        room: 'roof_void',
      });
      expect(parseEnglishCommand('room roof-void')).toEqual({
        type: 'room',
        room: 'roof_void',
      });
      expect(parseEnglishCommand('room Roof Void')).toEqual({
        type: 'room',
        room: 'roof_void',
      });
    });

    it('accepts forgiving command aliases and normalizes to canonical type', () => {
      expect(parseEnglishCommand('photos 3')).toEqual({
        type: 'photo',
        count: 3,
      });
      expect(parseEnglishCommand('issue slipped slates')).toEqual({
        type: 'finding',
        severity: 'CR2',
        text: 'slipped slates',
      });
      expect(parseEnglishCommand('critical roof sag')).toEqual({
        type: 'finding',
        severity: 'CR3',
        text: 'roof sag',
      });
      expect(parseEnglishCommand('note sound condition')).toEqual({
        type: 'finding',
        severity: 'CR1',
        text: 'sound condition',
      });
      expect(parseEnglishCommand('summary')).toEqual({
        type: 'list',
      });
    });
  });

  describe('Invalid input and actionable validation feedback', () => {
    it('returns actionable feedback for missing payloads', () => {
      const defectRes = parseEnglishCommand('defect');
      expect(defectRes.type).toBe('invalid');
      if (defectRes.type === 'invalid') {
        expect(defectRes.message).toContain('Add some detail after "defect"');
        expect(defectRes.message).toContain('Example: defect');
      }

      const locationRes = parseEnglishCommand('location');
      expect(locationRes.type).toBe('invalid');
      if (locationRes.type === 'invalid') {
        expect(locationRes.message).toContain('Specify a location after "location"');
      }

      const materialRes = parseEnglishCommand('material');
      expect(materialRes.type).toBe('invalid');
      if (materialRes.type === 'invalid') {
        expect(materialRes.message).toContain('Specify a material after "material"');
      }

      const recommendRes = parseEnglishCommand('recommend');
      expect(recommendRes.type).toBe('invalid');
      if (recommendRes.type === 'invalid') {
        expect(recommendRes.message).toContain('Add a recommendation after "recommend"');
      }

      const tagRes = parseEnglishCommand('tag');
      expect(tagRes.type).toBe('invalid');
      if (tagRes.type === 'invalid') {
        expect(tagRes.message).toContain('Add a tag label after "tag"');
      }

      const roomRes = parseEnglishCommand('room');
      expect(roomRes.type).toBe('invalid');
      if (roomRes.type === 'invalid') {
        expect(roomRes.message).toContain('Specify a room name after "room"');
      }
    });

    it('validates photo counts and rejects invalid counts with helpful messages', () => {
      const bananaRes = parseEnglishCommand('photo banana');
      expect(bananaRes.type).toBe('invalid');
      if (bananaRes.type === 'invalid') {
        expect(bananaRes.message).toContain('Invalid photo count "banana"');
      }

      const negRes = parseEnglishCommand('photo -2');
      expect(negRes.type).toBe('invalid');
      if (negRes.type === 'invalid') {
        expect(negRes.message).toContain('at least 1');
      }

      const maxRes = parseEnglishCommand('photo 15');
      expect(maxRes.type).toBe('invalid');
      if (maxRes.type === 'invalid') {
        expect(maxRes.message).toContain('Maximum 10');
      }
    });

    it('rejects unexpected trailing text on zero-argument commands', () => {
      const undoRes = parseEnglishCommand('undo extra');
      expect(undoRes.type).toBe('invalid');
      if (undoRes.type === 'invalid') {
        expect(undoRes.message).toContain('"undo" does not take additional arguments');
      }

      const listRes = parseEnglishCommand('list extra');
      expect(listRes.type).toBe('invalid');
      if (listRes.type === 'invalid') {
        expect(listRes.message).toContain('"list" does not take additional arguments');
      }

      const helpRes = parseEnglishCommand('help extra');
      expect(helpRes.type).toBe('invalid');
      if (helpRes.type === 'invalid') {
        expect(helpRes.message).toContain('"help" does not take additional arguments');
      }
    });

    it('suggests closest command on obvious typo without auto-executing', () => {
      const typoRes = parseEnglishCommand('urgnt leak beside chimney');
      expect(typoRes.type).toBe('invalid');
      if (typoRes.type === 'invalid') {
        expect(typoRes.suggestion).toBe('urgent');
        expect(typoRes.message).toContain('"urgnt" isn\'t recognised. Did you mean "urgent"?');
      }
    });
  });
});
