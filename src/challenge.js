(function (root) {
  const Lexicon = (typeof module === 'object' && module.exports) ? require('./lexicon.js') : root.Lexicon;

  const PAIRS = {
    en: ['bd', 'pq', 'mn', 'uv', 'il'],
    he: ['סש', 'חכ', 'בכ', 'טת', 'דר', 'וז', 'הח'],
  };
  const CONFUSABLE = {};
  for (const lang of Object.keys(PAIRS)) {
    CONFUSABLE[lang] = {};
    for (const [a, b] of PAIRS[lang]) {
      (CONFUSABLE[lang][a] = CONFUSABLE[lang][a] || []).push(b);
      (CONFUSABLE[lang][b] = CONFUSABLE[lang][b] || []).push(a);
    }
  }

  // Word letters minus plan letters (multiset), in word order.
  function needed(word, planLetters) {
    const have = new Map();
    for (const l of planLetters) have.set(l, (have.get(l) || 0) + 1);
    return [...word].filter((l) => {
      const n = have.get(l) || 0;
      if (n > 0) { have.set(l, n - 1); return false; }
      return true;
    });
  }

  // Needed letters with no reachable unmarked drone to cover them (spec 4.1).
  function missing(need, drones, { groundY, R }) {
    const pool = new Map();
    for (const d of drones) {
      if (d.marked) continue;
      const T = Math.min(4 + need.length, 0.4 * groundY / d.vy);
      if ((groundY - 2 * R - d.y) / d.vy >= T) pool.set(d.letter, (pool.get(d.letter) || 0) + 1);
    }
    return need.filter((l) => {
      const n = pool.get(l) || 0;
      if (n > 0) { pool.set(l, n - 1); return false; }
      return true;
    });
  }

  const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

  function decoy(word, lang, rng) {
    const letter = pick([...word], rng);
    if (rng() < 0.5) return letter;
    const c = (CONFUSABLE[lang] || {})[letter];
    return c ? pick(c, rng) : letter;
  }

  function judge(letters, word, lang) {
    if (letters.length < word.length) return 'short';
    return Lexicon.normalize(letters.join(''), lang) === word ? 'match' : 'miss';
  }

  const api = { CONFUSABLE, needed, missing, decoy, judge };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Challenge = api;
})(typeof window !== 'undefined' ? window : globalThis);
