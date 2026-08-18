import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CANONICAL_DEFECTS } from '../src/domain/ontology/canonical-defects';
import { matchDeterministic } from '../src/domain/normalization/deterministic-matcher';
import {
  learnAlias,
  resetDynamicAliasStore,
} from '../src/domain/normalization/dynamic-alias-store';
import { matchSemantic } from '../src/domain/normalization/semantic-fallback-matcher';
import { parseVoiceMacro } from '../src/lib/voice-macro-parser';

const FIRM_ID = 'firm-north';

describe('offline 2-tier defect normalization', () => {
  beforeEach(() => {
    resetDynamicAliasStore();
  });

  afterEach(() => {
    resetDynamicAliasStore();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('matches standard shorthand to roof_spread with required slots filled', () => {
    const parsed = parseVoiceMacro(
      'CR3 roof spread rear slope, SE referral',
      { firmId: FIRM_ID },
    );

    expect(parsed.defectId).toBe('roof_spread');
    expect(parsed.matchTier).toBe('deterministic');
    expect(parsed.conditionRating).toBe('CR3');
    expect(parsed.slots.location).toBe('rear slope');
    expect(parsed.slots.referral).toBe('SE referral');
    expect(parsed.missingSlots).toEqual([]);
    expect(parsed.clause.observation.length).toBeGreaterThan(0);
    expect(parsed.clause.implication.length).toBeGreaterThan(0);
    expect(parsed.clause.recommendation.length).toBeGreaterThan(0);

    matchDeterministic('CR3 roof spread rear pitch');
    const iterations = 200;
    const started = performance.now();
    let lastMatch = null as ReturnType<typeof matchDeterministic>;
    for (let index = 0; index < iterations; index += 1) {
      lastMatch = matchDeterministic('CR3 roof spread rear pitch');
    }
    const averageMs = (performance.now() - started) / iterations;

    expect(lastMatch?.defectId).toBe('roof_spread');
    expect(averageMs).toBeLessThan(1);
  });

  it('matches regional colloquialism blown bricks to chimney_spalling_lean', () => {
    const parsed = parseVoiceMacro('blown bricks chimney top', {
      firmId: FIRM_ID,
    });

    expect(parsed.defectId).toBe('chimney_spalling_lean');
    expect(parsed.matchTier).toBe('deterministic');
    expect(parsed.conditionRating).toBe(
      CANONICAL_DEFECTS.chimney_spalling_lean.defaultRating,
    );
    expect(parsed.slots.location).toBe('chimney top');
    expect(parsed.slots.defect_type).toBe('blown brickwork');
    expect(parsed.missingSlots).toEqual([]);
  });

  it('uses semantic fallback for unpredictable rafter-splay phrasing', () => {
    const parsed = parseVoiceMacro(
      'the rafters are splaying out sideways along the back',
      { firmId: FIRM_ID },
    );

    expect(parsed.matchTier).toBe('semantic');
    expect(parsed.defectId).toBe('roof_spread');
    expect(parsed.confidence).toBeGreaterThanOrEqual(0.65);
    expect(parsed.missingSlots).toEqual(
      expect.arrayContaining(['location', 'referral']),
    );

    const semantic = matchSemantic(
      'the rafters are splaying out sideways along the back',
    );
    expect(semantic?.defectId).toBe('roof_spread');
    expect(semantic?.confidence).toBeGreaterThanOrEqual(0.65);
  });

  it('promotes a novel slang phrase into the Tier 1 deterministic index', () => {
    const novelPhrase = 'wonky sticks up top';
    const firstPass = parseVoiceMacro(novelPhrase, { firmId: FIRM_ID });

    expect(firstPass.defectId).toBe('unclassified');
    expect(firstPass.matchTier).toBe('unclassified');
    expect(firstPass.slots.raw_transcript).toBe(novelPhrase);
    expect(matchDeterministic(novelPhrase)).toBeNull();

    learnAlias(FIRM_ID, novelPhrase, 'roof_spread');

    const secondPass = parseVoiceMacro(novelPhrase, { firmId: FIRM_ID });
    expect(secondPass.defectId).toBe('roof_spread');
    expect(secondPass.matchTier).toBe('deterministic');
    expect(secondPass.confidence).toBe(1);
  });

  it('performs 100% offline with zero network calls', () => {
    const fetchSpy = vi.fn();
    const xhrSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('XMLHttpRequest', xhrSpy);

    parseVoiceMacro('CR3 roof spread rear pitch, structural engineer');
    parseVoiceMacro('blown bricks on chimney');
    parseVoiceMacro('the rafters are splaying out sideways along the back');
    learnAlias(FIRM_ID, 'ridge gubbins', 'defective_flashing');
    parseVoiceMacro('ridge gubbins', { firmId: FIRM_ID });
    matchSemantic('tiny holes in the rafters with fresh frass');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrSpy).not.toHaveBeenCalled();

    const lowConfidence = parseVoiceMacro(
      'the kitchen tap drips occasionally',
      { firmId: FIRM_ID },
    );
    expect(lowConfidence.defectId).toBe('unclassified');
    expect(lowConfidence.matchTier).toBe('unclassified');
    expect(lowConfidence.slots.raw_transcript).toContain('kitchen tap');
  });
});
