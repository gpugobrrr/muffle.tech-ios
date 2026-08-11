import { commands } from '@/lib/command-builders';
import {
  getCommandAssistance,
  parseCommand,
  suggestionTokens,
  tokenSuggestions,
} from '@/lib/command-parser';
import { childNodes, parseSvyrInput } from '@/lib/command-registry';
import { SURVEY_OPERATIONS } from '@/lib/survey-operations';

/**
 * Ensures visible command strings remain valid executable commands.
 * Returns a list of failure messages (empty = pass).
 */
export function verifyCommandContract(): string[] {
  const failures: string[] = [];

  const expect = (label: string, command: string, expectedType: string) => {
    const parsed = parseCommand(command);
    if (parsed.type !== expectedType) {
      failures.push(
        `${label}: expected parse type "${expectedType}" for "${command}", got "${parsed.type}"`,
      );
    }
  };

  expect('preparation', commands.preparation(), 'incomplete');
  expect('openBrief alone', commands.openBrief(), 'incomplete');
  expect('briefInstruction', commands.briefInstruction(), 'incomplete');

  const partyRead = parseCommand(commands.briefInstructingParty());
  if (partyRead.type !== 'operation') {
    failures.push(
      `briefInstructingParty: expected a read operation, got "${partyRead.type}"`,
    );
  } else if (
    partyRead.operation.operationId !== SURVEY_OPERATIONS.readInstructingParty
  ) {
    failures.push(
      `briefInstructingParty operation mismatch: "${partyRead.operation.operationId}"`,
    );
  }

  const complete = commands.setInstructingParty('North & Co');
  if (complete !== 'prep/brief/instr/party North & Co') {
    failures.push(`setInstructingParty builder mismatch: "${complete}"`);
  }

  const parsed = parseCommand(complete);
  if (parsed.type !== 'operation') {
    failures.push(
      `setInstructingParty: expected an operation, got "${parsed.type}"`,
    );
  } else {
    if (parsed.operation.operationId !== SURVEY_OPERATIONS.setInstructingParty) {
      failures.push(
        `setInstructingParty operation mismatch: "${parsed.operation.operationId}"`,
      );
    }
    if (parsed.operation.arguments.value !== 'North & Co') {
      failures.push(
        `setInstructingParty value mismatch: "${parsed.operation.arguments.value}"`,
      );
    }
  }

  expect('openScope', commands.openScope(), 'placeholder');
  expect('openAccess', commands.openAccess(), 'placeholder');
  expect('openEquipment', commands.openEquipment(), 'placeholder');
  expect('openPlan', commands.openPlan(), 'placeholder');
  expect('openReady', commands.openReady(), 'placeholder');

  const pinAttempt = parseCommand('prep/brief pin');
  if (pinAttempt.type !== 'unknown') {
    failures.push(
      `pin commands must be removed; got "${pinAttempt.type}" for "prep/brief pin"`,
    );
  }
  const unpinAttempt = parseCommand('unpin');
  if (unpinAttempt.type !== 'unknown') {
    failures.push(
      `unpin commands must be removed; got "${unpinAttempt.type}" for "unpin"`,
    );
  }

  const expectSuggestionLabels = (
    command: string,
    expectedLabels: string[],
  ) => {
    const labels = tokenSuggestions(getCommandAssistance(command)).map(
      (suggestion) => suggestion.label,
    );
    if (labels.join(',') !== expectedLabels.join(',')) {
      failures.push(
        `suggestion labels for "${command}": expected [${expectedLabels.join(
          ', ',
        )}], got [${labels.join(', ')}]`,
      );
    }
  };

  expectSuggestionLabels('prep/brief', ['instr', 'purp', 'deliv', 'limit']);
  expectSuggestionLabels('prep/brief/instr', [
    'party <name>',
    'client <name>',
    'ref <ref>',
    'source',
  ]);
  expectSuggestionLabels('prep/brief/purpose', ['purp']);
  expectSuggestionLabels('prep/brief/instr/reference', ['ref <ref>']);

  const expectAliasPath = (command: string, expectedPath: string[]) => {
    const aliasResult = parseCommand(command);
    if (
      !('path' in aliasResult) ||
      aliasResult.path.join('/') !== expectedPath.join('/')
    ) {
      failures.push(
        `alias "${command}": expected canonical path "${expectedPath.join(
          '/',
        )}"`,
      );
    }
  };

  expectAliasPath('prep/brief/purpose', ['prep', 'brief', 'purp']);
  expectAliasPath('prep/brief/deliverable', ['prep', 'brief', 'deliv']);
  expectAliasPath('prep/brief/limitations', ['prep', 'brief', 'limit']);
  expectAliasPath('prep/brief/instr/reference', [
    'prep',
    'brief',
    'instr',
    'ref',
  ]);

  failures.push(...verifySuggestionParity());

  return failures;
}

/** Command paths exercised by the parity check, as typed into SVYR >. */
const PARITY_PATHS = ['', 'prep', 'prep/brief', 'prep/brief/instr'];

/**
 * Autocomplete must expose exactly the registry children for each path.
 * Expected commands are read from the registry rather than restated here.
 */
export function verifySuggestionParity(): string[] {
  const failures: string[] = [];

  for (const commandSuffix of PARITY_PATHS) {
    const suggestions = getCommandAssistance(commandSuffix);
    const resolvedTokens = suggestionTokens(suggestions);
    const { path } = parseSvyrInput(commandSuffix);
    const registered = childNodes(path).map((node) => node.token);

    if (resolvedTokens.join(',') !== registered.join(',')) {
      failures.push(
        `suggestions for "${commandSuffix}": registry offers [${registered.join(
          ', ',
        )}], resolver returned [${resolvedTokens.join(', ')}]`,
      );
    }
  }

  return failures;
}
