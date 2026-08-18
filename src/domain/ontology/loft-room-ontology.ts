export type ConditionRating = 'CR1' | 'CR2' | 'CR3';

export type LoftDefectId =
  | 'roof_spread'
  | 'insulation_deficit'
  | 'condensation_ventilation';

export type RICSClauseStructure = {
  observation: string;
  implication: string;
  recommendation: string;
};

export type LoftDefectDefinition = {
  defaultRating: ConditionRating;
  requiredSlots: readonly string[];
  buildClause: (slots: Record<string, string>) => RICSClauseStructure;
};

const MINERAL_WOOL_BENCHMARK_MM = 270;

function parseMeasurementMm(measurement: string): number | null {
  const match = /(\d+)\s*mm/i.exec(measurement);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) ? value : null;
}

function buildRoofSpreadClause(slots: Record<string, string>): RICSClauseStructure {
  const location = slots.location?.trim() || '[location]';
  const referral = slots.referral?.trim() || 'Structural Engineer (SE)';
  return {
    observation: `Rafter spread and collar tie deflection noted at the ${location}.`,
    implication: 'Outward thrust on wall-heads is likely.',
    recommendation: `${referral} appraisal recommended.`,
  };
}

function buildInsulationDeficitClause(
  slots: Record<string, string>,
): RICSClauseStructure {
  const measurement = slots.measurement?.trim() || '[measurement]';
  const measuredMm = parseMeasurementMm(measurement);
  const deficit =
    measuredMm === null
      ? null
      : Math.max(0, MINERAL_WOOL_BENCHMARK_MM - measuredMm);
  const implication =
    deficit === null
      ? 'Insulation depth appears below current guidance.'
      : `Deficit: ~${deficit}mm against ${MINERAL_WOOL_BENCHMARK_MM}mm mineral wool benchmark.`;

  return {
    observation: `Loft insulation measured at approximately ${measurement}.`,
    implication,
    recommendation:
      'Improve insulation depth to meet current guidance where practicable.',
  };
}

function buildCondensationVentilationClause(
  slots: Record<string, string>,
): RICSClauseStructure {
  const location = slots.location?.trim() || '[location]';
  return {
    observation: `Moisture staining on sarking/felt noted at the ${location}.`,
    implication:
      'Condensation risk is elevated and eaves ventilation appears inadequate.',
    recommendation:
      'Improve roof-space ventilation, particularly at eaves level.',
  };
}

export const LOFT_DEFECT_DEFINITIONS: Readonly<
  Record<LoftDefectId, LoftDefectDefinition>
> = {
  roof_spread: {
    defaultRating: 'CR3',
    requiredSlots: ['location', 'referral'],
    buildClause: buildRoofSpreadClause,
  },
  insulation_deficit: {
    defaultRating: 'CR2',
    requiredSlots: ['measurement'],
    buildClause: buildInsulationDeficitClause,
  },
  condensation_ventilation: {
    defaultRating: 'CR2',
    requiredSlots: ['location'],
    buildClause: buildCondensationVentilationClause,
  },
};

export function buildLoftClause(
  defectId: LoftDefectId,
  slots: Record<string, string>,
): RICSClauseStructure {
  return LOFT_DEFECT_DEFINITIONS[defectId].buildClause(slots);
}

export function getMissingSlots(
  defectId: LoftDefectId,
  slots: Record<string, string>,
): string[] {
  return LOFT_DEFECT_DEFINITIONS[defectId].requiredSlots.filter(
    (slotName) => !slots[slotName]?.trim(),
  );
}
