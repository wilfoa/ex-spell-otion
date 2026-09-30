(function (root) {
  let ac = null, master = null, speechPrimed = false;

  function tone(freq, dur, { type = 'sine', vol = 0.2, slide, at = 0 } = {}) {
    if (!Sfx.enabled || !ac) return;
    const n = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, n);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, n + dur);
    g.gain.setValueAtTime(0.0001, n);
    g.gain.exponentialRampToValueAtTime(vol, n + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, n + dur);
    o.connect(g).connect(master);
    o.start(n); o.stop(n + dur + 0.05);
  }

  function noise(dur, { vol = 0.3, filter = 'lowpass', from = 900, to, q = 1 } = {}) {
    if (!Sfx.enabled || !ac) return;
    const n = ac.currentTime, len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = buf;
    f.type = filter; f.Q.value = q;
    f.frequency.setValueAtTime(from, n);
    if (to) f.frequency.exponentialRampToValueAtTime(to, n + dur);
    g.gain.value = vol;
    s.connect(f).connect(g).connect(master);
    s.start(n);
  }

  const Sfx = {
    enabled: true,

    unlock() {
      try {
        if (!ac) {
          const AC = root.AudioContext || root.webkitAudioContext;
          if (!AC) return;
          ac = new AC();
          master = ac.createGain();
          master.gain.value = 0.8;
          master.connect(ac.destination);
        }
        if (ac.state === 'suspended') ac.resume();
      } catch (e) { ac = null; }
      // iOS only lets speech play later if it was first started inside a user gesture.
      if (!speechPrimed && root.speechSynthesis) {
        speechPrimed = true;
        try { root.speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch (e) { /* speech is optional */ }
      }
    },

    mark() { tone(880, 0.09, { type: 'triangle', vol: 0.12, slide: 1320 }); },

    whoosh() { noise(0.4, { vol: 0.35, filter: 'bandpass', from: 2400, to: 300, q: 2 }); },

    boom() {
      noise(0.55, { vol: 0.55, from: 1000, to: 120 });
      tone(130, 0.35, { vol: 0.3, slide: 40 });
    },

    success() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.16, at: i * 0.09 }));
      tone(1568, 0.5, { vol: 0.06, at: 0.36 });
    },

    fail() {
      tone(220, 0.25, { type: 'sawtooth', vol: 0.09, slide: 110 });
      tone(160, 0.4, { type: 'sawtooth', vol: 0.09, slide: 70, at: 0.2 });
    },

    say(text, lang) {
      if (!Sfx.enabled || !root.speechSynthesis) return;
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang === 'he' ? 'he-IL' : 'en-US';
        u.rate = 0.85;
        root.speechSynthesis.speak(u);
      } catch (e) { /* speech is optional */ }
    },

    // True when a voice for the language exists; voices load late on some browsers.
    canSpeak(lang) {
      if (root.__forceNoVoice || !root.speechSynthesis) return false;
      if (!voices.length) loadVoices();
      const re = lang === 'he' ? /^(he|iw)/i : /^en/i; // older Android reports Hebrew as 'iw'
      return voices.some((v) => re.test(v.lang || ''));
    },
  };

  let voices = [];
  function loadVoices() {
    try { voices = root.speechSynthesis.getVoices() || []; } catch (e) { voices = []; }
  }
  if (root.speechSynthesis) {
    loadVoices();
    try { root.speechSynthesis.addEventListener('voiceschanged', loadVoices); } catch (e) { /* optional */ }
  }

  root.Sfx = Sfx;
})(window);
