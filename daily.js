// daily.js — Daily puzzle system for Six-Figure Logic
// Seeded PRNG + daily state persistence
// Must be loaded BEFORE popup.js, AFTER app.js

(function () {
  'use strict';

  // ─── Seeded PRNG (sfc32) ────────────────────────────────────────────────
  function hashStr(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(31, h) + str.charCodeAt(i) | 0;
    }
    return h >>> 0;
  }

  function makeSeededRandom(seedStr) {
    const s = hashStr(seedStr);
    let a = s, b = s ^ 0xdeadbeef, c = s ^ 0x12345678, d = 1;
    return function () {
      a |= 0; b |= 0; c |= 0; d |= 0;
      const t = (a + b | 0) + d | 0;
      d = d + 1 | 0;
      a = b ^ b >>> 9;
      b = c + (c << 3) | 0;
      c = (c << 21 | c >>> 11);
      c = c + t | 0;
      return (t >>> 0) / 4294967296;
    };
  }

  // ─── EST date string ────────────────────────────────────────────────────
  function getESTDateString() {
    const now = new Date();
    const est = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const y = est.getFullYear();
    const m = String(est.getMonth() + 1).padStart(2, '0');
    const d = String(est.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // ─── Rating ranges ──────────────────────────────────────────────────────
  // Daily puzzles use 4 fixed difficulty bands
  const DAILY_BANDS = {
    easy:   { min: 800,  max: 1000, label: 'EASY',   color: 'easy' },
    medium: { min: 1001, max: 1400, label: 'MEDIUM',  color: 'medium' },
    hard:   { min: 1401, max: 1800, label: 'HARD',    color: 'hard' },
    expert: { min: 1801, max: 9999, label: 'EXPERT',  color: 'expert' },
  };
  const DAILY_KEYS = ['easy', 'medium', 'hard', 'expert'];

  // ─── Generate a puzzle using seeded random ──────────────────────────────
  // Uses a seeded PRNG that replaces Math.random ONLY for this synchronous call.
  // After completion, Math.random is restored AND we consume a fixed number of
  // values from the real PRNG to ensure daily generation never leaves the global
  // engine at the same state it was before — breaking any correlation with
  // subsequent random puzzle generation.
  function generateDailyPuzzle(dateStr, difficulty) {
    const band = DAILY_BANDS[difficulty];
    if (!band) return null;

    const seed = `${dateStr}-${difficulty}`;
    const seeded = makeSeededRandom(seed);

    // Save real Math.random
    const origRandom = Math.random;
    Math.random = seeded;

    let result = null;
    const gen = window.generatePuzzle;
    const score = window._scorePuzzle;
    const rate = window._computePuzzleRating;

    try {
      // Try up to 3000 times to find a puzzle in band
      for (let attempt = 0; attempt < 3000; attempt++) {
        const candidate = gen();
        if (!candidate || !candidate._rawClues) continue;
        const elim = score(candidate._rawClues, candidate);
        const rating = rate(candidate._rawClues, elim, candidate);
        if (rating >= band.min && rating <= band.max) {
          candidate._rating = rating;
          result = candidate;
          break;
        }
      }
    } finally {
      Math.random = origRandom;
      // Consume entropy from the real PRNG so the global engine state after
      // a daily generation is never the same as if no daily had been generated.
      // This prevents the first random puzzle from matching a daily puzzle.
      for (let i = 0; i < 37; i++) origRandom();
    }

    return result;
  }

  // ─── Daily state storage ────────────────────────────────────────────────
  const DAILY_STORAGE_KEY = 'sfl_daily_v2';

  function loadDailyStore() {
    try {
      const raw = localStorage.getItem(DAILY_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function saveDailyStore(store) {
    try { localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(store)); } catch (e) {}
  }

  function getTodayRecord() {
    const store = loadDailyStore();
    const today = getESTDateString();
    return store[today] || {};
  }

  function saveDifficultyRecord(difficulty, data) {
    const store = loadDailyStore();
    const today = getESTDateString();
    if (!store[today]) store[today] = {};
    store[today][difficulty] = data;
    // Prune old dates (keep last 7)
    const keys = Object.keys(store).sort();
    while (keys.length > 7) {
<<<<<<< HEAD
      const oldDate = keys.shift();
      delete store[oldDate];
      // Also prune cached puzzle objects for that date
      ['easy','medium','hard','expert'].forEach(diff => {
        try { localStorage.removeItem('sfl_daily_puzzle_' + oldDate + '_' + diff); } catch(e) {}
      });
=======
      delete store[keys.shift()];
>>>>>>> 97152078e30bbccd87bee0598ecbbe50793a609a
    }
    saveDailyStore(store);
  }

  function getDifficultyRecord(difficulty) {
    const rec = getTodayRecord();
    return rec[difficulty] || null;
  }

  // ─── Public API ─────────────────────────────────────────────────────────
  window.SFLDaily = {
    BANDS: DAILY_BANDS,
    KEYS: DAILY_KEYS,

    getDateString: getESTDateString,

    // Returns a puzzle object for today + difficulty (may take a moment)
<<<<<<< HEAD
 getPuzzle: function(dateStr, difficulty) {
      const cacheKey = 'sfl_daily_puzzle_' + dateStr + '_' + difficulty;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch(e) {}
      const puzzle = generateDailyPuzzle(dateStr, difficulty);
      if (puzzle) {
        try { localStorage.setItem(cacheKey, JSON.stringify(puzzle)); } catch(e) {}
      }
      return puzzle;
    },
=======
    getPuzzle: generateDailyPuzzle,
>>>>>>> 97152078e30bbccd87bee0598ecbbe50793a609a

    // State management
    getTodayRecord,
    getDifficultyRecord,
    saveDifficultyRecord,

    // Mark a daily as in-progress (called when puzzle starts)
    markStarted(difficulty, puzzleRating) {
      const existing = getDifficultyRecord(difficulty);
      // Don't overwrite a completed record
      if (existing && (existing.solved || existing.gaveUp)) return;
      saveDifficultyRecord(difficulty, {
        ...(existing || {}),
        started: true,
        puzzleRating,
        startedAt: Date.now(),
      });
    },

    // Mark a daily as completed
    markCompleted(difficulty, data) {
      // data: { solved, gaveUp, time, mistakes, grade, ratingDelta, gridState, answerState, clueStates, penaltyText, puzzleRating }
      const existing = getDifficultyRecord(difficulty);
      saveDifficultyRecord(difficulty, {
        ...(existing || {}),
        ...data,
        completedAt: Date.now(),
      });
    },
  };

})();
