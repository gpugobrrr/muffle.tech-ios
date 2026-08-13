import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CAPABILITY_KINDS,
  censusFromCapabilities,
  collectDuplicateKindIssues,
  collectUnclassifiedCountIssue,
  collectUnknownKindIssues,
} from '../src/core/capability';
import {
  openFrozenEditSession,
  resolveFrozenCommitTarget,
} from '../src/core/frozen-edit-session';
import { mediaRecordDirectory, mediaRelativePath } from '../src/core/local-media-store';
import { createOperationEngine } from '../src/core/operation-engine';
import {
  applyStateTransition,
  createJsonStateStore,
  resolveHydratedState,
  shouldPersistHydratedState,
} from '../src/core/persisted-state';
import { orderSelectionValues, toggleSelectionValue } from '../src/core/selection-set';

const CORE_DIR = join(dirname(fileURLToPath(import.meta.url)), '../src/core');

const FORBIDDEN_IMPORT_PATTERNS = [
  /^@\/lib\//,
  /^@\/domain\//,
  /^@\/types\//,
  /^@\/hooks\//,
  /^@\/components\//,
];

function coreSourceFiles(): string[] {
  return readdirSync(CORE_DIR)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => join(CORE_DIR, name));
}

function importedSpecifiers(source: string): string[] {
  return [
    ...source.matchAll(/from\s+['"]([^'"]+)['"]/g),
    ...source.matchAll(/require\(['"]([^'"]+)['"]\)/g),
  ].map((match) => match[1]);
}

test('generic core modules do not import survey-domain modules', () => {
  const files = coreSourceFiles();
  assert.ok(files.length >= 5);
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const specifier of importedSpecifiers(source)) {
      for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
        assert.equal(
          pattern.test(specifier),
          false,
          `${file} imports ${specifier}`,
        );
      }
    }
    assert.equal(source.includes('InspectionFinding'), false, file);
    assert.equal(source.includes('InspectionElementConceptId'), false, file);
    assert.equal(source.includes('building_element.'), false, file);
    assert.equal(source.includes('service_system.'), false, file);
    assert.equal(source.includes('ActiveJob'), false, file);
  }
});

test('generic operation engine executes a non-survey handler without survey imports', () => {
  type ListingState = { price: number };
  const engine = createOperationEngine<
    ListingState,
    { operationId: string; arguments: { price?: number } },
    ListingState
  >({
    handlers: {
      'listing.price.set': (state, request) => {
        const price = request.arguments.price;
        if (typeof price !== 'number') return null;
        return { ...state, price };
      },
    },
  });
  assert.equal(engine.has('listing.price.set'), true);
  assert.equal(engine.has('survey.inspection.finding.upsert'), false);
  const next = engine.execute(
    { price: 0 },
    { operationId: 'listing.price.set', arguments: { price: 250000 } },
  );
  assert.deepEqual(next, { price: 250000 });
  assert.equal(
    engine.execute({ price: 0 }, { operationId: 'unknown.op', arguments: {} }),
    null,
  );
});

test('generic capability census and validation operate on synthetic non-survey data', () => {
  const capabilities = [
    { route: 'listings', kind: CAPABILITY_KINDS.navigation },
    { route: 'listings/price', kind: CAPABILITY_KINDS.capture },
    { route: 'brochure', kind: CAPABILITY_KINDS.derived },
    { route: 'epc', kind: CAPABILITY_KINDS.blocked },
  ];
  const census = censusFromCapabilities(capabilities);
  assert.deepEqual(census, {
    total: 4,
    capture: 1,
    navigation: 1,
    derived: 1,
    blocked: 1,
    unclassified: 0,
  });
  assert.deepEqual(collectDuplicateKindIssues(capabilities), []);
  assert.deepEqual(collectUnknownKindIssues(capabilities), []);
  assert.deepEqual(collectUnclassifiedCountIssue(census.unclassified), []);
  assert.deepEqual(
    collectUnknownKindIssues([{ route: 'mystery', kind: 'maybe' }]),
    [{ route: 'mystery', message: 'unclassified governed route' }],
  );
});

test('generic persistence helpers operate on a synthetic serializable object', () => {
  type ListingDraft = { id: string; askingPrice: number };
  const store = createJsonStateStore<ListingDraft>((parsed) => {
    if (!parsed || typeof parsed !== 'object') return null;
    const candidate = parsed as ListingDraft;
    if (typeof candidate.id !== 'string' || typeof candidate.askingPrice !== 'number') {
      return null;
    }
    return candidate;
  });
  const serialized = store.serialize({ id: 'listing.1', askingPrice: 1 });
  assert.deepEqual(store.deserialize(serialized), { id: 'listing.1', askingPrice: 1 });
  assert.equal(store.deserialize('{'), null);
  assert.equal(shouldPersistHydratedState(false), false);
  assert.equal(shouldPersistHydratedState(true), true);
  assert.equal(
    resolveHydratedState({
      restored: { id: 'listing.1', askingPrice: 9 },
      mutatedBeforeHydration: true,
    }),
    null,
  );
  let holder = { id: 'listing.1', askingPrice: 1 };
  const next = applyStateTransition(
    holder,
    (current) => ({
      ...current,
      askingPrice: 2,
    }),
    (value) => {
      holder = value;
    },
  );
  assert.equal(holder.askingPrice, 2);
  assert.equal(next.askingPrice, 2);
});

test('generic frozen edit session ignores later live selection', () => {
  const session = openFrozenEditSession(
    ['listings', 'price'],
    { recordId: 'listing.1', field: 'askingPrice' },
    'price',
  );
  const live = { recordId: 'listing.2', field: 'tenure' };
  const target = resolveFrozenCommitTarget(session, live);
  assert.deepEqual(target, { recordId: 'listing.1', field: 'askingPrice' });
});

test('generic selection-set helpers do not require field schema', () => {
  assert.deepEqual(toggleSelectionValue(['gas'], 'electric'), ['gas', 'electric']);
  assert.deepEqual(
    orderSelectionValues(['gas', 'electric', 'water'], ['water', 'gas']),
    ['gas', 'water'],
  );
});

test('generic media path helpers do not encode survey evidence association', () => {
  const config = {
    rootSegments: ['agency', 'listings'],
    leafDirectory: 'photos',
    extension: 'jpg',
  };
  assert.equal(
    mediaRecordDirectory(config, 'listing.1'),
    'agency/listings/listing.1/photos',
  );
  assert.equal(
    mediaRelativePath(config, 'listing.1', 'photo.1'),
    'agency/listings/listing.1/photos/photo.1.jpg',
  );
});
