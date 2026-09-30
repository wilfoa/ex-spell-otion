const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('../src/lexicon.js');

test('normalize', () => {
  assert.equal(L.normalize('כלב', 'he'), 'כלב');
  for (const [f, r] of ['ךכ', 'םמ', 'ןנ', 'ףפ', 'ץצ']) assert.equal(L.normalize('א' + f, 'he'), 'א' + r);
  assert.equal(L.normalize('CaT', 'en'), 'cat');
});

test('display', () => {
  assert.equal(L.display(['ש', 'ל', 'ו', 'מ'], 'he').join(''), 'שלום');
  assert.deepEqual(L.display(['מ'], 'he'), ['מ']);
  assert.equal(L.display(['c', 'a', 't'], 'en').join(''), 'CAT');
});

test('buildValidSet', () => {
  const s = L.buildValidSet('שלום כלב', 'he');
  assert.ok(s.has(L.normalize('שלום', 'he')));
  assert.ok(s.has('שלומ'));
});

test('letterWeights', () => {
  const w = new Map(L.letterWeights(['aab'], 'en'));
  assert.ok(Math.abs(w.get('a') - 2 / 3) < 1e-9);
  assert.ok(Math.abs(w.get('b') - 1 / 3) < 1e-9);
  const he = L.letterWeights(['שלום'], 'he');
  assert.ok(Math.abs(he.reduce((s, [, x]) => s + x, 0) - 1) < 1e-9);
  assert.ok(he.some(([l]) => l === 'מ') && !he.some(([l]) => l === 'ם'));
});

test('weightedPick', () => {
  assert.equal(L.weightedPick([['x', 1]], Math.random), 'x');
});

test('SeedDeck', () => {
  const common = ['ab', 'abc', 'abcd', 'abcde', 'abcdefgh'];
  const d = new L.SeedDeck(common, 'en', 2);
  const got = [d.next(), d.next(), d.next()];
  assert.deepEqual(new Set(got), new Set(['ab', 'abc', 'abcd']));
  assert.ok(got.includes(d.next()));
  const h = new L.SeedDeck(common, 'en', 6);
  for (let i = 0; i < 3; i++) assert.equal(h.next(), 'abcdefgh');
  assert.throws(() => new L.SeedDeck(['ab'], 'en', 6), /no seed words/);
});
