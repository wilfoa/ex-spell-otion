# AGENTS.md

Guidance for AI coding agents and new contributors.

## 1. Project summary

Spell Defense is a spelling tower-defence browser game for a young child (2nd grader). Drones carry letters down the screen; the player taps drones to mark letters in order, then launches missiles to destroy them and score. The UI is bilingual, English and Hebrew (RTL), with Hebrew as the default on first visit. There are two modes: Free (spell any real word) and Challenge (spell a word that is spoken to you).

## 2. Hard constraints

- **Classic `<script>` tags only.** No ES modules, no `fetch`, no build step. The game must run from `file://` and from the GitHub Pages subpath `/ex-spell-otion/`.
- **Relative paths only** (`src/game.js`, never `/src/game.js`).
- **No dependencies.** `package.json` has no `dependencies`; tests use Node's built-in runner.
- **No emojis anywhere in the UI.** Use inline SVG icons.
- **Pure units are DOM-free** and take an injected `rng` (a function returning `[0, 1)`), so tests are deterministic.
- **Module wrapper pattern** for every file in `src/` that Node tests load:

  ```js
  (function (root) {
    const Lexicon = (typeof module === 'object' && module.exports) ? require('./lexicon.js') : root.Lexicon;
    // ...
    const api = { /* ... */ };
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.Rules = api;
  })(typeof window !== 'undefined' ? window : globalThis);
  ```

- **Hebrew final letters are normalized** to their regular forms for storage and comparison, and re-applied only for display (`Lexicon.normalize` / `Lexicon.display`). The five pairs: ך to כ, ם to מ, ן to נ, ף to פ, ץ to צ.
- **RTL via CSS logical properties** (`margin-inline-start`, `inset-inline-end`, ...), not `left`/`right`.

## 3. Architecture map

`src/` (script load order in `index.html`, top to bottom):

1. `words/en.js`, `words/he.js` - generated word lists (`window.WORDS.<lang> = { valid, common }`, space-separated strings). `valid` is the accepted-word set, `common` the frequent subset used to seed letters and Challenge words.
2. `src/lexicon.js` - normalize/display, word sets, `SeedDeck` (non-repeating word draw), letter weights.
3. `src/rules.js` - `LEVELS`, `START_LIVES`, `Plan`, `judge`, `score`, `challengeScore`.
4. `src/spawner.js` - fall speed, spawn interval, target drone count.
5. `src/suggest.js` - "Did you mean" (OSA edit distance, `suggest`, `diff`).
6. `src/challenge.js` - Challenge word judge, letter coverage (`needed` / `missing`), decoy letters, confusable pairs.
7. `src/game.js` - the game core: drones, plan, missiles, lives, score, both modes. DOM-free, emits events via callbacks.
8. `src/render.js` - canvas drawing (sky, drones, missiles, effects).
9. `src/audio.js` - Web Audio sound effects and speech (`Sfx.say`, `Sfx.canSpeak`).
10. `src/ui.js` - i18n strings, menu, HUD, challenge card, toasts, console.
11. `src/main.js` - wiring: settings persistence (guarded `localStorage`), game loop, keyboard, `window.__game` test hook.

Other directories:

- `words/` - generated word lists (do not edit by hand).
- `tools/` - `build-words.mjs` (regenerates `words/`), `blocklist.txt`, `en-two-letter.txt` (allowed two-letter English words).
- `tests/` - `node --test` files: `lexicon`, `rules`, `spawner`, `suggest`, `challenge`, `coverage` (headless coverage-guarantee simulation), `game`, `words`.
- `docs/` - `screenshot.png`, design specs in `docs/superpowers/specs/`, plans in `docs/superpowers/plans/`.

## 4. Game rules in brief

- **Settings:** language (en / he, default he), mode (free / challenge, default free), level, speed 1 to 10, sound. Persisted in `localStorage` key `spellDefense.settings`. Best scores are kept per mode, language and level.
- **Levels:**

  | Level  | Min letters | Multiplier |
  |--------|-------------|------------|
  | Easy   | 2           | 1x         |
  | Medium | 4           | 2x         |
  | Hard   | 6           | 3x         |

- **Lives:** 5. A wrong launch or a Challenge skip costs one. At 0 the game is over.
- **Free mode:** mark drones in order, launch. A valid, unused word of at least the level minimum scores `10 x letters x multiplier`. Anything else costs a life. Nothing tells the player what to spell.
- **Did-you-mean (Free only):** on an invalid launch, the closest common-list word (blocklist already removed) within edit distance 1 (word up to 4 letters) or 2 is shown with the wrong letters marked.
- **Challenge mode:** a word from the common list (length min to min+2) is spoken. The player must spell exactly that word. A match scores `10 x letters x multiplier`, halved if the player peeked at the written word. A miss costs a life and the same word repeats. Skip costs a life. If sound is off or no voice exists for the language, the word is shown written and Peek is hidden.
- **Coverage rule (Challenge):** every letter still needed is guaranteed to be on a reachable drone. `T = min(4 + |needed|, 0.4 x groundY / vy)` seconds; forced spawns of a missing letter happen at most once every 0.25 s.
- **Keyboard:** Enter launches, Backspace undoes the last letter, Escape pauses.

Full details: `docs/superpowers/specs/2026-09-30-spell-defense-design.md` (base game) and `docs/superpowers/specs/2026-09-30-challenge-mode-design.md` (Challenge mode, coverage, did-you-mean).

## 5. Commands

```bash
npm test                          # node --test, all tests in tests/
npm run words                     # regenerate words/*.js from FrequencyWords (network needed)
python3 -m http.server 8765       # serve locally at http://localhost:8765/
```

Opening `index.html` directly also works.

## 6. Testing expectations

- Pure units are developed test-first (TDD) with seeded or stub `rng`. Keep `npm test` green before every commit.
- UI and rendering changes need a Playwright visual and responsive check at 390x844, 844x390, 820x1180, 1180x820, 1440x900, plus 360x740 for the narrowest phone, in both languages and both modes.
- `window.__game` exposes the running game for tests and probes. `window.__forceNoVoice = true` forces the written-word fallback in Challenge mode.

## 7. Deploy

GitHub Pages serves the repository root of `main` (`.nojekyll` is present). Develop on a feature branch and squash-merge into `main`. There is no build or CI step.

## 8. Conventions

- Commit messages use a conventional prefix: `feat:`, `fix:`, `docs:`, `test:`.
- Design specs go in `docs/superpowers/specs/`, implementation plans in `docs/superpowers/plans/`, named `YYYY-MM-DD-topic`.
- Do not describe or add features beyond the specs without updating the spec.
