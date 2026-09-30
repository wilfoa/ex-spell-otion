# Spell Defense — Challenge Mode, "Did you mean", Hebrew default

Date: 2026-09-30
Status: Approved (brainstorming session)
Builds on: `docs/superpowers/specs/2026-09-30-spell-defense-design.md` (the "base spec"). Everything not changed here stays as the base spec says.

## 1. Purpose

Three additions for the same player (a 2nd grader):

1. **Challenge mode** — a spelling test: the game says a word aloud, the player spells it by marking drones in order and launching. The game guarantees the challenge's letters are always reachable in the sky.
2. **"Did you mean…?"** — in Free mode, a launched non-word shows the closest real word and highlights the letters that differ.
3. **Hebrew by default** on first visit.

Success criteria:
- A challenge word can always be completed: at every moment of play, each letter still needed has a reachable drone, at every speed (1–10) and viewport (≥ 360 px wide).
- A child who cannot hear the word (sound off, or no voice for the language) is never stuck: the word is shown written, without penalty.
- A misspelled Free-mode launch like `teh` shows "Did you mean THE?" with the wrong letters marked.
- First visit with no saved settings opens in Hebrew; a saved language still wins.
- Existing Free-mode behaviour, tests (40) and best scores are unchanged except where this spec says.

## 2. Modes and settings

- New setting `mode`: `'free'` (default) or `'challenge'`. Persisted with the other settings in `spellDefense.settings`; invalid/missing → `'free'`.
- Menu gains a **Mode** segmented control (Free / Challenge; Hebrew: חופשי / אתגר) above Level. Changing mode while a game is paused ends that game (same rule as language/level, base spec §2.5).
- Default `lang` when no valid saved value: `'he'` (was `'en'`).
- Best-score keys: Free keeps `spellDefense.best.<lang>.<level>` (no migration); Challenge uses `spellDefense.best.challenge.<lang>.<level>`.
- Levels, lives (5), speed, sound, pause, keyboard shortcuts: unchanged, apply to both modes.

## 3. Challenge mode rules

### 3.1 Challenge word
- Drawn from the language's **common** list via the existing `SeedDeck` for the level (length `minLength … minLength + 2`: Easy 2–4, Medium 4–6, Hard 6–8), which already excludes blocklisted words and does not repeat until exhausted.
- Stored normalized (lowercase / Hebrew non-final letters); displayed with `Lexicon.display`.

### 3.2 Challenge card
Under the top bar, centered, always visible during a challenge game:
- One empty slot per letter of the challenge word. Slots fill with the planned letters (display form) as the player marks drones; they do **not** show correctness. If the plan is longer than the word, extra letters are not shown in the card (the console plan strip still shows them).
- **Speaker** button: speaks the word (`Sfx.say`). The word is also spoken automatically when a challenge starts and after every miss.
- **Peek** button (eye icon): shows the written word in the slots for 2 s. The first peek on a word sets `peeked = true` for that word (points halved); further peeks on the same word cost nothing more.
- **Skip** button: costs one life, shows the correct spelling in the slots for 2 s (and speaks it), then starts a new challenge. At 0 lives → game over.
- **Written fallback:** if sound is off or `Sfx.canSpeak(lang)` is false, the word is shown written in the slots permanently and Peek is hidden; no penalty. Speaker is hidden when sound is off.
- All three buttons are ≥ 40 px tap targets with inline SVG icons; no emojis.

### 3.3 Launch in Challenge mode
- Launch is enabled only when `phase === 'playing'` and `plan.length === challenge.word.length`.
- `judge`: `match` if `normalize(plan)` equals the challenge word, else `miss`.
- **match**: missiles fire exactly as in Free mode. After the volley: score += `challengeScore = 10 × length × multiplier`, halved (rounded down) if `peeked`; `onWordDone`; new challenge (spoken).
- **miss**: lose a life, buzzer, shake, "Not quite!" toast, plan clears, same challenge stays, word spoken again. At 0 lives → game over.
- The Free-mode "used words" rule does not apply in Challenge mode.
- Marked drone landing, launch sequence, pause: as base spec.

## 4. Letter coverage in Challenge mode

### 4.1 Definitions
- **needed** = multiset of the challenge word's letters minus the multiset of letters currently in the plan (marked drones). Plan letters that are not in the word do not reduce anything.
- **fall time left** for a drone = `(groundY − 2R − d.y) / d.vy` seconds.
- **T(d)** = `min(4 + 1 × |needed|, 0.6 × groundY / d.vy)` seconds — capped at 60 % of the drone's full fall time (spawn at `-2R` to landing at `groundY − 2R` is `groundY` px), so a freshly spawned drone always counts as reachable even at speed 10 on a short screen.
- A drone is **reachable** if it is unmarked and its fall time left ≥ T(d).
- **missing** = needed minus the multiset of letters on reachable drones.

### 4.2 Spawning
Each game update in Challenge mode, before the normal spawn:
- If `missing` is non-empty and at least 0.25 s have passed since the last forced spawn: spawn one drone immediately carrying one missing letter (ignoring the spawn timer and the target count), then reset the spawn timer. At most one forced spawn per 0.25 s. Forced spawns are bounded because `|missing| ≤ |needed| ≤ 8`; normal spawns stay suppressed while the drone count is at or above the target count, so the sky never exceeds `targetCount + 8`.
- Otherwise, the normal timer/target-count spawn applies, and its letter is chosen: 50 % **decoy** (see 4.3), 50 % weighted random filler (`Lexicon.letterWeights` of the common list).
- The Free-mode `LetterQueue` is not used in Challenge mode.

### 4.3 Decoys
`decoy(word, lang, rng)`: with probability 0.5 a random letter of the word; otherwise a confusable of a random letter of the word if one exists (else a letter of the word).
Confusable pairs (both directions):
- en: b–d, p–q, m–n, u–v, i–l
- he: ס–ש, ח–כ, ב–כ, ט–ת, ד–ר, ו–ז, ה–ח

### 4.4 Guarantee
Property: in a simulated Challenge game (any seed, speed 1 and 10, W = 360 and 1440, H = 740, updates of 1/60 s), after an initial 2 s warm-up, no letter stays in `missing` for longer than `0.25 × challenge.word.length + 0.05` s of simulated time (one forced spawn per 0.25 s), and the drone count never exceeds `targetCount + 8`. Tested headlessly (§8).

## 5. "Did you mean…?" (Free mode only)

- Triggered when a Free-mode launch is judged `invalid`.
- Distance: optimal-string-alignment Damerau-Levenshtein (insert, delete, substitute, adjacent transposition, each cost 1), on normalized words.
- Candidates: valid-list words with `length ≥ minLength` and `|len − attemptLen| ≤ maxDist`. `maxDist = 1` if `attemptLen ≤ 4`, else `2`.
- Choose the candidate with the smallest distance; ties broken by frequency rank (earlier in the valid list = more common). Distance 0 is impossible (the attempt was invalid).
- If no candidate within `maxDist`: no suggestion.
- UI: the usual life loss, buzzer and shake still happen. Instead of "Not a word!", a card shows for ~3 s: "Did you mean **CAT**?" (Hebrew: "התכוונת ל**חתול**?") with the player's attempt beneath, letters that differ from the suggestion in red. The suggestion is spoken (if sound on). No suggestion → the existing "Not a word!" toast.
- `diff(attempt, suggestion)` returns, for each attempt letter, `'same' | 'wrong'`, from the OSA alignment backtrace (substituted/transposed/inserted letters are `'wrong'`); if the suggestion is longer, the missing positions are reported as `missing` indices so the card can show a red caret between letters.
- Performance: an index by word length built once per game; lookup ≤ 20 ms on a phone.

## 6. Architecture

New pure modules (DOM-free, `rng` injected, same wrapper pattern as `lexicon.js`, Node-tested):

```
src/suggest.js    Suggest.distance(a, b) -> number
                  Suggest.buildIndex(validStr, lang) -> index
                  Suggest.suggest(letters, { lang, minLength, index }) -> string|null   (normalized)
                  Suggest.diff(attempt, word) -> { marks: ('same'|'wrong')[], missing: number[] }
src/challenge.js  Challenge.needed(word, planLetters) -> string[]
                  Challenge.missing(needed, drones, { groundY, R }) -> string[]
                  Challenge.decoy(word, lang, rng) -> string
                  Challenge.judge(letters, word, lang) -> 'short'|'match'|'miss'
                  Challenge.CONFUSABLE
```

Changes:
- `src/rules.js`: `challengeScore(length, level, peeked) -> number`.
- `src/game.js`: `createGame({ mode = 'free', ... })`. Challenge state `g.challenge = { word, peeked }` (null in Free). New methods `peek()`, `skip()`. New hooks `onChallenge(displayWord)` (new challenge started), `onReveal(displayWord, seconds)` (peek/skip reveal). `onVerdict(verdict, displayWord, suggestion)` where `suggestion = { word: displayWord, marks, missing } | null` for Free-mode invalid; verdicts in Challenge mode are `'short'|'match'|'miss'|'busy'`. Coverage spawning per §4.
- `src/audio.js`: `Sfx.canSpeak(lang) -> boolean` (true when `speechSynthesis` exists and a voice whose `lang` starts with `en`/`he` is available; re-checked on `voiceschanged`).
- `src/main.js`: `settings.mode`; default `lang: 'he'`; best keys per §2; wires new hooks; passes `mode` to `createGame`.
- `src/ui.js` + `index.html`: Mode control; challenge card (slots, speaker, peek, skip); "Did you mean" card; new I18N strings (en + he); SVG icons speaker/eye/skip; layout at all five required viewports.
- Script order in `index.html`: `words/*, lexicon, rules, spawner, suggest, challenge, game, render, audio, ui, main`.

## 7. Error handling

- Speech unavailable / sound off → written fallback (§3.2).
- Peek/skip/launch while `phase !== 'playing'` → ignored.
- Challenge deck cannot be built (no common words in range) → menu error, Start disabled (same path as missing word lists).
- Suggestion search throws → treated as no suggestion.

## 8. Testing

- `node --test` stays green (existing 40 + new).
- `tests/suggest.test.js`: `distance('teh','the') === 1` (transposition); `distance('cat','cut') === 1`; `distance('kitten','sitting') === 3`; `suggest` returns `the` for `teh`; `null` for a far attempt; respects `minLength`; tie → more common word; Hebrew finals (`שלומ` vs `שלום`) normalize to distance 0 so a final-letter-only difference is never suggested as a correction; `diff('teh','the')` marks positions 1–2 wrong.
- `tests/challenge.test.js`: `needed` with repeated letters (`apple` minus plan `['p']` → `a,p,l,e`); non-word plan letters don't reduce needed; `missing` ignores marked and low drones (fall time < T); `decoy` only returns word letters or their confusables; `judge` short/match/miss incl. Hebrew finals.
- `tests/game.test.js` additions: challenge mode starts with a challenge and emits `onChallenge`; match scores `10 × len × mult`; peek halves; miss costs a life and keeps the word; skip costs a life and changes the word; launch disabled (returns `'short'`) until plan length equals word length; Free-mode invalid launch emits a suggestion for `teh`-like plans.
- `tests/coverage.test.js`: the §4.4 property over ≥ 20 seeds × speeds {1, 10} × widths {360, 1440}, with a simulated player who marks a correct letter every 1.5 s and a wrong letter every 4th action, 120 s each.
- Playwright (local, then the live site after deploy): Free and Challenge, en and he, at 390×844, 844×390, 820×1180, 1180×820, 1440×900 — no horizontal scroll, top bar / challenge card / console don't overlap, menu fits, drones tappable with real clicks, tap targets ≥ 40 px; solve a challenge, miss one, peek, skip; "Did you mean" card at 360×740 in en and he; first load with empty storage shows Hebrew; no console errors.

## 9. Out of scope

Per-letter instant feedback, timed challenges, fixed-length rounds, pictures for challenge words, custom word lists, suggestions in Challenge mode.
