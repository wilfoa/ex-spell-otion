# Challenge Mode, "Did you mean", Hebrew Default — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a spoken-word Challenge mode with guaranteed letter coverage, a "Did you mean…?" correction for Free-mode non-words, and Hebrew as the first-visit language.

**Architecture:** Two new pure, Node-tested modules (`src/suggest.js`, `src/challenge.js`) hold the algorithms. `src/game.js` gains a `mode` option that swaps Free-mode spawning/judging for challenge coverage spawning/judging and adds `peek()`/`skip()`. `main.js`, `ui.js`, `audio.js`, `index.html` add the Mode setting, the challenge card, the suggestion card and the Hebrew default.

**Tech Stack:** Vanilla JS classic scripts (no modules, no build), canvas, WebAudio + speechSynthesis, `node --test`, Playwright MCP.

**Spec:** `docs/superpowers/specs/2026-09-30-challenge-mode-design.md` (builds on `docs/superpowers/specs/2026-09-30-spell-defense-design.md`)

## Global Constraints

- Classic `<script>` tags only; must run from `file://` and from GitHub Pages at `/ex-spell-otion/` (relative paths only). No `fetch`, no ES modules, no dependencies.
- No emojis anywhere (UI text, icons, code strings shown to the player). Icons are inline SVG.
- Pure units (`lexicon`, `rules`, `spawner`, `suggest`, `challenge`, `game`) never touch DOM/canvas/audio/`localStorage`; randomness injected as `rng`.
- Pure-unit wrapper: copy the pattern from `src/spawner.js` (Node `require` vs `root.X`).
- Tests: `npm test` runs `node --test`; the existing 40 tests must stay green.
- `git` is a broken shell function on this machine: always use `/usr/bin/git`. Bash heredocs may write empty files: use the Write tool.
- Levels unchanged: Easy min 2 ×1, Medium min 4 ×2, Hard min 6 ×3. Lives 5.
- Challenge word length: `minLength … minLength + 2` via existing `Lexicon.SeedDeck`.
- Coverage: `T(d) = min(4 + |needed|, 0.4 × groundY / d.vy)`; drone lands at `y >= groundY − 2R`; forced spawn at most once per 0.25 s, ignoring spawn timer and target count.
- Suggestion: OSA Damerau-Levenshtein; `maxDist = 1` if attempt length ≤ 4 else 2; candidates `length ≥ minLength`, `|len − attemptLen| ≤ maxDist`; ties → earlier in valid list.
- Challenge score: `10 × length × multiplier`, halved (floor) if peeked. Peek/skip reveal: 2 s. Suggestion card: ~3 s.
- Settings: `mode` ∈ {`free`,`challenge`} default `free`; `lang` default `he`. Best keys: Free `spellDefense.best.<lang>.<level>` (unchanged), Challenge `spellDefense.best.challenge.<lang>.<level>`.
- Required viewports: 390×844, 844×390, 820×1180, 1180×820, 1440×900 (+ 360×740 for the suggestion card).

## Review Focus

1. Speed 10 on a short landscape phone in Challenge mode → sky must not flood with forced spawns and the word must stay buildable (tested in Task 4, coverage simulation at H=390).
2. Sound off or no Hebrew voice in Challenge mode → word shown written, no penalty, Peek hidden (tested in Task 5 via `canSpeak` stub + Task 6 Playwright with sound off).
3. Hebrew word whose only difference is a final vs non-final letter (e.g. plan `שלומ`) → must count as a match, never as a miss or a suggestion (tested in Tasks 1 and 2).
4. Challenge word with repeated letters (`apple`, `ללכת`) → coverage must keep two drones for a doubled letter (tested in Task 2 `needed`/`missing` and Task 4 simulation seeds including a doubled-letter word).
5. Tapping Peek/Skip/Speaker during a launch or while paused → ignored, no life lost (tested in Task 4).

---

### Task 1: Suggest module ("Did you mean")

**Files:**
- Create: `src/suggest.js` (global `Suggest`)
- Test: `tests/suggest.test.js`

**Interfaces:**
- Consumes: `Lexicon.normalize(word, lang)`.
- Produces:
  - `distance(a: string, b: string): number` — OSA Damerau-Levenshtein.
  - `buildIndex(validStr: string, lang): { byLen: Map<number, Array<{ w: string, rank: number }>> }` — normalized words, `rank` = position in the valid list.
  - `suggest(letters: string[], { lang, minLength, index }): string | null` — normalized suggestion.
  - `diff(attempt: string, word: string): { marks: Array<'same'|'wrong'>, missing: number[] }` — `marks.length === attempt.length`; `missing` = attempt indices before which a suggestion letter is absent (from the OSA backtrace; deletions from the attempt are `'wrong'`, insertions needed are `missing`).

- [ ] **Step 1: Write failing tests**
  - `distance('teh','the') === 1`; `distance('cat','cut') === 1`; `distance('kitten','sitting') === 3`; `distance('','ab') === 2`.
  - index from `'the cat cut act tea'` (en): `suggest(['t','e','h'], {lang:'en', minLength:2, index}) === 'the'`; `suggest(['x','y','z','q'], …) === null`; `suggest(['c','a'], {…, minLength:3})` never returns a 2-letter word.
  - tie → earlier word: index `'cat cut'`, attempt `['c','o','t']` (distance 1 to both) → `'cat'`.
  - `maxDist` rule: attempt `['c','a','t','x','y']` (len 5, maxDist 2) against index `'cat'` → `'cat'`; attempt `['c','x','y']` (len 3, maxDist 1) against `'cat'` → `null`.
  - Hebrew: `distance(Lexicon.normalize('שלום','he'), Lexicon.normalize('שלומ','he')) === 0`.
  - `diff('teh','the').marks` → `['same','wrong','wrong']`; `diff('ct','cat')` → marks `['same','same']`, `missing` `[1]`.
- [ ] **Step 2: Run to verify fail** — `node --test tests/suggest.test.js` → FAIL (module missing).
- [ ] **Step 3: Implement `src/suggest.js`.** OSA uses the standard DP matrix with the transposition case `d[i][j] = min(…, d[i-2][j-2] + 1)` when `a[i-1] === b[j-2] && a[i-2] === b[j-1]`; `diff` backtraces the same matrix.
- [ ] **Step 4: Run to verify pass** — `npm test` → all green.
- [ ] **Step 5: Commit** — `feat: suggest module (OSA distance, did-you-mean)`

---

### Task 2: Challenge module + challenge score

**Files:**
- Create: `src/challenge.js` (global `Challenge`)
- Modify: `src/rules.js` (add `challengeScore`)
- Test: `tests/challenge.test.js`, `tests/rules.test.js` (append)

**Interfaces:**
- Consumes: `Lexicon.normalize`, `Rules.LEVELS`.
- Produces:
  - `Challenge.CONFUSABLE: { [lang]: { [letter]: string[] } }` — built from the pair lists in spec §4.3, both directions, e.g. `en.b = ['d']`, `he['כ'] = ['ח','ב']`, `he['ח'] = ['כ','ה']`.
  - `needed(word: string, planLetters: string[]): string[]` — multiset difference, word order preserved.
  - `missing(needed: string[], drones: Array<{letter, y, vy, marked}>, { groundY, R }): string[]` — per spec §4.1 with `T(d) = min(4 + needed.length, 0.4 * groundY / d.vy)`; each reachable drone covers at most one needed letter.
  - `decoy(word: string, lang, rng): string` — spec §4.3.
  - `judge(letters: string[], word: string, lang): 'short'|'match'|'miss'` — `short` if `letters.length < word.length`; compare `Lexicon.normalize(letters.join(''), lang) === word`.
  - `Rules.challengeScore(length: number, level, peeked: boolean): number`.

- [ ] **Step 1: Write failing tests**
  - `needed('apple', ['p'])` → `['a','p','l','e']`; `needed('apple', ['x'])` → `['a','p','p','l','e']`.
  - `missing(['a','p','p'], drones, {groundY: 700, R: 30})` with drones: `a` at y 100 vy 50 (reachable), `p` at y 100 vy 50, `p` at y 600 vy 50 (fall left 0.8 s < T) → `['p']`; a marked `p` drone never covers.
  - T cap: needed of length 8, drone `a` at y −60 with vy 200, groundY 700 → full-fall 3.5 s, `0.4 × 700/200 = 1.4`; fall left `(700−60+60)/200 = 3.5 ≥ 1.4` → reachable, so `missing(['a',…], …)` excludes `a`.
  - `decoy('bat','en', rng)` over 200 rng draws only returns letters in `{b,a,t,d}`; Hebrew `decoy('כלב','he', rng)` only returns letters in `{כ,ל,ב,ח}` (plus `ב`'s confusable `כ`).
  - `judge(['c','a'],'cat','en') === 'short'`; `judge(['c','a','t'],'cat','en') === 'match'`; `judge(['c','u','t'],'cat','en') === 'miss'`; `judge(['ש','ל','ו','ם'], Lexicon.normalize('שלום','he'), 'he') === 'match'`.
  - `challengeScore(3,'easy',false) === 30`; `challengeScore(4,'medium',true) === 40`; `challengeScore(5,'hard',true) === 75`.
- [ ] **Step 2: Run to verify fail.**
- [ ] **Step 3: Implement `src/challenge.js` and `Rules.challengeScore`.**
- [ ] **Step 4: Run to verify pass** — `npm test`.
- [ ] **Step 5: Commit** — `feat: challenge module (coverage, decoys, judge) and challenge score`

---

### Task 3: Free-mode suggestion in the game core

**Files:**
- Modify: `src/game.js` (`launch`, setup)
- Test: `tests/game.test.js` (append)

**Interfaces:**
- Consumes: `Suggest.buildIndex`, `Suggest.suggest`, `Suggest.diff`, `Lexicon.display`.
- Produces: in Free mode, `onVerdict(verdict, displayWord, suggestion)` where `suggestion` is `null` unless `verdict === 'invalid'` and `Suggest.suggest` found a word; then `suggestion = { word: string /* display form */, marks, missing }` (from `Suggest.diff(normalizedAttempt, suggestionNormalized)`). Build the index once in `createGame` (Free mode only). A throw inside suggestion search is caught → `null`.

- [ ] **Step 1: Write failing tests** (use `make()` with `words: { valid: 'the cat act at ta', common: 'cat act' }`)
  - Force three drones' letters to `t,e,h`, mark, `launch() === 'invalid'`; `onVerdict` third arg deep-equals `{ word: 'THE', marks: ['same','wrong','wrong'], missing: [] }`; lives 4.
  - Plan `q,z` → `onVerdict` third arg `null`.
  - Valid launch → third arg `null`.
- [ ] **Step 2: Run to verify fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — `npm test` green.
- [ ] **Step 5: Commit** — `feat: did-you-mean suggestion on invalid launch`

---

### Task 4: Challenge mode in the game core + coverage simulation

**Files:**
- Modify: `src/game.js`
- Test: `tests/game.test.js` (append), create `tests/coverage.test.js`

**Interfaces:**
- Consumes: `Challenge.needed/missing/decoy/judge`, `Rules.challengeScore`, `Lexicon.SeedDeck`, `Lexicon.letterWeights`, `Lexicon.weightedPick`, `Lexicon.display`.
- Produces:
  - `createGame({ mode = 'free', … })`. In Challenge mode: `g.mode === 'challenge'`, `g.challenge = { word: string /* normalized */, peeked: boolean }`, `g.forcedSpawns` (count, for tests).
  - `peek(): boolean` — only when `phase === 'playing'`; sets `peeked`, emits `onReveal(displayWord, 2)`.
  - `skip(): boolean` — only when `phase === 'playing'`; `lives -= 1`, `onLives`, `onReveal(displayWord, 2)`, plan clears/unmarks, new challenge (`onChallenge`); at 0 lives → `over` + `onGameOver` (no new challenge).
  - `launch()` in Challenge mode returns `'short'|'match'|'miss'|'busy'`; `onVerdict(verdict, displayWord, null)`. `match` → same volley as Free `valid`; on volley end `points = Rules.challengeScore(len, level, peeked)`, `onWordDone(shown, points)`, then new challenge + `onChallenge`. `miss` → life lost, plan clears, same challenge, `onChallenge(displayWord)` re-emitted with the same word (UI re-speaks). `short` → nothing changes.
  - `onChallenge(displayWord)` fires on the first `update` of a Challenge game and on every new challenge.
  - Spawning in Challenge mode per spec §4.2 (forced spawn every ≥ 0.25 s when `Challenge.missing(...)` is non-empty; otherwise timer/target-count spawn with 50 % `Challenge.decoy`, 50 % weighted filler). Free mode spawning unchanged.
  - Calls to `peek`/`skip`/`launch` while paused or launching do nothing and cost nothing (Review Focus 5).

- [ ] **Step 1: Write failing tests** in `tests/game.test.js` (helper `makeChallenge(opts)` = `createGame({ mode:'challenge', lang:'en', level:'easy', words:{ valid:'cat act', common:'cat' }, … })`, so the challenge word is always `cat`):
  - first `update` emits `onChallenge('CAT')`; `g.challenge.word === 'cat'`.
  - after 300 × `update(0.05)`, letters `c`,`a`,`t` each have an unmarked drone.
  - mark `c,a` → `launch() === 'short'`; mark `c,a,t` → `'match'`, run to `playing` → `score === 30`, `onChallenge` emitted again.
  - `peek()` then match → `score === 15`.
  - mark `t,a,c` → `'miss'`, lives 4, `challenge.word` unchanged, plan empty.
  - `skip()` → lives 4, `onReveal('CAT', 2)`, `onChallenge` emitted.
  - during `launching` and while `paused`: `peek()`/`skip()` return false, lives unchanged.
- [ ] **Step 2: Write failing `tests/coverage.test.js`** — for seeds 1..20 × speeds {1, 10} × sizes {W 360 H 740 groundY 600 R 24, W 1440 H 900 groundY 800 R 40, W 844 H 390 groundY 300 R 24}, `lang 'en'`, `level 'hard'`, real word lists (`require('../words/en.js')`, `globalThis.WORDS.en`). Simulate 120 s at `dt = 1/60` with a player that every 1.5 s marks the reachable drone carrying the next needed letter (or, every 4th action, a wrong letter, then `undo()` on the next action) and launches when the plan is complete. Assert: after 2 s, no letter stays in `Challenge.missing(...)` longer than `0.25 × word.length + 0.05` s; `drones.length <= targetCount + 8` always; at least 1 challenge solved per run at speed 1.
- [ ] **Step 3: Run to verify fail.**
- [ ] **Step 4: Implement** in `src/game.js`. Keep Free-mode code paths untouched; branch on `mode` in `spawn`, `launch`, volley completion.
- [ ] **Step 5: Run** — `npm test` green (all old tests unchanged).
- [ ] **Step 6: Commit** — `feat: challenge mode in game core with letter coverage`

---

### Task 5: Settings, Hebrew default, Mode control, suggestion card, speech check

**Files:**
- Modify: `src/main.js`, `src/ui.js`, `src/audio.js`, `index.html`

**Interfaces:**
- Consumes: Task 3 `onVerdict(…, suggestion)`; Task 4 `mode` option (pass it through; the challenge card is Task 6).
- Produces:
  - `Sfx.canSpeak(lang): boolean` — true when `speechSynthesis` exists and `getVoices()` has a voice whose `lang` starts with `en`/`he`; listens to `voiceschanged`. For tests, `window.__forceNoVoice = true` makes it return false.
  - `settings.mode` (`'free'|'challenge'`, default `'free'`), default `lang: 'he'`; best keys per Global Constraints.
  - `UI.showSuggestion(suggestion, attemptDisplay)` — card for 3 s: Hebrew `התכוונת ל{word}?`, English `Did you mean {word}?`; attempt letters beneath with `marks === 'wrong'` in red and a red caret at each `missing` index; RTL-correct. Suggestion spoken via `Sfx.say` (lowercase for en).
  - Menu Mode segmented control above Level (en `Free` / `Challenge`, he `חופשי` / `אתגר`); changing mode while paused ends the game (same as language/level).
- [ ] **Step 1: Implement.**
- [ ] **Step 2: Unit tests + emoji grep** — `npm test` green; `perl -CSD -ne 'print "$ARGV:$.: $_" if /[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]/' index.html src/*.js` → no output.
- [ ] **Step 3: Playwright** (serve `python3 -m http.server 8765`; `window.__game` exposed): with cleared `localStorage`, first load shows Hebrew menu; saved `lang:'en'` loads English; Free mode invalid launch of a near-miss (find drones for a known misspelling or force letters via `__game`) shows the suggestion card at 360×740 in en and he — card fully on screen, red letters visible; Mode control visible and ≥ 40 px at all five viewports. Screenshots `.playwright-mcp/cm-t5-*.png`. No console errors.
- [ ] **Step 4: Commit** — `feat: mode setting, Hebrew default, did-you-mean card`

---

### Task 6: Challenge card UI, full browser verification, README

**Files:**
- Modify: `src/ui.js`, `src/main.js`, `index.html`, `README.md`

**Interfaces:**
- Consumes: Task 4 `onChallenge`, `onReveal`, `peek()`, `skip()`, `g.challenge`; Task 5 `Sfx.canSpeak`, `settings.mode`.
- Produces: challenge card per spec §3.2 — slots (one per letter, filled with display-form plan letters, extra letters not shown), Speaker / Peek (eye) / Skip SVG buttons ≥ 40 px; reveal shows the word in the slots for 2 s; written fallback when sound off or `!Sfx.canSpeak(lang)` (word always shown, Peek hidden, Speaker hidden when sound off); `onChallenge` → `Sfx.say(word)` (lowercase en); Launch enabled only when `plan.length === challenge.word.length`; miss toast en `Not quite!` / he `לא בדיוק!`; Skip label en `Skip` / he `דלג`. Card sits under the top bar and never overlaps it or the console; the sky loses no more than 72 px in portrait phone.
- [ ] **Step 1: Implement.**
- [ ] **Step 2: Unit tests + emoji grep** (commands as Task 5).
- [ ] **Step 3: Playwright matrix** — both modes × {en, he} at 390×844, 844×390, 820×1180, 1180×820, 1440×900: no horizontal scroll, top bar / challenge card / console don't overlap, menu fits, drones marked with real `page.mouse.click`, tap targets ≥ 40 px. In Challenge mode: solve a challenge (score > 0), miss one (life lost, word kept), peek (score halved on the next solve), skip (life lost, new word), and with sound off confirm the word is shown and Peek hidden; with `window.__forceNoVoice = true` and sound on, same fallback. Screenshots `.playwright-mcp/cm-t6-*.png`; a results table in the report. No console errors.
- [ ] **Step 4: README** — add a "Modes" section: Free (with "Did you mean") and Challenge (spoken word, Peek halves points, Skip costs a life, written fallback). Mention Hebrew default.
- [ ] **Step 5: Commit** — `feat: challenge card UI and docs`
