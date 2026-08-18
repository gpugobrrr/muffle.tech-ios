import React from 'react';
// @ts-expect-error react-dom server types not included in devDependencies
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-native')>();
  return {
    ...actual,
    Modal: ({ children, visible }: any) => (visible ? children : null),
  };
});

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

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import {
  ActiveFindingFocus,
  type ActiveFindingItem,
} from '../src/components/active-finding-focus';
import { FindingsLedgerModal } from '../src/components/findings-ledger-modal';
import {
  LoftInspectionScreen,
  type LoftFindingFeedItem,
} from '../src/screens/LoftInspectionScreen';

describe('ActiveFindingFocus (State A Focus HUD) & FindingsLedgerModal', () => {
  it('renders empty prompt when no active finding exists', () => {
    const onNudgeSlot = vi.fn();
    const html = renderToStaticMarkup(
      <ActiveFindingFocus finding={null} onNudgeSlot={onNudgeSlot} />,
    );

    expect(html).toContain('[active finding: none]');
    expect(html).toContain('SVYR &gt; ready for finding');
  });

  it('renders active finding card with condition rating, clauses, and slot nudges', () => {
    const onNudgeSlot = vi.fn();
    const onPhotoPress = vi.fn();

    const finding: ActiveFindingItem = {
      id: 'f-101',
      conditionRating: 'CR2',
      clause: {
        observation: 'Deflection observed at rear rafter pair',
        implication: 'Risk of structural roof spread',
        recommendation: 'Instruct structural engineer assessment',
      },
      missingSlots: ['location', 'material', 'recommend'],
      photoCount: 2,
      photoUris: ['file:///img1.jpg', 'file:///img2.jpg'],
    };

    const html = renderToStaticMarkup(
      <ActiveFindingFocus
        finding={finding}
        onNudgeSlot={onNudgeSlot}
        onPhotoPress={onPhotoPress}
      />,
    );

    expect(html).toContain('[CR2]');
    expect(html).toContain('[photo × 2]');
    expect(html).toContain('[obs]');
    expect(html).toContain('Deflection observed at rear rafter pair');
    expect(html).toContain('[imp]');
    expect(html).toContain('Risk of structural roof spread');
    expect(html).toContain('[rec]');
    expect(html).toContain('Instruct structural engineer assessment');
    expect(html).toContain('[+ location]');
    expect(html).toContain('[+ material]');
    expect(html).toContain('[+ recommend]');
    expect(html).toContain('[+ photo]');
  });

  it('renders FindingsLedgerModal with committed findings list and close trigger', () => {
    const onClose = vi.fn();
    const findings: LoftFindingFeedItem[] = [
      {
        id: 'f-1',
        conditionRating: 'CR3',
        clause: {
          observation: 'Active water ingress at valley gutter',
          implication: 'Rot in roof timbers',
          recommendation: 'Immediate repair by roofing contractor',
        },
        missingSlots: [],
        photoCount: 1,
        photoUris: ['file:///valley.jpg'],
      },
    ];

    const html = renderToStaticMarkup(
      <FindingsLedgerModal
        isOpen={true}
        onClose={onClose}
        findings={findings}
      />,
    );

    expect(html).toContain('[LOG LEDGER: 1 committed]');
    expect(html).toContain('[close ✕]');
    expect(html).toContain('[CR3]');
    expect(html).toContain('Active water ingress at valley gutter');
  });

  it('renders LoftInspectionScreen with [log: N] header count reflecting auto-commit partition', () => {
    const findings: LoftFindingFeedItem[] = [
      {
        id: 'f-1',
        conditionRating: 'CR1',
        clause: {
          observation: 'Minor cosmetic staining on collar tie',
          implication: 'Historical dryness',
          recommendation: 'Monitor at regular intervals',
        },
        missingSlots: [],
        photoCount: 0,
        photoUris: [],
      },
      {
        id: 'f-2',
        conditionRating: 'CR2',
        clause: {
          observation: 'Missing loft hatch insulation',
          implication: 'Heat loss and condensation',
          recommendation: 'Fit draught seal and insulation quilt',
        },
        missingSlots: ['location'],
        photoCount: 0,
        photoUris: [],
      },
    ];

    const html = renderToStaticMarkup(
      <LoftInspectionScreen
        caseId="case-1"
        findings={findings}
        acousticState="STANDBY"
        onBack={vi.fn()}
        mutateFindingSlot={vi.fn()}
      />,
    );

    // Header has [log: 1] (f-1 is committed, f-2 is active)
    expect(html).toContain('[log: 1]');
    // Active HUD shows f-2
    expect(html).toContain('Missing loft hatch insulation');
    // f-1 is not in the active single card HUD
    expect(html).not.toContain('Minor cosmetic staining on collar tie');
  });
});
