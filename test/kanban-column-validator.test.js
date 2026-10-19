import test from 'node:test';
import assert from 'node:assert/strict';

import { isValidKanbanColumn } from '../src/kanban-column-validator.js';

test('returns true for each valid kanban column', () => {
  assert.equal(isValidKanbanColumn('To Do'), true);
  assert.equal(isValidKanbanColumn('In Progress'), true);
  assert.equal(isValidKanbanColumn('Done'), true);
});

test('returns true for valid columns regardless of call order or repetition', () => {
  const calls = ['Done', 'To Do', 'Done', 'In Progress'];
  assert.deepEqual(calls.map(isValidKanbanColumn), [true, true, true, true]);
});

test('returns false for other strings that are not column names', () => {
  const invalidStrings = [
    'Todo',
    'To-Do',
    'ToDo',
    'to do',
    'in progress',
    'done',
    'DONE',
    'In progress',
    'To do',
    'Review',
    'Blocked',
    'Backlog',
    'In Review',
    'To Do ',
  ];

  for (const value of invalidStrings) {
    assert.equal(isValidKanbanColumn(value), false, `expected ${JSON.stringify(value)} to be invalid`);
  }
});

test('returns false for case variations of valid columns', () => {
  const caseVariations = [
    'to do',
    'TO DO',
    'tO dO',
    'in progress',
    'IN PROGRESS',
    'iN pRoGrEsS',
    'done',
    'DONE',
    'dOnE',
  ];

  for (const value of caseVariations) {
    assert.equal(isValidKanbanColumn(value), false, `expected ${JSON.stringify(value)} to be invalid`);
  }
});

test('returns false for whitespace variations', () => {
  const whitespaceVariations = [
    ' To Do',
    'To Do ',
    '  To Do  ',
    'To  Do',
    'To\tDo',
    'To\nDo',
    'In  Progress',
    ' In Progress ',
    'In Progress\t',
    'Done ',
    ' Done',
    '\tDone',
    'Done\n',
    ' ',
    '   ',
    '\t',
    '\n',
    '\r\n',
  ];

  for (const value of whitespaceVariations) {
    assert.equal(isValidKanbanColumn(value), false, `expected ${JSON.stringify(value)} to be invalid`);
  }
});

test('returns false for empty strings', () => {
  assert.equal(isValidKanbanColumn(''), false);
  assert.equal(isValidKanbanColumn(''.repeat(10)), false);
});

test('returns false for null and undefined', () => {
  assert.equal(isValidKanbanColumn(null), false);
  assert.equal(isValidKanbanColumn(undefined), false);
  assert.equal(isValidKanbanColumn(), false);
});

test('returns false for numbers and other primitives', () => {
  const primitives = [0, 1, -1, 3.14, NaN, Infinity, -Infinity, true, false, 0n, 1n, Symbol('To Do')];

  for (const value of primitives) {
    assert.equal(isValidKanbanColumn(value), false, `expected ${String(value)} to be invalid`);
  }
});

test('returns false for objects, arrays, and functions', () => {
  const values = [
    {},
    { column: 'To Do' },
    { toString: () => 'Done' },
    [],
    ['To Do'],
    ['In Progress'],
    [{}, []],
    () => 'Done',
    function named() {
      return 'To Do';
    },
  ];

  for (const value of values) {
    assert.equal(isValidKanbanColumn(value), false, 'expected non-string value to be invalid');
  }
});

test('returns a boolean for every input type', () => {
  const values = [null, undefined, 42, {}, [], 'Done', 'done', ''];

  for (const value of values) {
    assert.equal(typeof isValidKanbanColumn(value), 'boolean');
  }
});
