const test = require('node:test');
const assert = require('node:assert/strict');
const Lexicon = require('../src/lexicon.js');
const { CONFUSABLE, needed, missing, decoy, judge } = require('../src/challenge.js');

const dim = { groundY: 700, R: 30 };
const drone = (letter, y, vy, marked = false) => ({ letter, y, vy, marked });

test('CONFUSABLE is symmetric and matches the spec pairs', () => {
  assert.deepEqual(CONFUSABLE.en.b, ['d']);
  assert.deepEqual(CONFUSABLE.he['כ'], ['ח', 'ב']);
  assert.deepEqual(CONFUSABLE.he['ח'], ['כ', 'ה']);
  for (const lang of ['en', 'he'])
    for (const [a, list] of Object.entries(CONFUSABLE[lang]))
      for (const b of list) assert.ok(CONFUSABLE[lang][b].includes(a), `${a}<->${b}`);
});

test('needed: multiset difference, word order preserved', () => {
  assert.deepEqual(needed('apple', ['p']), ['a', 'p', 'l', 'e']);
  assert.deepEqual(needed('apple', ['x']), ['a', 'p', 'p', 'l', 'e']);
});

test('missing: reachable drones cover, each at most one letter', () => {
  const drones = [drone('a', 100, 50), drone('p', 100, 50), drone('p', 600, 50)];
  assert.deepEqual(missing(['a', 'p', 'p'], drones, dim), ['p']);
});

test('missing: marked drone never covers', () => {
  assert.deepEqual(missing(['a'], [drone('a', 100, 50, true)], dim), ['a']);
});

// |need| = 8, so uncapped T would be 12 s; the cap makes it 0.4 * 700 / 200 = 1.4 s.
test('missing: T is capped at 0.4 * groundY / vy', () => {
  const need = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  assert.deepEqual(missing(need, [drone('a', -60, 200)], dim), need.slice(1));
});

// Fall time left = (640 - y) / 200; reachable while >= 1.4 s, i.e. y <= 360.
test('missing: cap boundary at 0.4 * groundY / vy', () => {
  const need = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  assert.deepEqual(missing(need, [drone('a', 359, 200)], dim), need.slice(1));
  assert.deepEqual(missing(need, [drone('a', 361, 200)], dim), need);
  // y = 300 leaves 1.7 s: reachable under the 0.4 cap (it would not be under 0.6, T = 2.1 s).
  assert.deepEqual(missing(need, [drone('a', 300, 200)], dim), need.slice(1));
});

test('decoy: only word letters and their confusables', () => {
  let i = 0;
  const rng = () => ((i++ * 0.37) % 1);
  const en = new Set();
  const he = new Set();
  for (let n = 0; n < 200; n++) en.add(decoy('bat', 'en', rng));
  for (let n = 0; n < 200; n++) he.add(decoy('כלב', 'he', rng));
  assert.ok([...en].every((l) => 'batd'.includes(l)));
  assert.ok([...he].every((l) => 'כלבח'.includes(l)));
  assert.ok(en.has('d') && en.has('b'), 'en: word letter and confusable both appear');
  assert.ok(he.has('ח') && he.has('כ'), 'he: word letter and confusable both appear');
});

test('judge: short / match / miss', () => {
  assert.equal(judge(['c', 'a'], 'cat', 'en'), 'short');
  assert.equal(judge(['c', 'a', 't'], 'cat', 'en'), 'match');
  assert.equal(judge(['c', 'u', 't'], 'cat', 'en'), 'miss');
  assert.equal(judge(['ש', 'ל', 'ו', 'ם'], Lexicon.normalize('שלום', 'he'), 'he'), 'match');
});
