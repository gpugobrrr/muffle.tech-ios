/// <reference types="node" />

import { parseCommand } from '@/commands/command-parser';
import {
  getMatchingSuggestions,
  getNextSuggestionIndex,
} from '@/commands/command-suggestions';
import {
  createInitialTerminalState,
  terminalReducer,
} from '@/domain/terminal-reducer';
import { resolveExecutableCommand } from '@/domain/terminal-execution';
import assert from 'node:assert/strict';
import test from 'node:test';

const context = {
  activeElement: 'external-walls',
  activeCommand: null,
} as const;

test('cond normalises to condition', () => {
  assert.deepEqual(parseCommand('cond'), {
    type: 'OPEN_COMMAND',
    command: 'condition',
  });
});

test('def normalises to defect', () => {
  assert.deepEqual(parseCommand('def'), {
    type: 'OPEN_COMMAND',
    command: 'defect',
  });
});

test('autocomplete is case-insensitive', () => {
  assert.deepEqual(
    getMatchingSuggestions('CO', context).map(({ name }) => name),
    ['condition'],
  );
});

test('typing co suggests condition', () => {
  assert.equal(getMatchingSuggestions('co', context)[0]?.name, 'condition');
});

test('typing n suggests next then note', () => {
  assert.deepEqual(
    getMatchingSuggestions('n', context).map(({ name }) => name),
    ['next', 'note'],
  );
});

test('single Tab completes the highlighted suggestion', () => {
  const suggestions = getMatchingSuggestions('co', context);
  assert.equal(suggestions[0]?.name, 'condition');
});

test('repeated Tab cycles through matching suggestions', () => {
  const suggestions = getMatchingSuggestions('n', context);
  const firstIndex = 0;
  const secondIndex = getNextSuggestionIndex(suggestions.length, firstIndex);
  assert.equal(suggestions[firstIndex]?.name, 'next');
  assert.equal(suggestions[secondIndex]?.name, 'note');
});

test('double Tab completes and executes the highlighted command', () => {
  const suggestion = getMatchingSuggestions('def', context)[0];
  assert.deepEqual(parseCommand(suggestion.name), {
    type: 'OPEN_COMMAND',
    command: 'defect',
  });
});

test('keyboard Enter resolves the current command', () => {
  const state = terminalReducer(createInitialTerminalState(), {
    type: 'SET_INPUT',
    value: 'condition',
  });
  assert.deepEqual(resolveExecutableCommand(state), {
    type: 'OPEN_COMMAND',
    command: 'condition',
  });
});

test('visible Enter resolves the current command', () => {
  const state = terminalReducer(createInitialTerminalState(), {
    type: 'SET_INPUT',
    value: 'next',
  });
  assert.deepEqual(resolveExecutableCommand(state), {
    type: 'NAVIGATE',
    direction: 'next',
  });
});

test('keyboard and visible Enter use the same execution resolver', () => {
  const state = terminalReducer(createInitialTerminalState(), {
    type: 'SET_INPUT',
    value: 'co',
  });
  const keyboardResult = resolveExecutableCommand(state);
  const visibleButtonResult = resolveExecutableCommand(state);
  assert.deepEqual(keyboardResult, visibleButtonResult);
});

test('visible Enter completes and executes a unique suggestion', () => {
  const state = terminalReducer(createInitialTerminalState(), {
    type: 'SET_INPUT',
    value: 'co',
  });
  assert.deepEqual(resolveExecutableCommand(state), {
    type: 'OPEN_COMMAND',
    command: 'condition',
  });
});

test('visible Enter is disabled when no command can execute', () => {
  assert.equal(resolveExecutableCommand(createInitialTerminalState()), null);
});

test('unknown commands produce an error and remain in input', () => {
  const inputState = terminalReducer(createInitialTerminalState(), {
    type: 'SET_INPUT',
    value: 'xyz',
  });
  const errorState = terminalReducer(inputState, {
    type: 'SET_ERROR',
    message: 'Unknown command: “xyz”',
  });
  assert.equal(resolveExecutableCommand(inputState), null);
  assert.equal(errorState.inputValue, 'xyz');
  assert.equal(errorState.error, 'Unknown command: “xyz”');
});

test('next increments progress', () => {
  const state = terminalReducer(createInitialTerminalState(), {
    type: 'EXECUTE_COMMAND',
    command: { type: 'NAVIGATE', direction: 'next' },
  });
  assert.equal(state.progressIndex, 2);
});

test('back decrements progress', () => {
  const nextState = terminalReducer(createInitialTerminalState(), {
    type: 'NAVIGATE',
    direction: 'next',
  });
  const backState = terminalReducer(nextState, {
    type: 'NAVIGATE',
    direction: 'back',
  });
  assert.equal(backState.progressIndex, 1);
});

test('back cannot move below the first element', () => {
  const state = terminalReducer(createInitialTerminalState(), {
    type: 'NAVIGATE',
    direction: 'back',
  });
  assert.equal(state.progressIndex, 1);
});

test('undo restores the previous state', () => {
  const activeState = terminalReducer(createInitialTerminalState(), {
    type: 'SET_ACTIVE_COMMAND',
    command: 'condition',
  });
  const nextState = terminalReducer(activeState, {
    type: 'NAVIGATE',
    direction: 'next',
  });
  const undoneState = terminalReducer(nextState, { type: 'UNDO' });
  assert.equal(undoneState.progressIndex, 1);
  assert.equal(undoneState.activeCommand, 'condition');
});

test('successful commands enter history', () => {
  const state = terminalReducer(createInitialTerminalState(), {
    type: 'SET_ACTIVE_COMMAND',
    command: 'condition',
  });
  assert.deepEqual(state.commandHistory, ['condition']);
  assert.equal(state.lastExecutedCommand, 'condition');
});

test('consecutive duplicate commands are not repeated in history', () => {
  const firstState = terminalReducer(createInitialTerminalState(), {
    type: 'SET_ACTIVE_COMMAND',
    command: 'condition',
  });
  const secondState = terminalReducer(firstState, {
    type: 'SET_ACTIVE_COMMAND',
    command: 'condition',
  });
  assert.deepEqual(secondState.commandHistory, ['condition']);
});
