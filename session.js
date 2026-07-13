// session.js — Six-Figure Logic mid-puzzle persistence
// Autosaves the live puzzle (grid, answers, undo stack, timer, mistakes) to
// localStorage every second, and restores it on page load if present.
// Load order: app.js → session.js → daily.js → popup.js

(function () {
  'use strict';

  const SAVE_KEY         = 'sfl_session_v1';
  const SAVE_DEBOUNCE_MS = 500;
  window.SFLSession = { SAVE_KEY, triggerSave: () => scheduleSave() };

  // ═══════════════════════════════════════════════════════════════════════
  // CAPTURE — snapshot all live DOM/game state into a plain object
  // ═══════════════════════════════════════════════════════════════════════

  function captureState() {
    if (!window._sfgame || !window._sfgame.gameActive) return null;
    if (!window.currentSolution)                        return null;

    // Grid
    const gridEl    = document.getElementById('grid');
    const gridState = {};
    if (gridEl) {
      gridEl.querySelectorAll('.cell').forEach(cell => {
        gridState[cell.dataset.row + '-' + cell.dataset.value] =
          cell.classList.contains('crossed');
      });
    }

    // Undo / redo stacks — window._sflUndoStack IS the real array (by reference)
    const undoSnapshots = window._sflUndoStack ? window._sflUndoStack.slice() : [];
    const redoSnapshots = window._sflRedoStack ? window._sflRedoStack.slice() : [];

    // Answer dropdowns
    const answers = {};
    ['A','B','C','D','E','F'].forEach(id => {
      const el = document.getElementById(id);
      if (el) answers[id] = el.value;
    });

    // Mistake boxes
    const mistakeBoxes = [false, false, false];
    for (let i = 1; i <= 3; i++) {
      const box = document.getElementById('mistakeBox' + i);
      mistakeBoxes[i - 1] = box ? box.classList.contains('active') : false;
    }

    // Penalty text
    const penaltyEl   = document.getElementById('penaltyTime');
    const penaltyText = penaltyEl ? penaltyEl.textContent : '';

    // Clue highlight states
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

    // Mode — read from game state directly, not popup DOM (popup may be hidden)
    const mode = (window._sfgame && typeof window._sfgame._getMode === 'function')
      ? window._sfgame._getMode()
      : 'casual';

    // Timer start epoch — read directly from the real closure variable
    const startEpoch = window._sflTimerStart ? window._sflTimerStart.get() : Date.now();

    return {
      puzzleContext:  window._sflPuzzleContext ? { ...window._sflPuzzleContext } : null,
      solution:       window.currentSolution,
      gridState,
      undoSnapshots,
      redoSnapshots,
      answers,
      mistakeBoxes,
      mistakeCount:   mistakeBoxes.filter(Boolean).length,
      penaltyText,
      clueStates,
      startEpoch,
      mode,
      savedAt:        Date.now()
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STORAGE
  // ═══════════════════════════════════════════════════════════════════════

  function saveState() {
    const state = captureState();
    if (!state) { try { localStorage.removeItem(SAVE_KEY); } catch(e) {} return; }
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch(e) {}
  }

  function clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch(e) {}
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // AUTOSAVE TIMER
  // ═══════════════════════════════════════════════════════════════════════

  let _saveDebounceHandle = null;

  function scheduleSave() {
    if (_saveDebounceHandle) return; // a save is already pending
    _saveDebounceHandle = setTimeout(() => {
      _saveDebounceHandle = null;
      saveState();
    }, SAVE_DEBOUNCE_MS);
  }

  function cancelScheduledSave() {
    if (_saveDebounceHandle) { clearTimeout(_saveDebounceHandle); _saveDebounceHandle = null; }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RESTORE — rebuild DOM/game state from a saved snapshot
  // ═══════════════════════════════════════════════════════════════════════

  function restoreSession(state) {
    if (!state || !state.solution) return;

    // 1. Mode — must set before applyNewPuzzle calls lockGame
    const restoredMode = state.mode || 'casual';
    if (window._sfgame && typeof window._sfgame._setMode === 'function') {
      window._sfgame._setMode(restoredMode);
    }
    // Sync pill button visual
    const casualBtn = document.getElementById('popupModeCasual');
    const ratedBtn  = document.getElementById('popupModeRated');
    if (casualBtn && ratedBtn) {
      casualBtn.classList.toggle('active', restoredMode === 'casual');
      ratedBtn.classList.toggle('active',  restoredMode === 'rated');
    }
    // Sync mode badge above reset button
    const badge = document.getElementById('modeDisplayBadge');
    if (badge) {
      badge.textContent = restoredMode === 'rated' ? 'RATED' : 'CASUAL';
      badge.className   = 'mode-display-badge ' + (restoredMode === 'rated' ? 'mode-display-rated' : 'mode-display-casual');
      badge.style.visibility = 'visible';
    }

    // 2. Render puzzle (resets grid, starts timer, locks UI)
    window.applyNewPuzzle(state.solution);

    // Restore daily context (applyNewPuzzle/lockGame resets it to non-daily)
        if (state.puzzleContext && window._sflPuzzleContext) {
      window._sflPuzzleContext.isDaily = state.puzzleContext.isDaily || false;
      window._sflPuzzleContext.dailyDifficulty = state.puzzleContext.dailyDifficulty || null;
      window._sflPuzzleContext.dailyDate = state.puzzleContext.dailyDate || null;
      window._sflPuzzleContext.isReview = false; // never restore into review mode
    }

    // 3. Fix timer — write the saved epoch directly into the real closure variable
    if (window._sflTimerStart) {
      window._sflTimerStart.set(state.startEpoch);
    }

    // 4. Restore grid
    const gridEl = document.getElementById('grid');
    if (gridEl && state.gridState) {
      gridEl.querySelectorAll('.cell').forEach(cell => {
        const crossed = state.gridState[cell.dataset.row + '-' + cell.dataset.value] === true;
        cell.classList.toggle('crossed', crossed);
        cell.setAttribute('aria-pressed', String(crossed));
      });
    }

    // 5. Restore undo/redo stacks directly into the real arrays
    if (window._sflUndoStack && state.undoSnapshots) {
      window._sflUndoStack.length = 0;
      state.undoSnapshots.forEach(s => window._sflUndoStack.push(s));
    }
    if (window._sflRedoStack && state.redoSnapshots) {
      window._sflRedoStack.length = 0;
      state.redoSnapshots.forEach(s => window._sflRedoStack.push(s));
    }
    if (typeof window.updateUndoRedoBtns === 'function') window.updateUndoRedoBtns();

    // 6. Answer dropdowns
    if (state.answers) {
      ['A','B','C','D','E','F'].forEach(id => {
        const el = document.getElementById(id);
        if (el && state.answers[id] !== undefined) el.value = state.answers[id];
      });
    }

    // 6b. Rebuild letterLocks so grid/dropdown revert logic works post-restore
    if (typeof window._sflRebuildLetterLocks === 'function') {
      window._sflRebuildLetterLocks();
    }

    // 7. Mistake boxes
    for (let i = 1; i <= 3; i++) {
      const box = document.getElementById('mistakeBox' + i);
      if (!box) continue;
      const active = !!(state.mistakeBoxes && state.mistakeBoxes[i - 1]);
      box.classList.toggle('active', active);
      box.textContent = active ? '✗' : '';
    }

    // 8. Penalty display
    const penaltyEl = document.getElementById('penaltyTime');
    if (penaltyEl) {
      penaltyEl.textContent = state.penaltyText || '';
      penaltyEl.classList.toggle('visible', !!(state.penaltyText));
    }

    // 9. Clue highlight states
    if (state.clueStates && state.clueStates.length) {
      const cluesList = document.getElementById('cluesList');
      if (cluesList) {
        const items = cluesList.querySelectorAll('li');
        state.clueStates.forEach((s, i) => {
          if (!items[i]) return;
          items[i].classList.remove('clue-ok', 'clue-fail');
          if (s === 'ok')   items[i].classList.add('clue-ok');
          if (s === 'fail') items[i].classList.add('clue-fail');
        });
      }
    }

    // 10. Duplicate answer highlights
    if (typeof checkDuplicateAnswers === 'function') {
      checkDuplicateAnswers();
    }

    // 11. Internal mistakeCount + penaltySecs
    if (window._sfgame && typeof window._sfgame._setMistakeState === 'function') {
      window._sfgame._setMistakeState(state.mistakeCount || 0, state.penaltyText || '');
    }

    // 12. Feedback banner
    const feedbackEl = document.getElementById('feedback');
    if (feedbackEl) {
      feedbackEl.textContent = '⟳ Session restored';
      feedbackEl.className   = 'feedback';
      setTimeout(() => {
        if (feedbackEl.textContent.includes('restored')) {
          feedbackEl.textContent = '';
          feedbackEl.className   = 'feedback';
        }
      }, 4000);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // LIFECYCLE HOOKS — wrap app.js's applyNewPuzzle/stopTimer, wire up
  // autosave triggers, and restore on load
  // ═══════════════════════════════════════════════════════════════════════

  setTimeout(function () {

    // Fresh puzzle started
    const _prevApply = window.applyNewPuzzle;
    window.applyNewPuzzle = function (sol) {
      _prevApply(sol);
      setTimeout(saveState, 100);
    };

    // Puzzle ended (solve, forfeit, auto-forfeit) — clear save
    const _prevStop = window.stopTimer;
    window.stopTimer = function () {
      _prevStop();
      cancelScheduledSave();
      clearSave();
    };

    window.addEventListener('beforeunload', saveState);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveState();
    });

    const saved = loadState();
    if (saved && !window._sflBlockSessionRestore) {
      restoreSession(saved);
      if (window.SFLPopup && typeof window.SFLPopup.showGame === 'function') {
        window.SFLPopup.showGame();
      }
    }

  }, 0);

})();
