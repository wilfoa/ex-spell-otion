const test = require('node:test');
const assert = require('node:assert/strict');
const { Plan, judge, score } = require('../src/rules.js');

test('Plan marks, undoes, removes, clears', () => {
  const p = new Plan();
  assert.equal(p.mark(1, 'c'), true);
  p.mark(2, 'a');
  p.mark(3, 't');
  assert.deepEqual(p.letters, ['c', 'a', 't']);
  assert.equal(p.mark(2, 'x'), false);
  assert.equal(p.length, 3);
  assert.equal(p.indexOf(3), 2);
  p.undo();
  assert.deepEqual(p.letters, ['c', 'a']);
  assert.equal(p.remove(1), 0);
  assert.deepEqual(p.letters, ['a']);
  assert.deepEqual(p.ids, [2]);
  assert.equal(p.remove(99), -1);
  p.clear();
  assert.equal(p.length, 0);
});

test('judge', () => {
  const validSet = new Set(['cat', 'שלומ']);
  const o = { lang: 'en', minLength: 2, validSet, used: new Set() };
  assert.equal(judge(['c'], o), 'tooShort');
  assert.equal(judge(['c', 'a', 't'], o), 'valid');
  assert.equal(judge(['c', 'a', 't'], { ...o, used: new Set(['cat']) }), 'used');
  assert.equal(judge(['t', 'a', 'c'], o), 'invalid');
  assert.equal(judge(['ש', 'ל', 'ו', 'מ'], { ...o, lang: 'he' }), 'valid');
  assert.equal(judge(['c', 'a', 't'], { ...o, minLength: 4 }), 'tooShort');
});

test('score', () => {
  assert.equal(score(3, 'easy'), 30);
  assert.equal(score(4, 'medium'), 80);
  assert.equal(score(6, 'hard'), 180);
});
