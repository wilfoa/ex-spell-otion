(function (root) {
  const Lexicon = (typeof module === 'object' && module.exports) ? require('./lexicon.js') : root.Lexicon;

  function fallSpeed(speed, H) {
    return (8 + 9 * speed) * (H / 800);
  }

  // Never fewer than minLength + 3 drones, so a narrow phone can still spell the level's shortest word.
  function targetCount(levelTarget, W, R, minLength) {
    return Math.max(minLength + 3, 4, Math.min(levelTarget, Math.floor(W / (2 * R * 1.4))));
  }

  function spawnInterval(speed, H, fallDistance, count) {
    return fallDistance / fallSpeed(speed, H) / count;
  }

  class LetterQueue {
    constructor({ deck, weights, rng = Math.random }) {
      this.deck = deck;
      this.weights = weights;
      this.rng = rng;
      this.queue = [];
    }
    refill() {
      const batch = Array.from(this.deck.next());
      const fillers = 1 + Math.floor(this.rng() * 3);
      for (let i = 0; i < fillers; i++) batch.push(Lexicon.weightedPick(this.weights, this.rng));
      Lexicon.shuffle(batch, this.rng);
      this.queue.push(...batch);
      return batch;
    }
    next() {
      while (this.queue.length < 3) this.refill();
      return this.queue.shift();
    }
  }

  function pickX(W, R, drones, rng) {
    let x;
    for (let i = 0; i < 12; i++) {
      x = 1.6 * R + rng() * (W - 3.2 * R);
      if (!drones.some((d) => d.y < 4 * R && Math.abs(x - d.x) < 2.6 * R)) break;
    }
    return x;
  }

  const api = { fallSpeed, targetCount, spawnInterval, LetterQueue, pickX };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Spawner = api;
})(typeof window !== 'undefined' ? window : globalThis);
