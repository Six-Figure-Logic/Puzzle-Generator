// popup.js — Play popup for Six-Figure Logic
// Handles the puzzle selection popup (Daily + Random), mode pill,
// daily state display, solve history, and integration with app.js / daily.js
// Load order: app.js → session.js → daily.js → popup.js

// ═══════════════════════════════════════════════════════════════════════════
// SOLVE HISTORY STORAGE
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const HISTORY_KEY = 'sfl_history_v1';
  const HISTORY_CAP = 500; // per mode (casual/rated), stored together in one array

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  }

  function saveHistory(arr) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(arr)); } catch(e) {}
  }

  window.SFLHistory = {
    record(entry) {
      // entry: { puzzleRating, mode, solveTime, mistakes, grade, gaveUp, date,
      //          sol, gridState, answerState, clueStates, mistakeBoxes, penaltyText }
      const arr = loadHistory();
      arr.unshift({ ...entry, savedAt: Date.now() });

      // Cap is per-mode — drop the oldest entry of the same mode once over cap
      const modeCounts = {};
      const trimmed = [];
      for (const e of arr) {
        const m = e.mode || 'casual';
        modeCounts[m] = (modeCounts[m] || 0) + 1;
        if (modeCounts[m] <= HISTORY_CAP) trimmed.push(e);
      }
      saveHistory(trimmed);
    },
    getAll() { return loadHistory(); },
  };
})();

(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════
  // RANDOM PUZZLE DIFFICULTY RANGES
  // ═══════════════════════════════════════════════════════════════════════

  const RANGES = [
    { min: 800,  max: 1000, label: '800–1000',  tier: 'easy',   tierLabel: 'EASY' },
    { min: 1001, max: 1200, label: '1001–1200', tier: 'medium', tierLabel: 'MEDIUM' },
    { min: 1201, max: 1400, label: '1201–1400', tier: 'medium', tierLabel: 'MEDIUM' },
    { min: 1401, max: 1600, label: '1401–1600', tier: 'hard',   tierLabel: 'HARD', locked: true, unlockRating: 1400 },
    { min: 1601, max: 1800, label: '1601–1800', tier: 'hard',   tierLabel: 'HARD', locked: true, unlockRating: 1400 },
    { min: 1801, max: 2000, label: '1801–2000', tier: 'expert',  tierLabel: 'EXPERT', locked: true, unlockRating: 1800 },
    { min: 2001, max: 2200, label: '2001–2200', tier: 'expert',  tierLabel: 'EXPERT', locked: true, unlockRating: 1800 },
    { min: 2201, max: 2400, label: '2201–2400', tier: 'expert',  tierLabel: 'EXPERT', locked: true, unlockRating: 1800 },
    { min: 2401, max: 2600, label: '2401–2600', tier: 'extreme', tierLabel: 'EXTREME', locked: true, unlockRating: 2400 },
    { min: 2601, max: 9999, label: '2601+',     tier: 'extreme', tierLabel: 'EXTREME', locked: true, unlockRating: 2400 },
  ];

  // Player's live rating, used to gate the locked Extreme tier above.
  function getPlayerRating() {
    try {
      return (window.SFLRating && window.SFLRating.getProfile().rating) || 800;
    } catch (e) { return 800; }
  }

  function isRangeLocked(range) {
    if (popupMode !== 'rated') return false; // tiers only lock in rated mode, always open in casual
    return !!(range.locked && getPlayerRating() < range.unlockRating);
  }

  let currentRangeIdx = 0;
  let popupMode = 'casual';

  window._sflPuzzleContext = {
    isDaily: false,
    dailyDifficulty: null,
    dailyDate: null,
  };

  // ─── DOM refs (assigned on DOMContentLoaded) ────────────────────────────
  let dailyOverlay, randomOverlay;
  let modeCasualBtn, modeRatedBtn;
  let rangeLeftBtn, rangeRightBtn, rangeLabelEl, rangeTierEl;
  let randomLaunchBtn, newPuzzleBtn;

  // ═══════════════════════════════════════════════════════════════════════
  // MAIN MENU ⇄ GAME LAYOUT
  // ═══════════════════════════════════════════════════════════════════════

  function showMainMenu() {
    const menu = document.getElementById('mainMenu');
    const layout = document.querySelector('.main-layout');
    const topbars = document.querySelectorAll('.topbar');
    if (menu) menu.style.display = 'flex';
    if (layout) layout.classList.add('hidden');
    topbars.forEach(t => t.classList.add('hidden'));
    if (newPuzzleBtn) newPuzzleBtn.style.display = 'none';
    const badge = document.getElementById('modeDisplayBadge');
    if (badge) badge.style.visibility = 'hidden';
  }

  function showGameLayout() {
    const menu = document.getElementById('mainMenu');
    const layout = document.querySelector('.main-layout');
    const topbars = document.querySelectorAll('.topbar');
    if (menu) menu.style.display = 'none';
    if (layout) layout.classList.remove('hidden');
    topbars.forEach(t => t.classList.remove('hidden'));
    if (newPuzzleBtn) {
      newPuzzleBtn.style.removeProperty('display');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // POPUP OPEN / CLOSE
  // ═══════════════════════════════════════════════════════════════════════

  function openDailyPopup() {
    refreshDailyCards();
    if (dailyOverlay) dailyOverlay.classList.add('open');
  }
  function closeDailyPopup() {
    if (dailyOverlay) dailyOverlay.classList.remove('open');
  }

  function openRandomPopup() {
    updateRangeDisplay();
    if (randomOverlay) randomOverlay.classList.add('open');
  }
  function closeRandomPopup() {
    if (randomOverlay) randomOverlay.classList.remove('open');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MODE PILL (Random popup only — daily puzzles are always casual)
  // ═══════════════════════════════════════════════════════════════════════

  function setPopupMode(mode) {
    popupMode = mode;
    if (modeCasualBtn) modeCasualBtn.classList.toggle('active', mode === 'casual');
    if (modeRatedBtn)  modeRatedBtn.classList.toggle('active', mode === 'rated');
    const badge = document.getElementById('modeDisplayBadge');
    if (badge) {
      badge.textContent = mode === 'rated' ? 'RATED' : 'CASUAL';
      badge.className = 'mode-display-badge mode-display-' + mode;
    }
    if (window._sfgame && typeof window._sfgame._setMode === 'function') {
      window._sfgame._setMode(mode);
    }
    applyLaunchBtnModeStyle(mode);
    updateRangeDisplay();
  }

  function applyLaunchBtnModeStyle(mode) {
    if (!randomLaunchBtn || isRangeLocked(RANGES[currentRangeIdx])) return;
    if (mode === 'rated') {
      randomLaunchBtn.style.background = 'var(--accent-dim)';
      randomLaunchBtn.style.borderColor = 'rgba(232,255,71,0.35)';
      randomLaunchBtn.style.color = 'var(--accent)';
    } else {
      randomLaunchBtn.style.background = '';
      randomLaunchBtn.style.borderColor = '';
      randomLaunchBtn.style.color = '';
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────
  function formatTime(secs) {
    if (!secs && secs !== 0) return '--:--';
    const m = Math.floor(secs / 60);
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // DAILY CARD RENDERING
  // ═══════════════════════════════════════════════════════════════════════

  function refreshDailyCards() {
    const today = window.SFLDaily.getDateString();
    const todayRec = window.SFLDaily.getTodayRecord();

    const dateEl = document.getElementById('popupDailyDate');
    if (dateEl) {
      const parts = today.split('-');
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      dateEl.textContent = months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    }

    window.SFLDaily.KEYS.forEach(diff => {
      const card = document.getElementById(`daily-card-${diff}`);
      if (!card) return;
      const rec = todayRec[diff] || null;

      card.className = `daily-card diff-tier-${diff}`;
      const statusEl = card.querySelector('.daily-card-status');
      const timeEl   = card.querySelector('.daily-card-time');
      const actionEl = card.querySelector('.daily-card-action');
      if (!statusEl || !timeEl || !actionEl) return;

      if (!rec || (!rec.solved && !rec.gaveUp)) {
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
        if (rec.grade) timeEl.textContent += `  ${rec.grade}`;
        actionEl.textContent = 'REVIEW';
        actionEl.className = 'daily-card-action review';
        card.classList.add('completed-solved');
      } else {
        statusEl.textContent = '✗ FAILED';
        statusEl.className = 'daily-card-status failed';
        timeEl.textContent = '';
        actionEl.textContent = 'REVIEW';
        actionEl.className = 'daily-card-action review';
        card.classList.add('completed-failed');
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LAUNCH DAILY PUZZLE (always casual)
  // ═══════════════════════════════════════════════════════════════════════

  function launchDaily(difficulty) {
    const rec = window.SFLDaily.getDifficultyRecord(difficulty);
    const isReview = rec && (rec.solved || rec.gaveUp);

    if (isReview) {
      // Force-neutralize any live in-progress puzzle before repurposing shared UI
      // (mistake boxes, newPuzzleBtn, gameActive) for an unrelated completed daily.
      // Without this, gameActive stays true and the "< Back" button collides with
      // app.js's own Forfeit?/Give-Up capture listener on the same element.
      if (window._sfgame && window._sfgame.gameActive && typeof window._sfgame._forceEndGame === 'function') {
        window._sfgame._forceEndGame();
      }
      closeDailyPopup();
      try { localStorage.removeItem(window.SFLSession.SAVE_KEY); } catch(e) {}
      window._sflBlockSessionRestore = true;
      showLoading(true);
      showGameLayout();
      setTimeout(() => {
        restoreDailyFinalState(difficulty, rec);
        showLoading(false);
      }, 20);
      return;
    }

    if (window._sfgame && window._sfgame.gameActive && typeof window._sfgame._forceEndGame === 'function') {
      window._sfgame._forceEndGame();
    }
    closeDailyPopup();
    showLoading(true);
    showGameLayout();

    setPopupMode('casual');
    if (window._sfgame && typeof window._sfgame._setMode === 'function') {
      window._sfgame._setMode('casual');
    }

    window._sflPuzzleContext.isDaily = true;
    window._sflPuzzleContext.dailyDifficulty = difficulty;
    window._sflPuzzleContext.dailyDate = window.SFLDaily.getDateString();

    setTimeout(() => {
      const today = window.SFLDaily.getDateString();
      const sol = window.SFLDaily.getPuzzle(today, difficulty);
      showLoading(false);
      if (!sol) { alert('Could not generate today\'s puzzle. Please try again.'); return; }
      window.applyNewPuzzle(sol);
      window.SFLDaily.markStarted(difficulty, sol._rating || 1000);
    }, 20);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RESTORE A COMPLETED DAILY INTO REVIEW MODE
  // ═══════════════════════════════════════════════════════════════════════

  function restoreDailyFinalState(difficulty, rec) {
    window._sflPuzzleContext.isDaily = true;
    window._sflPuzzleContext.dailyDifficulty = difficulty;
    window._sflPuzzleContext.isReview = true;

    try { localStorage.removeItem(window.SFLSession.SAVE_KEY); } catch(e) {}

    const today = window.SFLDaily.getDateString();
    const sol = window.SFLDaily.getPuzzle(today, difficulty);
    if (!sol) return;
    if (rec.puzzleRating) sol._rating = rec.puzzleRating;
    window._sflApplyPuzzleLayout(sol);

    const gridEl = document.getElementById('grid');
    if (gridEl && rec.gridState) {
      gridEl.querySelectorAll('.cell').forEach(cell => {
        const key = cell.dataset.row + '-' + cell.dataset.value;
        const crossed = rec.gridState[key] === true;
        cell.classList.toggle('crossed', crossed);
        cell.setAttribute('aria-pressed', String(crossed));
      });
    }

    if (rec.answerState) {
      ['A','B','C','D','E','F'].forEach(id => {
        const el = document.getElementById(id);
        if (el && rec.answerState[id] !== undefined) el.value = rec.answerState[id];
      });
    }

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

    for (let i = 1; i <= 3; i++) {
      const box = document.getElementById('mistakeBox' + i);
      if (!box) continue;
      const active = !!(rec.mistakeBoxes && rec.mistakeBoxes[i - 1]);
      box.classList.toggle('active', active);
      box.textContent = active ? '✗' : '';
    }

    const timerEl = document.getElementById('timer');
    if (timerEl && rec.time !== undefined) {
      const m = String(Math.floor(rec.time / 60)).padStart(2, '0');
      const s = String(rec.time % 60).padStart(2, '0');
      timerEl.textContent = `${m}:${s}`;
      timerEl.className = 'timer stopped';
    }

    const penaltyEl = document.getElementById('penaltyTime');
    if (penaltyEl) {
      penaltyEl.textContent = rec.penaltyText || '';
      penaltyEl.classList.toggle('visible', !!(rec.penaltyText));
    }

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

    setBackMode(true);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // "BACK" / "< BACK" BUTTON STATE
  // ═══════════════════════════════════════════════════════════════════════

  function setBackMode(active) {
    if (!newPuzzleBtn) return;
    const solBtn = document.getElementById('showSolutionBtn');
    const hintBtn = document.getElementById('hintBtn');
    if (active) {
      newPuzzleBtn.innerHTML = '<span class="btn-icon">< Back</span>';
      newPuzzleBtn.dataset.backMode = '1';
      if (solBtn) solBtn.style.display = '';
      // Reviewing any puzzle (even a rated one) is free analysis —
      // hint should be available just like show-solution.
      if (hintBtn) hintBtn.style.display = '';
    } else {
      newPuzzleBtn.innerHTML = '<span class="btn-icon">START</span>';
      newPuzzleBtn.dataset.backMode = '';
      if (solBtn) solBtn.style.display = 'none';
      if (hintBtn) hintBtn.style.display = 'none';
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LOADING OVERLAY (spinner shown during puzzle generation)
  // ═══════════════════════════════════════════════════════════════════════

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

  // ═══════════════════════════════════════════════════════════════════════
  // RANDOM PUZZLE RANGE SELECTOR
  // ═══════════════════════════════════════════════════════════════════════

  function updateRangeDisplay() {
    const r = RANGES[currentRangeIdx];
    if (!rangeLabelEl || !rangeTierEl) return;
    const locked = isRangeLocked(r);

    rangeLabelEl.textContent = r.label;
    rangeTierEl.textContent  = locked ? `🔒 ${r.tierLabel}` : r.tierLabel;
    rangeTierEl.className    = `random-range-tier rating-${r.tier}`;

    if (locked) {
      const tip = `Reach a rating of ${r.unlockRating}+ to unlock ${r.tierLabel} puzzles (you're currently ${getPlayerRating()}).`;
      rangeTierEl.title  = tip;
      rangeLabelEl.title = tip;
      rangeTierEl.style.cursor  = 'help';
      rangeLabelEl.style.cursor = 'help';
    } else {
      rangeTierEl.title  = '';
      rangeLabelEl.title = '';
      rangeTierEl.style.cursor  = '';
      rangeLabelEl.style.cursor = '';
    }

    if (randomLaunchBtn) {
      randomLaunchBtn.disabled = locked;
      randomLaunchBtn.title = locked
        ? `Reach a rating of ${r.unlockRating}+ to unlock ${r.tierLabel} puzzles.`
        : '';
      if (locked) {
        randomLaunchBtn.style.background   = 'rgba(150,150,150,0.12)';
        randomLaunchBtn.style.borderColor  = 'rgba(150,150,150,0.35)';
        randomLaunchBtn.style.color        = '#8a8a8a';
        randomLaunchBtn.style.cursor       = 'not-allowed';
      } else {
        randomLaunchBtn.style.background  = '';
        randomLaunchBtn.style.borderColor = '';
        randomLaunchBtn.style.color       = '';
        randomLaunchBtn.style.cursor      = '';
        applyLaunchBtnModeStyle(popupMode); // re-apply the casual/rated pill styling
      }
    }

    if (rangeLeftBtn)  rangeLeftBtn.disabled  = currentRangeIdx === 0;
    if (rangeRightBtn) rangeRightBtn.disabled = currentRangeIdx === RANGES.length - 1;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LAUNCH RANDOM PUZZLE — generates in chunks so the UI can repaint
  // ═══════════════════════════════════════════════════════════════════════

  function launchRandom() {
    if (window._sfgame && window._sfgame.gameActive && typeof window._sfgame._forceEndGame === 'function') {
      window._sfgame._forceEndGame();
    }
    closeRandomPopup();
    showLoading(true);
    showGameLayout();

    window._sflPuzzleContext.isDaily = false;
    window._sflPuzzleContext.dailyDifficulty = null;
    window._sflPuzzleContext.isReview = false;

    if (window._sfgame && typeof window._sfgame._setMode === 'function') {
      window._sfgame._setMode(popupMode);
    }

   const range = RANGES[currentRangeIdx];
    if (isRangeLocked(range)) return; // guarded UI shouldn't allow this, but double-check
    const gen   = window.generatePuzzle;
    const score = window._scorePuzzle;
    const rate  = window._computePuzzleRating;
    const CHUNK = 50, MAX = 5000;
    let tried = 0, sol = null;

// Pool size per attempt. Expert & Extreme (1801+) redraws with a random pool size
    // between 10–25 each time to vary the difficulty and reduce generation speed.
    function nextPoolSize() {
      return range.min >= 1801 ? 10 + Math.floor(Math.random() * 16) : 10; // expert: 10..25
    }

    function runChunk() {
      const end = Math.min(tried + CHUNK, MAX);
      while (tried < end) {
        tried++;
        try {
          const candidate = gen(nextPoolSize(), range.tier === 'hard' || range.tier === 'expert' || range.tier === 'extreme');
          if (!candidate || !candidate._rawClues) continue;
          const elim = score(candidate._rawClues, candidate);
          // ── perf: skip expensive WED calc, see maxPossibleRating ──
          if (window._maxPossibleRating(elim) < range.min) continue;
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
            sol = gen(nextPoolSize(), range.tier === 'hard' || range.tier === 'expert' || range.tier === 'extreme');
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

  // ═══════════════════════════════════════════════════════════════════════
  // SHARED PUZZLE LAYOUT APPLICATION (review mode — no timer/lock side effects)
  // ═══════════════════════════════════════════════════════════════════════

  window._sflApplyPuzzleLayout = function (sol) {
    if (window._sflClearHintGlow) window._sflClearHintGlow();
    if (sol && sol.A !== undefined && sol.a === undefined) {
      sol.a = sol.A; sol.b = sol.B; sol.c = sol.C;
      sol.d = sol.D; sol.e = sol.E; sol.f = sol.F;
    }
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

    const gridEl = document.getElementById('grid');
    if (gridEl) {
      gridEl.querySelectorAll('.cell').forEach(c => {
        c.classList.remove('crossed');
        c.setAttribute('aria-pressed', 'false');
      });
    }

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

  // ═══════════════════════════════════════════════════════════════════════
  // SAVE DAILY COMPLETION STATE (grid/answers/clues at time of solve/forfeit)
  // ═══════════════════════════════════════════════════════════════════════

  function captureDailyCompletionState(solveTime, gaveUp, mistakes, penaltySecs, grade) {
    const ctx = window._sflPuzzleContext;
    if (!ctx.isDaily || !ctx.dailyDifficulty) return;
    // Puzzle spanned the midnight ET rollover — leave today's daily slot untouched so it's still playable. 
    // Solve history recording (separate code path below, unaffected by this) still captures the result.
    if (ctx.dailyDate && ctx.dailyDate !== window.SFLDaily.getDateString())
      return;

    const gridEl = document.getElementById('grid');
    const gridState = {};
    if (gridEl) {
      gridEl.querySelectorAll('.cell').forEach(cell => {
        gridState[cell.dataset.row + '-' + cell.dataset.value] = cell.classList.contains('crossed');
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
        clueStates.push(li.classList.contains('clue-ok') ? 'ok' : li.classList.contains('clue-fail') ? 'fail' : '');
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
      solved: !gaveUp, gaveUp, time: solveTime, mistakes, grade,
      puzzleRating, gridState, answerState, clueStates, mistakeBoxes, penaltyText,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INIT — DOM wiring, event listeners, lifecycle hooks
  // ═══════════════════════════════════════════════════════════════════════

  document.addEventListener('DOMContentLoaded', function () {
    dailyOverlay    = document.getElementById('dailySelectOverlay');
    randomOverlay   = document.getElementById('randomSelectOverlay');
    modeCasualBtn   = document.getElementById('popupModeCasual');
    modeRatedBtn    = document.getElementById('popupModeRated');
    rangeLeftBtn    = document.getElementById('rangeLeftBtn');
    rangeRightBtn   = document.getElementById('rangeRightBtn');
    rangeLabelEl    = document.getElementById('rangeLabel');
    rangeTierEl     = document.getElementById('rangeTier');
    randomLaunchBtn = document.getElementById('randomLaunchBtn');
    newPuzzleBtn    = document.getElementById('newPuzzleBtn');

    // ── Main menu buttons ──────────────────────────────────────────────
    const menuHowTo   = document.getElementById('menuHowToPlayBtn');
    const menuTut     = document.getElementById('menuTutorialBtn');
    const menuDaily   = document.getElementById('menuDailyBtn');
    const menuRandom  = document.getElementById('menuRandomBtn');

    if (menuHowTo)  menuHowTo.addEventListener('click', () => {
      const modal = document.getElementById('tutorialModal');
      if (modal) modal.classList.add('open');
    });
    if (menuTut)    menuTut.addEventListener('click',   () => {
      if (typeof openWorkedExample === 'function') openWorkedExample();
    });
    if (menuDaily)  menuDaily.addEventListener('click',  openDailyPopup);
    if (menuRandom) menuRandom.addEventListener('click', openRandomPopup);

    // ── Mode pill (random popup) ───────────────────────────────────────
    if (modeCasualBtn) modeCasualBtn.addEventListener('click', () => setPopupMode('casual'));
    if (modeRatedBtn)  modeRatedBtn.addEventListener('click',  () => setPopupMode('rated'));

    // ── Range selector ─────────────────────────────────────────────────
    if (rangeLeftBtn) rangeLeftBtn.addEventListener('click', () => {
      if (currentRangeIdx > 0) { currentRangeIdx--; updateRangeDisplay(); }
    });
    if (rangeRightBtn) rangeRightBtn.addEventListener('click', () => {
      if (currentRangeIdx < RANGES.length - 1) { currentRangeIdx++; updateRangeDisplay(); }
    });

    // ── Random launch ──────────────────────────────────────────────────
    if (randomLaunchBtn) randomLaunchBtn.addEventListener('click', launchRandom);

    // ── Daily cards ─────────────────────────────────────────────────────
    window.SFLDaily.KEYS.forEach(diff => {
      const card = document.getElementById(`daily-card-${diff}`);
      if (card) card.addEventListener('click', () => launchDaily(diff));
    });

    // ── Popup close buttons ────────────────────────────────────────────
    const dailyClose  = document.getElementById('dailyPopupClose');
    const randomClose = document.getElementById('randomPopupClose');
    if (dailyClose)  dailyClose.addEventListener('click',  closeDailyPopup);
    if (randomClose) randomClose.addEventListener('click', closeRandomPopup);

    if (dailyOverlay)  dailyOverlay.addEventListener('click',  e => { if (e.target === dailyOverlay)  closeDailyPopup(); });
    if (randomOverlay) randomOverlay.addEventListener('click', e => { if (e.target === randomOverlay) closeRandomPopup(); });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeDailyPopup();
        closeRandomPopup();
      }
    });

    // ═══════════════════════════════════════════════════════════════════
    // NEW PUZZLE / BACK BUTTON — routes to forfeit (app.js) or back nav
    // ═══════════════════════════════════════════════════════════════════
    if (newPuzzleBtn) {
      newPuzzleBtn.addEventListener('click', function (e) {
        // Back/review mode — return to history or daily popup
        if (newPuzzleBtn.dataset.backMode === '1') {
          e.stopImmediatePropagation();
          setBackMode(false);
          const fromHistory = window._sflPuzzleContext.fromHistory;
          window._sflPuzzleContext.isReview    = false;
          window._sflPuzzleContext.fromHistory = false;
          showMainMenu();
          if (fromHistory) {
            setTimeout(openHistoryOverlay, 50);
          } else if (window._sflPuzzleContext && window._sflPuzzleContext.isDaily) {
            setTimeout(openDailyPopup, 50);
          }
          return;
        }
        // Game active — let app.js's forfeit handler run (don't intercept)
        if (window._sfgame && window._sfgame.gameActive) return;
        // No game active and not in popup flow — go to main menu
        e.stopImmediatePropagation();
        showMainMenu();
      }, true);
    }

    // ═══════════════════════════════════════════════════════════════════
    // RATING RESULT PATCH — stash the last result for the share popover
    // ═══════════════════════════════════════════════════════════════════
    const origRecordResult = window.SFLRating.recordResult.bind(window.SFLRating);
    window.SFLRating.recordResult = function(solveSeconds, mistakes, puzzleRating, gaveUp) {
      const result = origRecordResult(solveSeconds, mistakes, puzzleRating, gaveUp);
      window._sflLastRatingResult = result;
      return result;
    };

    // ═══════════════════════════════════════════════════════════════════
    // STOPTIMER HOOK — saves daily completion state + records solve history
    // ═══════════════════════════════════════════════════════════════════
    const _origStopTimer = window.stopTimer;
    window.stopTimer = function () {
      _origStopTimer();
      const ctx = window._sflPuzzleContext;
      if (ctx.isReview) return;

      // Guard against duplicate recording if stopTimer fires again for the
      // same puzzle (e.g. user re-checks after already solving/failing).
      const _sol = window.currentSolution;
      if (_sol && _sol._sflResultRecorded) return;
      if (_sol) _sol._sflResultRecorded = true;

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
      const gaveUp = !solved;

      // Daily completion save
      if (ctx.isDaily && ctx.dailyDifficulty) {
        captureDailyCompletionState(solveTime, gaveUp, mistakes, 0, solved ? '' : 'F');
      }

      // History record — capture full puzzle state for replay.
      // Delayed so the grade element in the result popup is rendered first.
      setTimeout(() => {
        const sol = window.currentSolution;
        if (!sol) return;
        const puzzleRating = sol._rating || 1000;
        const mode = (window._sfgame && window._sfgame._getMode) ? window._sfgame._getMode() : 'casual';
        const grade = (() => {
          if (typeof window._computeLetterGrade === 'function') {
            return window._computeLetterGrade(solveTime, mistakes, puzzleRating, 1000, gaveUp);
          }
          return gaveUp ? 'F' : '?';
        })();

        const gridEl = document.getElementById('grid');
        const gridState = {};
        if (gridEl) {
          gridEl.querySelectorAll('.cell').forEach(cell => {
            gridState[cell.dataset.row + '-' + cell.dataset.value] = cell.classList.contains('crossed');
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
            clueStates.push(li.classList.contains('clue-ok') ? 'ok' : li.classList.contains('clue-fail') ? 'fail' : '');
          });
        }
        const mistakeBoxes = [false, false, false];
        for (let i = 1; i <= 3; i++) {
          const box = document.getElementById('mistakeBox' + i);
          mistakeBoxes[i - 1] = box ? box.classList.contains('active') : false;
        }
        const penaltyEl = document.getElementById('penaltyTime');
        const penaltyText = penaltyEl ? penaltyEl.textContent : '';

        const now = new Date();
        const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const dateStr = months[now.getMonth()] + ' ' + now.getDate() + ', ' + now.getFullYear();

        window.SFLHistory.record({
          puzzleRating,
          mode,
          solveTime,
          mistakes,
          grade,
          gaveUp,
          date: dateStr,
          sol: { ...sol },
          gridState,
          answerState,
          clueStates,
          mistakeBoxes,
          penaltyText,
        });
      }, 100);
    };

    // ═══════════════════════════════════════════════════════════════════
    // GRADE BACKFILL — once the result popup renders a grade for a daily,
    // attach it to the saved daily record
    // ═══════════════════════════════════════════════════════════════════
    const resultOverlay = document.getElementById('resultOverlay');
    if (resultOverlay) {
      const observer = new MutationObserver(() => {
        if (resultOverlay.classList.contains('open')) {
          setTimeout(() => {
            const ctx = window._sflPuzzleContext;
            if (!ctx.isDaily || !ctx.dailyDifficulty || ctx.isReview) return;
            const gradeEl = resultOverlay.querySelector('.result-grade-value');
            const grade = gradeEl ? gradeEl.textContent.trim() : '';
            if (!grade || grade === 'F') return;
            const existing = window.SFLDaily.getDifficultyRecord(ctx.dailyDifficulty);
            if (existing && existing.solved) {
              window.SFLDaily.saveDifficultyRecord(ctx.dailyDifficulty, { ...existing, grade });
            }
          }, 150);
        }
      });
      observer.observe(resultOverlay, { attributes: true, attributeFilter: ['class'] });
    }

    // ═══════════════════════════════════════════════════════════════════
    // RESULT POPUP CLOSE — return to daily popup if puzzle was a daily
    // ═══════════════════════════════════════════════════════════════════
    const resultCloseBtn = document.getElementById('resultCloseBtn');
    if (resultCloseBtn) {
      resultCloseBtn.addEventListener('click', () => {
        const ctx = window._sflPuzzleContext;
        if (ctx && ctx.isDaily && !ctx.isReview) {
          setBackMode(false);
          ctx.isReview = false;
          showMainMenu();
          setTimeout(openDailyPopup, 50);
        }
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // SOLVE HISTORY OVERLAY
    // ═══════════════════════════════════════════════════════════════════
    const historyOverlay  = document.getElementById('historyOverlay');
    const historyClose    = document.getElementById('historyPopupClose');
    const historyTabs     = document.querySelectorAll('.history-tab');
    const historyBody     = document.getElementById('historyTableBody');
    const historyEmpty    = document.getElementById('historyEmpty');
    const historyTable    = document.getElementById('historyTable');
    const menuHistoryBtn  = document.getElementById('menuHistoryBtn');

    let _historyTab = 'casual';
    let _sortCol    = 'puzzleRating';
    let _sortDir    = 'desc';

    function gradeColor(g) {
      if (!g || g === 'F')       return 'var(--danger)';
      if (g.startsWith('A'))     return 'var(--success)';
      if (g.startsWith('B'))     return '#7ecfff';
      if (g.startsWith('C'))     return 'var(--accent)';
      return '#ffa032';
    }

    function ratingColor(r) {
      if (r <= 1000) return { color: '#00e5a0', bg: 'rgba(0,229,160,0.12)', border: 'rgba(0,229,160,0.4)' };
      if (r <= 1400) return { color: 'var(--accent)', bg: 'rgba(232,255,71,0.10)', border: 'rgba(232,255,71,0.4)' };
      if (r <= 1800) return { color: '#ffa032', bg: 'rgba(255,160,50,0.12)', border: 'rgba(255,160,50,0.4)' };
      if (r <= 2400) return { color: 'var(--danger)', bg: 'rgba(255,77,106,0.12)', border: 'rgba(255,77,106,0.4)' };
      return { color: '#a855f7', bg: 'rgba(168,85,247,0.14)', border: 'rgba(168,85,247,0.45)' };
    }

    function fmtTime(secs) {
      if (secs === null || secs === undefined) return '--:--';
      const m = Math.floor(secs / 60);
      const s = String(secs % 60).padStart(2, '0');
      return `${m}:${s}`;
    }

    const GRADE_ORDER = ['A+','A','A−','B+','B','B−','C+','C','C−','D+','D','D−','F'];

    function sortValue(entry, col) {
      switch(col) {
        case 'puzzleRating': return entry.puzzleRating || 0;
        case 'solveTime':    return entry.gaveUp ? Infinity : (entry.solveTime || 0);
        case 'mistakes':     return entry.mistakes || 0;
        case 'grade':        return GRADE_ORDER.indexOf(entry.grade) === -1 ? 99 : GRADE_ORDER.indexOf(entry.grade);
        case 'date':         return entry.savedAt || 0;
        default:             return 0;
      }
    }

    function renderHistory() {
      const all = window.SFLHistory.getAll().filter(e => e.mode === _historyTab);
      const sorted = all.slice().sort((a, b) => {
        const av = sortValue(a, _sortCol), bv = sortValue(b, _sortCol);
        return _sortDir === 'asc' ? av - bv : bv - av;
      });

      historyTable.querySelectorAll('th').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.col === _sortCol) th.classList.add(_sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
        const arrow = th.querySelector('.sort-arrow');
        if (arrow) arrow.textContent = '↕';
      });
      const activeHeader = historyTable.querySelector(`th[data-col="${_sortCol}"] .sort-arrow`);
      if (activeHeader) activeHeader.textContent = _sortDir === 'asc' ? '↑' : '↓';

      historyBody.innerHTML = '';
      if (sorted.length === 0) {
        historyEmpty.style.display = '';
        historyTable.style.display = 'none';
        return;
      }
      historyEmpty.style.display = 'none';
      historyTable.style.display = '';

      sorted.forEach((entry) => {
        const rc = ratingColor(entry.puzzleRating || 0);
        const gc = gradeColor(entry.grade);
        const timeDisplay = entry.gaveUp ? '<span style="color:var(--danger)">FAILED</span>' : fmtTime(entry.solveTime);
        const mistakesDisplay = entry.mistakes > 0
          ? `<span style="color:var(--danger)">${entry.mistakes}</span>`
          : '<span style="color:var(--success)">—</span>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><span class="history-rating-chip" style="color:${rc.color};background:${rc.bg};border-color:${rc.border}">${entry.puzzleRating || '?'}</span></td>
          <td>${timeDisplay}</td>
          <td>${mistakesDisplay}</td>
          <td><span class="history-grade" style="color:${gc}">${entry.grade || '?'}</span></td>
          <td style="color:var(--text-muted);font-size:11px">${entry.date || ''}</td>
        `;
        tr.addEventListener('click', () => launchHistoryReview(entry));
        historyBody.appendChild(tr);
      });
    }

    function openHistoryOverlay() {
      renderHistory();
      if (historyOverlay) historyOverlay.classList.add('open');
    }
    function closeHistoryOverlay() {
      if (historyOverlay) historyOverlay.classList.remove('open');
    }

    function launchHistoryReview(entry) {
      if (!entry.sol) return;
      closeHistoryOverlay();
      if (window._sfgame && window._sfgame.gameActive && typeof window._sfgame._forceEndGame === 'function') {
        window._sfgame._forceEndGame();
      }
      try { localStorage.removeItem(window.SFLSession.SAVE_KEY); } catch(e) {}
      window._sflBlockSessionRestore = true;

      showLoading(true);
      showGameLayout();

      setTimeout(() => {
        window._sflPuzzleContext.isDaily    = false;
        window._sflPuzzleContext.dailyDifficulty = null;
        window._sflPuzzleContext.isReview   = true;
        window._sflPuzzleContext.fromHistory = true;

        const rec = entry;
        const sol = entry.sol;
        window._sflApplyPuzzleLayout(sol);

        // Grid
        const gridEl = document.getElementById('grid');
        if (gridEl && rec.gridState) {
          gridEl.querySelectorAll('.cell').forEach(cell => {
            const key = cell.dataset.row + '-' + cell.dataset.value;
            const crossed = rec.gridState[key] === true;
            cell.classList.toggle('crossed', crossed);
            cell.setAttribute('aria-pressed', String(crossed));
          });
        }

        // Answers
        if (rec.answerState) {
          ['A','B','C','D','E','F'].forEach(id => {
            const el = document.getElementById(id);
            if (el && rec.answerState[id] !== undefined) el.value = rec.answerState[id];
          });
        }

        // Clue states
        if (rec.clueStates && rec.clueStates.length) {
          const cl = document.getElementById('cluesList');
          if (cl) {
            cl.querySelectorAll('li').forEach((li, i) => {
              li.classList.remove('clue-ok', 'clue-fail');
              if (rec.clueStates[i] === 'ok')   li.classList.add('clue-ok');
              if (rec.clueStates[i] === 'fail')  li.classList.add('clue-fail');
            });
          }
        }

        // Mistake boxes
        for (let i = 1; i <= 3; i++) {
          const box = document.getElementById('mistakeBox' + i);
          if (!box) continue;
          const active = !!(rec.mistakeBoxes && rec.mistakeBoxes[i - 1]);
          box.classList.toggle('active', active);
          box.textContent = active ? '✗' : '';
        }

        // Timer
        const timerEl = document.getElementById('timer');
        if (timerEl) {
          if (rec.gaveUp) {
            timerEl.textContent = '--:--';
          } else {
            const m = String(Math.floor(rec.solveTime / 60)).padStart(2, '0');
            const s = String(rec.solveTime % 60).padStart(2, '0');
            timerEl.textContent = `${m}:${s}`;
          }
          timerEl.className = 'timer stopped';
        }

        // Penalty
        const penaltyEl = document.getElementById('penaltyTime');
        if (penaltyEl) {
          penaltyEl.textContent = rec.penaltyText || '';
          penaltyEl.classList.toggle('visible', !!(rec.penaltyText));
        }

        // Feedback
        const feedbackEl = document.getElementById('feedback');
        if (feedbackEl) {
          if (rec.gaveUp) {
            feedbackEl.textContent = '✗ Puzzle failed.';
            feedbackEl.className = 'feedback incorrect';
          } else {
            feedbackEl.textContent = '✓ ALL CORRECT! - WELL DONE.';
            feedbackEl.className = 'feedback correct';
          }
        }

        setBackMode(true);
        showLoading(false);
      }, 20);
    }

    // Tab switching
    historyTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        historyTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        _historyTab = tab.dataset.htab;
        renderHistory();
      });
    });

    // Column sort
    if (historyTable) {
      historyTable.querySelectorAll('th[data-col]').forEach(th => {
        th.addEventListener('click', () => {
          const col = th.dataset.col;
          if (_sortCol === col) {
            _sortDir = _sortDir === 'desc' ? 'asc' : 'desc';
          } else {
            _sortCol = col;
            _sortDir = col === 'puzzleRating' ? 'desc' : 'asc';
          }
          renderHistory();
        });
      });
    }

    if (menuHistoryBtn) menuHistoryBtn.addEventListener('click', openHistoryOverlay);
    if (historyClose)   historyClose.addEventListener('click',  closeHistoryOverlay);
    if (historyOverlay) historyOverlay.addEventListener('click', e => {
      if (e.target === historyOverlay) closeHistoryOverlay();
    });

// ── Initial state on page load ─────────────────────────────────────
    updateRangeDisplay();
    try {
      const _s = localStorage.getItem(window.SFLSession.SAVE_KEY);
      const _parsed = _s ? JSON.parse(_s) : null;
      const _hasSave = !!(_parsed && _parsed.solution);
      setPopupMode(_hasSave ? (_parsed.mode || 'casual') : 'casual');
      if (_hasSave) {
        showGameLayout();
      } else {
        showMainMenu();
      }
    } catch(e) {
      setPopupMode('casual');
      showMainMenu();
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════
  window.SFLPopup = {
    openDaily:   openDailyPopup,
    openRandom:  openRandomPopup,
    showMenu:    showMainMenu,
    showGame:    showGameLayout,
  };

  // ═══════════════════════════════════════════════════════════════════════
  // SHOW SOLUTION MODAL (review mode)
  // ═══════════════════════════════════════════════════════════════════════
  const showSolutionBtn = document.getElementById('showSolutionBtn');
  const solutionModal   = document.getElementById('solutionModal');
  const solutionClose   = document.getElementById('solutionModalClose');
  const solutionBody    = document.getElementById('solutionModalBody');

  function openSolutionModal() {
    const sol = window.currentSolution;
    if (!sol || !solutionBody) return;
    const labels = ['A','B','C','D','E','F'];
    solutionBody.innerHTML = labels.map(l => `
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px;
                  background:var(--surface2);border:1px solid var(--border-bright);
                  border-radius:8px;padding:10px 6px;">
        <span style="font-family:var(--mono);font-size:18px;font-weight:700;
                     color:var(--text-muted);">${l}</span>
        <span style="font-family:var(--mono);font-size:28px;
                     font-weight:700;color:var(--accent);">${sol[l] !== undefined ? sol[l] : sol[l.toLowerCase()]}</span>
      </div>
    `).join('');
    solutionModal.classList.add('open');
  }

  if (showSolutionBtn) showSolutionBtn.addEventListener('click', openSolutionModal);
  if (solutionClose)   solutionClose.addEventListener('click',  () => solutionModal.classList.remove('open'));
  if (solutionModal)   solutionModal.addEventListener('click',  e => {
    if (e.target === solutionModal) solutionModal.classList.remove('open');
  });

})();
