// rating_game.js — Game state + rating integration for Six-Figure Logic
// Load AFTER app.js and rating.js

(function () {
  'use strict';

  // ─── Game state ───────────────────────────────────────────────────────────
  let gameActive   = false;   // puzzle is in progress
  let gameMode     = 'casual'; // 'casual' | 'rated'
  let mistakeCount = 0;
  let penaltySecs  = 0;       // cumulative penalty seconds (display only)
  let puzzlePenaltyPerMistake = 0; // computed when puzzle starts
  let puzzleWasGivenUp = false; // track if current end was a give-up

  // ─── DOM refs ─────────────────────────────────────────────────────────────
  const newPuzzleBtn   = document.getElementById('newPuzzleBtn');
  const modePill       = document.getElementById('modePill');
  const modeCasualBtn  = document.getElementById('modeCasualBtn');
  const modeRatedBtn   = document.getElementById('modeRatedBtn');
  const penaltyEl      = document.getElementById('penaltyTime');
  const mistakeEl      = document.getElementById('mistakeCounter');
  const ratingDisplayEl = document.getElementById('playerRatingValue');
  const ratingRdEl     = document.getElementById('playerRatingRd');
  const resultOverlay  = document.getElementById('resultOverlay');
  const giveupOverlay  = document.getElementById('giveupOverlay');

  // ─── Rating display ───────────────────────────────────────────────────────
  function refreshRatingDisplay() {
    const p = window.SFLRating.getProfile();
    if (ratingDisplayEl) ratingDisplayEl.textContent = Math.round(p.rating);
    if (ratingRdEl)      ratingRdEl.textContent = '± ' + Math.round(p.rd);
  }
  refreshRatingDisplay();

  // ─── Mode pill ────────────────────────────────────────────────────────────
  function setMode(mode) {
    gameMode = mode;
    modeCasualBtn.classList.toggle('active', mode === 'casual');
    modeRatedBtn.classList.toggle('active',  mode === 'rated');
  }
  setMode('casual');

  modeCasualBtn.addEventListener('click', () => { if (!gameActive) setMode('casual'); });
  modeRatedBtn.addEventListener('click',  () => { if (!gameActive) setMode('rated'); });

  // ─── Penalty helpers ──────────────────────────────────────────────────────
  function formatMMSS(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  function addMistake() {
    mistakeCount++;
    penaltySecs += puzzlePenaltyPerMistake;

    // Update penalty display
    penaltyEl.textContent = '+' + formatMMSS(penaltySecs);
    penaltyEl.classList.add('visible');

    // Update mistake counter
    mistakeEl.textContent = '✗ ' + mistakeCount + '/3';
    mistakeEl.classList.add('visible');

    if (mistakeCount >= 3) {
      // Auto-forfeit — show result popup as failed
      puzzleWasGivenUp = true;
      const solveTime = getCurrentTimerSeconds();
      stopTimer(); // hook won't fire because puzzleWasGivenUp=true

      _lastGiveUpRatingResult = null;
      if (gameMode === 'rated' && window.currentSolution) {
        const puzzleRating = (window.currentSolution && window.currentSolution._rating) || 1000;
        _lastGiveUpRatingResult = window.SFLRating.recordResult(solveTime, mistakeCount, puzzleRating, true);
        refreshRatingDisplay();
      }

      showResultPopup(solveTime, true);
      unlockGame();
    }
  }

  // ─── Lock / unlock game state ─────────────────────────────────────────────
  function lockGame(puzzleRating) {
    gameActive = true;
    puzzleWasGivenUp = false;
    mistakeCount = 0;
    penaltySecs  = 0;
    puzzlePenaltyPerMistake = window.SFLRating.penaltyPerMistake(puzzleRating);

    // Lock mode pill
    modePill.classList.add('locked');
    modeCasualBtn.disabled = true;
    modeRatedBtn.disabled  = true;

    // Fix 3: Button becomes "I Give Up"
    newPuzzleBtn.innerHTML = '<span class="btn-icon">✗</span> I Give Up';
    newPuzzleBtn.classList.remove('primary');
    newPuzzleBtn.classList.add('primary', 'give-up-active');

    // Reset penalty display
    penaltyEl.textContent = '';
    penaltyEl.classList.remove('visible');
    mistakeEl.textContent = '';
    mistakeEl.classList.remove('visible');
  }

  function unlockGame() {
    gameActive = false;
    modePill.classList.remove('locked');
    modeCasualBtn.disabled = false;
    modeRatedBtn.disabled  = false;
    // Fix 3: Restore button text
    newPuzzleBtn.innerHTML = '<span class="btn-icon">&#x27F3;</span> New Puzzle';
    newPuzzleBtn.classList.remove('give-up-active');
    penaltyEl.classList.remove('visible');
    mistakeEl.classList.remove('visible');
  }

  // ─── Give up logic ────────────────────────────────────────────────────────
  let _lastGiveUpRatingResult = null; // stash rating result for popup display

  function doGiveUp() {
    puzzleWasGivenUp = true;
    const solveTime = getCurrentTimerSeconds();
    stopTimer();

    _lastGiveUpRatingResult = null;
    if (gameMode === 'rated' && window.currentSolution) {
      const puzzleRating = (window.currentSolution && window.currentSolution._rating) || 1000;
      _lastGiveUpRatingResult = window.SFLRating.recordResult(solveTime, mistakeCount, puzzleRating, true);
      refreshRatingDisplay();
    }

    showResultPopup(solveTime, true);
    unlockGame();
  }

  function showGiveUpConfirm() {
    giveupOverlay.classList.add('open');
  }

  function hideGiveUpConfirm() {
    giveupOverlay.classList.remove('open');
  }

  document.getElementById('giveupYes').addEventListener('click', () => {
    hideGiveUpConfirm();
    doGiveUp();
  });

  document.getElementById('giveupNo').addEventListener('click', () => {
    hideGiveUpConfirm();
  });

  // ─── Intercept New Puzzle button ──────────────────────────────────────────
  newPuzzleBtn.addEventListener('click', function (e) {
    if (!gameActive) return; // let app.js generate normally

    // Puzzle is active — this is "I Give Up"
    e.stopImmediatePropagation();

    // Fix 2: both casual and rated show give-up confirm (not completion popup)
    showGiveUpConfirm();
  }, true); // capture phase

  // ─── Hook applyNewPuzzle to lock the game ────────────────────────────────
  const _originalApply = window.applyNewPuzzle;
  window.applyNewPuzzle = function (sol) {
    // Fix 4: generatePuzzleJS returns uppercase keys {A,B,...} but scorePuzzle/
    // checkClue use lowercase {a,b,...}. Normalize before any rating computation.
    if (sol) {
      if (sol.A !== undefined && sol.a === undefined) {
        sol.a = sol.A; sol.b = sol.B; sol.c = sol.C;
        sol.d = sol.D; sol.e = sol.E; sol.f = sol.F;
      }
    }
    _originalApply(sol);
    window.currentSolution = sol;
    // Store puzzle's numerical rating on solution for later use
    if (sol && sol._rawClues && sol._rawClues.length) {
      const elim   = window._scorePuzzle(sol._rawClues, sol);
      const rating = window._computePuzzleRating(sol._rawClues, elim, sol);
      sol._rating = rating;
    }
    lockGame(sol._rating || 1000);
  };

  // ─── Get current timer value in seconds ──────────────────────────────────
  function getCurrentTimerSeconds() {
    const timerEl = document.getElementById('timer');
    if (!timerEl) return 0;
    const text = timerEl.textContent || '00:00';
    const parts = text.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  // ─── Hook stopTimer from app.js ───────────────────────────────────────────
  const _originalStopTimer = window.stopTimer;
  window.stopTimer = function () {
    if (typeof _originalStopTimer === 'function') _originalStopTimer();
    // Only fire result popup if game was active and it was a genuine solve (not give-up)
    if (gameActive && !puzzleWasGivenUp) {
      const solveTime = getCurrentTimerSeconds();
      showResultPopup(solveTime, false);
      unlockGame();
    }
  };

  // ─── Hook checkAnswers to count mistakes ─────────────────────────────────
  const checkBtn = document.getElementById('checkBtn');
  checkBtn.addEventListener('click', function () {
    setTimeout(() => {
      if (!gameActive) return;
      const fb = document.getElementById('feedback');
      if (!fb) return;
      if (fb.classList.contains('incorrect') &&
          fb.textContent.includes('clues')) {
        addMistake();
      }
    }, 0);
  });

  // ─── Letter grade from performance ───────────────────────────────────────
  function computeLetterGrade(solveSeconds, mistakes, puzzleRating, playerRating, gaveUp) {
    if (gaveUp) return 'F';
    const S = window.SFLRating.computeS(solveSeconds, mistakes, puzzleRating, playerRating);
    // S ranges 0.05 to 1.0
    // Map to letter grades
    if (S >= 0.95) return 'A+';
    if (S >= 0.88) return 'A';
    if (S >= 0.82) return 'A−';
    if (S >= 0.75) return 'B+';
    if (S >= 0.68) return 'B';
    if (S >= 0.62) return 'B−';
    if (S >= 0.55) return 'C+';
    if (S >= 0.48) return 'C';
    if (S >= 0.42) return 'C−';
    if (S >= 0.35) return 'D+';
    if (S >= 0.28) return 'D';
    return 'D−';
  }

  function gradeColor(grade) {
    if (grade === 'F')  return 'var(--danger)';
    if (grade.startsWith('A')) return 'var(--success)';
    if (grade.startsWith('B')) return '#7ecfff';
    if (grade.startsWith('C')) return 'var(--accent)';
    return '#ffa032';
  }

  function difficultyColor(rating) {
    if (rating <= 1000) return '#00e5a0';
    if (rating <= 1300) return 'var(--accent)';
    if (rating <= 1650) return '#ffa032';
    return 'var(--danger)';
  }

  function difficultyLabel(rating) {
    if (rating <= 1000) return 'EASY';
    if (rating <= 1300) return 'MEDIUM';
    if (rating <= 1650) return 'HARD';
    return 'EXPERT';
  }

  // ─── Result popup ─────────────────────────────────────────────────────────
  function showResultPopup(solveTime, gaveUp) {
    const puzzleRating = (window.currentSolution && window.currentSolution._rating) || 1000;
    const isRated = gameMode === 'rated';
    const title   = document.getElementById('resultTitle');
    const statsEl = document.getElementById('resultStats');
    const ratingRowEl = document.getElementById('resultRatingRow');
    const casualNoteEl = document.getElementById('resultCasualNote');

    // Fix 1: Correct title for give-up vs solve
    if (gaveUp) {
      title.textContent = '✗  PUZZLE FAILED';
      title.className   = 'result-title failed-title';
    } else {
      title.textContent = '✓  PUZZLE SOLVED';
      title.className   = 'result-title' + (isRated ? '' : ' casual-title');
    }

    // Fix 5: Redesigned stats grid
    // Top-left: Solve Time
    // Top-right: Mistakes + Penalty (combined box)
    // Bottom-left: Puzzle Rating (colored by difficulty)
    // Bottom-right: Letter Grade

    const p = window.SFLRating.getProfile();
    const grade = computeLetterGrade(solveTime, mistakeCount, puzzleRating, p.rating, gaveUp);
    const gc = gradeColor(grade);
    const dc = difficultyColor(puzzleRating);
    const dl = difficultyLabel(puzzleRating);

    const mistakesDisplay = mistakeCount > 0 ? mistakeCount : 'None';
    const mistakesColor = mistakeCount > 0 ? 'var(--danger)' : 'var(--success)';
    const penaltyDisplay = penaltySecs > 0 ? '+' + formatMMSS(penaltySecs) : 'None';
    const penaltyColor = penaltySecs > 0 ? 'var(--danger)' : 'var(--success)';

    statsEl.innerHTML = `
      <div class="result-stat">
        <span class="result-stat-label">SOLVE TIME</span>
        <span class="result-stat-value">${formatMMSS(solveTime)}</span>
      </div>
      <div class="result-stat result-stat-combined">
        <div class="result-stat-row">
          <span class="result-stat-label">MISTAKES</span>
          <span class="result-stat-label">PENALTY</span>
        </div>
        <div class="result-stat-row">
          <span class="result-stat-value" style="color:${mistakesColor}">${mistakesDisplay}</span>
          <span class="result-stat-value" style="color:${penaltyColor}">${penaltyDisplay}</span>
        </div>
      </div>
      <div class="result-stat">
        <span class="result-stat-label">PUZZLE RATING</span>
        <span class="result-stat-value" style="color:${dc}">${puzzleRating}</span>
      </div>
      <div class="result-stat result-stat-grade">
        <span class="result-stat-label">PERFORMANCE</span>
        <span class="result-grade-value" style="color:${gc}">${grade}</span>
      </div>
    `;

    if (isRated) {
      let result;
      if (!gaveUp) {
        result = window.SFLRating.recordResult(solveTime, mistakeCount, puzzleRating, false);
        refreshRatingDisplay();
      } else {
        // Rating already recorded in doGiveUp — use stashed result
        result = _lastGiveUpRatingResult || { oldRating: '?', newRating: '?', ratingDelta: 0 };
      }

      const deltaSign  = result.ratingDelta >= 0 ? '+' : '';
      const deltaClass = result.ratingDelta > 0 ? 'positive' : result.ratingDelta < 0 ? 'negative' : 'neutral';

      ratingRowEl.style.display = 'flex';
      ratingRowEl.innerHTML = `
        <span class="result-old-rating">${result.oldRating}</span>
        <span class="result-arrow">→</span>
        <span class="result-new-rating" id="animNewRating">${result.oldRating}</span>
        <span class="result-delta ${deltaClass}">${deltaSign}${result.ratingDelta}</span>
      `;
      casualNoteEl.style.display = 'none';

      if (!gaveUp) animateRating(result.oldRating, result.newRating, 1800);
    } else {
      ratingRowEl.style.display = 'none';
      casualNoteEl.style.display = 'block';
      casualNoteEl.textContent   = gaveUp ? 'Casual mode — no rating change' : 'Casual mode — rating unaffected';
    }

    resultOverlay.classList.add('open');
  }

  function animateRating(from, to, durationMs) {
    const el = document.getElementById('animNewRating');
    if (!el) return;
    const start = performance.now();
    const diff  = to - from;
    function step(now) {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      el.textContent = Math.round(from + diff * eased);
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = to;
    }
    requestAnimationFrame(step);
  }

  // Close result popup — clicking continue generates a new puzzle
  document.getElementById('resultCloseBtn').addEventListener('click', () => {
    resultOverlay.classList.remove('open');
  });
  resultOverlay.addEventListener('click', (e) => {
    if (e.target === resultOverlay) resultOverlay.classList.remove('open');
  });

  // Expose for external access if needed
  window._sfgame = { refreshRatingDisplay };

})();
