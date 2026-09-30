(function (root) {
  const Lexicon = (typeof module === 'object' && module.exports) ? require('./lexicon.js') : root.Lexicon;

  // Optimal-string-alignment DP matrix (insert, delete, substitute, adjacent transposition, each cost 1).
  function matrix(a, b) {
    const d = [];
    for (let i = 0; i <= a.length; i++) {
      d.push([i]);
      for (let j = 1; j <= b.length; j++) d[i][j] = i === 0 ? j : 0;
    }
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2][j - 2] + 1);
        d[i][j] = v;
      }
    }
    return d;
  }

  function distance(a, b) {
    return matrix(a, b)[a.length][b.length];
  }

  function buildIndex(validStr, lang) {
    const byLen = new Map();
    validStr.split(/\s+/).filter(Boolean).forEach((raw, rank) => {
      const w = Lexicon.normalize(raw, lang);
      if (!byLen.has(w.length)) byLen.set(w.length, []);
      byLen.get(w.length).push({ w, rank });
    });
    return { byLen };
  }

  function suggest(letters, { lang, minLength, index }) {
    const attempt = Lexicon.normalize(letters.join(''), lang);
    const maxDist = attempt.length <= 4 ? 1 : 2;
    let best = null;
    let bestDist = Infinity;
    let bestRank = Infinity;
    for (let len = Math.max(minLength, attempt.length - maxDist); len <= attempt.length + maxDist; len++) {
      for (const { w, rank } of index.byLen.get(len) || []) {
        const dist = distance(attempt, w);
        if (dist > maxDist || dist === 0) continue;
        if (dist < bestDist || (dist === bestDist && rank < bestRank)) { best = w; bestDist = dist; bestRank = rank; }
      }
    }
    return best;
  }

  // Backtrace the OSA matrix: attempt letters not matched are 'wrong'; letters the
  // suggestion has but the attempt lacks are reported as the attempt index they precede.
  function diff(attempt, word) {
    const d = matrix(attempt, word);
    const marks = new Array(attempt.length).fill('same');
    const missing = [];
    let i = attempt.length;
    let j = word.length;
    while (i > 0 || j > 0) {
      const cur = d[i][j];
      if (i > 0 && j > 0 && attempt[i - 1] === word[j - 1] && cur === d[i - 1][j - 1]) { i--; j--; }
      else if (i > 1 && j > 1 && attempt[i - 1] === word[j - 2] && attempt[i - 2] === word[j - 1] && cur === d[i - 2][j - 2] + 1) {
        marks[i - 1] = marks[i - 2] = 'wrong'; i -= 2; j -= 2;
      } else if (i > 0 && j > 0 && cur === d[i - 1][j - 1] + 1) { marks[i - 1] = 'wrong'; i--; j--; }
      else if (i > 0 && cur === d[i - 1][j] + 1) { marks[i - 1] = 'wrong'; i--; }
      else { missing.unshift(i); j--; }
    }
    return { marks, missing };
  }

  const api = { distance, buildIndex, suggest, diff };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Suggest = api;
})(typeof window !== 'undefined' ? window : globalThis);
