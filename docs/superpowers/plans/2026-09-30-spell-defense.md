# Spell Defense Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A bilingual (English/Hebrew) spelling tower-defence browser game where the player marks letter-carrying drones in order and launches missiles if the spelled word is real.

**Architecture:** Plain classic scripts (no modules, no build) so `index.html` works from `file://`. Pure, Node-testable logic lives in `lexicon.js`, `rules.js`, `spawner.js`, `game.js` (no DOM). `render.js`, `audio.js`, `ui.js` handle presentation; `main.js` wires everything and owns settings persistence and the frame loop.

**Tech Stack:** HTML5 canvas, vanilla JS (ES2020), WebAudio, speechSynthesis, Node ≥ 18 `node:test` for tests, Playwright (MCP) for visual checks.

**Spec:** `docs/superpowers/specs/2026-09-30-spell-defense-design.md`

## Global Constraints

- Runs by double-clicking `index.html`: no `fetch`, no ES modules, no runtime network except the Google Fonts stylesheet (with system-font fallback).
- No emojis anywhere in UI text, icons, or code strings shown to the player. Icons are inline SVG.
- No dependencies. Tests run with `node --test tests/`.
- Pure units (`lexicon`, `rules`, `spawner`, `game`) never touch `window.document`, canvas, audio, or `localStorage`; randomness is injected as `rng: () => number`.
- Pure-unit module pattern (so the same file works as a browser script and a Node `require`):
  ```js
  (function (root) {
    const api = { /* ... */ };
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.<GlobalName> = api;
  })(typeof window !== 'undefined' ? window : globalThis);
  ```
  Inside browser code, a unit reaches its dependency via `root.Lexicon`; in Node via `require('./lexicon.js')`. Use: `const Lexicon = (typeof module === 'object' && module.exports) ? require('./lexicon.js') : root.Lexicon;`
- Levels: Easy min 2 / ×1 / 6 drones; Medium min 4 / ×2 / 8 drones; Hard min 6 / ×3 / 10 drones.
- Start with 5 lives. Score per word = `10 × length × multiplier`.
- Fall speed px/s = `(8 + 9 × speed) × (H / 800) × jitter`, jitter ∈ [0.85, 1.15] per drone. Speed range 1–10, default 3.
- Hebrew finals: ך→כ, ם→מ, ן→נ, ף→פ, ץ→צ. Drones only carry non-final letters.
- Commits: `git` is a shell function on this machine that breaks; always call `/usr/bin/git`. End every commit message with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

1. A marked drone lands in the middle of the plan → its letter leaves the plan, later letters shift left, badge numbers renumber (tested in Task 5).
2. Tapping during a launch sequence, or tapping the same drone twice quickly → no mark changes, no duplicate letters (tested in Task 5).
3. Speed changed while drones and missiles are in flight → drones ease to new speed, missiles still hit, spawn interval updates (tested in Task 5).
4. Window resized / phone rotated mid-game → drones stay inside the new width and above the new ground (tested in Task 5).
5. English subtitle junk accepted as words (`ll`, `ve`, `re`, `s`, `t` from contractions) → two-letter English words are restricted to an allowlist (tested in Task 1).

---

### Task 1: Word data generator

**Files:**
- Create: `tools/build-words.mjs`, `tools/blocklist.txt`, `tools/en-two-letter.txt`, `words/en.js`, `words/he.js`, `package.json`
- Test: `tests/words.test.js`

**Interfaces:**
- Produces: `words/en.js` and `words/he.js`, each executing
  `window.WORDS = window.WORDS || {}; window.WORDS.<lang> = { valid: "<space-separated>", common: "<space-separated>" };`
  (use `(typeof window !== 'undefined' ? window : globalThis)` so Node can `require` them and read `globalThis.WORDS`).
- Produces: `package.json` with `{ "name": "spell-defense", "private": true, "scripts": { "test": "node --test tests/", "words": "node tools/build-words.mjs" } }`.

- [ ] **Step 1: Write the failing test** `tests/words.test.js`

```js
require('../words/en.js'); require('../words/he.js');
const { en, he } = globalThis.WORDS;
test('sizes', () => {
  for (const w of [en, he]) {
    const valid = w.valid.split(' '), common = w.common.split(' ');
    assert.ok(valid.length >= 25000 && valid.length <= 30000);
    assert.ok(common.length >= 2500 && common.length <= 3000);
    assert.ok(common.every(c => valid.includes(c)));   // common ⊂ valid
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
  const block = fs.readFileSync('tools/blocklist.txt', 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
  for (const b of block) assert.ok(!en.common.split(' ').includes(b) && !he.common.split(' ').includes(b));
});
```
(Add the `node:test`, `node:assert/strict` and `fs` requires at the top.)

- [ ] **Step 2: Run to verify it fails** — `node --test tests/words.test.js` → FAIL (cannot find `../words/en.js`).

- [ ] **Step 3: Implement `tools/build-words.mjs`**
  - Download `https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/{en,he}/{lang}_50k.txt` (lines are `word count`, frequency-ordered) with global `fetch`.
  - English: lowercase; keep `^[a-z]{2,}$`; a 2-letter word is kept only if listed in `tools/en-two-letter.txt`.
  - Hebrew: keep `^[א-ת]{2,}$`.
  - Deduplicate preserving order. `valid` = first 30,000; `common` = first 3,000 minus blocklist entries.
  - `tools/en-two-letter.txt`: `am an as at be by do go he hi if in is it me my no of oh ok on or so to up us we`, one per line.
  - `tools/blocklist.txt`: common English and Hebrew profanity, slurs, sexual and violent terms (≈40–80 entries). One per line, `#` comments allowed and ignored.
  - Write the two `words/*.js` files with a header comment crediting "FrequencyWords by Hermit Dave, CC-BY-SA 4.0".

- [ ] **Step 4: Run the generator, then the test** — `node tools/build-words.mjs && node --test tests/words.test.js` → PASS. Check each file is < 400 KB.

- [ ] **Step 5: Commit** — `/usr/bin/git add package.json tools words tests/words.test.js && /usr/bin/git commit -m "feat: generate English and Hebrew word lists"`

---

### Task 2: Lexicon

**Files:**
- Create: `src/lexicon.js` (global `Lexicon`)
- Test: `tests/lexicon.test.js`

**Interfaces:**
- Produces:
  - `normalize(word: string, lang: 'en'|'he'): string` — en → lowercase; he → finals to regular.
  - `display(letters: string[], lang): string[]` — en → uppercase each; he → last letter to final form when `letters.length >= 2`.
  - `buildValidSet(validStr: string, lang): Set<string>` — normalized entries.
  - `letterWeights(words: string[], lang): Array<[string, number]>` — normalized-letter frequencies over `words`, weights sum to 1; he never contains final letters.
  - `weightedPick(weights: Array<[string, number]>, rng): string`
  - `class SeedDeck(common: string[], lang, minLength: number, rng = Math.random)` with `next(): string` returning a normalized word with `minLength ≤ len ≤ minLength + 2`; shuffled deck, no repeat until exhausted, then reshuffle; constructor throws `Error('no seed words')` if none qualify.
  - `shuffle(arr, rng): arr` (Fisher–Yates, in place) — reused by Spawner.

- [ ] **Step 1: Write failing tests**
  - `normalize('כלב','he') === 'כלב'`; for each pair of `ךכ םמ ןנ ףפ ץצ`: `normalize('א'+final,'he') === 'א'+regular`; `normalize('CaT','en') === 'cat'`.
  - `display(['ש','ל','ו','מ'],'he').join('') === 'שלום'`; `display(['מ'],'he')` → `['מ']`; `display(['c','a','t'],'en').join('') === 'CAT'`.
  - `buildValidSet('שלום כלב','he').has(normalize('שלום','he'))`; `has('שלומ')` true.
  - `letterWeights(['aab'],'en')` → a ≈ 2/3, b ≈ 1/3; sum of weights within 1e-9 of 1; `letterWeights(['שלום'],'he')` contains `מ` not `ם`.
  - `weightedPick([['x',1]], Math.random) === 'x'`.
  - SeedDeck: with `common = ['ab','abc','abcd','abcde','abcdefgh']`, `minLength 2` → 3 `next()` calls return exactly `{'ab','abc','abcd'}` (no repeats), 4th call returns one of them; `minLength 6` → always `'abcdefgh'`; `new SeedDeck(['ab'],'en',6)` throws `/no seed words/`.

- [ ] **Step 2: Run to verify fail** — `node --test tests/lexicon.test.js` → FAIL.
- [ ] **Step 3: Implement `src/lexicon.js`** per Interfaces.
- [ ] **Step 4: Run to verify pass** — `node --test tests/lexicon.test.js` → PASS.
- [ ] **Step 5: Commit** — `feat: lexicon (normalize, display, seed deck)`

---

### Task 3: Rules

**Files:**
- Create: `src/rules.js` (global `Rules`)
- Test: `tests/rules.test.js`

**Interfaces:**
- Consumes: `Lexicon.normalize`.
- Produces:
  - `LEVELS = { easy: { minLength: 2, multiplier: 1, targetDrones: 6 }, medium: { minLength: 4, multiplier: 2, targetDrones: 8 }, hard: { minLength: 6, multiplier: 3, targetDrones: 10 } }`
  - `START_LIVES = 5`
  - `class Plan` with `ids: number[]`, `letters: string[]`, `get length`, `mark(id, letter): boolean` (false if `id` already present), `undo(): void`, `clear(): void`, `remove(id): number` (removed index or -1), `indexOf(id): number`.
  - `judge(letters: string[], { lang, minLength, validSet: Set<string>, used: Set<string> }): 'tooShort'|'used'|'valid'|'invalid'` — order: tooShort, used, valid, invalid; `used`/`validSet` compared on `normalize(letters.join(''), lang)`.
  - `score(length: number, level: 'easy'|'medium'|'hard'): number`

- [ ] **Step 1: Write failing tests**
  - Plan: mark 1,2,3 with c,a,t → letters `['c','a','t']`; `mark(2,'x')` returns false, length stays 3; `undo()` → `['c','a']`; `remove(1)` returns 0 and letters `['a']`, ids `[2]`; `remove(99)` returns -1; `clear()` → length 0.
  - judge with `validSet = new Set(['cat','שלומ'])`, minLength 2: `['c']` → tooShort; `['c','a','t']` → valid; `['c','a','t']` with `used = new Set(['cat'])` → used; `['t','a','c']` → invalid; Hebrew `['ש','ל','ו','מ']` → valid; minLength 4 with `['c','a','t']` → tooShort.
  - `score(3,'easy') === 30`, `score(4,'medium') === 80`, `score(6,'hard') === 180`.
- [ ] **Step 2: Run to verify fail** — `node --test tests/rules.test.js` → FAIL.
- [ ] **Step 3: Implement `src/rules.js`.**
- [ ] **Step 4: Run to verify pass.**
- [ ] **Step 5: Commit** — `feat: rules (plan, judge, score)`

---

### Task 4: Spawner

**Files:**
- Create: `src/spawner.js` (global `Spawner`)
- Test: `tests/spawner.test.js`

**Interfaces:**
- Consumes: `Lexicon.weightedPick`, `Lexicon.shuffle`; a deck duck-typed as `{ next(): string }` (a `Lexicon.SeedDeck` in the game).
- Produces:
  - `fallSpeed(speed: number, H: number): number` = `(8 + 9*speed) * (H/800)` (no jitter).
  - `targetCount(levelTarget: number, W: number, R: number): number` = `max(4, min(levelTarget, floor(W / (2*R*1.4))))`.
  - `spawnInterval(speed, H, fallDistance, count): number` seconds = `fallDistance / fallSpeed(speed, H) / count`.
  - `class LetterQueue({ deck, weights, rng = Math.random })` with `refill(): string[]` (builds one batch = seed letters + 1–3 weighted fillers, shuffled, appends to `this.queue`, returns the batch) and `next(): string` (calls `refill()` while `queue.length < 3`, then shifts).
  - `pickX(W: number, R: number, drones: Array<{x:number,y:number}>, rng): number` — random in `[1.6R, W-1.6R]`, up to 12 attempts to avoid `|x - d.x| < 2.6R` for drones with `d.y < 4R`; returns last attempt if none clear.

- [ ] **Step 1: Write failing tests**
  - `refill()` with deck stub returning `'cat'`: batch length 4–6, contains `c`,`a`,`t` (multiset), extra letters come from weights `[['z',1]]` so extras are all `'z'`.
  - Ordering: deck stub yields `'aaa'` then `'bbb'`, weights `[['z',1]]`; first 12 `next()` results: every `'b'` appears after every `'a'`.
  - `spawnInterval(s, 800, 600, 8) * 8` equals `600 / fallSpeed(s, 800)` within 1e-9 for s = 1..10.
  - `targetCount(10, 360, 24) === 5`; `targetCount(6, 1200, 40) === 6`; `targetCount(10, 200, 40) === 4`.
  - `pickX` with a drone at `{x: 500, y: 0}`, W 1000, R 30, deterministic rng cycling `[0.49, 0.9]` returns a value with `|x-500| >= 78`.
  - Hebrew: a deck yielding `normalize('שלום','he')` and weights from `letterWeights(['שלום'],'he')` → 50 `next()` letters contain none of `ךםןףץ`.
- [ ] **Step 2: Run to verify fail.**
- [ ] **Step 3: Implement `src/spawner.js`.**
- [ ] **Step 4: Run to verify pass.**
- [ ] **Step 5: Commit** — `feat: spawner (seeded letter queue, pacing)`

---

### Task 5: Game core (headless)

**Files:**
- Create: `src/game.js` (global `Game`)
- Test: `tests/game.test.js`

**Interfaces:**
- Consumes: `Lexicon.*`, `Rules.LEVELS`, `Rules.START_LIVES`, `Rules.Plan`, `Rules.judge`, `Rules.score`, `Spawner.*`.
- Produces: `createGame(opts): game` where
  `opts = { lang, level, speed, words: { valid: string, common: string }, W, H, groundY, R, rng = Math.random, hooks = {} }`
  - State fields: `drones: Drone[]`, `missiles: Missile[]`, `plan: Plan`, `score`, `lives`, `used: Set<string>`, `phase: 'playing'|'launching'|'paused'|'over'`, `speed`, `time`, `cannon: {x, y}` (= `{x: W/2, y: groundY - 30}`).
  - `Drone = { id, x, y, bx, vy, targetVy, jitter, letter, hue, phase, amp, freq, marked: boolean }` — spawns at `y = -2R`; `x = bx + sin(time*freq + phase) * amp`, `amp ∈ [10, 35]`, `freq ∈ [0.6, 1.4]`, `hue ∈ [0, 360)`.
  - `Missile = { x, y, vx, vy, droneId, tx, ty, delay, trail: Array<[x,y]>, done }` — speed 900 px/s, steers toward live drone position `(x, y + 0.5R)` (or last known `tx,ty` once the drone is gone) turning at most 6 rad/s, hits when within 18 px.
  - Methods: `update(dt)` (clamp dt to 0.05; no-op when paused/over), `mark(id): boolean`, `undo()`, `clear()`, `launch(): 'tooShort'|'used'|'valid'|'invalid'|'busy'`, `setSpeed(n)`, `resize(W, H, groundY, R)`, `pause()`, `resume()`, `droneAt(px, py): Drone|null` (nearest drone within `1.35R` of `(x, y + 0.6R)`), `word(): string[]` (display form of plan).
  - Hooks (all optional): `onSpawn(d)`, `onMark(d, index)`, `onUnmark()`, `onLand(d, removedIndex)`, `onFire(missile)`, `onHit(d, planIndex)`, `onVerdict(verdict, displayWord)`, `onWordDone(displayWord, points)`, `onLives(lives)`, `onGameOver(score)`.
  - Behaviour:
    - Spawn: when `drones.length < targetCount` and spawn timer elapsed, spawn with `LetterQueue.next()`, `pickX`, `vy = fallSpeed(speed,H) * jitter`. Timer = `spawnInterval(speed, H, groundY + 2R, targetCount)`. First `update` spawns immediately.
    - Landing: drone lands when `y >= groundY - 2R`. Removed; if marked and phase is `playing`, `plan.remove(id)` and `onLand(d, index)`; otherwise `onLand(d, -1)`.
    - `mark` / `undo` / `clear` / `launch` do nothing (return false / `'busy'`) unless phase is `playing`.
    - `launch`: `judge(...)`; `onVerdict`. `valid` → phase `launching`, one missile per plan id with `delay = 0.2 * i` from `cannon`; when all missiles are done: `score += Rules.score(len, level)`, add to `used`, `onWordDone`, plan clears, phase `playing`. `used` → plan clears. `invalid` → `lives -= 1`, `onLives`, plan clears; at 0 → phase `over`, `onGameOver(score)`. `tooShort` → nothing changes.
    - On hit: drone removed, `onHit(d, planIndex)`. A marked drone that lands during `launching` is removed but its missile flies to `tx,ty` and still counts.
    - `setSpeed(n)`: set `targetVy = fallSpeed(n,H) * jitter` on every drone; `update` moves `vy` toward `targetVy` by `min(1, dt/0.5)` of the gap; spawn timer interval recomputed.
    - `resize`: store new sizes, clamp every drone `bx` into `[1.6R, W - 1.6R]`, rescale `vy/targetVy` by `newH/oldH`, move `cannon`.

- [ ] **Step 1: Write failing tests** (deterministic `rng` from a seeded LCG helper in the test; `words = { valid: 'cat act at ta', common: 'cat act' }`, lang `en`, level `easy`, W 1000, H 800, groundY 700, R 30)
  - `spawns up to target count`: after `update(0.05)` × 400, `drones.length <= 6` and `> 0`.
  - `mark and double mark`: `mark(id)` true then `mark(id)` false; `plan.length === 1`.
  - `landing removes marked letter and closes gap` (Review Focus 1): mark three drones, set the middle one's `y = groundY`, `update(0.01)` → `plan.length === 2`, `plan.ids` equals the other two in original order; `onLand` called with index 1.
  - `valid launch`: force three drones' letters to `c,a,t`, mark in order, `launch() === 'valid'`, `phase === 'launching'`; `mark(otherId) === false` and `launch() === 'busy'` (Review Focus 2); run `update(0.016)` until `phase === 'playing'` (≤ 600 steps) → `score === 30`, `used.has('cat')`, `plan.length === 0`, three `onHit` calls in plan order.
  - `invalid launch costs a life; game over at 0`: plan `t,c`… use letters `c,c` (not in valid) → `'invalid'`, `lives === 4`; repeat until `phase === 'over'` and `onGameOver` called once.
  - `tooShort`: one marked drone → `'tooShort'`, lives unchanged, plan unchanged.
  - `speed change eases` (Review Focus 3): record a drone's `vy`, `setSpeed(10)`, `update(0.25)` → vy strictly between old and new target; after 40 × `update(0.05)` within 1% of target. During a launch, `setSpeed(1)` still ends with `phase === 'playing'` and score added.
  - `resize clamps` (Review Focus 4): `resize(400, 800, 700, 24)` → every drone `bx` within `[38.4, 361.6]`, `cannon.x === 200`.
  - `droneAt`: returns the drone whose centre is nearest to the tap within `1.35R`; returns null for a far tap.
- [ ] **Step 2: Run to verify fail** — `node --test tests/game.test.js` → FAIL.
- [ ] **Step 3: Implement `src/game.js`.** Homing steering (not determined by tests):
  ```js
  const want = Math.atan2(ty - m.y, tx - m.x), cur = Math.atan2(m.vy, m.vx);
  let d = want - cur; d = Math.atan2(Math.sin(d), Math.cos(d));
  const a = cur + Math.max(-6 * dt, Math.min(6 * dt, d));
  m.vx = Math.cos(a) * 900; m.vy = Math.sin(a) * 900;
  ```
  Initial missile velocity: straight up (`vx 0, vy -900`) with a small sideways bias toward the target so the arc curves. If a missile has not hit after 3 s, snap to the target and count the hit.
- [ ] **Step 4: Run all tests** — `node --test tests/` → PASS.
- [ ] **Step 5: Commit** — `feat: headless game core`

---

### Task 6: Page shell, renderer, audio, basic wiring

**Files:**
- Create: `src/render.js` (global `Render`), `src/audio.js` (global `Sfx`), `src/main.js`
- Replace: `index.html` (the prototype there is throwaway; overwrite it entirely)

**Interfaces:**
- Consumes: `Game.createGame`, `window.WORDS`.
- Produces:
  - `Render.create(canvas): renderer` with `resize(W, H, groundY, R, dpr)`, `draw(game, dt)`, and effect triggers `explode(x, y, hue)`, `confetti()`, `shake(px)`, `muzzle(angle)`. The renderer owns particles, clouds, cannon angle (eases toward the next unfired/in-flight missile's target, else toward the most recently marked drone, else straight up) and the prerendered background.
  - `Sfx` with `enabled: boolean`, `unlock()`, `mark()`, `whoosh()`, `boom()`, `success()`, `fail()`, `say(text, lang)` (`en-US`/`he-IL`, rate 0.85; silent no-op if `speechSynthesis` missing or `enabled` false).
  - `main.js`: creates the renderer and a game from hard-coded settings (`en`, `easy`, speed 3), connects hooks to `Render`/`Sfx`, `pointerdown` on canvas → `game.droneAt` → `game.mark`, runs `requestAnimationFrame` loop (`game.update(dt)`, `renderer.draw(game, dt)`), handles `resize`, pauses on `visibilitychange` hidden. Temporary: Enter key launches. Task 7 replaces the hard-coded settings with the UI.
- `index.html`: `<canvas id="stage">`, empty `#topbar`, `#console` (with `#plan` strip and `#launch` button placeholder), `#menu`, `#over` containers; Google Fonts link for Fredoka + Rubik; script order `words/en.js, words/he.js, src/lexicon.js, src/rules.js, src/spawner.js, src/game.js, src/render.js, src/audio.js, src/ui.js, src/main.js` (create an empty `src/ui.js` stub). CSS design tokens on `:root`; `body` background explicit.

Visual requirements (spec §5.1): dusk sky gradient, stars, moon with glow, two mountain layers, skyline with lit windows, ground band — prerendered on resize; drifting clouds; drone = two-rotor quadcopter body in its hue with spinning blades and blinking light, hanging rounded letter card (Fredoka 700, `display()` form of the letter); marked drone gets pulsing red ring + numbered badge (plan index + 1) on the card corner; cannon turret with recoil and muzzle flash; missile = small rocket body with fins and a fading smoke trail; explosion = flash ring + particles + shake; confetti on word done. Canvas scaled by `min(devicePixelRatio, 2)`.

- [ ] **Step 1: Write the files.**
- [ ] **Step 2: Run unit tests** — `node --test tests/` → PASS (unchanged).
- [ ] **Step 3: Visual check** — serve with `python3 -m http.server 8765` from the repo root, open `http://localhost:8765/` with Playwright at 1200×800, wait 3 s, screenshot. Then via `browser_evaluate`, mark three drones by dispatching `pointerdown` at their positions and screenshot (badges visible). No console errors. Also open `file://` path is not testable in Playwright here; confirm there are no `fetch`/`import` statements: `grep -rnE "fetch\(|^import |type=\"module\"" index.html src/` → no output.
- [ ] **Step 4: Commit** — `feat: canvas renderer, audio, page shell`

---

### Task 7: UI — menus, top bar, plan strip, i18n, RTL, settings

**Files:**
- Modify: `src/ui.js` (global `UI`), `src/main.js`, `index.html` (CSS/markup only as needed)

**Interfaces:**
- Consumes: game hooks and methods from Task 5; `Render`, `Sfx` from Task 6.
- Produces: `UI.init(handlers)` where `handlers = { onStart(settings), onResume(), onPause(), onUndo(), onClear(), onLaunch(), onSpeed(n), onSound(bool), onSettingsChanged(settings) }`; `UI.update(game, settings)` (call after every game hook and on settings change); `UI.toast(key, kind, extra?)`; `UI.showMenu({ canContinue })`; `UI.showGameOver(score, best, isRecord)`; `UI.flashPlanLoss(index)`; `UI.markHit(index)`; `UI.error(message)`. `UI.I18N = { en: {...}, he: {...} }`, `UI.ICONS = { heart, heartEmpty, turtle, rocket, soundOn, soundOff, pause, undo, clear, lock }` (inline SVG strings, `currentColor`, rounded 2.5px stroke style).
- `main.js` owns settings: `{ lang: 'en', level: 'easy', speed: 3, sound: true }` persisted under `localStorage['spellDefense.settings']` and best scores under `spellDefense.best.<lang>.<level>`, every access in try/catch.

Requirements (spec §2, §5.2–5.4, §6):
- Menu: title, one-line how-to, language segmented control (`English` / `עברית`), level segmented control with min-length hint (e.g. "Easy · 2+ letters"), speed slider 1–10 with turtle/rocket icons, sound toggle, Continue (only when a game is paused and settings unchanged), primary Start / New game, credit line "Word lists: FrequencyWords by Hermit Dave, CC-BY-SA 4.0".
- Top bar in game: 5 hearts, score, speed control (turtle, −, value, +, rocket) live, sound toggle live, pause. Under 600 px wide the speed control collapses to a chip that opens a popover slider.
- Console: plan strip tiles (pop-in, green on hit, red flash on loss, fills right-to-left in Hebrew), Undo, Clear, Launch (disabled with lock icon while `plan.length < minLength` or phase ≠ `playing`).
- Toasts: great (+points), not a word, already used, need N letters (not reachable via disabled Launch but used by Enter key).
- Hebrew switches `<html lang dir>`; all strings from `I18N`; layout mirrors via CSS logical properties.
- Keyboard: Enter launch, Backspace undo, Escape pause.
- Game over overlay: score, best / new record, Play again, Menu.
- If `window.WORDS[lang]` is missing, `UI.error()` shows a message in the menu and Start is disabled.
- No emojis anywhere: `grep -nP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" index.html src/*.js` → no output.

- [ ] **Step 1: Implement `ui.js` and update `main.js`/`index.html`.**
- [ ] **Step 2: Unit tests still pass** — `node --test tests/` → PASS.
- [ ] **Step 3: Emoji grep** (command above) → no output.
- [ ] **Step 4: Playwright walkthrough**, screenshots saved under `.playwright-mcp/`: menu EN at 1200×800; start Easy, mark drones spelling a valid word found via `browser_evaluate` (search `game.drones` for letters of any word in `valid` — expose `window.__game` from `main.js` for this), Launch, screenshot mid-flight and after; launch an invalid 2-letter word → a heart empties; change speed with + in the top bar and confirm drones' `vy` changed; switch to Hebrew → menu and in-game RTL screenshots; 390×844 portrait in-game screenshot showing collapsed speed chip; play to game over (inject invalid launches) → game over screenshot. No console errors throughout.
- [ ] **Step 5: Commit and push** — `feat: menus, HUD, bilingual UI` then `/usr/bin/git push`.

---

### Task 8: README

**Files:**
- Create: `README.md`

- [ ] **Step 1:** Short README: what the game is, how to play (open `index.html`), levels table, how to regenerate words (`npm run words`), how to test (`npm test`), word list credit (CC-BY-SA 4.0), one screenshot copied from Task 7 to `docs/screenshot.png`.
- [ ] **Step 2: Commit and push** — `docs: README`.
