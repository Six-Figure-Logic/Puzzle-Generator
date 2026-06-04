// popup.js — Play popup for Six-Figure Logic
// Handles the puzzle selection popup (Daily + Random), mode pill,
// daily state display, and integration with app.js / daily.js
// Must be loaded AFTER app.js and daily.js

(function () {
  'use strict';

  // ─── Rating range definitions (for Random Puzzle selector) ──────────────
  const RANGES = [
    { min: 800,  max: 1000, label: '800–1000',  tier: 'easy',   tierLabel: 'EASY' },
    { min: 1001, max: 1200, label: '1001–1200', tier: 'medium', tierLabel: 'MEDIUM' },
    { min: 1201, max: 1400, label: '1201–1400', tier: 'medium', tierLabel: 'MEDIUM' },
    { min: 1401, max: 1600, label: '1401–1600', tier: 'hard',   tierLabel: 'HARD' },
    { min: 1601, max: 1800, label: '1601–1800', tier: 'hard',   tierLabel: 'HARD' },
    { min: 1801, max: 2000, label: '1801–2000', tier: 'expert', tierLabel: 'EXPERT' },
    { min: 2001, max: 9999, label: '2001+',     tier: 'expert', tierLabel: 'EXPERT' },
  ];

  let currentRangeIdx = 0; // default to easiest range

  // ─── State ──────────────────────────────────────────────────────────────
  let popupMode = 'casual'; // 'casual' | 'rated'

  // Track whether current puzzle is a daily and which difficulty
  window._sflPuzzleContext = {
    isDaily: false,
    dailyDifficulty: null,
  };

  // ─── DOM refs (resolved after DOMContentLoaded) ──────────────────────────
  let popupOverlay, popupBox;
  let modeCasualBtn, modeRatedBtn;
  let rangeLeftBtn, rangeRightBtn, rangeLabelEl, rangeTierEl;
  let randomLaunchBtn;
  let newPuzzleBtn;

  // ─── Helpers ─────────────────────────────────────────────────────────────
  function getRating(sol) {
    if (!sol) return null;
    if (sol._rating) return sol._rating;
    if (sol._rawClues && sol._rawClues.length) {
      const elim = window._scorePuzzle(sol._rawClues, sol);
      const r = window._computePuzzleRating(sol._rawClues, elim, sol);
      sol._rating = r;
      return r;
    }
    return null;
  }

  function tierClass(tier) {
    return `rating-${tier}`;
  }

  function formatTime(secs) {
    if (!secs && secs !== 0) return '--:--';
    const m = Math.floor(secs / 60);
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  // ─── Popup open / close ──────────────────────────────────────────────────
function openPopup() {
  setTimeout(() => {
    refreshDailyCards();
    updateRangeDisplay();
    popupOverlay.classList.add('open');
  }, 350);
}

  function closePopup() {
    popupOverlay.classList.remove('open');
  }

  // ─── Mode pill (inside popup) ────────────────────────────────────────────
  function setPopupMode(mode) {
    popupMode = mode;
    modeCasualBtn.classList.toggle('active', mode === 'casual');
    modeRatedBtn.classList.toggle('active', mode === 'rated');
    // Sync the main-screen mode display badge
    const badge = document.getElementById('modeDisplayBadge');
    if (badge) {
      badge.textContent = mode === 'rated' ? 'RATED' : 'CASUAL';
      badge.className = 'mode-display-badge mode-display-' + mode;
    }
    // Also sync _sfgame's internal mode
    if (window._sfgame && typeof window._sfgame._setMode === 'function') {
      window._sfgame._setMode(mode);
    }
    // Style the random launch button to match mode
    if (randomLaunchBtn) {
      if (mode === 'rated') {
        randomLaunchBtn.style.background = 'rgba(232,255,71,0.12)';
        randomLaunchBtn.style.borderColor = 'rgba(232,255,71,0.35)';
        randomLaunchBtn.style.color = 'var(--accent)';
      } else {
        randomLaunchBtn.style.background = 'rgba(0,229,160,0.10)';
        randomLaunchBtn.style.borderColor = 'rgba(0,229,160,0.35)';
        randomLaunchBtn.style.color = '#00e5a0';
      }
    }
  }

  // ─── Daily card rendering ────────────────────────────────────────────────
  function refreshDailyCards() {
    const today = window.SFLDaily.getDateString();
    const todayRec = window.SFLDaily.getTodayRecord();

    // Fix 3: Show today's date in popup header
    const dateEl = document.getElementById('popupDailyDate');
    if (dateEl) {
      // Format as "Jun 4, 2026"
      const parts = today.split('-');
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      dateEl.textContent = months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    }

    window.SFLDaily.KEYS.forEach(diff => {
      const card = document.getElementById(`daily-card-${diff}`);
      if (!card) return;
      const rec = todayRec[diff] || null;

      // Clear dynamic content
      card.className = `daily-card diff-tier-${diff}`;
      const statusEl = card.querySelector('.daily-card-status');
      const timeEl   = card.querySelector('.daily-card-time');
      const actionEl = card.querySelector('.daily-card-action');

      if (!statusEl || !timeEl || !actionEl) return;

      if (!rec || (!rec.solved && !rec.gaveUp)) {
        // Not attempted
        statusEl.textContent = '';
        statusEl.className = 'daily-card-status';
        timeEl.textContent = '';
        actionEl.textContent = 'PLAY';
        actionEl.className = 'daily-card-action';
        card.classList.add('playable');
      } else if (rec.solved) {
        statusEl.textContent = '✓ SOLVED';
        statusEl.className = 'daily-card-status solved';
        timeEl.textContent = formatTime(rec.time);
        if (rec.grade) {
          timeEl.textContent += `  ${rec.grade}`;
        }
        actionEl.textContent = 'REVIEW';
        actionEl.className = 'daily-card-action review';
        card.classList.add('completed-solved');
} else {
        // gave up / failed — no solve time shown
        statusEl.textContent = '✗ FAILED';
        statusEl.className = 'daily-card-status failed';
        timeEl.textContent = '';
        actionEl.textContent = 'REVIEW';
        actionEl.className = 'daily-card-action review';
        card.classList.add('completed-failed');
      }
    });
  }

  // ─── Launch daily puzzle ─────────────────────────────────────────────────
  function launchDaily(difficulty) {
    const rec = window.SFLDaily.getDifficultyRecord(difficulty);
    const isReview = rec && (rec.solved || rec.gaveUp);

    // Review mode: restore final state, show back button, no interaction
    if (isReview) {
      closePopup();
      // Clear any saved session immediately so session.js cannot overwrite the review
      try { localStorage.removeItem('sfl_session_v1'); } catch(e) {}
      window._sflBlockSessionRestore = true;
      showLoading(true);
      // Defer so loading overlay paints first
      setTimeout(() => {
        restoreDailyFinalState(difficulty, rec);
        showLoading(false);
      }, 20);
      return;
    }

    // Fresh or in-progress daily
    closePopup();
    showLoading(true);

    // Set game mode
    if (window._sfgame && typeof window._sfgame._setMode === 'function') {
      window._sfgame._setMode(popupMode);
    }

    // Mark context
    window._sflPuzzleContext.isDaily = true;
    window._sflPuzzleContext.dailyDifficulty = difficulty;

    // Generate (or reuse cached) daily puzzle
    setTimeout(() => {
      const today = window.SFLDaily.getDateString();
      const sol = window.SFLDaily.getPuzzle(today, difficulty);
      showLoading(false);

      if (!sol) {
        alert('Could not generate today\'s puzzle. Please try again.');
        return;
      }

      window.applyNewPuzzle(sol);
      window.SFLDaily.markStarted(difficulty, sol._rating || 1000);
    }, 20);
  }

  // ─── Restore daily final state (review mode) ────────────────────────────
  function restoreDailyFinalState(difficulty, rec) {
    window._sflPuzzleContext.isDaily = true;
    window._sflPuzzleContext.dailyDifficulty = difficulty;
    window._sflPuzzleContext.isReview = true;

    // Prevent session.js from restoring a stale active-puzzle session
    // over the top of this review render.
    try { localStorage.removeItem('sfl_session_v1'); } catch(e) {}

    // Regenerate the puzzle to get clues
    const today = window.SFLDaily.getDateString();
    const sol = window.SFLDaily.getPuzzle(today, difficulty);
    if (!sol) return;

// Restore the stored rating so it doesn't get recomputed (recomputation
    // can produce different results due to WED ordering non-determinism)
    if (rec.puzzleRating) sol._rating = rec.puzzleRating;
    // Apply puzzle layout without triggering lockGame / timer
    window._sflApplyPuzzleLayout(sol);

    // Restore grid
    const gridEl = document.getElementById('grid');
    if (gridEl && rec.gridState) {
      gridEl.querySelectorAll('.cell').forEach(cell => {
        const key = cell.dataset.row + '-' + cell.dataset.value;
        const crossed = rec.gridState[key] === true;
        cell.classList.toggle('crossed', crossed);
        cell.setAttribute('aria-pressed', String(crossed));
      });
    }

    // Restore answers
    if (rec.answerState) {
      ['A','B','C','D','E','F'].forEach(id => {
        const el = document.getElementById(id);
        if (el && rec.answerState[id] !== undefined) el.value = rec.answerState[id];
      });
    }

    // Restore clue colors
    if (rec.clueStates && rec.clueStates.length) {
      const cluesList = document.getElementById('cluesList');
      if (cluesList) {
        const items = cluesList.querySelectorAll('li');
        rec.clueStates.forEach((s, i) => {
          if (!items[i]) return;
          items[i].classList.remove('clue-ok', 'clue-fail');
          if (s === 'ok') items[i].classList.add('clue-ok');
          if (s === 'fail') items[i].classList.add('clue-fail');
        });
      }
    }

    // Restore mistake boxes
    for (let i = 1; i <= 3; i++) {
      const box = document.getElementById('mistakeBox' + i);
      if (!box) continue;
      const active = !!(rec.mistakeBoxes && rec.mistakeBoxes[i - 1]);
      box.classList.toggle('active', active);
      box.textContent = active ? '✗' : '';
    }

    // Show final time in timer
    const timerEl = document.getElementById('timer');
    if (timerEl && rec.time !== undefined) {
      const m = String(Math.floor(rec.time / 60)).padStart(2, '0');
      const s = String(rec.time % 60).padStart(2, '0');
      timerEl.textContent = `${m}:${s}`;
      timerEl.className = 'timer stopped';
    }

    // Penalty display
    const penaltyEl = document.getElementById('penaltyTime');
    if (penaltyEl) {
      penaltyEl.textContent = rec.penaltyText || '';
      penaltyEl.classList.toggle('visible', !!(rec.penaltyText));
    }

    // Feedback
    const feedbackEl = document.getElementById('feedback');
    if (feedbackEl) {
      if (rec.solved) {
        feedbackEl.textContent = '✓ ALL CORRECT! - WELL DONE.';
        feedbackEl.className = 'feedback correct';
      } else {
        feedbackEl.textContent = '✗ Puzzle failed.';
        feedbackEl.className = 'feedback incorrect';
      }
    }

    // Switch button to "← Back"
    setBackMode(true);
  }

// ─── Back mode (when reviewing a solved daily) ───────────────────────────
  function setBackMode(active) {
    if (!newPuzzleBtn) return;
    if (active) {
      newPuzzleBtn.innerHTML = '<span class="btn-icon" style="font-size: 48pt;">←</span>';
      newPuzzleBtn.dataset.backMode = '1';
      // Grid stays interactive — player can toggle cells and check answers
      // Session saving is blocked separately via _sflPuzzleContext.isReview
    } else {
      newPuzzleBtn.innerHTML = '<span class="btn-icon">START</span>';
      newPuzzleBtn.dataset.backMode = '';
    }
  }

  // ─── Loading overlay helper ──────────────────────────────────────────────
  function showLoading(show) {
    let el = document.getElementById('puzzleLoadingOverlay');
    if (show) {
      if (!el) {
        el = document.createElement('div');
        el.id = 'puzzleLoadingOverlay';
        el.className = 'puzzle-loading-overlay';
        el.innerHTML = '<div class="puzzle-loading-spinner"></div><div class="puzzle-loading-text">Generating puzzle…</div>';
        document.body.appendChild(el);
      }
      el.classList.add('visible');
    } else {
      if (el) el.classList.remove('visible');
    }
  }

  // ─── Random puzzle range selector ───────────────────────────────────────
  function updateRangeDisplay() {
    const r = RANGES[currentRangeIdx];
    if (!rangeLabelEl || !rangeTierEl) return;
    rangeLabelEl.textContent = r.label;
    rangeTierEl.textContent  = r.tierLabel;
    rangeTierEl.className    = `random-range-tier rating-${r.tier}`;
    rangeLeftBtn.disabled    = currentRangeIdx === 0;
    rangeRightBtn.disabled   = currentRangeIdx === RANGES.length - 1;
  }

  // ─── Launch random puzzle ────────────────────────────────────────────────
  function launchRandom() {
    closePopup();
    showLoading(true);

    window._sflPuzzleContext.isDaily = false;
    window._sflPuzzleContext.dailyDifficulty = null;
    window._sflPuzzleContext.isReview = false;

    if (window._sfgame && typeof window._sfgame._setMode === 'function') {
      window._sfgame._setMode(popupMode);
    }

    const range = RANGES[currentRangeIdx];
    const gen   = window.generatePuzzle;
    const score = window._scorePuzzle;
    const rate  = window._computePuzzleRating;

    const CHUNK = 50, MAX = 5000;
    let tried = 0, sol = null;

    function runChunk() {
      const end = Math.min(tried + CHUNK, MAX);
      while (tried < end) {
        tried++;
        try {
          const candidate = gen();
          if (!candidate || !candidate._rawClues) continue;
          const elim   = score(candidate._rawClues, candidate);
          const rating = rate(candidate._rawClues, elim, candidate);
          if (rating >= range.min && rating <= range.max) {
            candidate._rating = rating;
            sol = candidate;
            break;
          }
        } catch (err) {
          showLoading(false);
          alert('Error generating puzzle: ' + err.message);
          return;
        }
      }

      if (sol || tried >= MAX) {
        if (!sol) {
          try {
            sol = gen();
            if (sol && sol._rawClues) {
              const elim = score(sol._rawClues, sol);
              sol._rating = rate(sol._rawClues, elim, sol);
            }
          } catch(e) {}
        }
        showLoading(false);
        if (sol) window.applyNewPuzzle(sol);
      } else {
        setTimeout(runChunk, 0);
      }
    }

    requestAnimationFrame(() => setTimeout(runChunk, 0));
  }

  // ─── Internal apply without locking (for review mode) ───────────────────
  // We expose this on window so restoreDailyFinalState can use it
  window._sflApplyPuzzleLayout = function (sol) {
    if (sol && sol.A !== undefined && sol.a === undefined) {
      sol.a = sol.A; sol.b = sol.B; sol.c = sol.C;
      sol.d = sol.D; sol.e = sol.E; sol.f = sol.F;
    }

    // Reset grid display
    window.currentSolution = sol;
    if (typeof window._sflSetCurrentSolution === 'function') window._sflSetCurrentSolution(sol);
    const undoStack = window._sflUndoStack;
    const redoStack = window._sflRedoStack;
    if (undoStack) undoStack.length = 0;
    if (redoStack) redoStack.length = 0;
    if (typeof window.updateUndoRedoBtns === 'function') window.updateUndoRedoBtns();

    ['A','B','C','D','E','F'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.value = ''; el.classList.remove('answer-duplicate'); }
    });

    const feedbackEl = document.getElementById('feedback');
    if (feedbackEl) { feedbackEl.textContent = ''; feedbackEl.className = 'feedback'; }

    // Clear grid cells
    const gridEl = document.getElementById('grid');
    if (gridEl) {
      gridEl.querySelectorAll('.cell').forEach(c => {
        c.classList.remove('crossed');
        c.setAttribute('aria-pressed', 'false');
      });
    }

// Render rating — use cached _rating if available to avoid recomputation drift
    const ratingEl = document.getElementById('puzzleRating');
    if (ratingEl && sol._rawClues && sol._rawClues.length) {
      const rating = sol._rating || (() => {
        const elim = window._scorePuzzle(sol._rawClues, sol);
        return window._computePuzzleRating(sol._rawClues, elim, sol);
      })();
      sol._rating = rating;
      document.getElementById('puzzleRatingValue').textContent = '  ★ ' + rating;
      ratingEl.className = 'puzzle-rating rating-' + window._ratingToDifficulty(rating);
      ratingEl.style.display = 'inline';
    } else if (ratingEl) {
      ratingEl.style.display = 'none';
    }

    // Render clues
    const cluesList = document.getElementById('cluesList');
    if (cluesList) {
      cluesList.innerHTML = '';
      if (sol && Array.isArray(sol._clues) && sol._clues.length) {
        sol._clues.forEach((s, idx) => {
          const li = document.createElement('li');
          li.textContent = s;
          if (typeof attachClueTooltip === 'function') {
            attachClueTooltip(li, sol._rawClues ? sol._rawClues[idx] : null);
          }
          cluesList.appendChild(li);
        });
      }
    }
  };

  // ─── Intercept daily completion ──────────────────────────────────────────
  // Hook into the result popup display to save daily record
  function patchForDailyCompletion() {
    // We hook the Glicko recordResult to intercept grade + rating after solve
    // The actual save happens in the stopTimer / give-up flow via _sfgame hooks
  }

  // ─── Save daily completion state ─────────────────────────────────────────
  function captureDailyCompletionState(solveTime, gaveUp, mistakes, penaltySecs, grade) {
    const ctx = window._sflPuzzleContext;
    if (!ctx.isDaily || !ctx.dailyDifficulty) return;

    const gridEl = document.getElementById('grid');
    const gridState = {};
    if (gridEl) {
      gridEl.querySelectorAll('.cell').forEach(cell => {
        gridState[cell.dataset.row + '-' + cell.dataset.value] =
          cell.classList.contains('crossed');
      });
    }

    const answerState = {};
    ['A','B','C','D','E','F'].forEach(id => {
      const el = document.getElementById(id);
      if (el) answerState[id] = el.value;
    });

    const clueStates = [];
    const cluesList = document.getElementById('cluesList');
    if (cluesList) {
      cluesList.querySelectorAll('li').forEach(li => {
        clueStates.push(
          li.classList.contains('clue-ok')   ? 'ok'   :
          li.classList.contains('clue-fail') ? 'fail' : ''
        );
      });
    }

    const mistakeBoxes = [false, false, false];
    for (let i = 1; i <= 3; i++) {
      const box = document.getElementById('mistakeBox' + i);
      mistakeBoxes[i - 1] = box ? box.classList.contains('active') : false;
    }

    const penaltyEl = document.getElementById('penaltyTime');
    const penaltyText = penaltyEl ? penaltyEl.textContent : '';

    const puzzleRating = (window.currentSolution && window.currentSolution._rating) || 1000;

    window.SFLDaily.markCompleted(ctx.dailyDifficulty, {
      solved: !gaveUp,
      gaveUp,
      time: solveTime,
      mistakes,
      grade,
      puzzleRating,
      gridState,
      answerState,
      clueStates,
      mistakeBoxes,
      penaltyText,
    });
  }

  // ─── Init ────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    popupOverlay   = document.getElementById('puzzleSelectOverlay');
    popupBox       = document.getElementById('puzzleSelectBox');
    modeCasualBtn  = document.getElementById('popupModeCasual');
    modeRatedBtn   = document.getElementById('popupModeRated');
    rangeLeftBtn   = document.getElementById('rangeLeftBtn');
    rangeRightBtn  = document.getElementById('rangeRightBtn');
    rangeLabelEl   = document.getElementById('rangeLabel');
    rangeTierEl    = document.getElementById('rangeTier');
    randomLaunchBtn = document.getElementById('randomLaunchBtn');
    newPuzzleBtn   = document.getElementById('newPuzzleBtn');

    if (!popupOverlay) return;

    // Mode pill
    if (modeCasualBtn) modeCasualBtn.addEventListener('click', () => setPopupMode('casual'));
    if (modeRatedBtn)  modeRatedBtn.addEventListener('click',  () => setPopupMode('rated'));

    // Range selector
    if (rangeLeftBtn) rangeLeftBtn.addEventListener('click', () => {
      if (currentRangeIdx > 0) { currentRangeIdx--; updateRangeDisplay(); }
    });
    if (rangeRightBtn) rangeRightBtn.addEventListener('click', () => {
      if (currentRangeIdx < RANGES.length - 1) { currentRangeIdx++; updateRangeDisplay(); }
    });

    // Random launch
    if (randomLaunchBtn) randomLaunchBtn.addEventListener('click', launchRandom);

    // Daily cards
    window.SFLDaily.KEYS.forEach(diff => {
      const card = document.getElementById(`daily-card-${diff}`);
      if (card) {
        card.addEventListener('click', () => {
          const rec = window.SFLDaily.getDifficultyRecord(diff);
          const isReview = rec && (rec.solved || rec.gaveUp);
          // Only launch if playable or reviewable
          launchDaily(diff);
        });
      }
    });

    // Close button
    const popupCloseBtn = document.getElementById('popupClose');
    if (popupCloseBtn) popupCloseBtn.addEventListener('click', closePopup);

    // Close on backdrop click
    if (popupOverlay) {
      popupOverlay.addEventListener('click', (e) => {
        if (e.target === popupOverlay) closePopup();
      });
    }

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && popupOverlay.classList.contains('open')) closePopup();
    });

    // ── Intercept the New Puzzle button ──────────────────────────────────
    // Remove old listener context — we capture phase to run before app.js
    newPuzzleBtn.addEventListener('click', function (e) {
      // If in back/review mode → go back to popup
      if (newPuzzleBtn.dataset.backMode === '1') {
        e.stopImmediatePropagation();
        setBackMode(false);
        window._sflPuzzleContext.isReview = false;
        openPopup();
        return;
      }
      // If game active → let forfeit logic run (app.js handles it)
      if (window._sfgame && window._sfgame.gameActive) return;
      // No game active → open popup
      e.stopImmediatePropagation();
      openPopup();
    }, true);

    // ── Hook into completion events ───────────────────────────────────────
    // We patch the SFLRating.recordResult to intercept grade info
    const origRecordResult = window.SFLRating.recordResult.bind(window.SFLRating);
    window.SFLRating.recordResult = function(solveSeconds, mistakes, puzzleRating, gaveUp) {
      const result = origRecordResult(solveSeconds, mistakes, puzzleRating, gaveUp);
      // Save daily completion if applicable (grade computed by caller)
      window._sflLastRatingResult = result;
      return result;
    };

    // We also need to capture after the grade is computed — hook stopTimer
    // The game logic fires showResultPopup from within stopTimer hook
    // We intercept at the result popup open moment
    const origShowResult = window._sfgame._showResultPopup;

    // Alternative: hook via MutationObserver on the result overlay
    // ── Hook stopTimer to catch all end-of-game events ────────────────────
    // This fires for: solve, 3-mistake auto-forfeit, and explicit forfeit.
    // The MutationObserver only catches cases where resultOverlay opens,
    // missing casual-mode forfeit. We hook stopTimer instead which always fires.
    const _origStopTimerPopup = window.stopTimer;
    window.stopTimer = function () {
      _origStopTimerPopup();
      const ctx = window._sflPuzzleContext;
      if (!ctx.isDaily || !ctx.dailyDifficulty || ctx.isReview) return;

      const timerEl = document.getElementById('timer');
      const timerText = timerEl ? timerEl.textContent : '00:00';
      const parts = timerText.split(':');
      const solveTime = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);

      let mistakes = 0;
      for (let i = 1; i <= 3; i++) {
        const box = document.getElementById('mistakeBox' + i);
        if (box && box.classList.contains('active')) mistakes++;
      }

      const fb = document.getElementById('feedback');
      const solved = fb && fb.classList.contains('correct');

      if (!solved) {
        captureDailyCompletionState(solveTime, true, mistakes, 0, 'F');
      } else {
        captureDailyCompletionState(solveTime, false, mistakes, 0, '');
      }
    };

    // Supplement: when result overlay opens after a SOLVE, update the grade
    const resultOverlay = document.getElementById('resultOverlay');
    if (resultOverlay) {
      const observer = new MutationObserver(() => {
        if (resultOverlay.classList.contains('open')) {
          setTimeout(() => {
            const ctx = window._sflPuzzleContext;
            if (!ctx.isDaily || !ctx.dailyDifficulty || ctx.isReview) return;
            const gradeEl = resultOverlay.querySelector('.result-grade-value');
            const grade = gradeEl ? gradeEl.textContent.trim() : '';
            if (!grade || grade === 'F') return; // forfeit already saved by stopTimer hook
            // Update the saved record with the grade
            const existing = window.SFLDaily.getDifficultyRecord(ctx.dailyDifficulty);
            if (existing && existing.solved) {
              window.SFLDaily.saveDifficultyRecord(ctx.dailyDifficulty, { ...existing, grade });
            }
          }, 150);
        }
      });
      observer.observe(resultOverlay, { attributes: true, attributeFilter: ['class'] });
    }

    // Initial render
    setPopupMode('casual');
    updateRangeDisplay();
    // Hide mode badge until a puzzle is in progress
    const badge = document.getElementById('modeDisplayBadge');
    if (badge) badge.style.visibility = 'hidden';
  });

  // ─── Expose for external access ─────────────────────────────────────────
  window.SFLPopup = { open: () => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', openPopup);
    } else {
      openPopup();
    }
  }};

})();
