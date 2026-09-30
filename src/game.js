(function (root) {
  const isNode = typeof module === 'object' && module.exports;
  const Lexicon = isNode ? require('./lexicon.js') : root.Lexicon;
  const Rules = isNode ? require('./rules.js') : root.Rules;
  const Spawner = isNode ? require('./spawner.js') : root.Spawner;

  const MISSILE_SPEED = 900;
  const TURN_RATE = 6; // rad/s at launch
  const TURN_GROWTH = 30; // rad/s added per second of flight
  const HIT_RADIUS = 18;
  const MISSILE_TIMEOUT = 3;
  const TRAIL_LENGTH = 12;

  function createGame({ lang, level, speed, words, W, H, groundY, R, rng = Math.random, hooks = {} }) {
    const { minLength, targetDrones } = Rules.LEVELS[level];
    const common = words.common.split(/\s+/).filter(Boolean);
    const validSet = Lexicon.buildValidSet(words.valid, lang);
    const queue = new Spawner.LetterQueue({
      deck: new Lexicon.SeedDeck(common, lang, minLength, rng),
      weights: Lexicon.letterWeights(common, lang),
      rng,
    });
    const emit = (name, ...args) => hooks[name] && hooks[name](...args);

    let nextId = 1;
    let spawnTimer = 0;
    let resumePhase = 'playing';
    let volley = null; // { drones, length, word, shown } while missiles are in flight

    const interval = () =>
      Spawner.spawnInterval(g.speed, g.H, g.groundY, Spawner.targetCount(targetDrones, g.W, g.R, minLength));

    const g = {
      lang, level, speed, W, H, groundY, R,
      drones: [],
      missiles: [],
      plan: new Rules.Plan(),
      score: 0,
      lives: Rules.START_LIVES,
      used: new Set(),
      phase: 'playing',
      time: 0,
      cannon: { x: W / 2, y: groundY - 30 },

      update(dt) {
        if (g.phase === 'paused' || g.phase === 'over') return;
        dt = Math.min(dt, 0.05);
        g.time += dt;
        spawn(dt);
        moveDrones(dt);
        moveMissiles(dt);
      },

      mark(id) {
        if (g.phase !== 'playing') return false;
        const d = g.drones.find((x) => x.id === id);
        if (!d || !g.plan.mark(id, d.letter)) return false;
        d.marked = true;
        emit('onMark', d, g.plan.length - 1);
        return true;
      },

      undo() {
        if (g.phase !== 'playing' || !g.plan.length) return;
        const id = g.plan.ids[g.plan.length - 1];
        g.plan.undo();
        unmark([id]);
        emit('onUnmark');
      },

      clear() {
        if (g.phase !== 'playing' || !g.plan.length) return;
        const ids = g.plan.ids;
        g.plan.clear();
        unmark(ids);
        emit('onUnmark');
      },

      launch() {
        if (g.phase !== 'playing') return 'busy';
        const verdict = Rules.judge(g.plan.letters, { lang, minLength, validSet, used: g.used });
        const shown = g.word().join('');
        emit('onVerdict', verdict, shown);
        if (verdict === 'tooShort') return verdict;
        if (verdict === 'valid') {
          volley = {
            drones: g.plan.ids.map((id) => g.drones.find((d) => d.id === id)),
            length: g.plan.length,
            word: Lexicon.normalize(g.plan.letters.join(''), lang),
            shown,
          };
          g.missiles = volley.drones.map((d, i) => {
            const tx = d.x, ty = d.y + 0.5 * g.R;
            const vx = Math.sign(tx - g.cannon.x) * 200;
            return {
              x: g.cannon.x, y: g.cannon.y, vx, vy: -Math.sqrt(MISSILE_SPEED ** 2 - vx * vx),
              droneId: d.id, tx, ty, delay: 0.2 * i, age: 0, fired: false, trail: [], done: false,
            };
          });
          g.phase = 'launching';
          return verdict;
        }
        const ids = g.plan.ids;
        g.plan.clear();
        unmark(ids);
        if (verdict === 'invalid') {
          g.lives -= 1;
          emit('onLives', g.lives);
          if (g.lives <= 0) {
            g.phase = 'over';
            emit('onGameOver', g.score);
          }
        }
        return verdict;
      },

      setSpeed(n) {
        g.speed = n;
        for (const d of g.drones) d.targetVy = Spawner.fallSpeed(n, g.H) * d.jitter;
        spawnTimer = Math.min(spawnTimer, interval());
      },

      resize(nW, nH, nGroundY, nR) {
        const k = nH / g.H, kx = nW / g.W, ky = nGroundY / g.groundY;
        Object.assign(g, { W: nW, H: nH, groundY: nGroundY, R: nR });
        for (const d of g.drones) {
          d.y *= ky;
          d.bx = Math.max(1.6 * nR, Math.min(nW - 1.6 * nR, d.bx));
          d.vy *= k;
          d.targetVy *= k;
        }
        for (const m of g.missiles) {
          m.x *= kx; m.tx *= kx;
          m.y *= ky; m.ty *= ky;
          m.trail = [];
        }
        g.cannon = { x: nW / 2, y: nGroundY - 30 };
      },

      pause() {
        if (g.phase === 'paused' || g.phase === 'over') return;
        resumePhase = g.phase;
        g.phase = 'paused';
      },

      resume() {
        if (g.phase === 'paused') g.phase = resumePhase;
      },

      droneAt(px, py) {
        let best = null, bestDist = 1.35 * g.R;
        for (const d of g.drones) {
          const dist = Math.hypot(px - d.x, py - (d.y + 0.6 * g.R));
          if (dist <= bestDist) { best = d; bestDist = dist; }
        }
        return best;
      },

      word() {
        return Lexicon.display(g.plan.letters, lang);
      },
    };

    function unmark(ids) {
      ids.forEach((id) => { const d = g.drones.find((x) => x.id === id); if (d) d.marked = false; });
    }

    function spawn(dt) {
      spawnTimer -= dt;
      if (spawnTimer > 0 || g.drones.length >= Spawner.targetCount(targetDrones, g.W, g.R, minLength)) return;
      spawnTimer = interval();
      const jitter = 0.85 + rng() * 0.3;
      const bx = Spawner.pickX(g.W, g.R, g.drones, rng);
      const d = {
        id: nextId++, x: bx, y: -2 * g.R, bx,
        vy: Spawner.fallSpeed(g.speed, g.H) * jitter,
        targetVy: Spawner.fallSpeed(g.speed, g.H) * jitter,
        jitter,
        letter: queue.next(),
        hue: rng() * 360,
        phase: rng() * 2 * Math.PI,
        amp: 10 + rng() * 25,
        freq: 0.6 + rng() * 0.8,
        marked: false,
      };
      d.x = d.bx + Math.sin(g.time * d.freq + d.phase) * d.amp;
      g.drones.push(d);
      emit('onSpawn', d);
    }

    function moveDrones(dt) {
      const ease = Math.min(1, dt / 0.5);
      for (const d of g.drones.slice()) {
        d.vy += (d.targetVy - d.vy) * ease;
        d.y += d.vy * dt;
        d.x = d.bx + Math.sin(g.time * d.freq + d.phase) * d.amp;
        if (d.y < g.groundY - 2 * g.R) continue;
        g.drones.splice(g.drones.indexOf(d), 1);
        const index = d.marked && g.phase === 'playing' ? g.plan.remove(d.id) : -1;
        emit('onLand', d, index);
      }
    }

    function moveMissiles(dt) {
      if (!volley) return;
      g.missiles.forEach((m, i) => {
        if (m.done) return;
        if (m.delay > 0 && (m.delay -= dt) > 0) return;
        if (!m.fired) { m.fired = true; emit('onFire', m); }
        m.age += dt;
        const target = g.drones.find((d) => d.id === m.droneId);
        if (target) { m.tx = target.x; m.ty = target.y + 0.5 * g.R; }
        const want = Math.atan2(m.ty - m.y, m.tx - m.x), cur = Math.atan2(m.vy, m.vx);
        let turn = want - cur;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        // Turn limit grows with age so a missile can't orbit a target inside its turning circle.
        const maxTurn = (TURN_RATE + TURN_GROWTH * m.age) * dt;
        const a = cur + Math.max(-maxTurn, Math.min(maxTurn, turn));
        m.vx = Math.cos(a) * MISSILE_SPEED;
        m.vy = Math.sin(a) * MISSILE_SPEED;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        if (m.age >= MISSILE_TIMEOUT) { m.x = m.tx; m.y = m.ty; }
        m.trail.push([m.x, m.y]);
        if (m.trail.length > TRAIL_LENGTH) m.trail.shift();
        if (Math.hypot(m.tx - m.x, m.ty - m.y) > HIT_RADIUS) return;
        m.done = true;
        const d = volley.drones[i];
        const at = g.drones.indexOf(d);
        if (at >= 0) g.drones.splice(at, 1);
        emit('onHit', d, i);
      });
      if (!g.missiles.every((m) => m.done)) return;
      const points = Rules.score(volley.length, level);
      g.score += points;
      g.used.add(volley.word);
      g.plan.clear();
      g.missiles = [];
      g.phase = 'playing';
      emit('onWordDone', volley.shown, points);
      volley = null;
    }

    return g;
  }

  const api = { createGame };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Game = api;
})(typeof window !== 'undefined' ? window : globalThis);
