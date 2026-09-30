const test = require('node:test');
const assert = require('node:assert/strict');
const Lexicon = require('../src/lexicon.js');
const { fallSpeed, targetCount, spawnInterval, LetterQueue, pickX } = require('../src/spawner.js');

const cycle = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };

test('refill: seed letters plus 1-3 weighted fillers', () => {
  const q = new LetterQueue({ deck: { next: () => 'cat' }, weights: [['z', 1]] });
  for (let i = 0; i < 30; i++) {
    const batch = q.refill();
    assert.ok(batch.length >= 4 && batch.length <= 6);
    const rest = [...batch];
    for (const l of 'cat') rest.splice(rest.indexOf(l), 1);
    assert.ok(rest.every((l) => l === 'z'));
  }
});

test('next: earlier seed words come out before later ones', () => {
  const words = ['aaa', 'bbb'];
  const deck = { next: () => (words.length > 1 ? words.shift() : words[0]) };
  const q = new LetterQueue({ deck, weights: [['z', 1]] });
  const out = Array.from({ length: 12 }, () => q.next());
  assert.equal(out.lastIndexOf('a') < out.indexOf('b'), true);
});

test('spawnInterval * count = fallDistance / fallSpeed', () => {
  for (let s = 1; s <= 10; s++) {
    assert.ok(Math.abs(spawnInterval(s, 800, 600, 8) * 8 - 600 / fallSpeed(s, 800)) < 1e-9);
  }
});

test('targetCount', () => {
  assert.equal(targetCount(8, 360, 24, 4), 7);
  assert.equal(targetCount(6, 1200, 40, 2), 6);
  assert.equal(targetCount(10, 1200, 40, 6), 10);
  assert.equal(targetCount(6, 200, 40, 1), 4);
});

test('targetCount leaves room to spell the minimum word on a 360px phone', () => {
  const { LEVELS } = require('../src/rules.js');
  for (const [name, { minLength, targetDrones }] of Object.entries(LEVELS)) {
    const n = targetCount(targetDrones, 360, 24, minLength);
    assert.ok(n >= minLength + 2, `${name}: ${n} drones for min ${minLength}`);
  }
});

test('pickX avoids crowded x', () => {
  const x = pickX(1000, 30, [{ x: 500, y: 0 }], cycle([0.49, 0.9]));
  assert.ok(Math.abs(x - 500) >= 78);
});

test('Hebrew letters are never final forms', () => {
  const word = Lexicon.normalize('שלום', 'he');
  const q = new LetterQueue({ deck: { next: () => word }, weights: Lexicon.letterWeights(['שלום'], 'he') });
  for (let i = 0; i < 50; i++) assert.ok(!/[ךםןףץ]/.test(q.next()));
});
