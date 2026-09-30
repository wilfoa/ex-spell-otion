(function (root) {
  const Rules = root.Rules;

  const I18N = {
    en: {
      title: 'Spell Defense',
      howto: 'Tap the drones to spell a word, then press Launch!',
      logoLetter: 'A',
      language: 'Language',
      level: 'Level',
      easy: 'Easy',
      medium: 'Medium',
      hard: 'Hard',
      letters: '{n}+ letters',
      speed: 'Speed',
      slower: 'Slower',
      faster: 'Faster',
      sound: 'Sound',
      pause: 'Pause',
      continue: 'Continue',
      start: 'Start',
      newGame: 'New game',
      credit: 'Word lists: FrequencyWords by Hermit Dave, CC-BY-SA\u00a04.0',
      score: 'Score',
      lives: '{n} lives left',
      undo: 'Undo',
      clear: 'Clear',
      launch: 'Launch',
      planHint: 'Tap the drones to spell a word',
      great: 'Great!',
      notWord: 'Not a word!',
      used: 'Already used!',
      needLetters: 'Need {n}+ letters',
      gameOver: 'Game over',
      best: 'Best',
      newRecord: 'New record!',
      playAgain: 'Play again',
      menu: 'Menu',
      wordsMissing: 'The English word list (words/en.js) is missing, so the game cannot start.',
    },
    he: {
      title: 'הגנת המילים',
      howto: 'הקישו על הרחפנים כדי לבנות מילה, ואז לחצו על שיגור!',
      logoLetter: 'א',
      language: 'שפה',
      level: 'רמה',
      easy: 'קל',
      medium: 'בינוני',
      hard: 'קשה',
      letters: '{n} אותיות ומעלה',
      speed: 'מהירות',
      slower: 'לאט יותר',
      faster: 'מהר יותר',
      sound: 'צלילים',
      pause: 'השהיה',
      continue: 'המשך',
      start: 'התחילו',
      newGame: 'משחק חדש',
      credit: 'רשימות מילים: FrequencyWords מאת Hermit Dave, CC-BY-SA\u00a04.0',
      score: 'נקודות',
      lives: 'נשארו {n} חיים',
      undo: 'בטל',
      clear: 'נקה',
      launch: 'שיגור',
      planHint: 'הקישו על הרחפנים כדי לבנות מילה',
      great: 'כל הכבוד!',
      notWord: 'זו לא מילה!',
      used: 'המילה כבר הייתה!',
      needLetters: 'צריך לפחות {n} אותיות',
      gameOver: 'המשחק נגמר',
      best: 'שיא',
      newRecord: 'שיא חדש!',
      playAgain: 'שחקו שוב',
      menu: 'תפריט',
      wordsMissing: 'רשימת המילים בעברית (words/he.js) חסרה, ולכן אי אפשר להתחיל.',
    },
  };

  const svg = (body) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  const HEART = 'M12 20.3S3.6 15.4 3 9.6C2.6 6.3 4.8 4 7.5 4c1.9 0 3.4 1.1 4.5 2.9C13.1 5.1 14.6 4 16.5 4c2.7 0 4.9 2.3 4.5 5.6-.6 5.8-9 10.7-9 10.7z';
  const SPEAKER = '<path d="M3.5 9.5h3.5l5-4.2v13.4l-5-4.2H3.5z" fill="currentColor"/>';

  const ICONS = {
    heart: svg(`<path d="${HEART}" fill="currentColor"/>`),
    heartEmpty: svg(`<path d="${HEART}"/>`),
    turtle: svg('<path d="M2 16.5a8 9 0 0 1 16 0z"/><path d="M6.3 16.5 8 11h4l1.7 5.5M7.8 11.2 10 7.6l2.2 3.6"/><path d="M4.8 16.5v3M15.2 16.5v3"/><path d="M17.6 13.6h2.1a2.3 2.3 0 0 0 0-4.6c-1.4 0-2.3.9-2.8 2.2"/>'),
    rocket: svg('<path d="M12 2.5c3 2.4 4.5 5.8 4.5 9.8v3.7h-9v-3.7c0-4 1.5-7.4 4.5-9.8z"/><circle cx="12" cy="9.5" r="1.5"/><path d="M7.5 13 4.5 16v3l3-1.5M16.5 13l3 3v3l-3-1.5M10 20.5h4"/>'),
    soundOn: svg(`${SPEAKER}<path d="M15.5 9.2a4 4 0 0 1 0 5.6M18.3 6.5a7.8 7.8 0 0 1 0 11"/>`),
    soundOff: svg(`${SPEAKER}<path d="M16 9.5l5 5M21 9.5l-5 5"/>`),
    pause: svg('<path d="M8.5 5.5v13M15.5 5.5v13"/>'),
    undo: svg('<path d="M8.5 14 4 9.5 8.5 5"/><path d="M4 9.5h10a5.5 5.5 0 0 1 0 11h-3.5"/>'),
    clear: svg('<path d="M4 6.8h16M9.5 6.8V4.3h5v2.5M6.3 6.8l1 13.2h9.4l1-13.2M10.3 10.5v6M13.7 10.5v6"/>'),
    lock: svg('<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/><path d="M12 14.5v2"/>'),
    star: svg('<path d="M12 3.2l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.6l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" fill="currentColor"/>'),
  };

  const $ = (id) => document.getElementById(id);
  const qa = (sel) => document.querySelectorAll(sel);

  let h = {};
  let settings = { lang: 'en', level: 'easy', speed: 3, sound: true };
  let game = null;
  let played = false;
  let prev = { game: null, ids: [], lives: 0, score: 0 };
  let els;

  const t = (key, n) => String(I18N[settings.lang][key]).replace('{n}', n);
  const menuOpen = () => !els.menu.hidden;
  const overOpen = () => !els.over.hidden;

  function init(handlers) {
    h = handlers;
    els = {
      menu: $('menu'), over: $('over'), plan: $('plan'), launch: $('launch'), launchIcon: $('launchIcon'),
      hearts: $('hearts'), score: $('score'), soundBtn: $('soundBtn'), soundSwitch: $('soundSwitch'),
      undo: $('undoBtn'), clear: $('clearBtn'), toast: $('toast'), pop: $('speedpop'), chip: document.querySelector('.chip'),
      cont: $('continueBtn'), start: $('startBtn'), startLabel: $('startLabel'), err: $('menuError'),
    };
    qa('[data-icon]').forEach((el) => { el.innerHTML = ICONS[el.dataset.icon]; });
    qa('[data-act="level"] small').forEach((el) => {
      el.dataset.n = Rules.LEVELS[el.parentElement.dataset.v].minLength;
    });
    els.hearts.innerHTML = Array.from({ length: Rules.START_LIVES }, () => '<span class="heart"></span>').join('');

    document.addEventListener('click', onClick);
    document.addEventListener('input', (e) => {
      if (e.target.matches('input[data-act="speed"]')) h.onSpeed(Number(e.target.value));
    });
    // Capture phase: a tap on the stage that closes the popover must not also mark a drone.
    document.addEventListener('pointerdown', (e) => {
      if (els.pop.hidden || e.target.closest('.chipwrap')) return;
      togglePopover(false);
      if (e.target.id === 'stage') e.stopPropagation();
    }, true);
    window.addEventListener('keydown', onKey);
  }

  function hideOverlays() {
    els.menu.hidden = true;
    els.over.hidden = true;
  }

  function onClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const v = b.dataset.v;
    switch (b.dataset.act) {
      case 'pause': h.onPause(); break;
      case 'sound': h.onSound(!settings.sound); break;
      case 'slower': h.onSpeed(Math.max(1, settings.speed - 1)); break;
      case 'faster': h.onSpeed(Math.min(10, settings.speed + 1)); break;
      case 'chip': togglePopover(els.pop.hidden); break;
      case 'undo': h.onUndo(); break;
      case 'clear': h.onClear(); break;
      case 'launch': h.onLaunch(); break;
      case 'lang':
      case 'level':
        if (settings[b.dataset.act] !== v) h.onSettingsChanged({ ...settings, [b.dataset.act]: v });
        break;
      case 'continue': hideOverlays(); h.onResume(); break;
      case 'start':
      case 'again': hideOverlays(); h.onStart({ ...settings }); break;
      case 'menu': showMenu({ canContinue: false }); break;
    }
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      if (menuOpen() && !els.cont.hidden) { hideOverlays(); h.onResume(); } else if (!menuOpen() && !overOpen()) h.onPause();
      return;
    }
    if (menuOpen() || overOpen() || !game || e.repeat) return;
    if (e.key === 'Enter') { e.preventDefault(); h.onLaunch(); }
    else if (e.key === 'Backspace') { e.preventDefault(); h.onUndo(); }
  }

  function togglePopover(open) {
    els.pop.hidden = !open;
    els.chip.setAttribute('aria-expanded', String(open));
  }

  function applyText() {
    qa('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n, el.dataset.n); });
    qa('[data-i18n-label]').forEach((el) => {
      const s = t(el.dataset.i18nLabel);
      el.setAttribute('aria-label', s);
      el.title = s;
    });
    els.startLabel.textContent = t(played ? 'newGame' : 'start');
  }

  function update(g, s) {
    game = g;
    settings = s;
    if (g) played = true;
    const html = document.documentElement;
    if (html.lang !== s.lang) {
      html.lang = s.lang;
      html.dir = s.lang === 'he' ? 'rtl' : 'ltr';
    }
    document.body.classList.toggle('no-game', !g);
    applyText();

    qa('[data-act="lang"], [data-act="level"]').forEach((b) => {
      b.setAttribute('aria-pressed', String(s[b.dataset.act] === b.dataset.v));
    });
    qa('[data-speed]').forEach((el) => { el.textContent = s.speed; });
    qa('input[data-act="speed"]').forEach((el) => { el.value = s.speed; });
    qa('[data-act="slower"]').forEach((b) => { b.disabled = s.speed <= 1; });
    qa('[data-act="faster"]').forEach((b) => { b.disabled = s.speed >= 10; });
    els.soundBtn.innerHTML = s.sound ? ICONS.soundOn : ICONS.soundOff;
    els.soundBtn.classList.toggle('off', !s.sound);
    els.soundSwitch.setAttribute('aria-checked', String(s.sound));
    els.soundSwitch.firstElementChild.innerHTML = s.sound ? ICONS.soundOn : ICONS.soundOff;

    if (!g) return;
    const fresh = prev.game !== g;
    renderHearts(g, fresh);
    renderScore(g, fresh);
    renderPlan(g, fresh);
    const playing = g.phase === 'playing';
    const locked = !playing || g.plan.length < Rules.LEVELS[g.level].minLength;
    els.launch.disabled = locked;
    const icon = locked ? 'lock' : 'rocket';
    if (els.launchIcon.dataset.icon !== icon) {
      els.launchIcon.dataset.icon = icon;
      els.launchIcon.innerHTML = ICONS[icon];
    }
    els.undo.disabled = els.clear.disabled = !playing || !g.plan.length;
    prev.game = g;
  }

  function renderHearts(g, fresh) {
    [...els.hearts.children].forEach((el, i) => {
      const full = i < g.lives;
      el.classList.toggle('empty', !full);
      el.innerHTML = full ? ICONS.heart : ICONS.heartEmpty;
    });
    if (!fresh && g.lives < prev.lives) restartAnim(els.hearts.children[g.lives], 'lose');
    els.hearts.setAttribute('aria-label', t('lives', g.lives));
    prev.lives = g.lives;
  }

  function renderScore(g, fresh) {
    els.score.textContent = g.score;
    if (!fresh && g.score > prev.score) restartAnim(els.score, 'bump');
    prev.score = g.score;
  }

  function renderPlan(g, fresh) {
    const letters = g.word(), ids = g.plan.ids, min = Rules.LEVELS[g.level].minLength;
    const launching = g.phase === 'launching';
    const known = fresh ? [] : prev.ids;
    const plan = els.plan;
    plan.textContent = '';
    letters.forEach((l, i) => {
      const tile = document.createElement('span');
      tile.className = 'tile';
      if (!known.includes(ids[i])) tile.classList.add('pop');
      if (launching && g.missiles[i] && g.missiles[i].done) tile.classList.add('hit');
      tile.textContent = l;
      plan.append(tile);
    });
    for (let i = letters.length; i < min; i++) {
      const slot = document.createElement('span');
      slot.className = 'tile slot';
      plan.append(slot);
    }
    if (!letters.length) {
      const hint = document.createElement('span');
      hint.className = 'plan-hint';
      hint.textContent = t('planHint');
      plan.append(hint);
    }
    // Keep the newest letter in view when the word is longer than the tray (RTL scrolls negative).
    if (letters.length) plan.scrollLeft = (document.documentElement.dir === 'rtl' ? -1 : 1) * plan.scrollWidth;
    prev.ids = ids.slice();
  }

  function restartAnim(el, cls) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  function markHit(index) {
    const tile = els.plan.children[index];
    if (tile) tile.classList.add('hit');
  }

  function flashPlanLoss(index) {
    restartAnim(els.plan, 'lost');
    const gone = document.createElement('span');
    gone.className = 'tile gone';
    gone.addEventListener('animationend', () => gone.remove());
    els.plan.insertBefore(gone, els.plan.children[index] || null);
  }

  function toast(key, kind, extra) {
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    const text = document.createElement('span');
    text.textContent = t(key, extra);
    el.append(text);
    if (key === 'great' && extra) {
      const pts = document.createElement('span');
      pts.className = 'pts';
      pts.dir = 'ltr';
      pts.textContent = '+' + extra;
      el.append(pts);
    }
    el.addEventListener('animationend', () => el.remove());
    els.toast.replaceChildren(el);
  }

  function showMenu({ canContinue }) {
    togglePopover(false);
    els.over.hidden = true;
    els.cont.hidden = !canContinue;
    els.menu.hidden = false;
    applyText();
  }

  function showGameOver(score, best, isRecord) {
    togglePopover(false);
    $('finalScore').textContent = score;
    $('bestScore').textContent = best;
    $('record').hidden = !isRecord;
    $('bestLine').hidden = isRecord;
    els.menu.hidden = true;
    els.over.hidden = false;
  }

  function error(message) {
    els.err.textContent = message || '';
    els.err.hidden = !message;
    els.start.disabled = !!message;
  }

  root.UI = { I18N, ICONS, init, update, toast, showMenu, showGameOver, flashPlanLoss, markHit, error };
})(window);
