(function (root) {
  const FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
  const TO_FINAL = { 'כ': 'ך', 'מ': 'ם', 'נ': 'ן', 'פ': 'ף', 'צ': 'ץ' };

  function normalize(word, lang) {
    if (lang === 'en') return word.toLowerCase();
    return [...word].map((c) => FINALS[c] || c).join('');
  }

  function display(letters, lang) {
    if (lang === 'en') return letters.map((l) => l.toUpperCase());
    const out = letters.slice();
    if (out.length >= 2) {
      const last = out.length - 1;
      out[last] = TO_FINAL[out[last]] || out[last];
    }
    return out;
  }

  function buildValidSet(validStr, lang) {
    return new Set(validStr.split(/\s+/).filter(Boolean).map((w) => normalize(w, lang)));
  }

  function letterWeights(words, lang) {
    const counts = new Map();
    let total = 0;
    for (const w of words) {
      for (const l of normalize(w, lang)) {
        counts.set(l, (counts.get(l) || 0) + 1);
        total++;
      }
    }
    return [...counts].map(([l, n]) => [l, n / total]);
  }

  function weightedPick(weights, rng) {
    let r = rng() * weights.reduce((s, [, w]) => s + w, 0);
    for (const [l, w] of weights) {
      if ((r -= w) < 0) return l;
    }
    return weights[weights.length - 1][0]; // float-rounding fallthrough
  }

  function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  class SeedDeck {
    constructor(common, lang, minLength, rng = Math.random) {
      this.rng = rng;
      this.words = [...new Set(common.map((w) => normalize(w, lang)))]
        .filter((w) => w.length >= minLength && w.length <= minLength + 2);
      if (!this.words.length) throw new Error('no seed words');
      this.deck = [];
    }
    next() {
      if (!this.deck.length) this.deck = shuffle(this.words.slice(), this.rng);
      return this.deck.pop();
    }
  }

  const api = { normalize, display, buildValidSet, letterWeights, weightedPick, SeedDeck, shuffle };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Lexicon = api;
})(typeof window !== 'undefined' ? window : globalThis);
