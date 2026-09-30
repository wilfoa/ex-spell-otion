(function () {
  const canvas = document.getElementById('stage'), consoleEl = document.getElementById('console');
  const renderer = Render.create(canvas);

  // ---------- Persistence (every access guarded: storage may be unavailable) ----------
  const SETTINGS_KEY = 'spellDefense.settings';
  const bestKey = (mode, lang, level) => `spellDefense.best.${mode === 'challenge' ? 'challenge.' : ''}${lang}.${level}`;

  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* defaults still work */ }
  }

  function loadSettings() {
    let s = null;
    try { s = JSON.parse(read(SETTINGS_KEY)); } catch (e) { /* corrupt: use defaults */ }
    s = s && typeof s === 'object' ? s : {};
    return {
      lang: s.lang === 'en' ? 'en' : 'he',
      mode: s.mode === 'challenge' ? 'challenge' : 'free',
      level: Object.prototype.hasOwnProperty.call(Rules.LEVELS, s.level) ? s.level : 'easy',
      speed: Number.isInteger(s.speed) && s.speed >= 1 && s.speed <= 10 ? s.speed : 3,
      sound: s.sound !== false,
    };
  }

  let settings = loadSettings();
  const saveSettings = () => write(SETTINGS_KEY, JSON.stringify(settings));
  Sfx.enabled = settings.sound;

  // ---------- Game lifecycle ----------
  let game = null;
  const idle = { drones: [], missiles: [], plan: new Rules.Plan(), cannon: { x: 0, y: 0 } };

  function metrics() {
    const W = window.innerWidth, H = window.innerHeight;
    return {
      W, H,
      groundY: H - consoleEl.offsetHeight,
      R: Math.max(24, Math.min(40, W / 24)),
      dpr: Math.min(window.devicePixelRatio || 1, 2),
    };
  }

  function layout() {
    const m = metrics();
    renderer.resize(m.W, m.H, m.groundY, m.R, m.dpr);
    if (game) game.resize(m.W, m.H, m.groundY, m.R);
    idle.cannon = { x: m.W / 2, y: m.groundY - 30 };
  }

  const refresh = () => UI.update(game, settings);
  const wordsFor = (lang) => window.WORDS && window.WORDS[lang];
  const checkWords = () => UI.error(wordsFor(settings.lang) ? '' : UI.I18N[settings.lang].wordsMissing);

  // Word speech only when a voice exists: otherwise the card shows the word written (spec 3.2).
  function speak(word) {
    if (Sfx.canSpeak(game.lang)) Sfx.say(game.lang === 'en' ? word.toLowerCase() : word, game.lang);
  }
  const challengeWord = () => Lexicon.display([...game.challenge.word], game.lang).join('');

  function makeHooks() {
    const R = () => game.R;
    return {
      onMark() { Sfx.mark(); refresh(); },
      onUnmark: refresh,
      onLand(d, removedIndex) {
        renderer.explode(d.x, d.y + 0.9 * R(), d.hue);
        renderer.shake(3);
        Sfx.boom();
        if (removedIndex >= 0) { refresh(); UI.flashPlanLoss(removedIndex); }
      },
      onFire(m) {
        renderer.muzzle(Math.atan2(m.vy, m.vx));
        Sfx.whoosh();
        refresh();
      },
      onHit(d, i) {
        renderer.explode(d.x, d.y + 0.6 * R(), d.hue);
        renderer.shake(5);
        Sfx.boom();
        UI.markHit(i);
      },
      onVerdict(verdict, shown, suggestion) {
        if (verdict === 'miss') {
          Sfx.fail();
          renderer.shake(12);
          UI.toast('notQuite', 'bad');
          return;
        }
        if (verdict !== 'invalid') return;
        Sfx.fail();
        renderer.shake(12);
        if (!suggestion) { UI.toast('notWord', 'bad'); return; }
        UI.showSuggestion(suggestion, shown);
        speak(suggestion.word);
      },
      onWordDone(word, points) {
        renderer.confetti();
        Sfx.success();
        speak(word);
        refresh();
        UI.toast('great', 'good', points);
      },
      onLives: refresh,
      // New challenge, or the same word again after a miss.
      onChallenge(word) { speak(word); refresh(); },
      onReveal: UI.showReveal,
      onGameOver(score) {
        const over = game, key = bestKey(over.mode, over.lang, over.level);
        const prevBest = Number(read(key)) || 0;
        const isRecord = score > prevBest;
        if (isRecord) write(key, String(score));
        refresh();
        // Let the last explosion and toast play before the overlay covers the scene.
        setTimeout(() => { if (game === over) UI.showGameOver(score, Math.max(score, prevBest), isRecord); }, 1100);
      },
    };
  }

  function startGame() {
    const words = wordsFor(settings.lang);
    if (!words) { checkWords(); UI.showMenu({ canContinue: false }); return; }
    const m = metrics();
    game = Game.createGame({
      mode: settings.mode, lang: settings.lang, level: settings.level, speed: settings.speed, words,
      W: m.W, H: m.H, groundY: m.groundY, R: m.R,
      hooks: makeHooks(),
    });
    window.__game = game;
    refresh();
  }

  const running = () => game && (game.phase === 'playing' || game.phase === 'launching');

  function pause() {
    if (!running()) return;
    game.pause();
    refresh();
    UI.showMenu({ canContinue: true });
  }

  // launch() clears the plan after onVerdict fires, so refresh once it returns.
  function launch() {
    if (!game || game.phase !== 'playing') return;
    // Challenge: Enter must obey the same gate as the Launch button.
    if (game.challenge && game.plan.length !== game.challenge.word.length) return;
    const verdict = game.launch();
    refresh();
    if (verdict === 'tooShort') UI.toast('needLetters', 'warn', Rules.LEVELS[game.level].minLength);
    else if (verdict === 'used') UI.toast('used', 'warn');
  }

  UI.init({
    onStart: startGame,
    onResume() { if (game) game.resume(); refresh(); },
    onPause: pause,
    onUndo() { if (game) game.undo(); },
    onClear() { if (game) game.clear(); },
    onLaunch: launch,
    onSay() {
      if (!game || !game.challenge) return;
      try { window.speechSynthesis.cancel(); } catch (e) { /* optional */ } // repeated taps must not queue
      speak(challengeWord());
    },
    onPeek() { if (game) game.peek(); },
    onSkip() {
      if (!game || !game.challenge || game.phase !== 'playing') return;
      speak(challengeWord()); // before skip(), so the next word is spoken after it
      game.skip();
      refresh(); // skip() drops the plan after its onLives refresh
    },
    onSpeed(n) {
      settings = { ...settings, speed: n };
      saveSettings();
      if (game) game.setSpeed(n);
      refresh();
    },
    onSound(on) {
      settings = { ...settings, sound: on };
      saveSettings();
      Sfx.enabled = on;
      if (!on) try { window.speechSynthesis.cancel(); } catch (e) { /* optional */ }
      refresh();
    },
    onSettingsChanged(next) {
      // Changing language, mode or level ends the paused game (spec 2.5).
      if (game && ['lang', 'mode', 'level'].some((k) => next[k] !== settings[k])) { game = null; window.__game = null; }
      settings = next;
      saveSettings();
      refresh();
      checkWords();
      UI.showMenu({ canContinue: false });
    },
  });

  layout();
  refresh();
  checkWords();
  UI.showMenu({ canContinue: false });

  // The first gesture unlocks WebAudio (iOS only honours some gesture types, so listen to all of them).
  ['pointerdown', 'pointerup', 'click', 'keydown'].forEach((type) => window.addEventListener(type, () => Sfx.unlock(), true));

  canvas.addEventListener('pointerdown', (e) => {
    if (!game || e.button > 0) return;
    const d = game.droneAt(e.clientX, e.clientY);
    if (d) game.mark(d.id);
  });

  window.addEventListener('resize', layout);
  // Voices load late on some browsers: re-check the challenge card's written fallback when they arrive.
  try { window.speechSynthesis.addEventListener('voiceschanged', refresh); } catch (e) { /* no speech: fallback stays */ }

  // Hidden tab pauses behind the menu; the player resumes with Continue.
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (game) game.update(dt);
    renderer.draw(game || idle, dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
