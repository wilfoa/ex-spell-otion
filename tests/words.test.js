const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
require('../words/en.js'); require('../words/he.js');
const { en, he } = globalThis.WORDS;
test('sizes', () => {
  for (const w of [en, he]) {
    const valid = w.valid.split(' '), common = w.common.split(' ');
    assert.ok(valid.length >= 25000 && valid.length <= 30000);
    assert.ok(common.length >= 2500 && common.length <= 3000);
    const set = new Set(valid);
    assert.ok(common.every(c => set.has(c)));   // common subset of valid
  }
});
test('english letters only, two-letter allowlist', () => {
  assert.ok(en.valid.split(' ').every(w => /^[a-z]{2,}$/.test(w)));
  for (const junk of ['ll', 've', 're']) assert.ok(!en.valid.split(' ').includes(junk));
  assert.ok(en.valid.split(' ').includes('go') && en.valid.split(' ').includes('cat'));
});
test('hebrew letters only', () => {
  assert.ok(he.valid.split(' ').every(w => /^[א-ת]{2,}$/.test(w)));
  assert.ok(he.valid.split(' ').includes('כלב'));
});
test('blocklist removed from common', () => {
  const block = fs.readFileSync('tools/blocklist.txt', 'utf8').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'));
  const ce = en.common.split(' '), ch = he.common.split(' ');
  for (const b of block) assert.ok(!ce.includes(b) && !ch.includes(b));
});
