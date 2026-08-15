import type {
  CommandNode,
  Level2CaptureCoverage,
} from '@/lib/command-registry';
import type { FieldDefinition } from '@/lib/field-schema';
import {
  buildFindingCaptureLeaf as createFindingCaptureLeaf,
  buildFindingLeaf,
  type FindingLeafDefinition,
} from '@/lib/level-2-finding-capture';
import { HEATING_FIELD_DEFINITIONS } from '@/lib/property-energy-heating';
import { MAINS_SERVICE_FIELD_DEFINITIONS } from '@/lib/property-energy-mains-services';
import {
  servicesPresenceFieldDefinition,
  type ServicesPresenceRouteId,
} from '@/lib/services-controlled-facts';
import {
  SERVICES_GAS_FINDING_CONFIG,
  servicesFindingConfig,
  type ServicesFindingConfig,
} from '@/lib/services-findings';

export type Level2CoverageManifestEntry = Level2CaptureCoverage & {
  route: string;
};

export const EXTERNAL_WALL_FINDING_ID = 'finding.external-wall.1';
export const EXTERNAL_WALL_ELEMENT_CONCEPT_ID = 'building_element.external_wall';

export const EXTERNAL_WALL_FINDING_LEAVES: readonly FindingLeafDefinition[] = [
  {
    kind: 'finding',
    token: 'observe',
    label: 'observation',
    description: 'Record the direct wall observation.',
    field: 'observation',
  },
  {
    kind: 'finding',
    token: 'condition',
    label: 'condition',
    description: 'Record free-text current condition.',
    field: 'condition',
  },
  {
    kind: 'finding',
    token: 'defect',
    label: 'defect',
    description: 'Record an identified defect.',
    field: 'defect',
  },
  {
    kind: 'finding',
    token: 'recommend',
    label: 'recommendation',
    description: 'Record recommended action.',
    field: 'recommendation',
  },

  {
    kind: 'workflow',
    token: 'limit',
    label: 'limitation',
    description: 'Finding limitation coverage.',
    coverage: {
      requirement: 'External wall finding limitation',
      status: 'blocked',
      blocker: 'Finding-level limitation is not Engine-backed.',
      recommendedLaterWork: 'Add a distinct finding limitation field after semantic review.',
    },
  },
  {
    kind: 'workflow',
    token: 'further',
    label: 'further investigation',
    description: 'Further-investigation coverage.',
    coverage: {
      requirement: 'External wall further investigation',
      status: 'blocked',
      canonicalConceptId: 'further_investigation',
      blocker: 'Canonical concept is type-only and not part of InspectionFinding.',
      recommendedLaterWork: 'Add an Engine field without inferring a relationship edge.',
    },
  },
  {
    kind: 'workflow',
    token: 'risk',
    label: 'risk',
    description: 'Risk capture coverage.',
    coverage: {
      requirement: 'External wall risk',
      status: 'blocked',
      canonicalConceptId: 'risk',
      blocker: 'Canonical concept is type-only and not part of InspectionFinding.',
      recommendedLaterWork: 'Add an Engine field independently from report summaries.',
    },
  },
  {
    kind: 'finding',
    token: 'evidence',
    label: 'evidence',
    description: 'Attach a stable evidence reference.',
    field: 'evidence',
  },
];

function workflowLeaf(
  token: string,
  label: string,
  description: string,
  coverage: Level2CaptureCoverage,
): CommandNode {
  return {
    token,
    label,
    learnerLabel: label,
    description,
    workflowOnly: true,
    coverage,
  };
}

function compoundFieldLeaf(field: FieldDefinition): CommandNode {
  return {
    token: field.token,
    label: field.label,
    learnerLabel: field.label,
    description: field.description,
    requiresValue: true,
    valuePrompt: field.valuePrompt,
    entryLabel: field.entryLabel,
    operationId: field.operationId,
    readOperationId: field.readOperationId,
    fieldId: field.fieldId,
    required: field.required,
    optional: field.optional,
    coverage: {
      requirement: field.label,
      status: 'interactive',
      engineBinding: field.operationId,
      recommendedLaterWork:
        'Retain grouped compound capture and optional provenance later.',
    },
  };
}

function mainsServiceFieldToCommandNode(
  field: FieldDefinition,
  requirement: string,
): CommandNode {
  return {
    token: field.token,
    label: field.label,
    learnerLabel: field.label,
    description: `${field.label} mains service presence.`,
    requiresValue: true,
    valuePrompt: field.valuePrompt,
    entryLabel: field.entryLabel,
    operationId: field.operationId,
    readOperationId: field.readOperationId,
    fieldId: field.fieldId,
    required: field.required,
    coverage: {
      requirement,
      status: 'interactive',
      engineBinding: field.operationId,
      recommendedLaterWork:
        'Retain grouped mains-services capture and optional provenance later.',
    },
  };
}

function controlledStatusLeaf(
  token: string,
  requirement: string,
): CommandNode {
  const field = MAINS_SERVICE_FIELD_DEFINITIONS.find((f) => f.token === token);
  if (!field) {
    throw new Error(`Missing mains service field definition for token: ${token}`);
  }
  return mainsServiceFieldToCommandNode(field, requirement);
}

function servicesPresenceLeaf(
  serviceId: ServicesPresenceRouteId,
  requirement: string,
  recommendedLaterWork: string,
): CommandNode {
  const field = servicesPresenceFieldDefinition(serviceId);
  return {
    token: field.token,
    label: field.label,
    learnerLabel: field.label,
    description: field.description,
    requiresValue: true,
    valuePrompt: field.valuePrompt,
    entryLabel: field.entryLabel,
    operationId: field.operationId,
    readOperationId: field.readOperationId,
    fieldId: field.fieldId,
    required: field.required,
    coverage: {
      requirement,
      status: 'interactive',
      engineBinding: field.operationId,
      recommendedLaterWork,
    },
  };
}

function servicesFindingLeaves(
  config: Pick<ServicesFindingConfig, 'findingId' | 'elementConceptId' | 'label'>,
): CommandNode[] {
  const prefix = config.label;
  return [
    createFindingCaptureLeaf(
      'observe',
      'observation',
      `Record the direct ${prefix.toLowerCase()} observation.`,
      config.findingId,
      config.elementConceptId,
      'observation',
      `${prefix} observation`,
    ),
    createFindingCaptureLeaf(
      'defect',
      'defect',
      `Record an identified ${prefix.toLowerCase()} defect.`,
      config.findingId,
      config.elementConceptId,
      'defect',
      `${prefix} defect`,
    ),
    createFindingCaptureLeaf(
      'recommend',
      'recommendation',
      `Record recommended ${prefix.toLowerCase()} action.`,
      config.findingId,
      config.elementConceptId,
      'recommendation',
      `${prefix} recommendation`,
    ),
  ];
}

function servicesPresenceCaptureBranch(
  config: ServicesFindingConfig,
  recommendedLaterWork: string,
): CommandNode {
  return {
    token: config.routeId,
    label: config.routeId,
    learnerLabel: config.label,
    description: `${config.label} presence and inspection findings.`,
    coverage: {
      requirement: config.label,
      status: 'interactive',
      canonicalConceptId: config.elementConceptId,
      engineBinding: 'survey.inspection.finding.upsert',
      recommendedLaterWork,
    },
    children: [
      servicesPresenceLeaf(
        config.routeId,
        `Mains ${config.label.toLowerCase()} presence`,
        recommendedLaterWork,
      ),
      ...servicesFindingLeaves(config),
    ],
  };
}

function servicesFindingOnlyBranch(
  config: ServicesFindingConfig,
  recommendedLaterWork: string,
): CommandNode {
  return {
    token: config.routeId,
    label: config.routeId,
    learnerLabel: config.label,
    description: `${config.label} inspection findings.`,
    coverage: {
      requirement: config.label,
      status: 'interactive',
      canonicalConceptId: config.elementConceptId,
      engineBinding: 'survey.inspection.finding.upsert',
      recommendedLaterWork,
    },
    children: servicesFindingLeaves(config),
  };
}

function compoundCaptureBranch(
  token: string,
  label: string,
  description: string,
  coverage: Level2CaptureCoverage,
  children: CommandNode[],
): CommandNode {
  return {
    token,
    label,
    learnerLabel: label,
    description,
    compoundCapture: true,
    coverage: {
      ...coverage,
      status: 'interactive',
      blocker: undefined,
      engineBinding: 'survey.controlled_fact.set',
    },
    children,
  };
}

const PROPERTY_NODE: CommandNode = {
  token: 'property',
  label: 'property',
  learnerLabel: 'Property',
  description: 'Property identity and Level 2 property coverage.',
  coverage: {
    requirement: 'About the property',
    status: 'navigation-only',
    canonicalConceptId: 'property',
    recommendedLaterWork:
      'Add independently reviewed property-description fields before enabling capture.',
  },
  children: [
    {
      token: 'energy',
      label: 'energy',
      learnerLabel: 'Energy',
      description: 'EPC, mains service and energy-source coverage.',
      coverage: {
        requirement: 'Energy and EPC information',
        status: 'navigation-only',
        recommendedLaterWork:
          'Add imported EPC provenance and surveyor discrepancy findings.',
      },
      children: [
        compoundCaptureBranch(
          'heating',
          'heating',
          'Central heating and energy-source coverage.',
          {
            requirement: 'Central heating and energy sources',
            status: 'blocked',
            recommendedLaterWork:
              'Resolve service-system provenance when canonical.',
          },
          HEATING_FIELD_DEFINITIONS.map(compoundFieldLeaf),
        ),
        compoundCaptureBranch(
          'mains-services',
          'mains-services',
          'Mains services coverage.',
          {
            requirement: 'Mains services',
            status: 'blocked',
            recommendedLaterWork:
              'Model advised/observed service presence with provenance.',
          },
          [
            controlledStatusLeaf('gas', 'Gas mains service'),
            controlledStatusLeaf('electricity', 'Electricity mains service'),
            controlledStatusLeaf('water', 'Water mains service'),
            controlledStatusLeaf('drainage', 'Drainage mains service'),
          ],
        ),
      ],
    },
    workflowLeaf('address', 'address', 'Confirmed property address.', {
      requirement: 'Property address',
      status: 'pre-populated',
      canonicalConceptId: 'property.address',
      engineBinding: 'ActiveJob.property.address',
      recommendedLaterWork:
        'Continue to populate from property selection rather than duplicate survey entry.',
    }),
    workflowLeaf('type', 'type', 'Property type coverage.', {
      requirement: 'Type of property',
      status: 'blocked',
      blocker: 'No canonical property-type field or Engine operation.',
      recommendedLaterWork: 'Design a property-description schema and operation.',
    }),
    workflowLeaf('age', 'age', 'Approximate property age coverage.', {
      requirement: 'Approximate year built',
      status: 'blocked',
      blocker: 'No canonical construction-date field or Engine operation.',
      recommendedLaterWork: 'Design a nullable approximate construction-date field.',
    }),
    workflowLeaf('extension', 'extension', 'Extension information coverage.', {
      requirement: 'Extension information',
      status: 'blocked',
      blocker: 'No canonical extension model.',
      recommendedLaterWork: 'Model extensions independently from report wording.',
    }),
    workflowLeaf('conversion', 'conversion', 'Conversion information coverage.', {
      requirement: 'Conversion information',
      status: 'blocked',
      blocker: 'No canonical conversion model.',
      recommendedLaterWork: 'Model conversion history with uncertain dates.',
    }),
    workflowLeaf('flat', 'flat', 'Flat and maisonette information coverage.', {
      requirement: 'Flat or maisonette information',
      status: 'blocked',
      blocker: 'No canonical tenure/building-context field.',
      recommendedLaterWork: 'Separate dwelling type, tenure and shared-area context.',
    }),
    workflowLeaf('construction', 'construction', 'Construction description coverage.', {
      requirement: 'Construction',
      status: 'blocked',
      blocker: 'Construction remains unresolved in ontology review.',
      recommendedLaterWork: 'Approve a construction semantic shape before capture.',
    }),
    workflowLeaf('accommodation', 'accommodation', 'Accommodation schedule coverage.', {
      requirement: 'Accommodation',
      status: 'blocked',
      blocker: 'No canonical room/accommodation model.',
      recommendedLaterWork: 'Design floor and room inventory semantics.',
    }),
    workflowLeaf('roof-spaces', 'roof-spaces', 'Roof-space availability coverage.', {
      requirement: 'Roof spaces',
      status: 'blocked',
      blocker: 'No canonical roof-space model.',
      recommendedLaterWork: 'Resolve roof-space subject and access semantics.',
    }),
    {
      token: 'location',
      label: 'location',
      learnerLabel: 'Location',
      description: 'Grounds, location, facilities and local environment coverage.',
      coverage: {
      requirement: 'Location',
      status: 'blocked',
      blocker: 'No canonical property-location assessment field.',
      recommendedLaterWork: 'Separate imported location facts from surveyor assessment.',
      },
      children: [
        workflowLeaf('grounds', 'grounds', 'Property grounds description coverage.', {
          requirement: 'Grounds',
          status: 'blocked',
          blocker: 'No canonical site/grounds taxonomy.',
          recommendedLaterWork: 'Design the deferred site/grounds taxonomy.',
        }),
        workflowLeaf('facilities', 'facilities', 'Local facilities coverage.', {
          requirement: 'Facilities',
          status: 'blocked',
          blocker: 'No canonical facilities model.',
          recommendedLaterWork:
            'Determine whether facilities are imported or surveyor-entered.',
        }),
        workflowLeaf('environment', 'environment', 'Local environment coverage.', {
          requirement: 'Local environment',
          status: 'blocked',
          blocker: 'No canonical local-environment assessment model.',
          recommendedLaterWork: 'Design evidence/provenance before capture.',
        }),
      ],
    },
  ],
};

const EXTERNAL_NODE: CommandNode = {
  token: 'external',
  label: 'external',
  learnerLabel: 'External',
  description: 'Outside inspection coverage.',
  coverage: {
    requirement: 'Outside the property',
    status: 'navigation-only',
    recommendedLaterWork: 'Enable subjects only as canonical Engine support is approved.',
  },
  children: [
    workflowLeaf('limitation', 'limitation', 'External inspection limitations.', {
      requirement: 'External inspection limitations',
      status: 'blocked',
      blocker: 'Section/finding limitation is distinct from brief limitation and unsupported.',
      recommendedLaterWork: 'Design section and finding limitation semantics.',
    }),
    workflowLeaf('chimney', 'chimney', 'Chimney inspection subject.', {
      requirement: 'Chimneys',
      status: 'navigation-only',
      canonicalConceptId: 'building_element.chimney',
      blocker: 'Canonical concept is type-only and absent from BuildingElementConceptId.',
      recommendedLaterWork: 'Add Engine-backed chimney finding support.',
    }),
    workflowLeaf('roof', 'roof', 'Roof covering inspection subject.', {
      requirement: 'Roof coverings',
      status: 'blocked',
      blocker: 'Roof covering is not canonical.',
      recommendedLaterWork: 'Resolve roof covering and roof structure independently.',
    }),
    workflowLeaf('rainwater', 'rainwater', 'Rainwater goods inspection subject.', {
      requirement: 'Rainwater pipes and gutters',
      status: 'navigation-only',
      canonicalConceptId: 'building_element.rainwater_goods',
      blocker: 'Canonical concept is type-only and has no Engine binding.',
      recommendedLaterWork: 'Add Engine-backed rainwater-goods finding support.',
    }),
    {
      token: 'walls',
      label: 'walls',
      learnerLabel: 'External walls',
      description: 'External wall finding capture.',
      coverage: {
        requirement: 'External walls',
        status: 'interactive',
        canonicalConceptId: EXTERNAL_WALL_ELEMENT_CONCEPT_ID,
        engineBinding: 'survey.inspection.finding.upsert',
        recommendedLaterWork: 'Add repeated findings and location context.',
      },
      children: EXTERNAL_WALL_FINDING_LEAVES.map((leaf) =>
        buildFindingLeaf(leaf, {
          findingId: EXTERNAL_WALL_FINDING_ID,
          elementConceptId: EXTERNAL_WALL_ELEMENT_CONCEPT_ID,
          subjectLabel: 'External wall',
        }),
      ),
    },
    workflowLeaf('windows', 'windows', 'Window inspection subject.', {
      requirement: 'Windows',
      status: 'navigation-only',
      canonicalConceptId: 'building_element.window',
      blocker: 'Canonical concept is type-only and has no Engine binding.',
      recommendedLaterWork: 'Add Engine-backed window finding support.',
    }),
    workflowLeaf('doors', 'doors', 'Outside-door inspection subject.', {
      requirement: 'Outside doors',
      status: 'blocked',
      blocker: 'External door is not canonical.',
      recommendedLaterWork: 'Resolve door concept scope before capture.',
    }),
    workflowLeaf('porch', 'porch', 'Porch inspection subject.', {
      requirement: 'Conservatories and porches',
      status: 'navigation-only',
      canonicalConceptId: 'building_element.porch',
      blocker: 'Porch is type-only; conservatory kind remains unresolved.',
      recommendedLaterWork: 'Enable porch independently after Engine binding.',
    }),
    workflowLeaf('joinery', 'joinery', 'Other joinery and finishes coverage.', {
      requirement: 'Other joinery and finishes',
      status: 'blocked',
      blocker: 'No canonical subject covers this report grouping.',
      recommendedLaterWork: 'Capture domain subjects rather than publication grouping.',
    }),
    workflowLeaf('other', 'other', 'Other external inspection coverage.', {
      requirement: 'Other external matters',
      status: 'blocked',
      blocker: 'No canonical generic external subject.',
      recommendedLaterWork: 'Define safe miscellaneous-finding subject semantics.',
    }),
  ],
};

const INTERNAL_NODE: CommandNode = {
  token: 'internal',
  label: 'internal',
  learnerLabel: 'Internal',
  description: 'Inside inspection coverage.',
  coverage: {
    requirement: 'Inside the property',
    status: 'navigation-only',
    recommendedLaterWork: 'Enable subjects only as canonical Engine support is approved.',
  },
  children: [
    workflowLeaf('limitation', 'limitation', 'Internal inspection limitations.', {
      requirement: 'Internal inspection limitations',
      status: 'blocked',
      blocker: 'Section/finding limitation is unsupported.',
      recommendedLaterWork: 'Design section and finding limitation semantics.',
    }),
    workflowLeaf('roof-structure', 'roof-structure', 'Roof structure inspection subject.', {
      requirement: 'Roof structure',
      status: 'blocked',
      blocker: 'Roof structure is not canonical.',
      recommendedLaterWork: 'Resolve roof structure independently from coverings.',
    }),
    workflowLeaf('ceilings', 'ceilings', 'Ceiling inspection subject.', {
      requirement: 'Ceilings',
      status: 'navigation-only',
      canonicalConceptId: 'building_element.ceiling',
      blocker: 'Canonical concept is type-only and has no Engine binding.',
      recommendedLaterWork: 'Add Engine-backed ceiling finding support.',
    }),
    workflowLeaf('walls-partitions', 'walls-partitions', 'Internal walls and partitions coverage.', {
      requirement: 'Walls and partitions',
      status: 'blocked',
      blocker: 'Partition and internal-wall semantic shapes remain unresolved.',
      recommendedLaterWork: 'Resolve these subjects without reusing external-wall meaning.',
    }),
    workflowLeaf('floors', 'floors', 'Floor inspection subject.', {
      requirement: 'Floors',
      status: 'blocked',
      blocker: 'Floor semantic shape remains unresolved.',
      recommendedLaterWork: 'Resolve floor entity/value semantics.',
    }),
    workflowLeaf('fireplaces-flues', 'fireplaces-flues', 'Fireplace and flue coverage.', {
      requirement: 'Fireplaces, chimney breasts and flues',
      status: 'navigation-only',
      canonicalConceptId: 'building_element.fireplace',
      blocker: 'Fireplace is type-only and does not cover all grouped subjects.',
      recommendedLaterWork: 'Enable fireplace and review chimney-breast/flue semantics separately.',
    }),
    workflowLeaf('built-ins', 'built-ins', 'Built-in fittings coverage.', {
      requirement: 'Built-in fittings',
      status: 'blocked',
      blocker: 'No canonical built-in fitting subject.',
      recommendedLaterWork: 'Design fitting subject and appliance exclusion.',
    }),
    workflowLeaf('woodwork', 'woodwork', 'Woodwork and staircase joinery coverage.', {
      requirement: 'Woodwork and staircase joinery',
      status: 'navigation-only',
      canonicalConceptId: 'building_element.staircase',
      blocker: 'Staircase is type-only and does not cover generic woodwork.',
      recommendedLaterWork: 'Enable staircase and resolve joinery separately.',
    }),
    workflowLeaf('bathroom', 'bathroom', 'Bathroom fittings coverage.', {
      requirement: 'Bathroom fittings',
      status: 'blocked',
      blocker: 'No canonical bathroom-fitting subject.',
      recommendedLaterWork: 'Design sanitary/bathroom fitting semantics.',
    }),
    workflowLeaf('other', 'other', 'Other internal inspection coverage.', {
      requirement: 'Other internal matters',
      status: 'blocked',
      blocker: 'No canonical generic internal subject.',
      recommendedLaterWork: 'Define safe miscellaneous-finding subject semantics.',
    }),
  ],
};

const SERVICES_NODE: CommandNode = {
  token: 'services',
  label: 'services',
  learnerLabel: 'Services',
  description: 'Visible services inspection coverage; no specialist testing.',
  coverage: {
    requirement: 'Services',
    status: 'navigation-only',
    recommendedLaterWork: 'Design visual-inspection service subjects without implying testing.',
  },
  children: [
    workflowLeaf('limitation', 'limitation', 'Services inspection limitations.', {
      requirement: 'Services inspection limitations',
      status: 'blocked',
      blocker: 'Section/finding limitation is unsupported.',
      recommendedLaterWork: 'Design section and finding limitation semantics.',
    }),
    servicesPresenceCaptureBranch(
      servicesFindingConfig('electricity'),
      'Add visual electrical-installation findings without implying testing.',
    ),
    {
      token: 'gas-oil',
      label: 'gas-oil',
      learnerLabel: 'Gas / oil',
      description: 'Gas and oil installation coverage.',
      coverage: {
        requirement: 'Gas and oil',
        status: 'navigation-only',
        recommendedLaterWork:
          'Keep oil supply blocked until a canonical oil element exists.',
      },
      children: [
        {
          token: 'gas',
          label: 'gas',
          learnerLabel: 'Gas',
          description: 'Mains gas presence and installation findings.',
          coverage: {
            requirement: 'Gas',
            status: 'interactive',
            canonicalConceptId: SERVICES_GAS_FINDING_CONFIG.elementConceptId,
            engineBinding: 'survey.inspection.finding.upsert',
            recommendedLaterWork:
              'Add oil supply separately once canonical semantics exist.',
          },
          children: [
            servicesPresenceLeaf(
              'gas',
              'Mains gas presence',
              'Keep oil supply blocked until canonical semantics exist.',
            ),
            ...servicesFindingLeaves(SERVICES_GAS_FINDING_CONFIG),
          ],
        },
        workflowLeaf('oil', 'oil', 'Oil supply and installation coverage.', {
          requirement: 'Oil',
          status: 'blocked',
          blocker: 'Oil supply is not canonical.',
          recommendedLaterWork:
            'Model oil supply separately from mains gas and heating fuel.',
        }),
      ],
    },
    servicesPresenceCaptureBranch(
      servicesFindingConfig('water'),
      'Add water-service findings without inventing pressure, quality or material enums.',
    ),
    servicesFindingOnlyBranch(
      servicesFindingConfig('heating'),
      'Keep structured heating facts at property/energy/heating.',
    ),
    servicesFindingOnlyBranch(
      servicesFindingConfig('water-heating'),
      'Keep hot-water structured facts at property/energy/heating/hot-water.',
    ),
    servicesPresenceCaptureBranch(
      servicesFindingConfig('drainage'),
      'Separate drainage findings from rainwater goods before adding narrative capture.',
    ),
    workflowLeaf('common', 'common', 'Common services coverage.', {
      requirement: 'Common services',
      status: 'blocked',
      blocker: 'No canonical common-services model.',
      recommendedLaterWork: 'Design shared-service context for flats and common areas.',
    }),
  ],
};

const GROUNDS_NODE: CommandNode = {
  token: 'grounds',
  label: 'grounds',
  learnerLabel: 'Grounds',
  description: 'Grounds and permanent structure inspection coverage.',
  coverage: {
    requirement: 'Grounds',
    status: 'navigation-only',
    recommendedLaterWork: 'Design the deferred site/grounds taxonomy.',
  },
  children: [
    workflowLeaf('limitation', 'limitation', 'Grounds inspection limitations.', {
      requirement: 'Grounds inspection limitations',
      status: 'blocked',
      blocker: 'Section/finding limitation is unsupported.',
      recommendedLaterWork: 'Design section and finding limitation semantics.',
    }),
    workflowLeaf('garage', 'garage', 'Garage inspection coverage.', {
      requirement: 'Garage',
      status: 'blocked',
      blocker: 'Garage ontology kind remains unresolved.',
      recommendedLaterWork: 'Resolve garage as space, structure or building element.',
    }),
    workflowLeaf('outbuildings', 'outbuildings', 'Permanent outbuilding coverage.', {
      requirement: 'Permanent outbuildings and other structures',
      status: 'blocked',
      blocker: 'Outbuilding ontology kind and grounds parent remain unresolved.',
      recommendedLaterWork: 'Resolve the site/grounds taxonomy first.',
    }),
    workflowLeaf('other', 'other', 'Other grounds coverage.', {
      requirement: 'Other grounds matters',
      status: 'blocked',
      blocker: 'No canonical generic grounds subject.',
      recommendedLaterWork: 'Define safe miscellaneous grounds semantics.',
    }),
  ],
};

export const LEVEL_2_COMMAND_NODES: readonly CommandNode[] = [
  PROPERTY_NODE,
  EXTERNAL_NODE,
  INTERNAL_NODE,
  SERVICES_NODE,
  GROUNDS_NODE,
  workflowLeaf('evidence', 'evidence', 'Evidence references attached to findings.', {
    requirement: 'Inspection evidence',
    status: 'navigation-only',
    canonicalConceptId: 'evidence',
    blocker: 'No evidence acquisition/index UI; references are attached within findings.',
    recommendedLaterWork: 'Add evidence acquisition and a derived evidence index.',
  }),
  workflowLeaf('summary', 'summary', 'Derived inspection summary coverage.', {
    requirement: 'Overall opinion and condition summary',
    status: 'derived-publication',
    blocker: 'Summary should be projected from findings and ratings, not re-entered.',
    recommendedLaterWork: 'Build deterministic summary projection after rating semantics.',
  }),
  workflowLeaf('report', 'report', 'Derived report publication coverage.', {
    requirement: 'Level 2 report',
    status: 'derived-publication',
    canonicalConceptId: 'report_document',
    blocker: 'Report expansion is outside the capture-shell scope.',
    recommendedLaterWork: 'Extend FirmAdapter/report projection from canonical capture.',
  }),
];

function flattenCoverage(
  nodes: readonly CommandNode[],
  parent: readonly string[],
): Level2CoverageManifestEntry[] {
  return nodes.flatMap((node) => {
    const path = [...parent, node.token];
    const current = node.coverage
      ? [{ route: path.join('/'), ...node.coverage }]
      : [];
    return [...current, ...flattenCoverage(node.children ?? [], path)];
  });
}

export const LEVEL_2_COVERAGE_MANIFEST: readonly Level2CoverageManifestEntry[] = [
  {
    route: 'prep',
    requirement: 'Inspection preparation',
    status: 'interactive',
    canonicalConceptId: 'inspection_brief',
    engineBinding:
      'survey.brief.instruction.party.set; survey.brief.instruction.source.set',
    blocker:
      'Only instructing party and source are currently Engine-backed; other PREP fields remain schema-only.',
    recommendedLaterWork: 'Add approved operations without changing the established PREP paths.',
  },
  ...flattenCoverage(LEVEL_2_COMMAND_NODES, []),
];

export function level2CoverageForRoute(
  route: string | readonly string[],
): Level2CoverageManifestEntry | undefined {
  const path = Array.isArray(route) ? route.join('/') : route;
  return LEVEL_2_COVERAGE_MANIFEST.find((entry) => entry.route === path);
}
