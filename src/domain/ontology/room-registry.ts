import {
  CANONICAL_DEFECT_LIST,
  type CanonicalDefectDefinition,
  type RoomContext,
} from '@/domain/ontology/canonical-defects';

const ROOM_CONTEXTS: readonly RoomContext[] = [
  'roof_void',
  'chimneys_roof_external',
  'external_walls',
  'rainwater_goods',
  'internal_ceilings_walls',
  'floors_joinery',
  'services_electrics_gas_water',
  'grounds_outbuildings',
];

function emptyRoomBuckets(): Record<RoomContext, CanonicalDefectDefinition[]> {
  return {
    roof_void: [],
    chimneys_roof_external: [],
    external_walls: [],
    rainwater_goods: [],
    internal_ceilings_walls: [],
    floors_joinery: [],
    services_electrics_gas_water: [],
    grounds_outbuildings: [],
  };
}

function buildRoomRegistry(): Readonly<
  Record<RoomContext, readonly CanonicalDefectDefinition[]>
> {
  const buckets = emptyRoomBuckets();
  for (const defect of CANONICAL_DEFECT_LIST) {
    buckets[defect.roomContext].push(defect);
  }
  return buckets;
}

/** Live room → canonical defect index. Rebuilt from the ontology catalog. */
export const ROOM_REGISTRY: Readonly<
  Record<RoomContext, readonly CanonicalDefectDefinition[]>
> = buildRoomRegistry();

export function normalizeRoomKey(activeRoom: string): RoomContext {
  const key = activeRoom.trim().toLowerCase().replace(/\s+/g, '_');
  if ((ROOM_CONTEXTS as readonly string[]).includes(key)) {
    return key as RoomContext;
  }
  return 'roof_void';
}

export function getRoomDefects(
  activeRoom: string,
): readonly CanonicalDefectDefinition[] {
  return ROOM_REGISTRY[normalizeRoomKey(activeRoom)];
}

export function buildSampleMacro(
  definition: CanonicalDefectDefinition,
): string {
  const alias = definition.aliases[0] ?? definition.id.replace(/_/g, ' ');
  const fillers = Object.values(definition.slots)
    .filter((entry) => entry.required)
    .map((entry) => entry.aliasTriggers?.[0])
    .filter((value): value is string => Boolean(value));
  return [definition.defaultRating, alias, ...fillers].join(' ');
}

export type OntologyHudViewModel = {
  isOpen: boolean;
  activeRoom: RoomContext;
  defects: readonly CanonicalDefectDefinition[];
};

export function getOntologyHudViewModel(
  isOpen: boolean,
  activeRoom: string,
): OntologyHudViewModel {
  const room = normalizeRoomKey(activeRoom);
  return {
    isOpen,
    activeRoom: room,
    defects: isOpen ? getRoomDefects(room) : [],
  };
}

export function selectOntologySamplePhrase(phrase: string): {
  dockBuffer: string;
  isDictOpen: false;
} {
  return { dockBuffer: phrase, isDictOpen: false };
}
