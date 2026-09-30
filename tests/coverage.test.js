// Spec 4.4: in Challenge mode every needed letter always gets a reachable drone.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createGame } = require('../src/game.js');
const Challenge = require('../src/challenge.js');
const Spawner = require('../src/spawner.js');
const Rules = require('../src/rules.js');
require('../words/en.js');

const WORDS = globalThis.WORDS.en;
const DT = 1 / 60;
const SIZES = [
  { W: 360, H: 740, groundY: 600, R: 24 },
  { W: 1440, H: 900, groundY: 800, R: 40 },
  { W: 844, H: 390, groundY: 300, R: 24 },
];

function lcg(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}

const fallLeft = (g, d) => (g.groundY - 2 * g.R - d.y) / d.vy;

// Every 1.5 s: undo a bad plan tail, else mark the next letter (every 4th action a wrong one),
// and launch as soon as the plan spells the word.
function player(g) {
  let actions = 0;
  return () => {
    if (g.phase !== 'playing') return;
    const word = g.challenge.word;
    const isPrefix = () => g.plan.letters.every((l, i) => l === word[i]);
    if (!isPrefix()) {
      while (!isPrefix()) g.undo();
      return;
    }
    actions++;
    const next = word[g.plan.length];
    const wrong = actions % 4 === 0;
    const pool = g.drones.filter((d) => !d.marked && (wrong ? d.letter !== next : d.letter === next));
    if (!pool.length) return;
    const d = pool.reduce((a, b) => (fallLeft(g, b) > fallLeft(g, a) ? b : a));
    g.mark(d.id);
    if (g.plan.length === word.length && isPrefix()) g.launch();
  };
}

for (const size of SIZES) for (const speed of [1, 10]) {
  test(`coverage W${size.W} H${size.H} speed ${speed}`, () => {
    const target = Spawner.targetCount(Rules.LEVELS.hard.targetDrones, size.W, size.R, 6);
    for (let seed = 1; seed <= 20; seed++) {
      let solved = 0;
      const g = createGame({
        mode: 'challenge', lang: 'en', level: 'hard', speed, words: WORDS, ...size,
        rng: lcg(seed), hooks: { onWordDone: () => solved++ },
      });
      const act = player(g);
      const age = new Map();
      let nextAction = 1.5;
      for (let t = 0; t < 120; t += DT) {
        g.update(DT);
        if (g.time >= nextAction) { act(); nextAction += 1.5; }
        assert.ok(g.drones.length <= target + 8, `seed ${seed}: ${g.drones.length} drones > ${target} + 8`);
        const bound = 0.25 * g.challenge.word.length + 0.05;
        const missing = new Set(Challenge.missing(Challenge.needed(g.challenge.word, g.plan.letters), g.drones, g));
        for (const l of [...age.keys()]) if (!missing.has(l)) age.delete(l);
        for (const l of missing) {
          age.set(l, (age.get(l) || 0) + DT);
          if (g.time > 2) assert.ok(age.get(l) <= bound, `seed ${seed} t=${g.time.toFixed(2)}: '${l}' missing ${age.get(l).toFixed(2)}s > ${bound}`);
        }
      }
      assert.notEqual(g.phase, 'over', `seed ${seed}: game over`);
      if (speed === 1) assert.ok(solved >= 1, `seed ${seed}: no challenge solved`);
    }
  });
}
