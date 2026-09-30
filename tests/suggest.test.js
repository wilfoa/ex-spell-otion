const test = require('node:test');
const assert = require('node:assert/strict');
const Lexicon = require('../src/lexicon.js');
const { distance, buildIndex, suggest, diff } = require('../src/suggest.js');

test('distance: OSA basics', () => {
  assert.equal(distance('teh', 'the'), 1);
  assert.equal(distance('cat', 'cut'), 1);
  assert.equal(distance('kitten', 'sitting'), 3);
  assert.equal(distance('', 'ab'), 2);
});

test('distance: Hebrew final letters normalize to distance 0', () => {
  assert.equal(distance(Lexicon.normalize('שלום', 'he'), Lexicon.normalize('שלומ', 'he')), 0);
});

test('buildIndex: normalized words grouped by length with rank', () => {
  const index = buildIndex('The cat', 'en');
  assert.deepEqual(index.byLen.get(3), [{ w: 'the', rank: 0 }, { w: 'cat', rank: 1 }]);
});

test('suggest: closest word, null when none, respects minLength', () => {
  const index = buildIndex('the cat cut act tea', 'en');
  assert.equal(suggest(['t', 'e', 'h'], { lang: 'en', minLength: 2, index }), 'the');
  assert.equal(suggest(['x', 'y', 'z', 'q'], { lang: 'en', minLength: 2, index }), null);
  const r = suggest(['c', 'a'], { lang: 'en', minLength: 3, index });
  assert.ok(r === null || r.length >= 3);
});

test('suggest: tie goes to the earlier word in the valid list', () => {
  const index = buildIndex('cat cut', 'en');
  assert.equal(suggest(['c', 'o', 't'], { lang: 'en', minLength: 2, index }), 'cat');
});

test('suggest: maxDist is 2 for length > 4, 1 otherwise', () => {
  const index = buildIndex('cat', 'en');
  assert.equal(suggest(['c', 'a', 't', 'x', 'y'], { lang: 'en', minLength: 2, index }), 'cat');
  assert.equal(suggest(['c', 'x', 'y'], { lang: 'en', minLength: 2, index }), null);
});

test('diff: transposition marks both letters wrong', () => {
  assert.deepEqual(diff('teh', 'the'), { marks: ['same', 'wrong', 'wrong'], missing: [] });
});

test('diff: missing letter reported before attempt index', () => {
  assert.deepEqual(diff('ct', 'cat'), { marks: ['same', 'same'], missing: [1] });
});

test('diff: substitution and extra letter are wrong', () => {
  assert.deepEqual(diff('cut', 'cat').marks, ['same', 'wrong', 'same']);
  assert.deepEqual(diff('caat', 'cat').marks.filter((m) => m === 'wrong').length, 1);
});
