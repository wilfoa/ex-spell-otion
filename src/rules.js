(function (root) {
  const Lexicon = (typeof module === 'object' && module.exports) ? require('./lexicon.js') : root.Lexicon;

  const LEVELS = {
    easy: { minLength: 2, multiplier: 1, targetDrones: 6 },
    medium: { minLength: 4, multiplier: 2, targetDrones: 8 },
    hard: { minLength: 6, multiplier: 3, targetDrones: 10 },
  };
  const START_LIVES = 5;

  class Plan {
    constructor() {
      this.ids = [];
      this.letters = [];
    }
    get length() { return this.ids.length; }
    indexOf(id) { return this.ids.indexOf(id); }
    mark(id, letter) {
      if (this.ids.includes(id)) return false;
      this.ids.push(id);
      this.letters.push(letter);
      return true;
    }
    undo() {
      this.ids.pop();
      this.letters.pop();
    }
    clear() {
      this.ids = [];
      this.letters = [];
    }
    remove(id) {
      const i = this.ids.indexOf(id);
      if (i >= 0) {
        this.ids.splice(i, 1);
        this.letters.splice(i, 1);
      }
      return i;
    }
  }

  function judge(letters, { lang, minLength, validSet, used }) {
    if (letters.length < minLength) return 'tooShort';
    const word = Lexicon.normalize(letters.join(''), lang);
    if (used.has(word)) return 'used';
    return validSet.has(word) ? 'valid' : 'invalid';
  }

  function score(length, level) {
    return 10 * length * LEVELS[level].multiplier;
  }

  const api = { LEVELS, START_LIVES, Plan, judge, score };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Rules = api;
})(typeof window !== 'undefined' ? window : globalThis);
