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

  expect('prep/brief pin', commands.pin('prep/brief'), 'pin-context');
  expect(
    'prep/brief/instr pin',
    commands.pin('prep/brief/instr'),
    'pin-context',
  );
  expect('unpin', commands.unpin(), 'unpin-context');
  expect(
    'value pin rejected',
    'prep/brief/instr/party North & Co pin',
    'cannot-pin',
  );

  const expectSuggestionLabels = (
    command: string,
    expectedLabels: string[],
  ) => {
    const labels = tokenSuggestions(getCommandAssistance(command, [])).map(
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
 * Portrait and Power User mode render one shared suggestion list. Expected
 * commands are read from the registry rather than restated here, so adding or
 * removing a node updates both layouts and this check at once — and neither
 * renderer can filter, truncate, or extend what the registry offers.
 */
export function verifySuggestionParity(): string[] {
  const failures: string[] = [];

  for (const commandSuffix of PARITY_PATHS) {
    const suggestions = getCommandAssistance(commandSuffix, []);

    // Power User renders every token suggestion; portrait renders the same
    // projection. Both must agree before either is compared to the registry.
    const powerUserTokens = suggestionTokens(suggestions);
    const portraitTokens = tokenSuggestions(suggestions).map(
      (suggestion) => suggestion.commandPath[suggestion.commandPath.length - 1],
    );

    if (powerUserTokens.join(',') !== portraitTokens.join(',')) {
      failures.push(
        `suggestion parity: "${commandSuffix}" resolved [${portraitTokens.join(
          ', ',
        )}] in portrait and [${powerUserTokens.join(', ')}] in Power User mode`,
      );
    }

    const { path } = parseSvyrInput(commandSuffix);
    const registered = childNodes(path).map((node) => node.token);

    if (powerUserTokens.join(',') !== registered.join(',')) {
      failures.push(
        `suggestions for "${commandSuffix}": registry offers [${registered.join(
          ', ',
        )}], renderers received [${powerUserTokens.join(', ')}]`,
      );
    }
  }

  return failures;
}
