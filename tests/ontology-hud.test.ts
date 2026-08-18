import { describe, expect, it } from 'vitest';

import { CANONICAL_DEFECT_LIST } from '../src/domain/ontology/canonical-defects';
import {
  buildSampleMacro,
  getOntologyHudViewModel,
  getRoomDefects,
  ROOM_REGISTRY,
  selectOntologySamplePhrase,
} from '../src/domain/ontology/room-registry';

describe('ontology dictionary HUD', () => {
  it('loads all registered roof_void defects when [dict] opens', () => {
    const view = getOntologyHudViewModel(true, 'roof_void');
    const registered = ROOM_REGISTRY.roof_void;
    const catalogRoofIds = CANONICAL_DEFECT_LIST.filter(
      (defect) => defect.roomContext === 'roof_void',
    ).map((defect) => defect.id);

    expect(view.isOpen).toBe(true);
    expect(view.activeRoom).toBe('roof_void');
    expect(view.defects.map((defect) => defect.id)).toEqual(catalogRoofIds);
    expect(view.defects.map((defect) => defect.id)).toEqual(
      registered.map((defect) => defect.id),
    );
    expect(view.defects.length).toBeGreaterThan(0);
    expect(view.defects.some((defect) => defect.id === 'roof_spread')).toBe(
      true,
    );
  });

  it('selecting a sample phrase updates the dock buffer and dismisses the HUD', () => {
    const roofSpread = getRoomDefects('roof_void').find(
      (defect) => defect.id === 'roof_spread',
    );
    expect(roofSpread).toBeDefined();
    const phrase = buildSampleMacro(roofSpread!);
    const next = selectOntologySamplePhrase(phrase);

    expect(phrase.length).toBeGreaterThan(0);
    expect(phrase).toContain('roof spread');
    expect(next.dockBuffer).toBe(phrase);
    expect(next.isDictOpen).toBe(false);
  });

  it('switching rooms to external_walls reloads that room\'s defect definitions', () => {
    const roof = getOntologyHudViewModel(true, 'roof_void');
    const walls = getOntologyHudViewModel(true, 'external_walls');

    expect(walls.activeRoom).toBe('external_walls');
    expect(walls.defects).toEqual(ROOM_REGISTRY.external_walls);
    expect(walls.defects.length).toBeGreaterThan(0);
    expect(walls.defects.map((defect) => defect.id)).not.toEqual(
      roof.defects.map((defect) => defect.id),
    );
    expect(
      walls.defects.every((defect) => defect.roomContext === 'external_walls'),
    ).toBe(true);
  });
});
