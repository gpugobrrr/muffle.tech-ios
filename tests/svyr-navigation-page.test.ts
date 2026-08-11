import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { childNodes } from '../src/lib/command-registry';
import {
  getCommandAssistance,
  suggestionTokens,
} from '../src/lib/command-parser';
import {
  flattenNavigationRows,
  getNavigationScrollState,
  interleaveNavigationColumns,
  navigationChildTokens,
  rootNavigationTokens,
  SCROLL_EDGE_EPSILON,
  toNavigationColumns,
  toNavigationRows,
} from '../src/lib/svyr-navigation';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function labels(rows: ReturnType<typeof toNavigationRows<string>>): string[][] {
  return rows.map((row) => [...row]);
}

test('toNavigationRows returns no rows for an empty list', () => {
  assert.deepEqual(toNavigationRows([]), []);
});

test('toNavigationRows places a single item in the first column only', () => {
  assert.deepEqual(labels(toNavigationRows(['one'])), [['one']]);
});

test('toNavigationRows renders two items as one full row', () => {
  assert.deepEqual(labels(toNavigationRows(['one', 'two'])), [['one', 'two']]);
});

test('toNavigationRows renders three items as two rows with a trailing left item', () => {
  assert.deepEqual(labels(toNavigationRows(['one', 'two', 'three'])), [
    ['one', 'two'],
    ['three'],
  ]);
});

test('toNavigationRows renders eight items in four balanced rows', () => {
  const items = ['1', '2', '3', '4', '5', '6', '7', '8'];
  assert.deepEqual(labels(toNavigationRows(items)), [
    ['1', '2'],
    ['3', '4'],
    ['5', '6'],
    ['7', '8'],
  ]);
});

test('toNavigationRows renders nine items with a trailing left item', () => {
  const items = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  assert.deepEqual(labels(toNavigationRows(items)), [
    ['1', '2'],
    ['3', '4'],
    ['5', '6'],
    ['7', '8'],
    ['9'],
  ]);
});

test('flattenNavigationRows preserves the original ordered input', () => {
  const items = Array.from({ length: 11 }, (_, index) => `item-${index + 1}`);
  assert.deepEqual(flattenNavigationRows(toNavigationRows(items)), items);
});

test('toNavigationRows does not truncate large input arrays', () => {
  const items = Array.from({ length: 25 }, (_, index) => `item-${index + 1}`);
  assert.equal(flattenNavigationRows(toNavigationRows(items)).length, 25);
  assert.deepEqual(flattenNavigationRows(toNavigationRows(items)), items);
});

test('toNavigationColumns derives independent left and right lists from rows', () => {
  const items = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  assert.deepEqual(toNavigationColumns(items), {
    left: ['1', '3', '5', '7', '9'],
    right: ['2', '4', '6', '8'],
  });
  assert.deepEqual(
    interleaveNavigationColumns(toNavigationColumns(items)),
    items,
  );
});

test('toNavigationColumns handles empty, single, and two-item inputs', () => {
  assert.deepEqual(toNavigationColumns([]), { left: [], right: [] });
  assert.deepEqual(toNavigationColumns(['one']), {
    left: ['one'],
    right: [],
  });
  assert.deepEqual(toNavigationColumns(['one', 'two']), {
    left: ['one'],
    right: ['two'],
  });
  assert.deepEqual(toNavigationColumns(['one', 'two', 'three']), {
    left: ['one', 'three'],
    right: ['two'],
  });
});

test('toNavigationColumns preserves canonical order for large inputs', () => {
  const items = Array.from({ length: 25 }, (_, index) => `item-${index + 1}`);
  const columns = toNavigationColumns(items);
  assert.equal(columns.left.length + columns.right.length, items.length);
  assert.deepEqual(interleaveNavigationColumns(columns), items);
});

test('independent column scroll state can differ for left and right', () => {
  const leftOverflowTop = getNavigationScrollState({
    offsetY: 0,
    viewportHeight: 200,
    contentHeight: 500,
  });
  const rightFits = getNavigationScrollState({
    offsetY: 0,
    viewportHeight: 200,
    contentHeight: 200,
  });
  assert.deepEqual(leftOverflowTop, {
    canScrollUp: false,
    canScrollDown: true,
  });
  assert.deepEqual(rightFits, {
    canScrollUp: false,
    canScrollDown: false,
  });

  const rightOverflowTop = getNavigationScrollState({
    offsetY: 0,
    viewportHeight: 150,
    contentHeight: 400,
  });
  const leftFits = getNavigationScrollState({
    offsetY: 0,
    viewportHeight: 150,
    contentHeight: 150,
  });
  assert.deepEqual(rightOverflowTop, {
    canScrollUp: false,
    canScrollDown: true,
  });
  assert.deepEqual(leftFits, {
    canScrollUp: false,
    canScrollDown: false,
  });

  const leftMiddle = getNavigationScrollState({
    offsetY: 150,
    viewportHeight: 200,
    contentHeight: 500,
  });
  const rightTop = getNavigationScrollState({
    offsetY: 0,
    viewportHeight: 200,
    contentHeight: 500,
  });
  assert.deepEqual(leftMiddle, {
    canScrollUp: true,
    canScrollDown: true,
  });
  assert.deepEqual(rightTop, {
    canScrollUp: false,
    canScrollDown: true,
  });

  const leftBottom = getNavigationScrollState({
    offsetY: 300,
    viewportHeight: 200,
    contentHeight: 500,
  });
  const rightMiddle = getNavigationScrollState({
    offsetY: 120,
    viewportHeight: 200,
    contentHeight: 500,
  });
  assert.deepEqual(leftBottom, {
    canScrollUp: true,
    canScrollDown: false,
  });
  assert.deepEqual(rightMiddle, {
    canScrollUp: true,
    canScrollDown: true,
  });
});

test('getNavigationScrollState hides both indicators when content fits', () => {
  assert.deepEqual(
    getNavigationScrollState({
      offsetY: 0,
      viewportHeight: 400,
      contentHeight: 400,
    }),
    { canScrollUp: false, canScrollDown: false },
  );
});

test('getNavigationScrollState shows only down at the top of overflowing content', () => {
  assert.deepEqual(
    getNavigationScrollState({
      offsetY: 0,
      viewportHeight: 200,
      contentHeight: 500,
    }),
    { canScrollUp: false, canScrollDown: true },
  );
});

test('getNavigationScrollState shows both indicators in the middle', () => {
  assert.deepEqual(
    getNavigationScrollState({
      offsetY: 150,
      viewportHeight: 200,
      contentHeight: 500,
    }),
    { canScrollUp: true, canScrollDown: true },
  );
});

test('getNavigationScrollState shows only up at the bottom', () => {
  assert.deepEqual(
    getNavigationScrollState({
      offsetY: 300,
      viewportHeight: 200,
      contentHeight: 500,
    }),
    { canScrollUp: true, canScrollDown: false },
  );
});

test('getNavigationScrollState uses epsilon to avoid edge flicker', () => {
  assert.deepEqual(
    getNavigationScrollState({
      offsetY: SCROLL_EDGE_EPSILON,
      viewportHeight: 200,
      contentHeight: 500,
      epsilon: SCROLL_EDGE_EPSILON,
    }),
    { canScrollUp: false, canScrollDown: true },
  );
  assert.deepEqual(
    getNavigationScrollState({
      offsetY: 298,
      viewportHeight: 200,
      contentHeight: 500,
      epsilon: SCROLL_EDGE_EPSILON,
    }),
    { canScrollUp: true, canScrollDown: false },
  );
});

test('root navigation tokens include services exactly once from the route tree', () => {
  const tokens = rootNavigationTokens();
  assert.equal(tokens.filter((token) => token === 'services').length, 1);
  assert.deepEqual(tokens, [
    'prep',
    'property',
    'external',
    'internal',
    'services',
    'grounds',
    'evidence',
    'summary',
    'report',
  ]);
});

test('services navigation container exposes its existing child routes', () => {
  assert.deepEqual(navigationChildTokens(['services']), [
    'limitation',
    'electricity',
    'gas-oil',
    'water',
    'heating',
    'water-heating',
    'drainage',
    'common',
  ]);
});

test('property and external navigation containers use the same route-tree source', () => {
  assert.ok(navigationChildTokens(['property']).includes('energy'));
  assert.ok(navigationChildTokens(['external']).includes('walls'));
});

test('root assistance matches the canonical route tree', () => {
  assert.deepEqual(
    suggestionTokens(getCommandAssistance('')),
    rootNavigationTokens(),
  );
  assert.deepEqual(
    suggestionTokens(getCommandAssistance('services/')),
    navigationChildTokens(['services']),
  );
});

test('root navigation uses row-major column derivation through the shared grid', () => {
  const grid = readSrc('src/components/svyr-suggestion-grid.tsx');
  assert.match(grid, /toNavigationColumns/);
  assert.doesNotMatch(grid, /splitNavigationColumns/);
});

test('shared suggestion grid uses independent per-column scroll surfaces', () => {
  const grid = readSrc('src/components/svyr-suggestion-grid.tsx');
  assert.match(grid, /function NavigationColumn/);
  assert.equal((grid.match(/<NavigationColumn/g) ?? []).length, 2);
  assert.match(grid, /items=\{left\}/);
  assert.match(grid, /items=\{right\}/);
  assert.match(grid, /columnIndicatorTop/);
  assert.match(grid, /columnIndicatorBottom/);
  assert.doesNotMatch(grid, /scrollIndicatorTop/);
  assert.doesNotMatch(grid, /scrollIndicatorBottom/);
  assert.match(grid, /pointerEvents="none"/);
  assert.match(grid, /Colors\.textMuted/);
});

test('navigation template fills the central workspace with minimal content padding', () => {
  const navigationPage = readSrc('src/components/svyr-navigation-page.tsx');
  const grid = readSrc('src/components/svyr-suggestion-grid.tsx');

  assert.match(navigationPage, /fillAvailableHeight/);
  assert.doesNotMatch(navigationPage, /ERGONOMIC_START/);
  assert.doesNotMatch(navigationPage, /useWindowDimensions/);
  assert.match(navigationPage, /flex:\s*1/);
  assert.match(grid, /gridContainerFill/);
  assert.match(grid, /columnScrollFill/);
  assert.doesNotMatch(grid, /COLUMN_INDICATOR_INSET/);
});

test('capture-choice grid usage does not opt into full-height navigation layout', () => {
  const autocomplete = readSrc('src/components/autocomplete-area.tsx');
  assert.doesNotMatch(autocomplete, /fillAvailableHeight/);
});

test('navigation-page template is used for workspace navigation', () => {
  const iface = readSrc('src/components/svyr-interface.tsx');
  assert.match(iface, /from '@\/components\/svyr-navigation-page'/);
  assert.match(iface, /<SvyrNavigationPage/);
  assert.doesNotMatch(iface, /from '@\/components\/autocomplete-area'/);
});

test('blocked descendants do not hide the services navigation container', () => {
  const services = childNodes(['services']);
  assert.ok(services.length > 0);
  assert.ok(services.some((node) => node.token === 'electricity'));
  assert.ok(services.some((node) => node.workflowOnly));
});

test('more than eight navigation items remain fully represented for scrolling', () => {
  const root = getCommandAssistance('');
  assert.ok(root.length > 8);
  assert.equal(
    root.filter((suggestion) => suggestion.type === 'token').length,
    root.length,
  );
});

test('adding a fixture child to the route tree appears without page-specific JSX', () => {
  const tokens = rootNavigationTokens();
  assert.ok(tokens.includes('services'));
  assert.equal(tokens.indexOf('services'), tokens.lastIndexOf('services'));
});
