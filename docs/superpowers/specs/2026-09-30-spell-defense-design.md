# Spell Defense — Design Spec

Date: 2026-09-30
Status: Approved (brainstorming session)

## 1. Purpose

A browser spelling game for a 2nd grader. Tower-defence framing: drones carrying letters descend toward a city; the player builds a word by choosing which drones to strike and in what order, then launches missiles. The game never tells the player which word to spell — any real word of sufficient length counts. Bilingual: English and Hebrew, with the entire UI switching language and direction.

Success criteria:
- A child can play a full game (start → several words → game over) without adult help.
- A valid word is always buildable from what is on screen, at every level and speed.
- Real words the child spells are accepted (no "not a word" for common words); non-words cost a life.
- Runs by double-clicking `index.html` — no server, no install, no network at runtime.
- No emojis anywhere in the UI; all icons are custom inline SVG.

## 2. Game rules

### 2.1 Settings

| Setting | Values | Where changeable |
|---|---|---|
| Language | English, Hebrew | Menu (setup / pause). Changing starts a new game. |
| Level | Easy, Medium, Hard | Menu (setup / pause). Changing starts a new game. |
| Drone speed | 1–10, default 3 | Menu **and** in-game top bar; applies live. |
| Sound | on / off, default on | Menu **and** in-game top bar; applies live. |

All four persist in `localStorage` (wrapped in try/catch; defaults if unavailable).

| Level | Minimum word length | Score multiplier | Target drones on screen |
|---|---|---|---|
| Easy | 2 | ×1 | 6 |
| Medium | 4 | ×2 | 8 |
| Hard | 6 | ×3 | 10 |

Target drone count is reduced on narrow screens: `min(levelTarget, floor(viewportWidth / (droneWidth * 1.4)))`, minimum 4.

### 2.2 Lives and game over

- Start with 5 lives.
- Lose one life per launched non-word.
- At 0 lives: game over screen shows the final score and the best score for this language + level (persisted); "new record" message if beaten. Buttons: Play again, Menu.

### 2.3 Marking (the strike plan)

- Tapping an unmarked drone marks it: its letter is appended to the plan; the drone shows a pulsing target ring and a numbered badge (1, 2, 3, …) matching its plan position.
- A drone can be in the plan once. Tapping an already-marked drone does nothing.
- **Undo** removes the last mark. **Clear** removes all marks.
- Marked drones keep their normal speed.
- If a marked drone reaches the ground, it explodes, its letter is removed from the plan, later letters shift to close the gap (badges renumber), and the plan strip flashes red at that position.
- Unmarked drones that reach the ground explode with no penalty.
- Hit area is generous: a tap within 1.35 × drone radius of the drone+card centre counts; if several drones qualify, the one closest to the tap wins.

### 2.4 Launch

- **Launch** is disabled (shows a lock icon) while `plan.length < minLength`. Too-short words therefore never cost a life.
- On Launch, the plan's word is normalized (§3.4) and judged:
  - **valid** (in the valid set, not used this game): missiles fire from the cannon, one per marked drone, in plan order, staggered 0.2 s. Each missile homes on the drone's live position. On each hit, the drone explodes and its plan tile turns green. After the final hit: word spoken aloud, confetti, chime, score += `10 × length × levelMultiplier`, word added to the used set. Plan clears.
    - If a marked drone lands while missiles are in flight, it still counts (the word was already accepted); its missile retargets to the explosion point.
    - During a launch sequence, marking and Launch are disabled until the last missile resolves.
  - **used** (valid but already scored this game): "Already used!" message, no points, no life lost, plan clears.
  - **invalid**: lose a life, buzzer, screen shake, "Not a word!" message, plan clears. Drones keep flying.

### 2.5 Pause / menu

- Pause button freezes the simulation and opens the menu, with **Continue** (hidden when no game is running) and **New game**.
- Changing language or level in the menu while a game is paused ends that game (Continue is hidden; the primary button reads "New game").
- Keyboard: Enter = Launch, Backspace = Undo, Escape = Pause.

## 3. Word data and letter generation

### 3.1 Sources

`tools/build-words.mjs` (Node ≥ 18, run once by a developer; output is committed):
- Downloads FrequencyWords (hermitdave, CC-BY-SA 4.0) `content/2018/en/en_50k.txt` and `content/2018/he/he_50k.txt` from `raw.githubusercontent.com/hermitdave/FrequencyWords/master/`.
- Filters: English `^[a-z]{2,}$` after lowercasing; Hebrew `^[א-ת]{2,}$` (letters only, no niqqud/geresh/punctuation). Keeps frequency order, deduplicates after normalization.
- **valid** = first 30,000 filtered words. **common** = first 3,000 filtered words minus the blocklist.
- Blocklist lives in `tools/blocklist.txt` (one word per line; profanity, slurs, sexual and violent terms in both languages). Blocked words are removed from **common** only.
- Writes `words/en.js` and `words/he.js`:
  `window.WORDS = window.WORDS || {}; window.WORDS.en = { valid: "<space-separated>", common: "<space-separated>" };`
- The menu shows a small credit line: "Word lists: FrequencyWords by Hermit Dave, CC-BY-SA 4.0".

### 3.2 Seed words

A seed word is a hidden word from **common** with `minLength ≤ length ≤ minLength + 2` (Easy 2–4, Medium 4–6, Hard 6–8). Seeds are drawn without repetition (shuffled deck per language+level; reshuffle when exhausted). Seed words are never displayed.

### 3.3 Spawn queue

- The spawner keeps a queue of letters. When the queue has fewer than 3 letters, it appends one **batch**: the letters of a new seed word plus 1–3 filler letters, shuffled together.
- Filler letters are drawn weighted by letter frequency, computed from the **common** list at load.
- Letters are stored in normalized form (§3.4); Hebrew drones only ever carry non-final letters.
- **Spawn interval** = `fallTime(speed) / targetDroneCount`, where `fallTime` is the time a drone takes to go from spawn height to the ground at the current speed. With a steady on-screen count, a seed's letters (≤ 8) share the screen.
- Only spawn when the current drone count is below the target count.
- Spawn x-position: up to 12 random attempts to avoid being within 2.6 drone radii horizontally of any drone in the top 4 radii of the screen.

### 3.4 Normalization and judging

- `normalize(word)`: English → lowercase. Hebrew → map finals to regular (ך→כ, ם→מ, ן→נ, ף→פ, ץ→צ).
- `display(letters, lang)`: English → uppercase. Hebrew → final form applied to the last letter if the plan has ≥ 2 letters.
- `judge(letters)`: `tooShort` if `length < minLength`; else `used` if in used set; else `valid` if `normalize(word)` is in the valid set (valid set is built from normalized entries); else `invalid`.

### 3.5 Drone speed

- Fall speed in px/s = `(8 + 9 × speed) × (viewportHeight / 800) × jitter`, jitter ∈ [0.85, 1.15] fixed per drone.
- On speed change, every drone eases its velocity toward the new value over ~0.5 s. The spawn interval updates immediately.

## 4. Architecture

No build step, no modules (classic `<script>` tags, so `file://` works).

```
index.html            markup, CSS, script tags (words → src/*)
words/en.js, he.js    generated word data (committed)
src/lexicon.js        normalize, display, buildValidSet, letterWeights, SeedDeck
src/spawner.js        Spawner: queue, batches, spawnInterval, pickX
src/rules.js          Plan (mark/undo/clear/removeDrone), judge, score
src/audio.js          WebAudio sound effects + speechSynthesis
src/render.js         canvas: background, drones, cannon, missiles, particles
src/ui.js             DOM: top bar, plan strip, menus, i18n tables, SVG icons, input
src/game.js           state, main loop, entity updates, wires everything
tools/build-words.mjs word list generator
tools/blocklist.txt   seed blocklist
tests/*.test.js       node:test suites for lexicon, spawner, rules
```

Module pattern for pure units (`lexicon`, `spawner`, `rules`):

```js
(function (root) {
  const api = { /* ... */ };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Lexicon = api;
})(typeof window !== 'undefined' ? window : globalThis);
```

Pure units take randomness as a `rng` function argument (default `Math.random`) so tests are deterministic. They do not touch DOM, canvas, audio, or `localStorage`.

Dependencies: `game` → `lexicon`, `spawner`, `rules`, `render`, `ui`, `audio`. `render` and `ui` read game state; they never mutate rules state. `ui` forwards input to `game` methods (`mark(drone)`, `undo()`, `clear()`, `launch()`, `setSpeed(n)`, `setSound(b)`, `pause()`, `resume()`, `newGame()`).

## 5. Presentation

### 5.1 Visuals

- Cartoon dusk world. Background prerendered to an offscreen canvas on resize: sky gradient, stars, moon with glow, two mountain layers, city skyline with lit windows, ground band. Clouds drift per frame.
- Drone: quadcopter body in its own hue, two spinning rotors, blinking light; letter on a hanging rounded card (Fredoka font, loaded from Google Fonts with Rubik as fallback; system sans as final fallback).
- Marked drone: pulsing red target ring and a numbered badge on the card.
- Cannon: turret bottom-centre that rotates toward each missile's target, with recoil and muzzle flash.
- Missile: small drawn rocket with a smoke trail, curved homing flight, explosion (flash ring, particles, small screen shake).
- Plan strip (bottom console): letter tiles pop in on mark, turn green on hit, flash red on loss. Launch button prominent, with lock icon when disabled.
- Icons: inline SVG, one consistent rounded thick-stroke style: heart (full/empty), turtle, rocket, speaker on/off, pause, undo, clear, lock.
- Responsive from 360 px phones to desktop. Drone radius `clamp(24, W/24, 40)` CSS px. Canvas uses devicePixelRatio (capped at 2).

### 5.2 Top bar (in game)

Lives (5 SVG hearts) · Score · Speed control (turtle, −, value, +, rocket) · Sound toggle · Pause. On viewports < 600 px, the speed control collapses to a chip (turtle + value) that opens a popover with a slider. Top-bar and console elements are DOM above the canvas, so taps on them never mark drones.

### 5.3 Audio

Synthesized with WebAudio (no files): mark blip, missile whoosh, explosion, success chime (rising arpeggio), failure buzz. Valid word is spoken via `speechSynthesis` (`en-US` / `he-IL`, rate 0.85). Sound off mutes all of it. The AudioContext is created/resumed on the first user gesture.

### 5.4 Language

- All UI strings come from `I18N.en` / `I18N.he` tables in `ui.js`.
- Hebrew sets `<html lang="he" dir="rtl">`; top bar, console, menus mirror via CSS logical properties; plan strip fills right-to-left. The canvas scene is not mirrored.

## 6. Error handling

- `localStorage` unavailable → defaults, game still works.
- `speechSynthesis` missing or throws → skipped silently.
- `window.WORDS.<lang>` missing at start → menu shows an error message instead of starting.
- `dt` clamped to 50 ms per frame (tab switches don't teleport drones).
- Game auto-pauses when the tab is hidden (`visibilitychange`).

## 7. Testing

- `node --test tests/` — no dependencies.
  - lexicon: normalize/display round-trips for all five Hebrew finals; English case; valid-set lookup with final letters; SeedDeck length bounds per level and no repeats before exhaustion; letter weights sum to 1.
  - spawner: a batch contains every letter of its seed (multiset) plus 1–3 fillers; all letters in a batch are queued before the next batch; spawn interval × target count = fall time across speeds 1–10; Hebrew queue never contains final letters.
  - rules: mark/undo/clear; mark same drone twice is a no-op; removing a marked drone closes the gap and returns the removed index; judge returns tooShort/used/valid/invalid correctly; score formula.
- Visual check: Playwright screenshots of menu, in-game, marked drones, launch sequence, game over — in both English and Hebrew, at 1200×800 and 390×844.

## 8. Out of scope

Levels that ramp during play, multiplayer, accounts, leaderboards, custom word lists, mobile app packaging, niqqud.
