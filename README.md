# Spell Defense

A bilingual (English/Hebrew) spelling tower-defence game for early readers. Drones carry letters down the sky; spell words to shoot them down.

![Spell Defense gameplay screenshot](docs/screenshot.png)

## Play Online

https://wilfoa.github.io/ex-spell-otion/

Works on phones, tablets and desktops. The game opens in Hebrew; switch to English in the menu.

## How to Play

Drones carry letters across the sky. Tap a drone to mark its letter; each marked drone gets a number showing its place in your word. When the word is ready, press **Launch** to fire missiles at the marked drones. If a marked drone reaches the ground before you launch, its letter drops out of your word.

Choose a **Mode** in the menu:

- **Free** (default): spell any real word that is at least as long as the level minimum. The game never tells you which word to spell. A correct word scores `10 x letters x level multiplier`. A non-word costs a life, and if a similar real word exists the game asks "Did you mean...?" and shows which letters were wrong.
- **Challenge**: the game says a word out loud and you spell exactly that word. The speaker button repeats it. **Peek** (eye button) shows the written word for 2 seconds but halves the points for that word. **Skip** costs a life and shows the answer. A wrong word costs a life and the same word is repeated. Every letter you need is always somewhere in the sky. If sound is off or the device has no voice for the language, the word is simply shown written.

You start with 5 lives. Best scores are saved separately for each mode, language and level.

## Levels

| Level  | Minimum letters | Points multiplier |
|--------|-----------------|-------------------|
| Easy   | 2+              | 1x                |
| Medium | 4+              | 2x                |
| Hard   | 6+              | 3x                |

In Challenge mode the word length is the level minimum up to two letters more.

## Controls

| Action | Control |
|--------|---------|
| Mark a letter | Tap or click a drone |
| Launch word | Enter, or the Launch button |
| Undo last letter | Backspace, or the Undo button |
| Pause | Escape, or the pause button |
| Speed (1 to 10) | The minus and plus buttons in the top bar, live during play |
| Sound on/off | The speaker button in the top bar, live during play |

Language, mode and level are chosen in the menu before a game starts.

## Run Locally

Open `index.html` in a browser. No install, server or build is needed.

## Develop

```bash
npm test        # run the unit tests (Node's built-in test runner)
npm run words   # regenerate the word lists in words/ (needs network)
```

Contributors and AI agents: see [AGENTS.md](AGENTS.md).

## Credits

Word lists are derived from [FrequencyWords](https://github.com/hermitdave/FrequencyWords) by Hermit Dave, used under [CC-BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
