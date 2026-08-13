import {
  CAPABILITY_KINDS,
  censusFromCapabilities,
  collectDuplicateKindIssues,
  collectUnclassifiedCountIssue,
  collectUnknownKindIssues,
  type CapabilityCensusCounts,
  type CapabilityIssue,
  type CapabilityKind,
} from '@/core/capability';
import {
  getConceptByCanonicalField,
  getOntologyConcept,
} from '@/domain/ontology/muffle-ontology.v1';
import {
  COMMAND_REGISTRY,
  findCommandNode,
  isBranchNode,
  type CommandNode,
} from '@/lib/command-registry';
import {
  resolveSvyrDataEntryType,
  resolveSvyrNodeDataEntryType,
  type SvyrDataEntryType,
} from '@/lib/data-entry-types';
import { EXTERNAL_FINDING_CONFIGS } from '@/lib/external-findings';
import { findFieldDefinition } from '@/lib/field-schema';
import type { FindingCaptureConfig } from '@/lib/finding-capture';
import { INTERNAL_FINDING_CONFIGS } from '@/lib/internal-findings';
import { isInspectionElementConceptId } from '@/lib/inspection-finding-elements';
import { MAINS_SERVICE_FIELD_IDS } from '@/lib/property-energy-mains-services';
import {
  SERVICES_FINDING_CONFIGS,
  SERVICES_GAS_FINDING_CONFIG,
} from '@/lib/services-findings';

/** Product/runtime capability of one governed SVYR route. */
export const SURVEY_CAPABILITY_KINDS = CAPABILITY_KINDS;

export type SurveyCapabilityKind = CapabilityKind;

/**
 * Why a visible route is intentionally not canonical capture.
 * Kept small: one reason per actual repository pattern, not per label.
 */
export const SURVEY_BLOCKED_REASONS = {
  missingFieldSemantics: 'missing_field_semantics',
  unresolvedSubjectScope: 'unresolved_subject_scope',
  ontologyTypeOnly: 'ontology_type_only',
  workflowModelUndefined: 'workflow_model_undefined',
  findingModelExtensionRequired: 'finding_model_extension_required',
  publicationGrouping: 'publication_grouping',
  intentionallyUnsupported: 'intentionally_unsupported',
} as const;

export type SurveyBlockedReason =
  (typeof SURVEY_BLOCKED_REASONS)[keyof typeof SURVEY_BLOCKED_REASONS];

export type SurveyCapability = {
  route: string;
  path: readonly string[];
  kind: SurveyCapabilityKind;
  captureType?: SvyrDataEntryType;
  fieldId?: string;
  findingId?: string;
  elementConceptId?: string;
  operationId?: string;
  blockedReason?: SurveyBlockedReason;
  optional?: boolean;
};

export type SurveyCapabilityCensus = CapabilityCensusCounts & {
  capabilities: readonly SurveyCapability[];
};

export type SurveyCapabilityIssue = CapabilityIssue;

/** Authoritative finding configs — capability indexes these, it does not copy them. */
export function allFindingCaptureConfigs(): readonly FindingCaptureConfig[] {
  return [
    ...EXTERNAL_FINDING_CONFIGS,
    ...INTERNAL_FINDING_CONFIGS,
    ...SERVICES_FINDING_CONFIGS,
    SERVICES_GAS_FINDING_CONFIG,
  ];
}

export function findingConfigForPath(
  path: readonly string[],
): FindingCaptureConfig | undefined {
  const matches = allFindingCaptureConfigs().filter((config) => {
    if (path.length < config.route.length) return false;
    return config.route.every((token, index) => path[index] === token);
  });
  return matches.sort((left, right) => right.route.length - left.route.length)[0];
}

function routeKey(path: readonly string[]): string {
  return path.join('/');
}

/**
 * Explicit blocked-reason index. Classification still comes from the command
 * tree; this map only names why a blocked route is blocked.
 */
export const BLOCKED_ROUTE_REASONS: Readonly<Record<string, SurveyBlockedReason>> = {
  'prep/scope': SURVEY_BLOCKED_REASONS.workflowModelUndefined,
  'prep/access': SURVEY_BLOCKED_REASONS.workflowModelUndefined,
  'prep/equipment': SURVEY_BLOCKED_REASONS.workflowModelUndefined,
  'prep/plan': SURVEY_BLOCKED_REASONS.workflowModelUndefined,
  'prep/ready': SURVEY_BLOCKED_REASONS.workflowModelUndefined,
  'property/flat': SURVEY_BLOCKED_REASONS.missingFieldSemantics,
  'property/construction': SURVEY_BLOCKED_REASONS.missingFieldSemantics,
  'property/accommodation': SURVEY_BLOCKED_REASONS.missingFieldSemantics,
  'property/roof-spaces': SURVEY_BLOCKED_REASONS.missingFieldSemantics,
  'property/location': SURVEY_BLOCKED_REASONS.workflowModelUndefined,
  'property/location/grounds': SURVEY_BLOCKED_REASONS.unresolvedSubjectScope,
  'property/location/facilities': SURVEY_BLOCKED_REASONS.missingFieldSemantics,
  'property/location/environment': SURVEY_BLOCKED_REASONS.missingFieldSemantics,
  'external/limitation': SURVEY_BLOCKED_REASONS.workflowModelUndefined,
  'external/roof': SURVEY_BLOCKED_REASONS.unresolvedSubjectScope,
  'external/doors': SURVEY_BLOCKED_REASONS.unresolvedSubjectScope,
  'external/porch': SURVEY_BLOCKED_REASONS.ontologyTypeOnly,
  'external/joinery': SURVEY_BLOCKED_REASONS.publicationGrouping,
  'external/other': SURVEY_BLOCKED_REASONS.publicationGrouping,
  'internal/limitation': SURVEY_BLOCKED_REASONS.workflowModelUndefined,
  'internal/roof-structure': SURVEY_BLOCKED_REASONS.unresolvedSubjectScope,
  'internal/walls-partitions': SURVEY_BLOCKED_REASONS.unresolvedSubjectScope,
  'internal/floors': SURVEY_BLOCKED_REASONS.unresolvedSubjectScope,
  'internal/fireplaces-flues': SURVEY_BLOCKED_REASONS.ontologyTypeOnly,
  'internal/built-ins': SURVEY_BLOCKED_REASONS.missingFieldSemantics,
  'internal/woodwork': SURVEY_BLOCKED_REASONS.ontologyTypeOnly,
  'internal/bathroom': SURVEY_BLOCKED_REASONS.missingFieldSemantics,
  'internal/other': SURVEY_BLOCKED_REASONS.publicationGrouping,
  'services/limitation': SURVEY_BLOCKED_REASONS.workflowModelUndefined,
  'services/gas-oil/oil': SURVEY_BLOCKED_REASONS.intentionallyUnsupported,
  'services/common': SURVEY_BLOCKED_REASONS.publicationGrouping,
  'grounds/limitation': SURVEY_BLOCKED_REASONS.workflowModelUndefined,
  'grounds/garage': SURVEY_BLOCKED_REASONS.unresolvedSubjectScope,
  'grounds/outbuildings': SURVEY_BLOCKED_REASONS.unresolvedSubjectScope,
  'grounds/other': SURVEY_BLOCKED_REASONS.publicationGrouping,
  evidence: SURVEY_BLOCKED_REASONS.workflowModelUndefined,
};

function captureTypeFor(path: readonly string[], node: CommandNode): SvyrDataEntryType | undefined {
  const fromNode = resolveSvyrNodeDataEntryType(node);
  if (fromNode) return fromNode;
  const field = findFieldDefinition([...path]);
  if (field) return resolveSvyrDataEntryType(field);
  return undefined;
}

export function classifyCommandNode(
  path: readonly string[],
  node: CommandNode,
): SurveyCapabilityKind {
  if (
    node.evidenceCaptureTarget ||
    node.findingTarget ||
    node.fieldId ||
    node.compoundCapture
  ) {
    return SURVEY_CAPABILITY_KINDS.capture;
  }

  if (node.coverage?.status === 'derived-publication') {
    return SURVEY_CAPABILITY_KINDS.derived;
  }

  if (node.coverage?.status === 'pre-populated') {
    return SURVEY_CAPABILITY_KINDS.navigation;
  }

  if (node.available === false || node.coverage?.status === 'blocked') {
    return SURVEY_CAPABILITY_KINDS.blocked;
  }

  if (node.coverage?.blocker && !isBranchNode(node)) {
    return SURVEY_CAPABILITY_KINDS.blocked;
  }

  if (isBranchNode(node) || node.coverage?.status === 'navigation-only') {
    return SURVEY_CAPABILITY_KINDS.navigation;
  }

  if (node.workflowOnly) {
    return SURVEY_CAPABILITY_KINDS.blocked;
  }

  return SURVEY_CAPABILITY_KINDS.navigation;
}

export function describeCommandNodeCapability(
  path: readonly string[],
  node: CommandNode,
): SurveyCapability {
  const kind = classifyCommandNode(path, node);
  const route = routeKey(path);
  const findingConfig = findingConfigForPath(path);
  const field = node.fieldId ? findFieldDefinition([...path]) : null;

  const capability: SurveyCapability = {
    route,
    path,
    kind,
  };

  if (kind === SURVEY_CAPABILITY_KINDS.capture) {
    capability.captureType = captureTypeFor(path, node);
    if (node.fieldId) capability.fieldId = node.fieldId;
    else if (field) capability.fieldId = field.fieldId;
    if (node.findingTarget) {
      capability.findingId = node.findingTarget.findingId;
      capability.elementConceptId = node.findingTarget.elementConceptId;
      capability.operationId = node.operationId ?? 'survey.inspection.finding.upsert';
    } else if (node.evidenceCaptureTarget) {
      capability.findingId = node.evidenceCaptureTarget.findingId;
      capability.elementConceptId = node.evidenceCaptureTarget.elementConceptId;
      capability.operationId = 'survey.inspection.evidence.add';
    } else if (findingConfig && node.compoundCapture !== true && !node.fieldId) {
      capability.findingId = findingConfig.findingId;
      capability.elementConceptId = findingConfig.elementConceptId;
    }
    if (node.operationId) capability.operationId = node.operationId;
    else if (field?.operationId) capability.operationId = field.operationId;
    if (node.optional) capability.optional = true;
  }

  if (kind === SURVEY_CAPABILITY_KINDS.blocked) {
    capability.blockedReason = BLOCKED_ROUTE_REASONS[route];
  }

  return capability;
}

function walkRegistry(
  nodes: readonly CommandNode[],
  parent: readonly string[],
  capabilities: SurveyCapability[],
): void {
  for (const node of nodes) {
    const path = [...parent, node.token];
    capabilities.push(describeCommandNodeCapability(path, node));
    if (node.children?.length) {
      walkRegistry(node.children, path, capabilities);
    }
  }
}

export function surveyCapabilityCensus(): SurveyCapabilityCensus {
  const capabilities: SurveyCapability[] = [];
  walkRegistry(COMMAND_REGISTRY, [], capabilities);
  return {
    ...censusFromCapabilities(capabilities),
    capabilities,
  };
}

export function capabilityForCommand(command: string): SurveyCapability | null {
  const raw = command.split('/').filter(Boolean);
  const canonical: string[] = [];
  let node: CommandNode | null = null;
  for (const token of raw) {
    const next = findCommandNode([...canonical, token]);
    if (!next) return null;
    canonical.push(next.token);
    node = next;
  }
  if (!node) return null;
  return describeCommandNodeCapability(canonical, node);
}

export function capabilityForRoute(
  route: string | readonly string[],
): SurveyCapability | null {
  const command = typeof route === 'string' ? route : route.join('/');
  return capabilityForCommand(command);
}

export function validateSurveyCapabilities(
  census = surveyCapabilityCensus(),
): SurveyCapabilityIssue[] {
  const issues: SurveyCapabilityIssue[] = [];
  const findingIds = new Map<string, string>();
  const elementIds = new Map<string, string>();

  for (const config of allFindingCaptureConfigs()) {
    const previousId = findingIds.get(config.findingId);
    if (previousId && previousId !== config.route.join('/')) {
      issues.push({
        route: config.route.join('/'),
        message: `duplicate finding ID ${config.findingId}`,
      });
    }
    findingIds.set(config.findingId, config.route.join('/'));
    const previousElement = elementIds.get(config.elementConceptId);
    if (previousElement && previousElement !== config.route.join('/')) {
      issues.push({
        route: config.route.join('/'),
        message: `duplicate elementConceptId ${config.elementConceptId}`,
      });
    }
    elementIds.set(config.elementConceptId, config.route.join('/'));
    if (!isInspectionElementConceptId(config.elementConceptId)) {
      issues.push({
        route: config.route.join('/'),
        message: `elementConceptId ${config.elementConceptId} is not Engine-backed`,
      });
    }
  }

  issues.push(
    ...collectDuplicateKindIssues(census.capabilities),
    ...collectUnknownKindIssues(census.capabilities),
    ...collectUnclassifiedCountIssue(census.unclassified),
  );

  for (const capability of census.capabilities) {
    const node = findCommandNode([...capability.path]);
    if (!node) {
      issues.push({ route: capability.route, message: 'capability path does not resolve' });
      continue;
    }

    if (capability.kind === SURVEY_CAPABILITY_KINDS.capture) {
      if (!capability.captureType) {
        issues.push({ route: capability.route, message: 'capture route has no Type 1–7 kind' });
      }
      if (node.fieldId) {
        const field = findFieldDefinition([...capability.path]);
        if (!field) {
          issues.push({
            route: capability.route,
            message: `missing field schema for ${node.fieldId}`,
          });
        } else {
          if (field.fieldId !== node.fieldId) {
            issues.push({
              route: capability.route,
              message: 'node fieldId does not match field schema',
            });
          }
          if (!field.operationId && !node.operationId) {
            issues.push({
              route: capability.route,
              message: 'field capture has no Engine operation',
            });
          }
          if (!getConceptByCanonicalField(field.fieldId)) {
            issues.push({
              route: capability.route,
              message: `missing ontology semantics for ${field.fieldId}`,
            });
          }
          const schemaType = resolveSvyrDataEntryType(field);
          if (
            capability.captureType &&
            capability.captureType !== schemaType
          ) {
            issues.push({
              route: capability.route,
              message: `capture kind ${capability.captureType} conflicts with schema kind ${schemaType}`,
            });
          }
        }
      }
      if (node.findingTarget) {
        const config = findingConfigForPath(capability.path);
        if (!config) {
          issues.push({ route: capability.route, message: 'finding leaf has no finding config' });
        } else if (config.findingId !== node.findingTarget.findingId) {
          issues.push({
            route: capability.route,
            message: 'finding leaf ID does not match finding config',
          });
        } else if (config.elementConceptId !== node.findingTarget.elementConceptId) {
          issues.push({
            route: capability.route,
            message: 'finding leaf elementConceptId does not match finding config',
          });
        }
        if (!isInspectionElementConceptId(node.findingTarget.elementConceptId)) {
          issues.push({
            route: capability.route,
            message: 'finding elementConceptId is not Engine-backed',
          });
        }
      }
      if (node.evidenceCaptureTarget) {
        const config = findingConfigForPath(capability.path);
        if (!config) {
          issues.push({ route: capability.route, message: 'evidence leaf has no finding config' });
        } else if (config.findingId !== node.evidenceCaptureTarget.findingId) {
          issues.push({
            route: capability.route,
            message: 'evidence target does not match finding config',
          });
        }
      }
    }

    if (capability.kind === SURVEY_CAPABILITY_KINDS.blocked) {
      if (!capability.blockedReason) {
        issues.push({
          route: capability.route,
          message: 'blocked route is missing an explicit blocked reason',
        });
      }
      if (node.operationId || node.findingTarget || node.evidenceCaptureTarget || node.fieldId) {
        issues.push({
          route: capability.route,
          message: 'blocked route must not declare Engine write bindings',
        });
      }
      const conceptId = node.coverage?.canonicalConceptId;
      if (conceptId && isInspectionElementConceptId(conceptId)) {
        issues.push({
          route: capability.route,
          message: 'blocked route points at an Engine-backed inspection element',
        });
      }
    }

    if (capability.kind === SURVEY_CAPABILITY_KINDS.derived) {
      if (node.fieldId || node.findingTarget || node.evidenceCaptureTarget) {
        issues.push({
          route: capability.route,
          message: 'derived route must not store canonical capture targets',
        });
      }
    }
  }

  const blockedFromCensus = census.capabilities
    .filter((capability) => capability.kind === SURVEY_CAPABILITY_KINDS.blocked)
    .map((capability) => capability.route)
    .sort();
  const blockedFromIndex = Object.keys(BLOCKED_ROUTE_REASONS).sort();
  if (blockedFromCensus.join('\n') !== blockedFromIndex.join('\n')) {
    issues.push({
      route: '*',
      message: 'blocked census routes do not match BLOCKED_ROUTE_REASONS',
    });
  }

  return issues;
}

export const SHARED_MAINS_SERVICE_FIELD_IDS = MAINS_SERVICE_FIELD_IDS;

export function ontologyConceptIsTypeOnly(conceptId: string): boolean {
  return getOntologyConcept(conceptId)?.maturity === 'type-only';
}
