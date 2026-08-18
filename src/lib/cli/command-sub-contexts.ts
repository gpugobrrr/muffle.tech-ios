/**
 * RICS domain sub-command contexts and options for dynamic Golden Zone HUD switching.
 * When a surveyor types or dictates a lead keyword (e.g. 'location', 'urgent', 'defect'),
 * the Golden Zone HUD dynamically updates to display relevant valid arguments.
 */

export type SubContextKeyword =
  | 'urgent'
  | 'defect'
  | 'routine'
  | 'location'
  | 'recommend'
  | 'material'
  | 'room'
  | 'photo';

export const COMMAND_REGISTRY: Record<SubContextKeyword, readonly string[]> = {
  urgent: [
    'roof spread rear slope',
    'sagging collar tie',
    'active water ingress',
    'spalling gable brickwork',
    'structural referral',
    'deflected purlin',
    'severe damp staining',
    'rot in main rafter',
  ],
  defect: [
    'condensation on sarking',
    'torn bitumen felt',
    'missing insulation',
    'delaminated felt',
    'woodworm flight holes',
    'unlagged pipework',
    'dampness around chimney',
    'loose valley mortar',
  ],
  routine: [
    'adequate 270mm quilt',
    'timbers appear dry',
    'functioning eaves vents',
    'sound collar ties',
    'breathable underlay',
    'clear ventilation path',
    'dry hatch insulation',
    'no active infestation',
  ],
  location: [
    'rear north slope',
    'eaves level',
    'ridge board',
    'party wall junction',
    'front pitch',
    'around chimney stack',
    'valley gutter',
    'hatch surround',
  ],
  recommend: [
    'structural engineer',
    'specialist timber report',
    'roofer overhaul',
    'add eaves ventilation',
    'top up to 270mm quilt',
    'replace damaged felt',
    'lag all cold pipework',
    'treat timber infestation',
  ],
  material: [
    'mineral wool quilt',
    'bitumen felt',
    'sarking board',
    'timber rafters',
    'breathable membrane',
    'rigid PIR board',
    'slate battens',
    'lead flashing',
  ],
  room: [
    'roof void',
    'external walls',
    'chimneys roof external',
    'rainwater goods',
    'internal ceilings walls',
    'floors joinery',
    'windows external doors',
    'bathroom sanitary',
  ],
  photo: [
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
  ],
};

/**
 * Returns contextual sub-command hints if the input text starts with a known lead keyword.
 * Returns null if input is empty or does not match a sub-context.
 */
export function getSubCommandHints(
  inputText?: string | null,
): readonly string[] | null {
  if (!inputText) return null;
  const trimmed = inputText.trim();
  if (!trimmed) return null;

  const firstWord = trimmed.split(/\s+/)[0]?.toLowerCase();
  if (!firstWord) return null;

  if (firstWord === 'urgent' || firstWord === 'critical') {
    return COMMAND_REGISTRY.urgent;
  }
  if (firstWord === 'defect' || firstWord === 'issue') {
    return COMMAND_REGISTRY.defect;
  }
  if (firstWord === 'routine' || firstWord === 'note') {
    return COMMAND_REGISTRY.routine;
  }
  if (firstWord === 'location') {
    return COMMAND_REGISTRY.location;
  }
  if (firstWord === 'recommend' || firstWord === 'recommendation') {
    return COMMAND_REGISTRY.recommend;
  }
  if (firstWord === 'material') {
    return COMMAND_REGISTRY.material;
  }
  if (firstWord === 'room') {
    return COMMAND_REGISTRY.room;
  }
  if (firstWord === 'photo' || firstWord === 'photos') {
    return COMMAND_REGISTRY.photo;
  }

  return null;
}
