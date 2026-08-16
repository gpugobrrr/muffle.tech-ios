import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  LAPTOP_MIN_VIEWPORT_WIDTH,
  readCssInputCapabilities,
  resolvePresentationMode,
} from '../src/lib/presentation-mode';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('automatic laptop mode requires web, a wide viewport, and fine hover pointer when known', () => {
  assert.equal(
    resolvePresentationMode({
      platform: 'web',
      viewportWidth: LAPTOP_MIN_VIEWPORT_WIDTH,
      pointer: 'fine',
      hover: 'hover',
    }),
    'laptop',
  );
});

test('web alone does not select laptop mode', () => {
  assert.equal(
    resolvePresentationMode({
      platform: 'web',
      viewportWidth: 390,
      pointer: 'fine',
      hover: 'hover',
    }),
    'touch',
  );
  assert.equal(
    resolvePresentationMode({
      platform: 'ios',
      viewportWidth: 1366,
      pointer: 'fine',
      hover: 'hover',
    }),
    'touch',
  );
  assert.equal(
    resolvePresentationMode({
      platform: 'android',
      viewportWidth: 1280,
    }),
    'touch',
  );
});

test('landscape phones stay on touch even when the session is web', () => {
  assert.equal(
    resolvePresentationMode({
      platform: 'web',
      viewportWidth: 844,
      pointer: 'coarse',
      hover: 'none',
    }),
    'touch',
  );
  assert.equal(
    resolvePresentationMode({
      platform: 'web',
      viewportWidth: 932,
    }),
    'touch',
  );
});

test('wide web viewports with coarse pointer remain touch-capable', () => {
  assert.equal(
    resolvePresentationMode({
      platform: 'web',
      viewportWidth: 1180,
      pointer: 'coarse',
      hover: 'none',
    }),
    'touch',
  );
});

test('explicit preference overrides automatic detection', () => {
  assert.equal(
    resolvePresentationMode({
      platform: 'web',
      viewportWidth: 1440,
      pointer: 'fine',
      hover: 'hover',
      preference: 'touch',
    }),
    'touch',
  );
  assert.equal(
    resolvePresentationMode({
      platform: 'web',
      viewportWidth: 390,
      pointer: 'coarse',
      hover: 'none',
      preference: 'laptop',
    }),
    'laptop',
  );
  assert.equal(
    resolvePresentationMode({
      platform: 'ios',
      viewportWidth: 390,
      preference: 'laptop',
    }),
    'laptop',
  );
});

test('unavailable matchMedia or unknown pointer/hover falls back to touch', () => {
  const capabilities = readCssInputCapabilities(null);
  assert.deepEqual(capabilities, { pointer: null, hover: null });
  assert.equal(
    resolvePresentationMode({
      platform: 'web',
      viewportWidth: 1280,
      pointer: capabilities.pointer,
      hover: capabilities.hover,
    }),
    'touch',
  );
  assert.equal(
    resolvePresentationMode({
      platform: 'web',
      viewportWidth: 1440,
      pointer: null,
      hover: 'hover',
    }),
    'touch',
  );
  assert.equal(
    resolvePresentationMode({
      platform: 'web',
      viewportWidth: 1440,
      pointer: 'fine',
      hover: null,
    }),
    'touch',
  );
});

test('explicit laptop preference wins when capability detection is unavailable', () => {
  assert.equal(
    resolvePresentationMode({
      platform: 'web',
      viewportWidth: 1440,
      pointer: null,
      hover: null,
      preference: 'laptop',
    }),
    'laptop',
  );
  assert.equal(
    resolvePresentationMode({
      platform: 'ios',
      viewportWidth: 390,
      pointer: null,
      hover: null,
      preference: 'laptop',
    }),
    'laptop',
  );
});

test('readCssInputCapabilities maps fine pointer and hover queries', () => {
  assert.deepEqual(
    readCssInputCapabilities((query) => ({
      matches: query === '(pointer: fine)' || query === '(hover: hover)',
    })),
    { pointer: 'fine', hover: 'hover' },
  );
  assert.deepEqual(
    readCssInputCapabilities((query) => ({
      matches: query === '(pointer: coarse)' || query === '(hover: none)',
    })),
    { pointer: 'coarse', hover: 'none' },
  );
});

test('split keyboard is retained in touch mode and omitted in laptop mode', () => {
  const textPage = readSrc('src/components/text-entry-page.tsx');
  assert.match(textPage, /presentationMode = 'touch'/);
  assert.match(textPage, /isLaptopPresentation \? null : \(/);
  assert.match(textPage, /<SplitTextKeyboard/);
  assert.match(textPage, /showSoftInputOnFocus=\{isLaptopPresentation\}/);
});

test('shared text and numeric commit callbacks stay on the existing entry path', () => {
  const textPage = readSrc('src/components/text-entry-page.tsx');
  const numericPage = readSrc('src/components/numeric-entry-page.tsx');
  const panel = readSrc('src/components/svyr-data-entry-panel.tsx');
  const svyr = readSrc('src/components/svyr-interface.tsx');
  const workspace = readSrc('src/hooks/use-workspace.ts');

  assert.match(textPage, /onChangeText=\{onChangeText\}/);
  assert.match(textPage, /onSubmitEditing=\{onSubmit\}/);
  assert.match(textPage, /onChangeText=\{handleCustomKeyboardChange\}/);
  assert.match(textPage, /onSubmit=\{handleCustomKeyboardSubmit\}/);
  assert.match(numericPage, /onChangeText=\{onChangeText\}/);
  assert.match(numericPage, /onSubmit=\{onSubmit\}/);
  assert.match(panel, /presentationMode=\{presentationMode\}/);
  assert.match(svyr, /usePresentationMode\(\)/);
  assert.match(svyr, /presentationMode=\{presentationMode\}/);
  assert.doesNotMatch(workspace, /presentationMode|usePresentationMode/);
});
