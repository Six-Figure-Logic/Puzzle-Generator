// daily.js — Daily puzzle system for Six-Figure Logic
// Seeded PRNG + daily state persistence
// Load order: app.js → session.js → daily.js → popup.js

(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════
  // SEEDED PRNG (sfc32) — deterministic per date+difficulty
  // ═══════════════════════════════════════════════════════════════════════

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

  // ═══════════════════════════════════════════════════════════════════════
  // DATE HELPERS — daily puzzles rotate at midnight Eastern
  // ═══════════════════════════════════════════════════════════════════════

  function getESTDateString() {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const lookup = {};
    parts.forEach(p => { lookup[p.type] = p.value; });
    return `${lookup.year}-${lookup.month}-${lookup.day}`;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DIFFICULTY BANDS — 4 fixed bands for daily puzzles
  // ═══════════════════════════════════════════════════════════════════════

  const DAILY_BANDS = {
    easy:   { min: 800,  max: 1000, label: 'EASY',   color: 'easy' },
    medium: { min: 1001, max: 1400, label: 'MEDIUM',  color: 'medium' },
    hard:   { min: 1401, max: 1800, label: 'HARD',    color: 'hard' },
    expert: { min: 1801, max: 2400, label: 'EXPERT',  color: 'expert' },
  };
  const DAILY_KEYS = ['easy', 'medium', 'hard', 'expert'];

  // ═══════════════════════════════════════════════════════════════════════
  // PUZZLE GENERATION — seeded so every player gets the same puzzle per day
  // ═══════════════════════════════════════════════════════════════════════
  // Swaps Math.random for a seeded PRNG for the duration of this synchronous
  // call only. After generation, Math.random is restored and a fixed number
  // of values are burned from it so daily generation never leaves the real
  // PRNG at a predictable state relative to random-puzzle generation.
  function generateDailyPuzzle(dateStr, difficulty) {
    const band = DAILY_BANDS[difficulty];
    if (!band) return null;

    const seed = `${dateStr}-${difficulty}`;
    const seeded = makeSeededRandom(seed);
    const origRandom = Math.random;
    Math.random = seeded;

    let result = null;
    let fallbackCandidate = null;
    const gen = window.generatePuzzle;
    const score = window._scorePuzzle;
    const rate = window._computePuzzleRating;

    // Pool size per attempt. Expert redraws with a random pool size between
    // 10–25 each time to vary difficulty and reduce generation speed.
    function nextPoolSize() {
      return difficulty === 'expert' ? 10 + Math.floor(Math.random() * 16) : 10;
    }

    try {
      for (let attempt = 0; attempt < 5000; attempt++) {
        const candidate = gen(nextPoolSize(), difficulty === 'hard' || difficulty === 'expert');
        if (!candidate || !candidate._rawClues) continue;
        if (!fallbackCandidate) fallbackCandidate = candidate;
        const elim = score(candidate._rawClues, candidate);
        // ── perf: skip expensive WED calc, see maxPossibleRating ──
        if (window._maxPossibleRating(elim) < band.min) continue;
        const rating = rate(candidate._rawClues, elim, candidate);
        candidate._rating = rating;
        if (rating >= band.min && rating <= band.max) {
          result = candidate;
          break;
        }
      }
      if (!result && fallbackCandidate) {
        if (!fallbackCandidate._rating) {
          const elim = score(fallbackCandidate._rawClues, fallbackCandidate);
          fallbackCandidate._rating = rate(fallbackCandidate._rawClues, elim, fallbackCandidate);
        }
        result = fallbackCandidate;
      }
    } finally {
      Math.random = origRandom;
      for (let i = 0; i < 37; i++) origRandom();
    }

    return result;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DAILY STATE STORAGE — per-date record of started/completed puzzles
  // ═══════════════════════════════════════════════════════════════════════

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

    // Prune dates older than the last 7, including their cached puzzle objects
    const keys = Object.keys(store).sort();
    while (keys.length > 7) {
      const oldDate = keys.shift();
      delete store[oldDate];
      DAILY_KEYS.forEach(diff => {
        try { localStorage.removeItem('sfl_daily_puzzle_' + oldDate + '_' + diff); } catch(e) {}
      });
    }
    saveDailyStore(store);
  }

  function getDifficultyRecord(difficulty) {
    const rec = getTodayRecord();
    return rec[difficulty] || null;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════

  window.SFLDaily = {
    BANDS: DAILY_BANDS,
    KEYS: DAILY_KEYS,

    getDateString: getESTDateString,

    // Returns a puzzle object for date + difficulty (cached once rating is frozen)
    getPuzzle: function(dateStr, difficulty) {
      const cacheKey = 'sfl_daily_puzzle_' + dateStr + '_' + difficulty;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed._rating) return parsed; // only trust cache once rating is frozen
        }
      } catch(e) {}

      const puzzle = generateDailyPuzzle(dateStr, difficulty);
      if (puzzle) {
        if (!puzzle._rating && puzzle._rawClues) {
          const elim = window._scorePuzzle(puzzle._rawClues, puzzle);
          puzzle._rating = window._computePuzzleRating(puzzle._rawClues, elim, puzzle);
        }
        try { localStorage.setItem(cacheKey, JSON.stringify(puzzle)); } catch(e) {}
      }
      return puzzle;
    },

    // State management
    getTodayRecord,
    getDifficultyRecord,
    saveDifficultyRecord,

    // Mark a daily as in-progress (called when puzzle starts). Never overwrites a completed record.
    markStarted(difficulty, puzzleRating) {
      const existing = getDifficultyRecord(difficulty);
      if (existing && (existing.solved || existing.gaveUp)) return;
      saveDifficultyRecord(difficulty, {
        ...(existing || {}),
        started: true,
        puzzleRating,
        startedAt: (existing && existing.startedAt) || Date.now(),
      });
    },

    // Mark a daily as completed.
    // data: { solved, gaveUp, time, mistakes, grade, ratingDelta, gridState, answerState, clueStates, penaltyText, puzzleRating }
    markCompleted(difficulty, data) {
      const existing = getDifficultyRecord(difficulty);
      saveDifficultyRecord(difficulty, {
        ...(existing || {}),
        ...data,
        completedAt: Date.now(),
      });
    },
  };

})();
