// session.js — Six-Figure Logic mid-puzzle persistence
// ─────────────────────────────────────────────────────────────────────────────
// Requires three small patches to app.js — see bottom of this file.
// Add as the last script tag in index.html, after app.js:
//     <script src="app.js"></script>
//     <script src="session.js"></script>
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  const SAVE_KEY         = 'sfl_session_v1';
  const SAVE_INTERVAL_MS = 1000;

  // Set flag synchronously so popup.js DOMContentLoaded always sees it
  try {
    const _peek = localStorage.getItem(SAVE_KEY);
    if (_peek && !window._sflBlockSessionRestore) {
      const _peekParsed = JSON.parse(_peek);
      if (_peekParsed && _peekParsed.solution) {
        window._sflSessionRestored = true;
      }
    }
  } catch(e) {}

  // ─── Capture ──────────────────────────────────────────────────────────────

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

    // Mode — pill is now inside the popup
    let mode = 'casual';
    const casualBtn = document.getElementById('popupModeCasual');
    if (casualBtn && !casualBtn.classList.contains('active')) mode = 'rated';

    // Difficulty — diff-btns removed; use puzzle context if available
    let selectedDiff = 'easy';
    // (difficulty buttons no longer exist; selectedDiff kept for compat but unused)

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
      selectedDiff,
      savedAt:        Date.now()
    };
  }

  // ─── Storage ──────────────────────────────────────────────────────────────

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

  // ─── Autosave ─────────────────────────────────────────────────────────────

  let _autosaveHandle = null;

  function startAutosave() {
    if (_autosaveHandle) return;
    _autosaveHandle = setInterval(saveState, SAVE_INTERVAL_MS);
  }

  function stopAutosave() {
    if (_autosaveHandle) { clearInterval(_autosaveHandle); _autosaveHandle = null; }
  }

  // ─── Restore ──────────────────────────────────────────────────────────────

  function restoreSession(state) {
    if (!state || !state.solution) return;

    // 1. Mode — must set before applyNewPuzzle calls lockGame
    if (window._sfgame && typeof window._sfgame._setMode === 'function') {
      window._sfgame._setMode(state.mode || 'casual');
    }

    // 2. Difficulty visual — diff-btns removed from main page; skip
    // (popup.js owns difficulty selection now)

    // 3. Render puzzle (resets grid, starts timer, locks UI)
    window.applyNewPuzzle(state.solution);
    // Restore daily context (applyNewPuzzle/lockGame resets it to non-daily)
    if (state.puzzleContext && window._sflPuzzleContext) {
      window._sflPuzzleContext.isDaily = state.puzzleContext.isDaily || false;
      window._sflPuzzleContext.dailyDifficulty = state.puzzleContext.dailyDifficulty || null;
      window._sflPuzzleContext.isReview = false; // never restore into review mode
    }

    // 4. Fix timer — write the saved epoch directly into the real closure variable
    if (window._sflTimerStart) {
      window._sflTimerStart.set(state.startEpoch);
    }

    // 5. Restore grid
    const gridEl = document.getElementById('grid');
    if (gridEl && state.gridState) {
      gridEl.querySelectorAll('.cell').forEach(cell => {
        const crossed = state.gridState[cell.dataset.row + '-' + cell.dataset.value] === true;
        cell.classList.toggle('crossed', crossed);
        cell.setAttribute('aria-pressed', String(crossed));
      });
    }

    // 6. Restore undo/redo stacks directly into the real arrays
    if (window._sflUndoStack && state.undoSnapshots) {
      window._sflUndoStack.length = 0;
      state.undoSnapshots.forEach(s => window._sflUndoStack.push(s));
    }
    if (window._sflRedoStack && state.redoSnapshots) {
      window._sflRedoStack.length = 0;
      state.redoSnapshots.forEach(s => window._sflRedoStack.push(s));
    }
    // Refresh the undo/redo button enabled states
    if (typeof window.updateUndoRedoBtns === 'function') window.updateUndoRedoBtns();

    // 7. Answer dropdowns
    if (state.answers) {
      ['A','B','C','D','E','F'].forEach(id => {
        const el = document.getElementById(id);
        if (el && state.answers[id] !== undefined) el.value = state.answers[id];
      });
    }

    // 8. Mistake boxes
    for (let i = 1; i <= 3; i++) {
      const box = document.getElementById('mistakeBox' + i);
      if (!box) continue;
      const active = !!(state.mistakeBoxes && state.mistakeBoxes[i - 1]);
      box.classList.toggle('active', active);
      box.textContent = active ? '✗' : '';
    }

    // 9. Penalty display
    const penaltyEl = document.getElementById('penaltyTime');
    if (penaltyEl) {
      penaltyEl.textContent = state.penaltyText || '';
      penaltyEl.classList.toggle('visible', !!(state.penaltyText));
    }

    // 9b. Clue highlight states
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

// 9c. Duplicate answer highlights
if (typeof checkDuplicateAnswers === 'function') {
  checkDuplicateAnswers();
}

    // 10. Internal mistakeCount + penaltySecs
    if (window._sfgame && typeof window._sfgame._setMistakeState === 'function') {
      window._sfgame._setMistakeState(state.mistakeCount || 0, state.penaltyText || '');
    }

    // 11. Feedback banner
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

  // ─── Lifecycle hooks ──────────────────────────────────────────────────────

  setTimeout(function () {

    // Fresh puzzle started — begin autosave
    const _prevApply = window.applyNewPuzzle;
    window.applyNewPuzzle = function (sol) {
      _prevApply(sol);
      startAutosave();
      setTimeout(saveState, 100);
    };

    // Puzzle ended (solve, forfeit, auto-forfeit) — clear save
    const _prevStop = window.stopTimer;
    window.stopTimer = function () {
      _prevStop();
      stopAutosave();
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

