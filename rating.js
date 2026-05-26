// rating.js — Six-Figure Logic Glicko-2 rating system

(function () {
  'use strict';

  // ─── Constants ───────────────────────────────────────────────────────────
  const STORAGE_KEY   = 'sfl_rating_v1';
  const TAU           = 0.5;          // Glicko-2 system constant (volatility constraint)
  const INIT_RATING   = 1000;
  const INIT_RD       = 350;
  const INIT_VOL      = 0.06;
  const MIN_RD        = 50;
  const MAX_RD        = 350;
  const RD_DECAY_PER_DAY = 3;        // RD added per 24h inactivity
  const MS_PER_DAY    = 86400000;

  // ─── Storage helpers ─────────────────────────────────────────────────────
  function loadProfile() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch(e) {}
    return {
      rating:    INIT_RATING,
      rd:        INIT_RD,
      vol:       INIT_VOL,
      lastPlayed: null,
      gamesPlayed: 0
    };
  }

  function saveProfile(p) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch(e) {}
  }

  // Apply RD drift for inactivity (cap at MAX_RD)
  function applyRdDrift(p) {
    if (!p.lastPlayed) return p;
    const daysSince = (Date.now() - p.lastPlayed) / MS_PER_DAY;
    if (daysSince < 1) return p;
    const drift = Math.floor(daysSince) * RD_DECAY_PER_DAY;
    p.rd = Math.min(MAX_RD, p.rd + drift);
    return p;
  }

  // ─── Expected time formula ────────────────────────────────────────────────
  // Equal-rating baseline (player = puzzle):
  //   ≤2000: base = 180 + (puzzleRating - 800) × 0.15  seconds
  //   >2000: base = 360 + (puzzleRating - 2000) × 1.8  seconds
  // Then scaled by (puzzleRating / playerRating):
  //   expectedTime = base × (puzzleRating / playerRating)
  function expectedBase(puzzleRating) {
    if (puzzleRating <= 2000) {
      return 180 + (puzzleRating - 800) * 0.15;
    } else {
      return 360 + (puzzleRating - 2000) * 1.8;
    }
  }

  function expectedTime(puzzleRating, playerRating) {
    const base = expectedBase(puzzleRating);
    return base * (puzzleRating / playerRating);
  }

  // Penalty seconds per mistake (20% of equal-rating base time)
  function penaltyPerMistake(puzzleRating) {
    return Math.round(expectedBase(puzzleRating) * 0.20);
  }

  // ─── S (performance score) calculation ───────────────────────────────────
  // S = clamp(0.5 - 0.35 × ln(effectiveTime / expectedTime), 0.05, 1.25)
  // Give up / 3 mistakes before solve → S = 0 (hard loss)
  function computeS(solveSeconds, mistakes, puzzleRating, playerRating) {
    const penalty   = penaltyPerMistake(puzzleRating);
    const effective = solveSeconds + mistakes * penalty;
    const expected  = expectedTime(puzzleRating, playerRating);
    const ratio     = effective / expected;
    const raw       = 0.5 - 0.35 * Math.log(ratio);
    return Math.max(0.05, Math.min(1.25, raw));
  }

  // ─── Glicko-2 update ─────────────────────────────────────────────────────
  // Uses continuous S in place of binary outcome.
  // puzzle is treated as the "opponent" with its own rating.
  // PUZZLE_RD raised to 350 so upsets against much-harder puzzles
  // yield appropriately large rating swings.
  const PUZZLE_RD = 350;

  function glicko2Update(profile, puzzleRating, S) {
    const mu    = (profile.rating - 1500) / 173.7178;
    const phi   = profile.rd / 173.7178;
    const sigma = profile.vol;

    const mu_j  = (puzzleRating - 1500) / 173.7178;
    const phi_j = PUZZLE_RD / 173.7178;

    function g(phi) {
      return 1 / Math.sqrt(1 + 3 * phi * phi / (Math.PI * Math.PI));
    }
    function E(mu, mu_j, phi_j) {
      return 1 / (1 + Math.exp(-g(phi_j) * (mu - mu_j)));
    }

    const g_j = g(phi_j);
    const E_j = E(mu, mu_j, phi_j);

    // Step 3: v (estimated variance)
    const v = 1 / (g_j * g_j * E_j * (1 - E_j));

    // Step 4: delta
    const delta = v * g_j * (S - E_j);

    // Step 5: new volatility via Illinois algorithm
    const a = Math.log(sigma * sigma);
    const eps = 0.000001;
    function f(x) {
      const ex = Math.exp(x);
      const d2 = phi * phi + v + ex;
      return (ex * (delta * delta - phi * phi - v - ex)) / (2 * d2 * d2)
           - (x - a) / (TAU * TAU);
    }
    let A = a;
    let B;
    if (delta * delta > phi * phi + v) {
      B = Math.log(delta * delta - phi * phi - v);
    } else {
      let k = 1;
      while (f(a - k * TAU) < 0) k++;
      B = a - k * TAU;
    }
    let fA = f(A), fB = f(B);
    for (let i = 0; i < 100 && Math.abs(B - A) > eps; i++) {
      const C  = A + (A - B) * fA / (fB - fA);
      const fC = f(C);
      if (fC * fB < 0) { A = B; fA = fB; }
      else             { fA /= 2; }
      B = C; fB = fC;
    }
    const newSigma = Math.exp(A / 2);

    // Step 6: pre-rating update RD
    const phiStar = Math.sqrt(phi * phi + newSigma * newSigma);

    // Step 7: new RD and rating
    const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
    const newMu  = mu + newPhi * newPhi * g_j * (S - E_j);

    const newRating = Math.round(173.7178 * newMu + 1500);
    const newRd     = Math.max(MIN_RD, Math.min(MAX_RD, Math.round(173.7178 * newPhi)));

    return { newRating, newRd, newVol: newSigma, expectedS: E_j, v, delta };
  }

  // ─── Public API ──────────────────────────────────────────────────────────
  window.SFLRating = {

    getProfile() {
      const p = loadProfile();
      applyRdDrift(p);
      return p;
    },

    getRatingDisplay() {
      const p = this.getProfile();
      return Math.round(p.rating);
    },

    expectedTime,
    penaltyPerMistake,
    computeS,

    // Call this when a puzzle is completed (or given up)
    // Returns { oldRating, newRating, oldRd, newRd, ratingDelta, S, expectedS }
    recordResult(solveSeconds, mistakes, puzzleRating, gaveUp) {
      let p = loadProfile();
      applyRdDrift(p);

      const S = gaveUp ? 0 : computeS(solveSeconds, mistakes, puzzleRating, p.rating);
      const result = glicko2Update(p, puzzleRating, S);

      const oldRating = Math.round(p.rating);
      const oldRd     = Math.round(p.rd);

      p.rating     = result.newRating;
      p.rd         = result.newRd;
      p.vol        = result.newVol;
      p.lastPlayed = Date.now();
      p.gamesPlayed++;

      saveProfile(p);

      return {
        oldRating,
        newRating: result.newRating,
        oldRd,
        newRd:     result.newRd,
        ratingDelta: result.newRating - oldRating,
        S:         Math.round(S * 100) / 100,
        expectedS: Math.round(result.expectedS * 100) / 100,
        penalty:   penaltyPerMistake(puzzleRating) * mistakes,
        gamesPlayed: p.gamesPlayed
      };
    }
  };

})();
