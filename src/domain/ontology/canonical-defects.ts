import {
  buildLoftClause,
  getMissingSlots as getLoftMissingSlots,
  type LoftDefectId,
  type RICSClauseStructure,
} from '@/domain/ontology/loft-room-ontology';

export type ConditionRating = 'CR1' | 'CR2' | 'CR3';

export type RoomContext =
  | 'roof_void'
  | 'chimneys_roof_external'
  | 'external_walls'
  | 'rainwater_goods'
  | 'internal_ceilings_walls'
  | 'floors_joinery'
  | 'services_electrics_gas_water'
  | 'grounds_outbuildings';

export type RICSClause = RICSClauseStructure;

export type FindingSlotDefinition = {
  name: string;
  required: boolean;
  type: 'string' | 'number' | 'enum';
  allowedValues?: string[];
  aliasTriggers?: string[];
};

export type CanonicalDefectId =
  | 'roof_spread'
  | 'defective_flashing'
  | 'insulation_depth_deficit'
  | 'insulation_deficit'
  | 'condensation_ventilation'
  | 'chimney_spalling_lean'
  | 'woodworm_infestation'
  | 'rising_penetrating_damp'
  | 'spalling_brickwork'
  | 'unclassified';

export type CanonicalDefectDefinition = {
  id: Exclude<CanonicalDefectId, 'unclassified'>;
  element: string;
  title: string;
  defaultRating: ConditionRating;
  roomContext: RoomContext;
  slots: Record<string, FindingSlotDefinition>;
  clauseTemplate: RICSClause;
  aliases: string[];
  /** Semantic trigger vocabulary mapped to relative token weights. */
  tokenWeights: Readonly<Record<string, number>>;
  /** Descriptive phrases used only by the offline semantic fallback. */
  semanticPhrases: readonly string[];
};

const MINERAL_WOOL_BENCHMARK_MM = 270;

const LOFT_DEFECT_IDS: ReadonlySet<string> = new Set([
  'roof_spread',
  'insulation_deficit',
  'condensation_ventilation',
]);

export function isLoftDefectId(id: string): id is LoftDefectId {
  return LOFT_DEFECT_IDS.has(id);
}

export const UNCLASSIFIED_DEFECT_ID = 'unclassified' as const;

function slot(
  name: string,
  required: boolean,
  type: FindingSlotDefinition['type'],
  extra: Pick<FindingSlotDefinition, 'allowedValues' | 'aliasTriggers'> = {},
): FindingSlotDefinition {
  return { name, required, type, ...extra };
}

export const CANONICAL_DEFECTS: Readonly<
  Record<Exclude<CanonicalDefectId, 'unclassified'>, CanonicalDefectDefinition>
> = {
  roof_spread: {
    id: 'roof_spread',
    element: 'Roof Void',
    title: 'Roof spread',
    defaultRating: 'CR3',
    roomContext: 'roof_void',
    slots: {
      location: slot('location', true, 'string', {
        aliasTriggers: ['rear pitch', 'rear slope', 'front slope', 'party wall'],
      }),
      referral: slot('referral', true, 'string', {
        aliasTriggers: ['structural engineer', 'SE', 'SE referral'],
      }),
    },
    clauseTemplate: {
      observation: 'Rafter spread and collar tie deflection noted at the {{location}}.',
      implication: 'Outward thrust on wall-heads is likely.',
      recommendation: '{{referral}} appraisal recommended.',
    },
    aliases: [
      'roof spread',
      'roof spreading',
      'spreading roof',
      'rafter spread',
      'collar spread',
    ],
    tokenWeights: {
      rafter: 5,
      rafters: 5,
      splay: 5,
      splaying: 5,
      splayed: 5,
      spread: 5,
      spreading: 4,
      sideways: 3,
      outward: 3,
      thrust: 4,
      collar: 3,
      purlin: 2,
      wallhead: 3,
      roof: 1,
    },
    semanticPhrases: [
      'rafters splaying out',
      'rafters splaying sideways',
      'splaying out sideways',
      'rafters spreading outwards',
      'outward thrust on wall heads',
      'timbers spreading at the eaves',
    ],
  },
  defective_flashing: {
    id: 'defective_flashing',
    element: 'Roof Coverings',
    title: 'Defective flashing',
    defaultRating: 'CR2',
    roomContext: 'chimneys_roof_external',
    slots: {
      location: slot('location', true, 'string', {
        aliasTriggers: ['main stack', 'party wall', 'rear pitch', 'front slope'],
      }),
      material: slot('material', true, 'enum', {
        allowedValues: ['lead', 'slate', 'concrete tile', 'mineral wool'],
        aliasTriggers: ['lead', 'slate', 'concrete tile'],
      }),
    },
    clauseTemplate: {
      observation:
        'Defective {{material}} flashing was noted at the {{location}}.',
      implication:
        'Water ingress at junctions is likely, with associated decay and damp risk to adjacent fabric.',
      recommendation:
        'Instruct a roofing contractor to renew or dress flashings and make the junction weathertight.',
    },
    aliases: [
      'defective flashing',
      'failed flashing',
      'flashing failure',
      'perished flashing',
      'lifted flashing',
      'open flashing',
    ],
    tokenWeights: {
      flashing: 5,
      flashings: 5,
      soaker: 4,
      soakers: 4,
      apron: 3,
      stepped: 2,
      lead: 2,
      junction: 2,
      upstand: 2,
    },
    semanticPhrases: [
      'flashing coming away',
      'lead lifting at the abutment',
      'open soakers at the stack',
      'apron flashing failed',
    ],
  },
  insulation_depth_deficit: {
    id: 'insulation_depth_deficit',
    element: 'Roof Void',
    title: 'Insulation depth deficit',
    defaultRating: 'CR2',
    roomContext: 'roof_void',
    slots: {
      depth_mm: slot('depth_mm', true, 'number', {
        aliasTriggers: ['mm', 'cm', 'depth'],
      }),
    },
    clauseTemplate: {
      observation: 'Loft insulation measured at approximately {{depth_mm}}mm.',
      implication:
        'Insulation depth appears below current mineral wool guidance.',
      recommendation:
        'Improve insulation depth to meet current guidance where practicable.',
    },
    aliases: [
      'insulation depth deficit',
      'insufficient insulation depth',
      'shallow insulation',
      'thin insulation',
      'insulation too thin',
      'insulation below guidance',
    ],
    tokenWeights: {
      insulation: 4,
      depth: 4,
      deficit: 3,
      shallow: 3,
      thin: 3,
      quilt: 2,
      loft: 1,
    },
    semanticPhrases: [
      'insulation looks thin',
      'not enough quilt in the loft',
      'loft insulation below current guidance',
    ],
  },
  insulation_deficit: {
    id: 'insulation_deficit',
    element: 'Roof Void',
    title: 'Insulation deficit',
    defaultRating: 'CR2',
    roomContext: 'roof_void',
    slots: {
      measurement: slot('measurement', true, 'string', {
        aliasTriggers: ['mm', 'cm', 'mineral wool'],
      }),
    },
    clauseTemplate: {
      observation: 'Loft insulation measured at approximately {{measurement}}.',
      implication: 'Insulation depth appears below current guidance.',
      recommendation:
        'Improve insulation depth to meet current guidance where practicable.',
    },
    aliases: [
      'loft insulation',
      'insulation deficit',
      'insulation',
      'mineral wool deficit',
    ],
    tokenWeights: {
      insulation: 4,
      loft: 2,
      quilt: 3,
      wool: 2,
    },
    semanticPhrases: [
      'loft insulation measured',
      'mineral wool too shallow',
    ],
  },
  condensation_ventilation: {
    id: 'condensation_ventilation',
    element: 'Roof Void',
    title: 'Condensation and ventilation',
    defaultRating: 'CR2',
    roomContext: 'roof_void',
    slots: {
      location: slot('location', true, 'string'),
    },
    clauseTemplate: {
      observation: 'Moisture staining on sarking/felt noted at the {{location}}.',
      implication:
        'Condensation risk is elevated and eaves ventilation appears inadequate.',
      recommendation:
        'Improve roof-space ventilation, particularly at eaves level.',
    },
    aliases: [
      'condensation',
      'no eaves vents',
      'eaves vents',
      'eaves ventilation',
      'felt staining',
    ],
    tokenWeights: {
      condensation: 5,
      eaves: 3,
      vent: 3,
      vents: 3,
      ventilation: 4,
      felt: 2,
      sarking: 3,
    },
    semanticPhrases: [
      'no eaves ventilation',
      'moisture staining on felt',
      'condensation in the roof void',
    ],
  },
  chimney_spalling_lean: {
    id: 'chimney_spalling_lean',
    element: 'Chimneys',
    title: 'Chimney spalling or lean',
    defaultRating: 'CR3',
    roomContext: 'chimneys_roof_external',
    slots: {
      location: slot('location', true, 'string', {
        aliasTriggers: ['main stack', 'party wall', 'chimney top'],
      }),
      defect_type: slot('defect_type', true, 'enum', {
        allowedValues: ['spalling', 'lean', 'blown brickwork'],
        aliasTriggers: ['blown', 'spalling', 'lean', 'leaning'],
      }),
    },
    clauseTemplate: {
      observation:
        '{{defect_type}} was noted to the chimney at the {{location}}.',
      implication:
        'Further deterioration, falling masonry, and water ingress at the stack are likely.',
      recommendation:
        'Instruct a competent chimney/roofing contractor to inspect, restrain or rebuild as required, with structural input if the stack is leaning.',
    },
    aliases: [
      'blown bricks',
      'blown brick',
      'blown brickwork',
      'chimney spalling',
      'spalling chimney',
      'chimney lean',
      'leaning chimney',
      'leaning stack',
    ],
    tokenWeights: {
      chimney: 4,
      stack: 3,
      blown: 5,
      brick: 3,
      bricks: 3,
      brickwork: 3,
      spalling: 5,
      spall: 5,
      lean: 4,
      leaning: 4,
      friable: 3,
      frost: 2,
    },
    semanticPhrases: [
      'blown bricks on chimney',
      'faces coming off the stack',
      'chimney leaning away from vertical',
      'frost damaged brickwork at the pot',
    ],
  },
  woodworm_infestation: {
    id: 'woodworm_infestation',
    element: 'Services / Timber',
    title: 'Woodworm infestation',
    defaultRating: 'CR2',
    roomContext: 'roof_void',
    slots: {
      location: slot('location', true, 'string', {
        aliasTriggers: ['rear pitch', 'party wall', 'roof void'],
      }),
      activity_status: slot('activity_status', true, 'enum', {
        allowedValues: ['active', 'historic', 'indeterminate'],
        aliasTriggers: ['active', 'historic', 'flight holes'],
      }),
    },
    clauseTemplate: {
      observation:
        'Wood-boring insect attack was noted at the {{location}} ({{activity_status}}).',
      implication:
        'Progressive section-loss may weaken structural timbers if activity is ongoing.',
      recommendation:
        'Obtain a specialist timber/pest report and treat or strengthen affected members as advised.',
    },
    aliases: [
      'woodworm',
      'wood worm',
      'wood-boring insect',
      'flight holes',
      'beetle attack',
      'anobium',
    ],
    tokenWeights: {
      woodworm: 5,
      worm: 2,
      beetle: 4,
      flight: 3,
      holes: 2,
      anobium: 4,
      frass: 4,
      timber: 1,
    },
    semanticPhrases: [
      'tiny holes in the rafters',
      'fresh frass on the joists',
      'active wood boring beetle',
    ],
  },
  rising_penetrating_damp: {
    id: 'rising_penetrating_damp',
    element: 'Damp',
    title: 'Rising or penetrating damp',
    defaultRating: 'CR3',
    roomContext: 'internal_ceilings_walls',
    slots: {
      location: slot('location', true, 'string', {
        aliasTriggers: ['party wall', 'rear pitch', 'ground floor'],
      }),
      meter_reading: slot('meter_reading', true, 'string', {
        aliasTriggers: ['wme', '%', 'meter'],
      }),
    },
    clauseTemplate: {
      observation:
        'Dampness was recorded at the {{location}} (meter reading {{meter_reading}}).',
      implication:
        'Rising or penetrating moisture may degrade finishes, plaster, and concealed timber.',
      recommendation:
        'Instruct a damp specialist to diagnose the mechanism and specify appropriate remedial work.',
    },
    aliases: [
      'rising damp',
      'penetrating damp',
      'rising penetrating damp',
      'damp meter',
      'high meter reading',
    ],
    tokenWeights: {
      damp: 4,
      dampness: 4,
      rising: 4,
      penetrating: 4,
      meter: 3,
      wme: 3,
      tide: 3,
      hygroscopic: 3,
      plaster: 1,
    },
    semanticPhrases: [
      'tide mark at skirting',
      'wet plaster at the base of the wall',
      'high moisture meter readings',
    ],
  },
  spalling_brickwork: {
    id: 'spalling_brickwork',
    element: 'External Walls',
    title: 'Spalling brickwork',
    defaultRating: 'CR2',
    roomContext: 'external_walls',
    slots: {
      location: slot('location', true, 'string', {
        aliasTriggers: ['front elevation', 'party wall', 'rear elevation'],
      }),
      defect_type: slot('defect_type', true, 'enum', {
        allowedValues: ['spalling', 'frost damage', 'failed pointing'],
        aliasTriggers: ['spalling', 'frost damage'],
      }),
      extent: slot('extent', false, 'string', {
        aliasTriggers: ['localised', 'widespread'],
      }),
    },
    clauseTemplate: {
      observation:
        '{{defect_type}} was noted to brickwork at the {{location}}.',
      implication:
        'Progressive face-loss may admit moisture and accelerate masonry decay.',
      recommendation:
        'Instruct a brickwork contractor to cut out and replace damaged units and repoint in a compatible mortar.',
    },
    aliases: [
      'spalling brickwork',
      'spalled masonry',
      'friable wall faces',
      'frost damaged brickwork',
    ],
    tokenWeights: {
      spalling: 5,
      spalled: 4,
      brickwork: 4,
      masonry: 3,
      frost: 3,
      pointing: 2,
      elevation: 2,
    },
    semanticPhrases: [
      'faces coming off the front wall',
      'frost damaged bricks at DPC',
    ],
  },
};

export const CANONICAL_DEFECT_LIST: readonly CanonicalDefectDefinition[] =
  Object.values(CANONICAL_DEFECTS);

export function getCanonicalDefect(
  id: CanonicalDefectId,
): CanonicalDefectDefinition | null {
  if (id === UNCLASSIFIED_DEFECT_ID) return null;
  return CANONICAL_DEFECTS[id];
}

function fillTemplate(
  template: string,
  slots: Record<string, string | undefined>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => {
    const value = slots[name]?.trim();
    return value && value.length > 0 ? value : `[${name}]`;
  });
}

function parseDepthMm(slots: Record<string, string | undefined>): number | null {
  const raw = slots.depth_mm?.trim() || slots.measurement?.trim();
  if (!raw) return null;
  const match = /(\d+(?:\.\d+)?)\s*(mm|cm)?/i.exec(raw);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value)) return null;
  const unit = match[2]?.toLowerCase();
  return unit === 'cm' ? value * 10 : value;
}

function buildInsulationDepthClause(
  slots: Record<string, string | undefined>,
): RICSClause {
  const depth = parseDepthMm(slots);
  const depthLabel =
    depth === null ? '[depth_mm]' : String(Math.round(depth));
  const deficit =
    depth === null ? null : Math.max(0, MINERAL_WOOL_BENCHMARK_MM - depth);
  return {
    observation: `Loft insulation measured at approximately ${depthLabel}mm.`,
    implication:
      deficit === null
        ? 'Insulation depth appears below current mineral wool guidance.'
        : `Deficit: ~${deficit}mm against ${MINERAL_WOOL_BENCHMARK_MM}mm mineral wool benchmark.`,
    recommendation:
      'Improve insulation depth to meet current guidance where practicable.',
  };
}

function buildUnclassifiedClause(
  slots: Record<string, string | undefined>,
): RICSClause {
  const transcript = slots.raw_transcript?.trim() || '[transcript]';
  return {
    observation: transcript,
    implication: 'This observation could not be classified automatically.',
    recommendation: 'Assign a canonical defect and complete required slots.',
  };
}

export function buildCanonicalClause(
  defectId: CanonicalDefectId,
  slots: Record<string, string | undefined>,
): RICSClause {
  if (defectId === UNCLASSIFIED_DEFECT_ID) {
    return buildUnclassifiedClause(slots);
  }
  if (isLoftDefectId(defectId)) {
    const loftSlots: Record<string, string> = {};
    for (const [key, value] of Object.entries(slots)) {
      if (value?.trim()) loftSlots[key] = value;
    }
    return buildLoftClause(defectId, loftSlots);
  }
  if (defectId === 'insulation_depth_deficit') {
    return buildInsulationDepthClause(slots);
  }
  const definition = CANONICAL_DEFECTS[defectId];
  return {
    observation: fillTemplate(definition.clauseTemplate.observation, slots),
    implication: fillTemplate(definition.clauseTemplate.implication, slots),
    recommendation: fillTemplate(definition.clauseTemplate.recommendation, slots),
  };
}

export function getCanonicalMissingSlots(
  defectId: CanonicalDefectId,
  slots: Record<string, string | undefined>,
): string[] {
  if (defectId === UNCLASSIFIED_DEFECT_ID) {
    return [];
  }
  if (isLoftDefectId(defectId)) {
    const loftSlots: Record<string, string> = {};
    for (const [key, value] of Object.entries(slots)) {
      if (value?.trim()) loftSlots[key] = value;
    }
    return getLoftMissingSlots(defectId, loftSlots);
  }
  const definition = CANONICAL_DEFECTS[defectId];
  return Object.values(definition.slots)
    .filter((entry) => entry.required && !slots[entry.name]?.trim())
    .map((entry) => entry.name);
}

export function requiredSlotNames(defectId: CanonicalDefectId): string[] {
  if (defectId === UNCLASSIFIED_DEFECT_ID) return [];
  return Object.values(CANONICAL_DEFECTS[defectId].slots)
    .filter((entry) => entry.required)
    .map((entry) => entry.name);
}
