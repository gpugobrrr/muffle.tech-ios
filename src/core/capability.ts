/**
 * Domain-neutral capability kinds, census, and structural index checks.
 *
 * A vertical supplies its own route records. This module does not know what
 * those routes represent.
 */

export const CAPABILITY_KINDS = {
  capture: 'capture',
  navigation: 'navigation',
  derived: 'derived',
  blocked: 'blocked',
} as const;

export type CapabilityKind =
  (typeof CAPABILITY_KINDS)[keyof typeof CAPABILITY_KINDS];

export type CapabilityIndexEntry = {
  route: string;
  kind: string;
};

export type CapabilityCensusCounts = {
  total: number;
  capture: number;
  navigation: number;
  derived: number;
  blocked: number;
  unclassified: number;
};

export type CapabilityIssue = {
  route: string;
  message: string;
};

const KNOWN_KINDS = new Set<string>(Object.values(CAPABILITY_KINDS));

export function censusFromCapabilities(
  capabilities: readonly CapabilityIndexEntry[],
): CapabilityCensusCounts {
  const counts: CapabilityCensusCounts = {
    total: capabilities.length,
    capture: 0,
    navigation: 0,
    derived: 0,
    blocked: 0,
    unclassified: 0,
  };
  for (const capability of capabilities) {
    if (capability.kind === CAPABILITY_KINDS.capture) counts.capture += 1;
    else if (capability.kind === CAPABILITY_KINDS.navigation) counts.navigation += 1;
    else if (capability.kind === CAPABILITY_KINDS.derived) counts.derived += 1;
    else if (capability.kind === CAPABILITY_KINDS.blocked) counts.blocked += 1;
    else counts.unclassified += 1;
  }
  return counts;
}

/** One route must have exactly one kind. */
export function collectDuplicateKindIssues(
  capabilities: readonly CapabilityIndexEntry[],
): CapabilityIssue[] {
  const issues: CapabilityIssue[] = [];
  const kindsByRoute = new Map<string, string>();
  for (const capability of capabilities) {
    const existing = kindsByRoute.get(capability.route);
    if (existing && existing !== capability.kind) {
      issues.push({
        route: capability.route,
        message: `route classified as both ${existing} and ${capability.kind}`,
      });
    }
    kindsByRoute.set(capability.route, capability.kind);
  }
  return issues;
}

export function collectUnknownKindIssues(
  capabilities: readonly CapabilityIndexEntry[],
  allowedKinds: ReadonlySet<string> = KNOWN_KINDS,
): CapabilityIssue[] {
  const issues: CapabilityIssue[] = [];
  for (const capability of capabilities) {
    if (!allowedKinds.has(capability.kind)) {
      issues.push({
        route: capability.route,
        message: 'unclassified governed route',
      });
    }
  }
  return issues;
}

export function collectUnclassifiedCountIssue(
  unclassified: number,
): CapabilityIssue[] {
  if (unclassified === 0) return [];
  return [
    {
      route: '*',
      message: `unclassified governed routes = ${unclassified}`,
    },
  ];
}
