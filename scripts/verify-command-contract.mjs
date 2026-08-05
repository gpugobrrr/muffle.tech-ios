/**
 * Contract check without a test runner. Imports the real command registry and
 * parser so the fixtures cannot drift from the shipped SVYR grammar.
 */
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./ts-alias-hooks.mjs', import.meta.url);

const { verifyCommandContract, verifySuggestionParity } = await import(
  '../src/lib/command-contract.ts'
);
const { childNodes, findCommandNode } = await import(
  '../src/lib/command-registry.ts'
);
const { getCommandAssistance, suggestionTokens, tokenSuggestions } =
  await import('../src/lib/command-parser.ts');
const {
  canRemoveLastEditableCommandSegment,
  deletePreviousCommandPart,
  removeLastEditableCommandSegment,
} = await import('../src/lib/command-edit.ts');

const failures = verifyCommandContract();
assert.deepEqual(failures, [], `contract failures:\n${failures.join('\n')}`);

const parityFailures = verifySuggestionParity();
assert.deepEqual(
  parityFailures,
  [],
  `suggestion parity failures:\n${parityFailures.join('\n')}`,
);

/**
 * One controller state feeds both renderers, so each must receive the same
 * suggestion objects — not merely equal tokens. Expectations come from the
 * registry so the fixtures follow it automatically.
 */
for (const [commandSuffix, path] of [
  ['', []],
  ['prep', ['prep']],
  ['prep/brief', ['prep', 'brief']],
  ['prep/brief/instr', ['prep', 'brief', 'instr']],
]) {
  const shared = getCommandAssistance(commandSuffix, []);

  const powerUserSuggestions = tokenSuggestions(shared);
  const portraitSuggestions = tokenSuggestions(shared);

  assert.deepEqual(
    portraitSuggestions,
    powerUserSuggestions,
    `renderers disagree at "${commandSuffix}"`,
  );
  portraitSuggestions.forEach((suggestion, index) => {
    assert.equal(
      suggestion,
      powerUserSuggestions[index],
      `renderers received different suggestion objects at "${commandSuffix}"`,
    );
  });

  assert.deepEqual(
    suggestionTokens(shared),
    childNodes(path).map((node) => node.token),
    `suggestions at "${commandSuffix}" must match the registered children`,
  );
}

assert.equal(
  findCommandNode(['prep', 'brief', 'instr', 'party']).operationId,
  'survey.brief.instruction.party.set',
);
assert.equal(
  findCommandNode(['prep', 'brief', 'instr', 'party']).readOperationId,
  'survey.brief.instruction.party.read',
);

assert.deepEqual(suggestionTokens(getCommandAssistance('prep/brief/pu', [])), [
  'purp',
]);
assert.deepEqual(
  suggestionTokens(getCommandAssistance('prep/brief/purpose', [])),
  ['purp'],
);

assert.equal(deletePreviousCommandPart('prep/brief/purp'), 'prep/brief');
assert.equal(deletePreviousCommandPart('prep/brief/purpose'), 'prep/brief');
assert.equal(
  removeLastEditableCommandSegment('prep/brief/instr/ref '),
  'prep/brief/instr',
);

/**
 * Atomic Backspace and the directory-up swipe must resolve through the same
 * structural helper, so every editable path yields one identical result.
 */
for (const suffix of [
  'prep',
  'prep/brief',
  'prep/brief/instr',
  'prep/brief/instr/party',
  'prep/brief/instr/party ',
]) {
  assert.equal(
    removeLastEditableCommandSegment(suffix),
    deletePreviousCommandPart(suffix),
    `swipe and Backspace disagree on "${suffix}"`,
  );
}

// Walking a full path up to the root removes exactly one segment per swipe.
assert.deepEqual(
  ['prep/brief/instr/party', 'prep/brief/instr', 'prep/brief', 'prep'].map(
    (suffix) => removeLastEditableCommandSegment(suffix),
  ),
  ['prep/brief/instr', 'prep/brief', 'prep', ''],
);

// Pinned prefixes are protected, and unsaved free text is never discarded.
assert.equal(
  canRemoveLastEditableCommandSegment('', ['prep', 'brief']),
  false,
);
assert.equal(
  removeLastEditableCommandSegment('instr/party', ['prep', 'brief']),
  'instr',
);
assert.equal(
  removeLastEditableCommandSegment('prep/brief/instr/party North & Co'),
  'prep/brief/instr/party North & Co',
);
assert.equal(
  canRemoveLastEditableCommandSegment('prep/brief/instr/party North & Co'),
  false,
);

const { parseCommand } = await import('../src/lib/command-parser.ts');
const { executeSurveyOperation, SURVEY_OPERATIONS } = await import(
  '../src/lib/survey-operations.ts'
);

const emptyBrief = {
  instruction: {
    instructingParty: null,
    client: null,
    reference: null,
  },
};

const readParsed = parseCommand('prep/brief/instr/party');
assert.equal(readParsed.type, 'operation');
assert.equal(
  readParsed.type === 'operation' && readParsed.operation.operationId,
  SURVEY_OPERATIONS.readInstructingParty,
);

const readResult = executeSurveyOperation(
  emptyBrief,
  readParsed.type === 'operation'
    ? readParsed.operation
    : { operationId: '', arguments: {} },
);
assert.equal(readResult?.label, 'Instructing party');
assert.equal(readResult?.value, 'Not recorded');

const writeParsed = parseCommand('prep/brief/instr/party North & Co');
assert.equal(writeParsed.type, 'operation');
const writeResult = executeSurveyOperation(
  emptyBrief,
  writeParsed.type === 'operation'
    ? writeParsed.operation
    : { operationId: '', arguments: {} },
);
assert.equal(writeResult?.value, 'North & Co');
assert.equal(
  writeResult?.brief.instruction.instructingParty,
  'North & Co',
);

console.log('command contract ok');
