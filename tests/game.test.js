const test = require('node:test');
const assert = require('node:assert/strict');
const { createGame } = require('../src/game.js');

function lcg(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}

function make(hooks = {}) {
  return createGame({
    lang: 'en', level: 'easy', speed: 3,
    words: { valid: 'cat act at ta', common: 'cat act' },
    W: 1000, H: 800, groundY: 700, R: 30, rng: lcg(42), hooks,
  });
}

function makeSuggest(hooks) {
  return createGame({
    lang: 'en', level: 'easy', speed: 3,
    words: { valid: 'the cat act at ta', common: 'the cat act' },
    W: 1000, H: 800, groundY: 700, R: 30, rng: lcg(42), hooks,
  });
}

function planLetters(g, letters) {
  grow(g, letters.length);
  letters.split('').forEach((l, i) => { g.drones[i].letter = l; g.mark(g.drones[i].id); });
}

test('invalid launch reports a did-you-mean suggestion', () => {
  const seen = [];
  const g = makeSuggest({ onVerdict: (...a) => seen.push(a) });
  planLetters(g, 'teh');
  assert.equal(g.launch(), 'invalid');
  assert.deepEqual(seen[0][2], { word: 'THE', marks: ['same', 'wrong', 'wrong'], missing: [] });
  assert.equal(g.lives, 4);
});

test('did-you-mean never suggests a blocklisted word (spoken to a child)', () => {
  const seen = [];
  const g = createGame({
    lang: 'en', level: 'easy', speed: 3,
    words: { valid: 'fuck luck', common: 'luck' },
    W: 1000, H: 800, groundY: 700, R: 30, rng: lcg(42), hooks: { onVerdict: (...a) => seen.push(a) },
  });
  planLetters(g, 'uck');
  assert.equal(g.launch(), 'invalid');
  assert.equal(seen[0][2].word, 'LUCK');
});

test('invalid launch with no close word has null suggestion', () => {
  const seen = [];
  const g = makeSuggest({ onVerdict: (...a) => seen.push(a) });
  planLetters(g, 'qz');
  assert.equal(g.launch(), 'invalid');
  assert.equal(seen[0][2], null);
});

test('valid launch has null suggestion', () => {
  const seen = [];
  const g = makeSuggest({ onVerdict: (...a) => seen.push(a) });
  planLetters(g, 'cat');
  assert.equal(g.launch(), 'valid');
  assert.equal(seen[0][2], null);
});

// Run until at least n drones are on screen.
function grow(g, n) {
  for (let i = 0; i < 2000 && g.drones.length < n; i++) g.update(0.05);
  assert.ok(g.drones.length >= n);
}

test('spawns up to target count', () => {
  const g = make();
  for (let i = 0; i < 400; i++) g.update(0.05);
  assert.ok(g.drones.length > 0 && g.drones.length <= 6);
});

test('first update spawns immediately', () => {
  const spawned = [];
  const g = make({ onSpawn: (d) => spawned.push(d) });
  g.update(0.01);
  assert.equal(g.drones.length, 1);
  assert.equal(spawned[0], g.drones[0]);
});

test('mark and double mark', () => {
  const g = make();
  g.update(0.05);
  const id = g.drones[0].id;
  assert.equal(g.mark(id), true);
  assert.equal(g.mark(id), false);
  assert.equal(g.plan.length, 1);
});

test('landing removes marked letter and closes gap', () => {
  const lands = [];
  const g = make({ onLand: (d, i) => lands.push(i) });
  grow(g, 3);
  const [a, b, c] = g.drones;
  [a, b, c].forEach((d) => g.mark(d.id));
  b.y = g.groundY;
  g.update(0.01);
  assert.equal(g.plan.length, 2);
  assert.deepEqual(g.plan.ids, [a.id, c.id]);
  assert.deepEqual(lands, [1]);
  assert.ok(!g.drones.includes(b));
});

test('valid launch', () => {
  const hits = [];
  const done = [];
  const g = make({ onHit: (d, i) => hits.push([d.id, i]), onWordDone: (w, p) => done.push([w, p]) });
  grow(g, 4);
  // Nearest-to-cannon first so staggered missiles hit in plan order.
  const dist = (d) => Math.hypot(d.x - g.cannon.x, d.y - g.cannon.y);
  const picks = g.drones.slice().sort((p, q) => dist(p) - dist(q)).slice(0, 3);
  const other = g.drones.find((d) => !picks.includes(d));
  picks.forEach((d, i) => { d.letter = 'cat'[i]; g.mark(d.id); });
  assert.deepEqual(g.word(), ['C', 'A', 'T']);
  assert.equal(g.launch(), 'valid');
  assert.equal(g.phase, 'launching');
  assert.equal(g.mark(other.id), false);
  assert.equal(g.launch(), 'busy');
  for (let i = 0; i < 600 && g.phase !== 'playing'; i++) g.update(0.016);
  assert.equal(g.phase, 'playing');
  assert.equal(g.score, 30);
  assert.ok(g.used.has('cat'));
  assert.equal(g.plan.length, 0);
  assert.deepEqual(hits, picks.map((d, i) => [d.id, i]));
  assert.deepEqual(done, [['CAT', 30]]);
  assert.equal(g.launch(), 'tooShort');
});

test('used word clears plan without cost', () => {
  const g = make();
  grow(g, 3);
  g.used.add('cat');
  g.drones.slice(0, 3).forEach((d, i) => { d.letter = 'cat'[i]; g.mark(d.id); });
  assert.equal(g.launch(), 'used');
  assert.equal(g.plan.length, 0);
  assert.equal(g.lives, 5);
  assert.equal(g.phase, 'playing');
});

test('invalid launch costs a life; game over at 0', () => {
  const lives = [];
  const over = [];
  const g = make({ onLives: (n) => lives.push(n), onGameOver: (s) => over.push(s) });
  grow(g, 2);
  const [a, b] = g.drones;
  a.letter = 'c'; b.letter = 'c';
  g.mark(a.id); g.mark(b.id);
  assert.equal(g.launch(), 'invalid');
  assert.equal(g.lives, 4);
  assert.equal(g.plan.length, 0);
  for (let i = 0; i < 10 && g.phase !== 'over'; i++) {
    g.mark(a.id); g.mark(b.id);
    assert.equal(g.launch(), 'invalid');
  }
  assert.equal(g.phase, 'over');
  assert.deepEqual(lives, [4, 3, 2, 1, 0]);
  assert.deepEqual(over, [0]);
  assert.equal(g.mark(a.id), false);
  const t = g.time;
  g.update(0.05);
  assert.equal(g.time, t);
});

test('tooShort', () => {
  const g = make();
  g.update(0.05);
  g.mark(g.drones[0].id);
  assert.equal(g.launch(), 'tooShort');
  assert.equal(g.lives, 5);
  assert.equal(g.plan.length, 1);
});

test('undo and clear', () => {
  const g = make();
  grow(g, 2);
  g.mark(g.drones[0].id); g.mark(g.drones[1].id);
  g.undo();
  assert.deepEqual(g.plan.ids, [g.drones[0].id]);
  g.clear();
  assert.equal(g.plan.length, 0);
});

test('pause freezes the simulation', () => {
  const g = make();
  g.update(0.05);
  g.pause();
  const y = g.drones[0].y;
  g.update(0.05);
  assert.equal(g.drones[0].y, y);
  assert.equal(g.mark(g.drones[0].id), false);
  g.resume();
  assert.equal(g.phase, 'playing');
  g.update(0.05);
  assert.ok(g.drones[0].y > y);
});

test('speed change eases', () => {
  const g = make();
  g.update(0.05);
  const d = g.drones[0];
  const old = d.vy;
  g.setSpeed(10);
  const target = d.targetVy;
  assert.ok(target > old);
  g.update(0.25);
  assert.ok(d.vy > old && d.vy < target);
  for (let i = 0; i < 40; i++) g.update(0.05);
  assert.ok(Math.abs(d.vy - target) / target < 0.01);
});

test('speed change during launch still completes', () => {
  const g = make();
  grow(g, 3);
  g.drones.slice(0, 3).forEach((d, i) => { d.letter = 'cat'[i]; g.mark(d.id); });
  assert.equal(g.launch(), 'valid');
  g.setSpeed(1);
  for (let i = 0; i < 600 && g.phase !== 'playing'; i++) g.update(0.016);
  assert.equal(g.phase, 'playing');
  assert.equal(g.score, 30);
});

test('marked drone landing during launch still counts', () => {
  const lands = [];
  const g = make({ onLand: (d, i) => lands.push(i) });
  grow(g, 3);
  const ds = g.drones.slice(0, 3);
  ds.forEach((d, i) => { d.letter = 'cat'[i]; g.mark(d.id); });
  g.launch();
  ds[2].y = g.groundY;
  g.update(0.01);
  assert.deepEqual(lands, [-1]);
  assert.equal(g.plan.length, 3);
  for (let i = 0; i < 600 && g.phase !== 'playing'; i++) g.update(0.016);
  assert.equal(g.score, 30);
});

test('resize clamps', () => {
  const g = make();
  grow(g, 3);
  const vy = g.drones[0].vy;
  g.resize(400, 800, 700, 24);
  for (const d of g.drones) assert.ok(d.bx >= 38.4 && d.bx <= 361.6);
  assert.equal(g.cannon.x, 200);
  assert.equal(g.drones[0].vy, vy);
  g.resize(400, 400, 300, 24);
  assert.equal(g.drones[0].vy, vy / 2);
  assert.equal(g.cannon.y, 270);
});

test('rotating to landscape rescales drones and keeps the plan', () => {
  const lands = [];
  const g = make({ onLand: (d, i) => lands.push(i) });
  grow(g, 3);
  const ds = g.drones.slice(0, 3);
  ds.forEach((d, i) => { d.y = 300 + 40 * i; assert.ok(g.mark(d.id)); });
  g.resize(800, 390, 330, 24);
  for (const d of ds) assert.ok(d.y < g.groundY - 2 * g.R, `drone y ${d.y} below landing line`);
  assert.ok(Math.abs(ds[0].y - 300 * 330 / 700) < 1e-9);
  g.update(0.016);
  assert.deepEqual(lands, []);
  assert.equal(g.plan.length, 3);
});

test('resize rescales in-flight missiles', () => {
  const g = make();
  grow(g, 2);
  const ds = g.drones.slice(0, 2);
  ds.forEach((d, i) => { d.y = 300 + 40 * i; });
  ds.forEach((d) => g.mark(d.id));
  // Force a valid word from whatever letters landed on the drones.
  g.plan.letters.splice(0, 2, 'a', 't');
  assert.equal(g.launch(), 'valid');
  const m = g.missiles[0];
  const before = { x: m.x, y: m.y, tx: m.tx, ty: m.ty };
  g.resize(800, 390, 330, 24);
  assert.ok(Math.abs(m.x - before.x * 0.8) < 1e-9);
  assert.ok(Math.abs(m.tx - before.tx * 0.8) < 1e-9);
  assert.ok(Math.abs(m.y - before.y * 330 / 700) < 1e-9);
  assert.ok(Math.abs(m.ty - before.ty * 330 / 700) < 1e-9);
});

test('droneAt', () => {
  const g = make();
  grow(g, 3);
  for (const d of g.drones) assert.equal(g.droneAt(d.x, d.y + 0.6 * g.R), d);
  assert.equal(g.droneAt(-1000, -1000), null);
});

test('onFire fires once per missile, even on zero-dt frames', () => {
  const fired = [];
  const g = make({ onFire: (m) => fired.push(m) });
  grow(g, 3);
  g.drones.slice(0, 3).forEach((d, i) => { d.letter = 'cat'[i]; g.mark(d.id); });
  g.launch();
  g.update(0); g.update(0); g.update(0);
  g.update(0.3);
  assert.equal(new Set(fired).size, fired.length);
  assert.equal(fired.length, g.missiles.filter((m) => m.delay <= 0).length);
  assert.equal(fired.length, 1); // dt clamps to 0.05, so only the undelayed missile is out
  for (let i = 0; i < 10; i++) { g.update(0.05); g.update(0); }
  assert.equal(fired.length, 3);
  assert.equal(new Set(fired).size, 3);
});

// ---- Challenge mode ----

function makeChallenge(hooks = {}) {
  return createGame({
    mode: 'challenge', lang: 'en', level: 'easy', speed: 3,
    words: { valid: 'cat act', common: 'cat' },
    W: 1000, H: 800, groundY: 700, R: 30, rng: lcg(7), hooks,
  });
}

// Run long enough for coverage, then mark one unmarked drone per letter.
function markWord(g, letters) {
  for (const l of letters) {
    const d = g.drones.find((x) => x.letter === l && !x.marked);
    assert.ok(d, `no drone for ${l}`);
    assert.ok(g.mark(d.id));
  }
}

function warm(g) {
  for (let i = 0; i < 300; i++) g.update(0.05);
}

function runToPlaying(g) {
  for (let i = 0; i < 600 && g.phase !== 'playing'; i++) g.update(0.016);
  assert.equal(g.phase, 'playing');
}

test('challenge: first update announces the word', () => {
  const seen = [];
  const g = makeChallenge({ onChallenge: (w) => seen.push(w) });
  assert.equal(g.mode, 'challenge');
  assert.deepEqual(g.challenge, { word: 'cat', peeked: false });
  assert.deepEqual(seen, []);
  g.update(0.05);
  assert.deepEqual(seen, ['CAT']);
  g.update(0.05);
  assert.deepEqual(seen, ['CAT']);
});

test('free mode has no challenge and no peek/skip', () => {
  const g = make();
  assert.equal(g.mode, 'free');
  assert.equal(g.challenge, null);
  g.update(0.05);
  assert.equal(g.peek(), false);
  assert.equal(g.skip(), false);
  assert.equal(g.lives, 5);
});

test('challenge: every needed letter gets a drone', () => {
  const g = makeChallenge();
  warm(g);
  for (const l of 'cat') assert.ok(g.drones.some((d) => d.letter === l && !d.marked), `no ${l}`);
  assert.ok(g.forcedSpawns > 0);
});

test('challenge: short, then match scores and starts a new challenge', () => {
  const seen = [];
  const verdicts = [];
  const done = [];
  const g = makeChallenge({
    onChallenge: (w) => seen.push(w),
    onVerdict: (...a) => verdicts.push(a),
    onWordDone: (w, p) => done.push([w, p]),
  });
  warm(g);
  markWord(g, 'ca');
  assert.equal(g.launch(), 'short');
  assert.equal(g.plan.length, 2);
  assert.equal(g.lives, 5);
  markWord(g, 't');
  assert.equal(g.launch(), 'match');
  assert.deepEqual(verdicts[1], ['match', 'CAT', null]);
  assert.equal(g.phase, 'launching');
  runToPlaying(g);
  assert.equal(g.score, 30);
  assert.deepEqual(done, [['CAT', 30]]);
  assert.deepEqual(seen, ['CAT', 'CAT']);
  assert.equal(g.plan.length, 0);
});

test('challenge: peek halves the score', () => {
  const reveals = [];
  const g = makeChallenge({ onReveal: (...a) => reveals.push(a) });
  warm(g);
  assert.equal(g.peek(), true);
  assert.equal(g.challenge.peeked, true);
  assert.deepEqual(reveals, [['CAT', 2]]);
  markWord(g, 'cat');
  assert.equal(g.launch(), 'match');
  runToPlaying(g);
  assert.equal(g.score, 15);
  assert.equal(g.challenge.peeked, false);
});

test('challenge: miss costs a life and keeps the word', () => {
  const seen = [];
  const g = makeChallenge({ onChallenge: (w) => seen.push(w) });
  warm(g);
  markWord(g, 'tac');
  assert.equal(g.launch(), 'miss');
  assert.equal(g.lives, 4);
  assert.equal(g.challenge.word, 'cat');
  assert.equal(g.plan.length, 0);
  assert.ok(g.drones.every((d) => !d.marked));
  assert.deepEqual(seen, ['CAT', 'CAT']);
  assert.equal(g.phase, 'playing');
});

test('challenge: skip costs a life, reveals and starts a new challenge', () => {
  const seen = [];
  const reveals = [];
  const lives = [];
  const g = makeChallenge({
    onChallenge: (w) => seen.push(w), onReveal: (...a) => reveals.push(a), onLives: (n) => lives.push(n),
  });
  warm(g);
  markWord(g, 'c');
  assert.equal(g.skip(), true);
  assert.equal(g.lives, 4);
  assert.deepEqual(lives, [4]);
  assert.deepEqual(reveals, [['CAT', 2]]);
  assert.deepEqual(seen, ['CAT', 'CAT']);
  assert.equal(g.plan.length, 0);
});

test('challenge: skip at last life ends the game without a new challenge', () => {
  const seen = [];
  const over = [];
  const g = makeChallenge({ onChallenge: (w) => seen.push(w), onGameOver: (s) => over.push(s) });
  g.update(0.05);
  for (let i = 0; i < 5; i++) assert.equal(g.skip(), true);
  assert.equal(g.phase, 'over');
  assert.deepEqual(over, [0]);
  assert.equal(seen.length, 5);
  assert.equal(g.skip(), false);
});

test('challenge mode never builds or queries the suggestion index', (t) => {
  const Suggest = require('../src/suggest.js');
  const boom = () => { throw new Error('Suggest used in challenge mode'); };
  t.mock.method(Suggest, 'buildIndex', boom);
  t.mock.method(Suggest, 'suggest', boom);
  const g = makeChallenge();
  warm(g);
  markWord(g, 'tac');
  assert.equal(g.launch(), 'miss');
});

test('challenge: peek/skip do nothing while launching or paused', () => {
  const g = makeChallenge();
  warm(g);
  markWord(g, 'cat');
  assert.equal(g.launch(), 'match');
  assert.equal(g.peek(), false);
  assert.equal(g.skip(), false);
  assert.equal(g.challenge.peeked, false);
  assert.equal(g.lives, 5);
  runToPlaying(g);
  g.pause();
  assert.equal(g.peek(), false);
  assert.equal(g.skip(), false);
  assert.equal(g.launch(), 'busy');
  assert.equal(g.challenge.peeked, false);
  assert.equal(g.lives, 5);
});

// [dx, dy] of the drone's aim point from the cannon. (150, 50) is inside the
// fixed-rate turning circle and orbited until the 3 s snap before the fix.
for (const [dx, dy] of [[60, 100], [150, 50]]) test(`missile hits a drone close to the cannon quickly (${dx}, ${dy})`, () => {
  let hitAt = null;
  const g = make({ onHit: (d, i) => { if (i === 0 && hitAt === null) hitAt = g.time; } });
  grow(g, 2);
  const [near, far] = g.drones;
  // Aim point beside and above the cannon; drone kept above the landing line.
  Object.assign(near, { bx: g.cannon.x + dx, amp: 0, y: g.cannon.y - dy - 0.5 * g.R, letter: 'a' });
  near.x = near.bx;
  assert.ok(near.y < g.groundY - 2 * g.R);
  far.letter = 't';
  g.mark(near.id); g.mark(far.id);
  assert.equal(g.launch(), 'valid');
  const t0 = g.time;
  for (let i = 0; i < 200 && hitAt === null; i++) g.update(0.016);
  assert.ok(hitAt !== null && hitAt - t0 < 1.0, `hit after ${hitAt - t0}s`);
});
