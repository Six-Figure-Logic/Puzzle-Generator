// app.js - vertical A-F rows, compact 1..10 left-to-right
const gridEl = document.getElementById('grid');
const newPuzzleBtn = document.getElementById('newPuzzleBtn');
const checkBtn = document.getElementById('checkBtn');
const resetGridBtn = document.getElementById('resetGridBtn');
const feedbackEl = document.getElementById('feedback');

const inputIds = ['A','B','C','D','E','F'];
const inputs = {};
inputIds.forEach(id => inputs[id] = document.getElementById(id));

let currentSolution = null;

//timer variables
let timerInterval = null;
let timerStart = 0;
window._sflTimerStart = { get: () => timerStart, set: (v) => { timerStart = v; } };

const timerEl = document.getElementById('timer');

function startTimer() {
  timerStart = Date.now();

  clearInterval(timerInterval);

  timerEl.className = 'timer running';

  timerInterval = setInterval(() => {
    const elapsedSeconds = Math.floor((Date.now() - timerStart) / 1000);

    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;

    const m = String(minutes).padStart(2, '0');
    const s = String(seconds).padStart(2, '0');

    timerEl.textContent = `${m}:${s}`;
  }, 250);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerEl.className = 'timer stopped';
}

function resetTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerSeconds = 0;
  timerEl.textContent = '00:00';
  timerEl.className = 'timer';
}


// Build grid as rows A..F, columns 1..10 left-to-right
function buildGridRows() {
  gridEl.innerHTML = '';
  for (let r = 0; r < inputIds.length; r++) {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'row';
    // row header (A..F)
    const header = document.createElement('div');
    header.className = 'row-header';
    header.textContent = inputIds[r];
    rowDiv.appendChild(header);

    // cells container
    const cellsWrap = document.createElement('div');
    cellsWrap.className = 'row-cells';

    for (let n = 1; n <= 10; n++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.tabIndex = 0;
      cell.setAttribute('role','button');
      cell.setAttribute('aria-pressed','false');
      cell.dataset.row = inputIds[r];
      cell.dataset.value = String(n);
      cell.textContent = String(n);

      // LEFT CLICK: lock this value — eliminate row + column, fill answer
      cell.addEventListener('click', (e) => {
        e.preventDefault();
        pushHistory();
        const lockedRow = cell.dataset.row;
        const lockedVal = cell.dataset.value;

        // Cross out all other cells in the same row (same letter, different value)
        gridEl.querySelectorAll(`.cell[data-row="${lockedRow}"]`).forEach(c => {
          if (c.dataset.value !== lockedVal) {
            c.classList.add('crossed');
            c.setAttribute('aria-pressed', 'true');
          }
        });

        // Cross out all other cells in the same column (same value, different letter)
        gridEl.querySelectorAll(`.cell[data-value="${lockedVal}"]`).forEach(c => {
          if (c.dataset.row !== lockedRow) {
            c.classList.add('crossed');
            c.setAttribute('aria-pressed', 'true');
          }
        });

        // Keep the clicked cell itself clear
        cell.classList.remove('crossed');
        cell.setAttribute('aria-pressed', 'false');

        // Assign value to the corresponding answer dropdown
        const select = document.getElementById(lockedRow);
        if (select) select.value = lockedVal;
        checkDuplicateAnswers();
      });

      cell.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleCell(cell);
        }
      });

      // RIGHT CLICK: simple toggle cross
      cell.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        toggleCell(cell);
      });

      cellsWrap.appendChild(cell);
    }

    rowDiv.appendChild(cellsWrap);
    gridEl.appendChild(rowDiv);
  }
}

// ── Undo / Redo ──────────────────────────────────────────────────────────────
const undoStack = [];
const redoStack = [];
window._sflUndoStack = undoStack;
window._sflRedoStack = redoStack;
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');

function getGridSnapshot() {
  const snap = {};
  gridEl.querySelectorAll('.cell').forEach(c => {
    snap[c.dataset.row + '-' + c.dataset.value] = c.classList.contains('crossed');
  });
  return snap;
}

function applyGridSnapshot(snap) {
  gridEl.querySelectorAll('.cell').forEach(c => {
    const crossed = snap[c.dataset.row + '-' + c.dataset.value] || false;
    c.classList.toggle('crossed', crossed);
    c.setAttribute('aria-pressed', String(crossed));
  });
}

function pushHistory() {
  undoStack.push(getGridSnapshot());
  redoStack.length = 0;
  updateUndoRedoBtns();
}

function updateUndoRedoBtns() {
  if (undoBtn) undoBtn.disabled = undoStack.length === 0;
  if (redoBtn) redoBtn.disabled = redoStack.length === 0;
  window.updateUndoRedoBtns = updateUndoRedoBtns;
}

if (undoBtn) undoBtn.addEventListener('click', () => {
  if (!undoStack.length) return;
  redoStack.push(getGridSnapshot());
  applyGridSnapshot(undoStack.pop());
  updateUndoRedoBtns();
});

if (redoBtn) redoBtn.addEventListener('click', () => {
  if (!redoStack.length) return;
  undoStack.push(getGridSnapshot());
  applyGridSnapshot(redoStack.pop());
  updateUndoRedoBtns();
});

function toggleCell(cell) {
  pushHistory();
  const isCrossed = cell.classList.toggle('crossed');
  cell.setAttribute('aria-pressed', String(isCrossed));
  updateUndoRedoBtns();
}

function resetGrid() {
  pushHistory();
  gridEl.querySelectorAll('.cell.crossed').forEach(c => {
    c.classList.remove('crossed');
    c.setAttribute('aria-pressed','false');
  });
  updateUndoRedoBtns();
}

// Populate selects 1..10
function populateAnswerSelects() {
  inputIds.forEach(id => {
    const el = document.getElementById(id);
    el.innerHTML = '<option value="">—</option>';
    for (let n = 1; n <= 10; n++) {
      const opt = document.createElement('option');
      opt.value = String(n);
      opt.textContent = String(n);
      el.appendChild(opt);
    }
    el.addEventListener('change', checkDuplicateAnswers);
  });
}

function checkDuplicateAnswers() {
  const vals = inputIds.map(id => document.getElementById(id).value);
  const counts = {};
  vals.forEach(v => { if (v) counts[v] = (counts[v] || 0) + 1; });
  inputIds.forEach((id, i) => {
    const el = document.getElementById(id);
    const isDupe = vals[i] && counts[vals[i]] > 1;
    el.classList.toggle('answer-duplicate', isDupe);
  });
}

// ======= Puzzle generator translated from VBA to JS =======
// Drop this into app.js and call generatePuzzle() from your UI.
// Returns { A:.., B:.., C:.., D:.., E:.., F:.., _clues: [ ... ] }

(function(){
  // --- Lookups and globals ---
  const PrimeLookup = new Array(11).fill(false);
  const EvenLookup = new Array(11).fill(false);
  const ValidProductsList = [];

  function initLookups() {
    // primes 1..10 (VBA hardcoded)
    PrimeLookup[1] = false;
    PrimeLookup[2] = true;
    PrimeLookup[3] = true;
    PrimeLookup[4] = false;
    PrimeLookup[5] = true;
    PrimeLookup[6] = false;
    PrimeLookup[7] = true;
    PrimeLookup[8] = false;
    PrimeLookup[9] = false;
    PrimeLookup[10] = false;
    for (let i = 1; i <= 10; i++) EvenLookup[i] = (i % 2 === 0);

    // valid products (VBA list)
    const list = [6,8,9,10,12,14,15,16,18,20,21,24,27,28,30,32,35,36,40,42,45,48,50,54,56,60,63,70,72,80,90];
    for (let v of list) ValidProductsList.push(v);
  }

  // --- Utilities ---
  function randInt(maxExclusive) { return Math.floor(Math.random() * maxExclusive); }
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  const varNames = ["A","B","C","D","E","F"];

  // --- MakeRandomSolution (6 unique values from 1..10) ---
  function makeRandomSolution() {
    const arr = Array.from({length:10}, (_,i)=>i+1);
    shuffle(arr);
    return { a: arr[0], b: arr[1], c: arr[2], d: arr[3], e: arr[4], f: arr[5] };
  }

  // --- Clue factory: structure {Var1,Var2,Var3,Operator,Value,Var1Index,Var2Index,Var3Index} ---
  function makeClue() {
    return { Var1:"", Var2:"", Var3:"", Operator:"", Value:0, Var1Index:0, Var2Index:0, Var3Index:0 };
  }

  // --- GenerateRandomClue (18 types) ---
  function generateRandomClue(sol) {
    const vals = [sol.a, sol.b, sol.c, sol.d, sol.e, sol.f];
    let attempts = 0;

    // Declare all variables used across switch cases at function scope
    // to avoid "Cannot access 'X' before initialization" TDZ errors.
    let i, j, k;
    let vi, vj, vk;
    let innerTries;
    let maxV, maxIdx, minV, minIdx;

    while (attempts++ < 500) {
      const c = makeClue();
      const typeId = Math.floor(Math.random() * 18) + 1;

      switch(typeId) {
        case 1: // sum pair
          i = randInt(6); j = randInt(6); while (j===i) j = randInt(6);
          c.Var1 = varNames[i]; c.Var2 = varNames[j]; c.Operator = "+"; c.Value = vals[i] + vals[j];
          c.Var1Index = i+1; c.Var2Index = j+1; return c;

        case 2: // product pair
          i = randInt(6); j = randInt(6); while (j===i) j = randInt(6);
          c.Var1 = varNames[i]; c.Var2 = varNames[j]; c.Operator = "*"; c.Value = vals[i] * vals[j];
          c.Var1Index = i+1; c.Var2Index = j+1; return c;

        case 3: // diff (larger - smaller)
          i = randInt(6); j = randInt(6); while (j===i) j = randInt(6);
          vi = vals[i]; vj = vals[j];
          if (vi > vj) { c.Var1 = varNames[i]; c.Var2 = varNames[j]; c.Var1Index = i+1; c.Var2Index = j+1; }
          else { c.Var1 = varNames[j]; c.Var2 = varNames[i]; c.Var1Index = j+1; c.Var2Index = i+1; }
          c.Operator = "-"; c.Value = Math.abs(vi - vj); return c;

        case 4: // comparison > or <
          i = randInt(6); j = randInt(6); while (j===i) j = randInt(6);
          c.Var1 = varNames[i]; c.Var2 = varNames[j]; c.Var1Index = i+1; c.Var2Index = j+1;
          c.Operator = (vals[i] > vals[j]) ? ">" : "<"; c.Value = 0; return c;

        case 5: // parity unary
          i = randInt(6);
          c.Var1 = varNames[i]; c.Var1Index = i+1;
          c.Operator = EvenLookup[vals[i]] ? "even" : "odd"; c.Value = 0; return c;

        case 6: // prime unary
          i = randInt(6);
          c.Var1 = varNames[i]; c.Var1Index = i+1;
          c.Operator = PrimeLookup[vals[i]] ? "prime" : "not prime"; c.Value = 0; return c;

        case 7: // largest
          maxV = vals[0]; maxIdx = 0;
          for (let t=1;t<6;t++){ if (vals[t] > maxV){ maxV = vals[t]; maxIdx = t; } }
          c.Var1 = varNames[maxIdx]; c.Var1Index = maxIdx+1; c.Operator = "largest"; return c;

        case 8: // smallest
          minV = vals[0]; minIdx = 0;
          for (let t=1;t<6;t++){ if (vals[t] < minV){ minV = vals[t]; minIdx = t; } }
          c.Var1 = varNames[minIdx]; c.Var1Index = minIdx+1; c.Operator = "smallest"; return c;

        case 9: // not largest (random non-max)
          maxV = vals[0]; maxIdx = 0;
          for (let t=1;t<6;t++){ if (vals[t] > maxV){ maxV = vals[t]; maxIdx = t; } }
          i = randInt(6); while (i===maxIdx) i = randInt(6);
          c.Var1 = varNames[i]; c.Var1Index = i+1; c.Operator = "not largest"; return c;

        case 10: // not smallest
          minV = vals[0]; minIdx = 0;
          for (let t=1;t<6;t++){ if (vals[t] < minV){ minV = vals[t]; minIdx = t; } }
          i = randInt(6); while (i===minIdx) i = randInt(6);
          c.Var1 = varNames[i]; c.Var1Index = i+1; c.Operator = "not smallest"; return c;

        case 11: // adjacent
          innerTries = 0;
          do {
            i = randInt(6); j = randInt(6); innerTries++;
            if (i!==j && Math.abs(vals[i]-vals[j])===1) {
              c.Var1 = varNames[i]; c.Var2 = varNames[j]; c.Operator = "adjacent";
              c.Var1Index = i+1; c.Var2Index = j+1; return c;
            }
          } while (innerTries < 50);
          break;

        case 12: // xor even
          innerTries = 0;
          do {
            i = randInt(6); j = randInt(6); innerTries++;
            if (i!==j && (EvenLookup[vals[i]] ^ EvenLookup[vals[j]])) {
              c.Var1 = varNames[i]; c.Var2 = varNames[j]; c.Operator = "xor even";
              c.Var1Index = i+1; c.Var2Index = j+1; return c;
            }
          } while (innerTries < 50);
          break;

        case 13: // xor prime
          innerTries = 0;
          do {
            i = randInt(6); j = randInt(6); innerTries++;
            if (i!==j && (PrimeLookup[vals[i]] ^ PrimeLookup[vals[j]])) {
              c.Var1 = varNames[i]; c.Var2 = varNames[j]; c.Operator = "xor prime";
              c.Var1Index = i+1; c.Var2Index = j+1; return c;
            }
          } while (innerTries < 50);
          break;

        case 14: // between
          innerTries = 0;
          do {
            i = randInt(6); j = randInt(6); k = randInt(6); innerTries++;
            if (i!==j && i!==k && j!==k) {
              vi = vals[i]; vj = vals[j]; vk = vals[k];
              if ((vi > vj && vi < vk) || (vi > vk && vi < vj)) {
                c.Var1 = varNames[i]; c.Var2 = varNames[j]; c.Var3 = varNames[k];
                c.Operator = "between"; c.Var1Index = i+1; c.Var2Index = j+1; c.Var3Index = k+1; return c;
              }
            }
          } while (innerTries < 100);
          break;

        case 15: // closer
          innerTries = 0;
          do {
            i = randInt(6); j = randInt(6); k = randInt(6); innerTries++;
            if (i!==j && i!==k && j!==k) {
              vi = vals[i]; vj = vals[j]; vk = vals[k];
              if (Math.abs(vi - vj) < Math.abs(vi - vk)) {
                c.Var1 = varNames[i]; c.Var2 = varNames[j]; c.Var3 = varNames[k];
                c.Operator = "closer"; c.Var1Index = i+1; c.Var2Index = j+1; c.Var3Index = k+1; return c;
              }
            }
          } while (innerTries < 100);
          break;

        case 16: // not between
          innerTries = 0;
          do {
            i = randInt(6); j = randInt(6); k = randInt(6); innerTries++;
            if (i!==j && i!==k && j!==k) {
              vi = vals[i]; vj = vals[j]; vk = vals[k];
              if (!((vi > vj && vi < vk) || (vi > vk && vi < vj))) {
                c.Var1 = varNames[i]; c.Var2 = varNames[j]; c.Var3 = varNames[k];
                c.Operator = "not between"; c.Var1Index = i+1; c.Var2Index = j+1; c.Var3Index = k+1; return c;
              }
            }
          } while (innerTries < 100);
          break;

        case 17: // no sum
          innerTries = 0;
          do {
            const sumN = 5 + Math.floor(Math.random() * 13); // 5..17
            let hasPairSum = false;
            for (let p=0;p<6 && !hasPairSum;p++){
              for (let q=p+1;q<6;q++){
                if (vals[p] + vals[q] === sumN) { hasPairSum = true; break; }
              }
            }
            innerTries++;
            if (!hasPairSum) { c.Operator = "no sum"; c.Value = sumN; return c; }
          } while (innerTries < 30);
          break;

        case 18: // no product
          innerTries = 0;
          do {
            const prodN = ValidProductsList[Math.floor(Math.random() * ValidProductsList.length)];
            let hasPairProd = false;
            for (let p=0;p<6 && !hasPairProd;p++){
              for (let q=p+1;q<6;q++){
                if (vals[p] * vals[q] === prodN) { hasPairProd = true; break; }
              }
            }
            innerTries++;
            if (!hasPairProd) { c.Operator = "no product"; c.Value = prodN; return c; }
          } while (innerTries < 50);
          break;
      } // switch
    } // attempts loop

    // fallback: return a simple parity clue
    const fallback = makeClue();
    fallback.Var1 = "A"; fallback.Var1Index = 1; fallback.Operator = (EvenLookup[sol.a] ? "even" : "odd");
    return fallback;
  }

  // --- Clue to human string ---
  function clueToString(c) {
    if (!c || !c.Operator) return "";
    switch(c.Operator) {
      case "+": return `${c.Var1} + ${c.Var2} = ${c.Value}`;
      case "*": return `${c.Var1} * ${c.Var2} = ${c.Value}`;
      case "-": return `${c.Var1} - ${c.Var2} = ${c.Value}`;
      case ">": return `${c.Var1} > ${c.Var2}`;
      case "<": return `${c.Var1} < ${c.Var2}`;
      case "even": return `${c.Var1} is even`;
      case "odd": return `${c.Var1} is odd`;
      case "prime": return `${c.Var1} is prime`;
      case "not prime": return `${c.Var1} is not prime`;
      case "adjacent": return `${c.Var1} is adjacent to ${c.Var2}`;
      case "xor even": return `${c.Var1} or ${c.Var2} is even (but not both)`;
      case "xor prime": return `${c.Var1} or ${c.Var2} is prime (but not both)`;
      case "between": return `${c.Var1} is between ${c.Var2} and ${c.Var3}`;
      case "not between": return `${c.Var1} is not between ${c.Var2} and ${c.Var3}`;
      case "closer": return `${c.Var1} is closer to ${c.Var2} than to ${c.Var3}`;
      case "largest": return `${c.Var1} is the largest`;
      case "smallest": return `${c.Var1} is the smallest`;
      case "not largest": return `${c.Var1} is not the largest`;
      case "not smallest": return `${c.Var1} is not the smallest`;
      case "no sum": return `No two letters sum to ${c.Value}`;
      case "no product": return `No two letters multiply to ${c.Value}`;
      default: return `${c.Var1} ${c.Operator} ${c.Value}`;
    }
  }

  // --- CheckClue (evaluate a clue against a candidate solution) ---
  function checkClue(sol, c) {
    const arr = [sol.a, sol.b, sol.c, sol.d, sol.e, sol.f];
    const v1 = c.Var1Index > 0 ? arr[c.Var1Index - 1] : 0;
    const v2 = c.Var2Index > 0 ? arr[c.Var2Index - 1] : 0;
    const v3 = c.Var3Index > 0 ? arr[c.Var3Index - 1] : 0;

    switch(c.Operator) {
      case "+": return (v1 + v2 === c.Value);
      case "-": return (v1 - v2 === c.Value);
      case "*": return (v1 * v2 === c.Value);
      case ">": return (v1 > v2);
      case "<": return (v1 < v2);
      case "even": return EvenLookup[v1];
      case "odd": return !EvenLookup[v1];
      case "prime": return PrimeLookup[v1];
      case "not prime": return !PrimeLookup[v1];
      case "adjacent": return Math.abs(v1 - v2) === 1;
      case "xor even":
        if (!v1 || !v2) return false;
        return (EvenLookup[v1] ^ EvenLookup[v2]);
      case "xor prime":
        if (!v1 || !v2) return false;
        return (PrimeLookup[v1] ^ PrimeLookup[v2]);
      case "between":
        return ((v1 > v2 && v1 < v3) || (v1 > v3 && v1 < v2));
      case "not between":
        return !((v1 > v2 && v1 < v3) || (v1 > v3 && v1 < v2));
      case "closer":
        return (Math.abs(v1 - v2) < Math.abs(v1 - v3));
      case "largest": {
        const maxV = Math.max(sol.a, sol.b, sol.c, sol.d, sol.e, sol.f);
        return v1 === maxV;
      }
      case "smallest": {
        const minV = Math.min(sol.a, sol.b, sol.c, sol.d, sol.e, sol.f);
        return v1 === minV;
      }
      case "not largest": {
        const maxV = Math.max(sol.a, sol.b, sol.c, sol.d, sol.e, sol.f);
        return v1 !== maxV;
      }
      case "not smallest": {
        const minV = Math.min(sol.a, sol.b, sol.c, sol.d, sol.e, sol.f);
        return v1 !== minV;
      }
      case "no sum": {
        const target = c.Value;
        for (let p=0;p<6;p++) for (let q=p+1;q<6;q++) if (arr[p] + arr[q] === target) return false;
        return true;
      }
      case "no product": {
        const target = c.Value;
        for (let p=0;p<6;p++) for (let q=p+1;q<6;q++) if (arr[p] * arr[q] === target) return false;
        return true;
      }
      default: return false;
    }
  }

  // --- Fixed: findSolutionsForClues ---
// Key fix: "global" clues (no sum, no product, largest, smallest, not largest, not smallest)
// have Var indices of 0 and must be checked only at the leaf (varIndex === 6).
// Clues with all indices <= varIndex are checked eagerly. Others wait for the leaf.
function findSolutionsForClues(clues, maxSolutions = 2) {
  const solutions = [];
  const sol = { a: 0, b: 0, c: 0, d: 0, e: 0, f: 0 };
  const keys = ['a','b','c','d','e','f'];

  // Partition clues once: those that need all 6 values vs those that can prune early
  const globalClues = [];   // checked only when all 6 are assigned
  const partialClues = [];  // checked as soon as their vars are assigned

  // These operators compare one variable against ALL others, so they can only be
  // evaluated correctly when every variable has been assigned. Checking them early
  // (when some vars are still 0) corrupts the max/min calculation and allows wrong
  // solutions through (root cause of the "multiple solutions" bug).
  const GLOBAL_OPS = new Set(['largest','smallest','not largest','not smallest','no sum','no product']);

  for (const c of clues) {
    if (GLOBAL_OPS.has(c.Operator)) {
      globalClues.push(c);
    } else {
      const maxIdx = Math.max(c.Var1Index || 0, c.Var2Index || 0, c.Var3Index || 0);
      if (maxIdx === 0) globalClues.push(c);
      else partialClues.push({ clue: c, maxIdx });
    }
  }

  function backtrack(varIndex, usedMask) {
    if (solutions.length >= maxSolutions) return;

    if (varIndex === 7) {
      // Check all global clues (need full assignment)
      for (const c of globalClues) {
        if (!checkClue(sol, c)) return;
      }
      solutions.push({ ...sol });
      return;
    }

    const key = keys[varIndex - 1];
    for (let n = 1; n <= 10; n++) {
      const bit = 1 << (n - 1);
      if (usedMask & bit) continue;

      sol[key] = n;

      // Early pruning: check partial clues fully assigned up to varIndex
      let ok = true;
      for (const { clue, maxIdx } of partialClues) {
        if (maxIdx === varIndex) {          // all vars of this clue now assigned
          if (!checkClue(sol, clue)) { ok = false; break; }
        }
      }

      if (ok) backtrack(varIndex + 1, usedMask | bit);
      if (solutions.length >= maxSolutions) return;
    }
    sol[key] = 0;
  }

  backtrack(1, 0);
  return solutions;
}

  // --- HasTrivialXorClues (detect trivial XOR + direct parity/primality clues) ---
  function hasTrivialXorClues(clues) {
    for (let i=0;i<clues.length;i++) {
      const ci = clues[i];
      if (ci.Operator === "xor even") {
        const xorVar1 = ci.Var1Index, xorVar2 = ci.Var2Index;
        for (let j=0;j<clues.length;j++) {
          if (i===j) continue;
          const cj = clues[j];
          if ((cj.Operator === "even" || cj.Operator === "odd") &&
              (cj.Var1Index === xorVar1 || cj.Var1Index === xorVar2)) return true;
        }
      }
      if (ci.Operator === "xor prime") {
        const xorVar1 = ci.Var1Index, xorVar2 = ci.Var2Index;
        for (let j=0;j<clues.length;j++) {
          if (i===j) continue;
          const cj = clues[j];
          if ((cj.Operator === "prime" || cj.Operator === "not prime") &&
              (cj.Var1Index === xorVar1 || cj.Var1Index === xorVar2)) return true;
        }
      }
    }
    return false;
  }

  // --- Greedy prune: remove any clue that is redundant while preserving uniqueness (uses robust solver) ---
  function greedyPruneClues(clues, originalSolution) {
    // start with all clues, try removing each one and keep removal if uniqueness remains
    const final = clues.slice();
    let changed = true;
    while (changed) {
      changed = false;
      for (let i=0;i<final.length;i++) {
        const test = final.slice(0,i).concat(final.slice(i+1));
        const sols = findSolutionsForClues(test, 2);
        if (sols.length === 1) {
          // ensure the single solution equals the original solution (if provided)
          if (!originalSolution || (
              String(sols[0].a) === String(originalSolution.a) &&
              String(sols[0].b) === String(originalSolution.b) &&
              String(sols[0].c) === String(originalSolution.c) &&
              String(sols[0].d) === String(originalSolution.d) &&
              String(sols[0].e) === String(originalSolution.e) &&
              String(sols[0].f) === String(originalSolution.f)
            )) {
            // removing final[i] still leaves unique solution -> drop it
            final.splice(i,1);
            changed = true;
            break;
          }
        }
      }
    }
    return final;
  }

  // --- Fixed: generatePuzzleJS ---
// Strategy: always generate UP TO 8 clues first (not stopping early at uniqueness),
// then prune exhaustively until no clue is redundant and count <= 6.
function generatePuzzleJS(maxAttempts = 5000) {
  initLookups();

  // Exhaustive greedy prune: repeatedly scan and remove any redundant clue
  // until no more can be removed. More thorough than single-pass.
  function exhaustivePrune(clues, targetSol) {
    const working = clues.slice();
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < working.length; i++) {
        const without = working.filter((_, idx) => idx !== i);
        const sols = findSolutionsForClues(without, 2);
        if (sols.length === 1 &&
            sols[0].a === targetSol.a && sols[0].b === targetSol.b &&
            sols[0].c === targetSol.c && sols[0].d === targetSol.d &&
            sols[0].e === targetSol.e && sols[0].f === targetSol.f) {
          working.splice(i, 1);
          changed = true;
          break; // restart scan after any removal
        }
      }
    }
    return working;
  }

  // Generate a clue that is valid for sol and not a duplicate
  function pickClue(existing, solObj, tries = 300) {
    for (let t = 0; t < tries; t++) {
      const candidate = generateRandomClue(solObj);
      if (existing.some(c => JSON.stringify(c) === JSON.stringify(candidate))) continue;

      // Reject XOR clues that are trivialised by existing parity/prime clues
      if (candidate.Operator === "xor even" || candidate.Operator === "xor prime") {
        const v1 = candidate.Var1Index, v2 = candidate.Var2Index;
        const trivial = existing.some(cc =>
          (cc.Operator === "even" || cc.Operator === "odd") &&
          (cc.Var1Index === v1 || cc.Var1Index === v2)
        ) || existing.some(cc =>
          (cc.Operator === "prime" || cc.Operator === "not prime") &&
          (cc.Var1Index === v1 || cc.Var1Index === v2)
        );
        if (trivial) continue;
      }

      return candidate;
    }
    return null;
  }

  let attempt = 0;
  while (attempt++ < maxAttempts) {
    const sol = makeRandomSolution();

    // Step 1: gather up to 8 non-duplicate clues (all valid for sol, no uniqueness requirement yet)
    const pool = [];
    for (let k = 0; k < 8; k++) {
      const clue = pickClue(pool, sol, 300);
      if (clue) pool.push(clue);
    }

    // Step 2: verify the pool already forces a unique solution (needed before pruning)
    const solsPool = findSolutionsForClues(pool, 2);
    if (solsPool.length !== 1 ||
        solsPool[0].a !== sol.a || solsPool[0].b !== sol.b ||
        solsPool[0].c !== sol.c || solsPool[0].d !== sol.d ||
        solsPool[0].e !== sol.e || solsPool[0].f !== sol.f) {
      continue; // pool doesn't pin the solution — try again
    }

    // Step 3: exhaustively prune redundant clues
    const pruned = exhaustivePrune(pool, sol);

    // Step 4: final validation — unique, correct solution, within clue limit
    if (pruned.length > 6) continue;
    const finalSols = findSolutionsForClues(pruned, 2);
    if (finalSols.length !== 1) continue;
    if (finalSols[0].a !== sol.a || finalSols[0].b !== sol.b ||
        finalSols[0].c !== sol.c || finalSols[0].d !== sol.d ||
        finalSols[0].e !== sol.e || finalSols[0].f !== sol.f) continue;

    return {
      A: sol.a, B: sol.b, C: sol.c, D: sol.d, E: sol.e, F: sol.f,
      _clues: pruned.map(clueToString),
      _rawClues: pruned
    };
  }

  // Fallback (should be very rare)
  const sol = makeRandomSolution();
  return {
    A: sol.a, B: sol.b, C: sol.c, D: sol.d, E: sol.e, F: sol.f,
    _clues: [`A + B = ${sol.a + sol.b}`, `C + D = ${sol.c + sol.d}`, `E + F = ${sol.e + sol.f}`],
    _rawClues: []
  };
}

  // ── Difficulty scoring (translated from VBA RankPuzzleDifficulty) ──
  // Applies all clue eliminations iteratively on a virtual 6×10 candidate grid,
  // then counts remaining cells. Fewer remaining = easier.
  // Thresholds (tunable): easy ≤20, medium ≤35, hard ≤45, expert >45


  function scorePuzzle(clues, sol) {
    // Virtual grid: grid[varIdx 0..5][val 1..10] = true if candidate still alive
    const grid = Array.from({ length: 6 }, () => {
      const row = new Array(11).fill(false);
      for (let v = 1; v <= 10; v++) row[v] = true;
      return row;
    });

    function getMin(r) { for (let v=1;v<=10;v++) if (grid[r][v]) return v; return 0; }
    function getMax(r) { for (let v=10;v>=1;v--) if (grid[r][v]) return v; return 0; }
    function clear(r, v) { grid[r][v] = false; }

    function applyClue(c) {
      const r1 = c.Var1Index - 1, r2 = c.Var2Index - 1, r3 = c.Var3Index - 1;
      const op = c.Operator;

      switch(op) {
        case '+': {
          const n = c.Value;
          // remove values >= n from both; remove n/2 if n even; propagate
          for (let v=Math.max(1,n);v<=10;v++) { clear(r1,v); clear(r2,v); }
          if (n>11) { for (let v=1;v<=n-11;v++) { clear(r1,v); clear(r2,v); } }
          if (n%2===0 && n/2>=1 && n/2<=10) { clear(r1,n/2); clear(r2,n/2); }
          for (let a=1;a<=10;a++) { if (!grid[r1][a]) { const b=n-a; if(b>=1&&b<=10) clear(r2,b); } }
          for (let b=1;b<=10;b++) { if (!grid[r2][b]) { const a=n-b; if(a>=1&&a<=10) clear(r1,a); } }
          break;
        }
        case '-': {
          const n = c.Value;
          for (let v=1;v<=Math.min(10,n);v++) clear(r1,v);
          for (let v=Math.max(1,10-n+1);v<=10;v++) clear(r2,v);
          for (let v=1;v<=10;v++) { if(!grid[r2][v]) { const x=v+n; if(x<=10) clear(r1,x); } }
          for (let v=1;v<=10;v++) { if(!grid[r1][v]) { const y=v-n; if(y>=1) clear(r2,y); } }
          break;
        }
        case '*': {
          const n = c.Value;
          for (let v=1;v<=10;v++) {
            if (n%v!==0 || n/v<1 || n/v>10) { clear(r1,v); clear(r2,v); }
          }
          // remove square root if perfect square
          const sq = Math.round(Math.sqrt(n));
          if (sq*sq===n) { clear(r1,sq); clear(r2,sq); }
          // propagate
          for (let v=1;v<=10;v++) { if(!grid[r1][v] && n%v===0) { const c2=n/v; if(c2>=1&&c2<=10) clear(r2,c2); } }
          for (let v=1;v<=10;v++) { if(!grid[r2][v] && n%v===0) { const c2=n/v; if(c2>=1&&c2<=10) clear(r1,c2); } }
          break;
        }
        case '>': {
          let ch=true; while(ch){ ch=false;
            const minY=getMin(r2), maxX=getMax(r1);
            for(let v=1;v<=minY;v++) if(grid[r1][v]){clear(r1,v);ch=true;}
            for(let v=maxX;v<=10;v++) if(grid[r2][v]){clear(r2,v);ch=true;}
          } break;
        }
        case '<': {
          let ch=true; while(ch){ ch=false;
            const maxY=getMax(r2), minX=getMin(r1);
            for(let v=maxY;v<=10;v++) if(grid[r1][v]){clear(r1,v);ch=true;}
            for(let v=1;v<=minX;v++) if(grid[r2][v]){clear(r2,v);ch=true;}
          } break;
        }
        case 'even':     for(let v=1;v<=10;v++) if(!EvenLookup[v]) clear(r1,v); break;
        case 'odd':      for(let v=1;v<=10;v++) if(EvenLookup[v])  clear(r1,v); break;
        case 'prime':    for(let v=1;v<=10;v++) if(!PrimeLookup[v]) clear(r1,v); break;
        case 'not prime':for(let v=1;v<=10;v++) if(PrimeLookup[v])  clear(r1,v); break;
        case 'adjacent': {
          let ch=true; while(ch){ ch=false;
            for(let v=1;v<=10;v++) if(grid[r1][v]){ if(!grid[r2][v-1]&&!grid[r2][v+1]){clear(r1,v);ch=true;} }
            for(let v=1;v<=10;v++) if(grid[r2][v]){ if(!grid[r1][v-1]&&!grid[r1][v+1]){clear(r2,v);ch=true;} }
          } break;
        }
        case 'largest': {
          // Initial prune: X must be > 5 to be the largest of 6 unique values from 1..10
          for(let v=1;v<=5;v++) clear(r1,v);
          let ch=true; while(ch){ ch=false;
            const mx=getMax(r1);
            // All other rows: remove any value >= maxX (others can't equal or exceed X's max)
            for(let ri=0;ri<6;ri++) if(ri!==r1) for(let v=mx;v<=10;v++) if(grid[ri][v]){clear(ri,v);ch=true;}
            // X must be > each other row's min candidate -> remove X <= otherMin
            for(let ri=0;ri<6;ri++) if(ri!==r1){ const mn=getMin(ri); if(mn>0) for(let v=1;v<=mn;v++) if(grid[r1][v]){clear(r1,v);ch=true;} }

            // Naked-pair forced maximum: if two OTHER rows are a naked pair {a,b},
            // then max(a,b) is always attained by one of them -> eliminate X <= max(a,b).
            for(let ra=0;ra<6;ra++) if(ra!==r1){
              const ca=[];for(let v=1;v<=10;v++)if(grid[ra][v])ca.push(v);
              if(ca.length!==2)continue;
              for(let rb=ra+1;rb<6;rb++) if(rb!==r1){
                const cb=[];for(let v=1;v<=10;v++)if(grid[rb][v])cb.push(v);
                if(cb.length===2&&cb[0]===ca[0]&&cb[1]===ca[1]){
                  // naked pair found: max guaranteed = ca[1] (larger of the two)
                  const forcedMax=ca[1];
                  for(let v=1;v<=forcedMax;v++) if(grid[r1][v]){clear(r1,v);ch=true;}
                }
              }
            }
          } break;
        }
        case 'smallest': {
          // Initial prune: X must be < 6 to be the smallest of 6 unique values from 1..10
          for(let v=6;v<=10;v++) clear(r1,v);
          let ch=true; while(ch){ ch=false;
            const mn=getMin(r1);
            // All other rows: remove any value <= minX (others can't equal or go below X's min)
            for(let ri=0;ri<6;ri++) if(ri!==r1) for(let v=1;v<=mn;v++) if(grid[ri][v]){clear(ri,v);ch=true;}
            // X must be < each other row's max candidate -> remove X >= otherMax
            for(let ri=0;ri<6;ri++) if(ri!==r1){ const mx=getMax(ri); if(mx>0) for(let v=mx;v<=10;v++) if(grid[r1][v]){clear(r1,v);ch=true;} }

            // Naked-pair forced minimum: if two OTHER rows are a naked pair {a,b},
            // then min(a,b) is always attained -> eliminate X >= min(a,b).
            for(let ra=0;ra<6;ra++) if(ra!==r1){
              const ca=[];for(let v=1;v<=10;v++)if(grid[ra][v])ca.push(v);
              if(ca.length!==2)continue;
              for(let rb=ra+1;rb<6;rb++) if(rb!==r1){
                const cb=[];for(let v=1;v<=10;v++)if(grid[rb][v])cb.push(v);
                if(cb.length===2&&cb[0]===ca[0]&&cb[1]===ca[1]){
                  // naked pair found: min guaranteed = ca[0] (smaller of the two)
                  const forcedMin=ca[0];
                  for(let v=forcedMin;v<=10;v++) if(grid[r1][v]){clear(r1,v);ch=true;}
                }
              }
            }
          } break;
        }
        case 'not largest': {
          // X < some other var. Remove X values >= max of all other rows' maxes.
          let best=0; for(let ri=0;ri<6;ri++) if(ri!==r1){const m=getMax(ri);if(m>best)best=m;}
          // VBA: For v = otherMax To 10 -> removes >= otherMax (X can't be that high)
          for(let v=best;v<=10;v++) clear(r1,v);
          // Secondary: if only one other row's max > minX, that row can't go below minX
          const minX=getMin(r1);
          if(minX>0){
            let count=0, singleRow=-1;
            for(let ri=0;ri<6;ri++) if(ri!==r1){ const m=getMax(ri); if(m>minX){count++;singleRow=ri;} }
            if(count===1 && singleRow>=0){ for(let v=1;v<=minX;v++) clear(singleRow,v); }
          }
          break;
        }
        case 'not smallest': {
          // X > some other var. Remove X values <= min of all other rows' mins.
          let best=11; for(let ri=0;ri<6;ri++) if(ri!==r1){const m=getMin(ri);if(m>0&&m<best)best=m;}
          // VBA: For v = 1 To otherMin -> removes <= otherMin
          for(let v=1;v<=best;v++) clear(r1,v);
          // Secondary: if only one other row's min < maxX, that row can't go above maxX
          const maxX=getMax(r1);
          if(maxX>0){
            let count=0, singleRow=-1;
            for(let ri=0;ri<6;ri++) if(ri!==r1){ const m=getMin(ri); if(m>0&&m<maxX){count++;singleRow=ri;} }
            if(count===1 && singleRow>=0){ for(let v=maxX;v<=10;v++) clear(singleRow,v); }
          }
          break;
        }
        case 'between': {
          let ch=true; while(ch){ ch=false;
            const mnY=getMin(r2),mxY=getMax(r2),mnZ=getMin(r3),mxZ=getMax(r3);
            const mnYZ=Math.min(mnY,mnZ), mxYZ=Math.max(mxY,mxZ);
            // Core: X must lie strictly between min(Y,Z) and max(Y,Z)
            for(let v=1;v<=10;v++) if(grid[r1][v]&&(v<=mnYZ||v>=mxYZ)){clear(r1,v);ch=true;}

            // Cross-elimination rules (from VBA EliminateBtwn):
            const mnX=getMin(r1),mxX=getMax(r1);
            const mnY2=getMin(r2),mxY2=getMax(r2),mnZ2=getMin(r3),mxZ2=getMax(r3);
            // minX >= maxY -> Z must be above minX
            if(mnX>0&&mxY2>0&&mnX>=mxY2){ for(let v=1;v<=mnX;v++) if(grid[r3][v]){clear(r3,v);ch=true;} }
            // minY >= maxX -> Z must be below maxX
            if(mnY2>0&&mxX>0&&mnY2>=mxX){ for(let v=mxX;v<=10;v++) if(grid[r3][v]){clear(r3,v);ch=true;} }
            // minX >= maxZ -> Y must be above minX
            if(mnX>0&&mxZ2>0&&mnX>=mxZ2){ for(let v=1;v<=mnX;v++) if(grid[r2][v]){clear(r2,v);ch=true;} }
            // minZ > maxX -> Y must be below maxX
            if(mnZ2>0&&mxX>0&&mnZ2>mxX){ for(let v=mxX;v<=10;v++) if(grid[r2][v]){clear(r2,v);ch=true;} }

            // Exhaustive triple-validity check for Y candidates
            for(let yv=1;yv<=10;yv++) if(grid[r2][yv]){
              let validY=false;
              outer1: for(let xv=1;xv<=10;xv++) if(grid[r1][xv]&&xv!==yv){
                for(let zv=1;zv<=10;zv++) if(grid[r3][zv]&&zv!==xv&&zv!==yv){
                  if((yv<xv&&xv<zv)||(zv<xv&&xv<yv)){validY=true;break outer1;}
                }
              }
              if(!validY){clear(r2,yv);ch=true;}
            }
            // Exhaustive triple-validity check for Z candidates
            for(let zv=1;zv<=10;zv++) if(grid[r3][zv]){
              let validZ=false;
              outer2: for(let xv=1;xv<=10;xv++) if(grid[r1][xv]&&xv!==zv){
                for(let yv=1;yv<=10;yv++) if(grid[r2][yv]&&yv!==xv&&yv!==zv){
                  if((zv<xv&&xv<yv)||(yv<xv&&xv<zv)){validZ=true;break outer2;}
                }
              }
              if(!validZ){clear(r3,zv);ch=true;}
            }
          } break;
        }
        case 'not between': {
          let ch=true; while(ch){ ch=false;
            const mnY=getMin(r2),mxY=getMax(r2),mnZ=getMin(r3),mxZ=getMax(r3);
            const minOfMax=Math.min(mxY,mxZ), maxOfMin=Math.max(mnY,mnZ);
            if(minOfMax<=maxOfMin) for(let v=minOfMax;v<=maxOfMin;v++) if(grid[r1][v]){clear(r1,v);ch=true;}

            // 4 cross-elimination rules from VBA EliminateNotbtwn:
            const mnX=getMin(r1),mxX=getMax(r1);
            const mnY2=getMin(r2),mxY2=getMax(r2),mnZ2=getMin(r3),mxZ2=getMax(r3);
            // Rule 1: minX >= maxY -> delete Z >= maxX
            if(mnX>0&&mxY2>0&&mxX>0&&mnX>=mxY2){ for(let v=mxX;v<=10;v++) if(grid[r3][v]){clear(r3,v);ch=true;} }
            // Rule 2: maxX <= minY -> delete Z <= minX
            if(mxX>0&&mnY2>0&&mnX>0&&mxX<=mnY2){ for(let v=1;v<=mnX;v++) if(grid[r3][v]){clear(r3,v);ch=true;} }
            // Rule 3: minX >= maxZ -> delete Y >= maxX
            if(mnX>0&&mxZ2>0&&mxX>0&&mnX>=mxZ2){ for(let v=mxX;v<=10;v++) if(grid[r2][v]){clear(r2,v);ch=true;} }
            // Rule 4: maxX <= minZ -> delete Y <= minX
            if(mxX>0&&mnZ2>0&&mnX>0&&mxX<=mnZ2){ for(let v=1;v<=mnX;v++) if(grid[r2][v]){clear(r2,v);ch=true;} }
          } break;
        }
        case 'closer': {
          // X is closer to Y (r2) than to Z (r3): |x-y| < |x-z|
          // Loop until stable (cascades)
          let ch=true; while(ch){ ch=false;
            // Loop 1: eliminate impossible X values
            // Delete x if: for every valid y (y!=x), min|x-y| >= max|x-z| (z!=x)
            for(let v=1;v<=10;v++) if(grid[r1][v]){
              // maxXZ = max |x-z| over z in Z where z != x
              let maxXZ=-1;
              for(let z=1;z<=10;z++) if(grid[r3][z]&&z!==v) maxXZ=Math.max(maxXZ,Math.abs(v-z));
              if(maxXZ<0) continue; // no valid z
              // minXY = min |x-y| over y in Y where y != x
              let minXY=999;
              for(let y=1;y<=10;y++) if(grid[r2][y]&&y!==v) minXY=Math.min(minXY,Math.abs(v-y));
              if(minXY===999) continue; // no valid y
              if(minXY>=maxXZ){clear(r1,v);ch=true;}
            }

            // Loop 2: eliminate impossible Y values
            // Delete y if: for every valid x (x!=y), |x-y| >= max|x-z| (z!=x)
            for(let yv=1;yv<=10;yv++) if(grid[r2][yv]){
              let yCanBeValid=false;
              for(let xv=1;xv<=10;xv++) if(grid[r1][xv]&&xv!==yv){
                let mxz=-1;
                for(let z=1;z<=10;z++) if(grid[r3][z]&&z!==xv) mxz=Math.max(mxz,Math.abs(xv-z));
                if(mxz<0) continue;
                if(Math.abs(xv-yv)<mxz){yCanBeValid=true;break;}
              }
              if(!yCanBeValid){clear(r2,yv);ch=true;}
            }

            // Loop 3: eliminate impossible Z values
            // Delete z if: for every valid x (x!=z), min|x-y| >= |x-z| (y!=x)
            for(let zv=1;zv<=10;zv++) if(grid[r3][zv]){
              let zCanBeValid=false;
              for(let xv=1;xv<=10;xv++) if(grid[r1][xv]&&xv!==zv){
                const dXZ=Math.abs(xv-zv);
                let mxy=999;
                for(let y=1;y<=10;y++) if(grid[r2][y]&&y!==xv) mxy=Math.min(mxy,Math.abs(xv-y));
                if(mxy===999) continue;
                if(mxy<dXZ){zCanBeValid=true;break;}
              }
              if(!zCanBeValid){clear(r3,zv);ch=true;}
            }
          } break;
        }
        case 'no sum': {
  const target = c.Value;

  // 1) Pinned single value: remove complement everywhere
  for (let ri = 0; ri < 6; ri++) {
    let cnt = 0, single = 0;
    for (let v = 1; v <= 10; v++) if (grid[ri][v]) { cnt++; single = v; }
    if (cnt === 1) {
      const comp = target - single;
      if (comp >= 1 && comp <= 10 && comp !== single) {
        for (let rj = 0; rj < 6; rj++) clear(rj, comp);
      }
    }
  }

  // 2) Special pair rules (VBA): force lone occurrence to be exclusive
  let pairA = 0, pairB = 0, applyPair = false;
  switch (target) {
    case 9:  pairA = 9;  pairB = 10; applyPair = true; break;
    case 10: pairA = 5;  pairB = 10; applyPair = true; break;
    case 12: pairA = 1;  pairB = 6;  applyPair = true; break;
    case 13: pairA = 1;  pairB = 2;  applyPair = true; break;
  }
  if (applyPair) {
    const rowsWithA = [], rowsWithB = [];
    for (let ri = 0; ri < 6; ri++) {
      if (grid[ri][pairA]) rowsWithA.push(ri);
      if (grid[ri][pairB]) rowsWithB.push(ri);
    }
    if (rowsWithA.length === 1) {
      const r = rowsWithA[0];
      for (let v = 1; v <= 10; v++) if (v !== pairA && grid[r][v]) clear(r, v);
    }
    if (rowsWithB.length === 1) {
      const r = rowsWithB[0];
      for (let v = 1; v <= 10; v++) if (v !== pairB && grid[r][v]) clear(r, v);
    }
  }

  // 3) Locked-pair complement elimination
  for (let x = 1; x <= 9; x++) {
    for (let y = x + 1; y <= 10; y++) {
      // collect rows that have x or y
      const rowsWithEither = [];
      for (let ri = 0; ri < 6; ri++) if (grid[ri][x] || grid[ri][y]) rowsWithEither.push(ri);
      if (rowsWithEither.length !== 2) continue;
      const r0 = rowsWithEither[0], r1 = rowsWithEither[1];
      // both rows must be subsets of {x,y}
      let r0OnlyXY = true, r1OnlyXY = true;
      for (let v = 1; v <= 10; v++) {
        if (v !== x && v !== y) {
          if (grid[r0][v]) r0OnlyXY = false;
          if (grid[r1][v]) r1OnlyXY = false;
        }
      }
      if (!r0OnlyXY || !r1OnlyXY) continue;
      // ensure both values appear across the two rows
      const hasX = grid[r0][x] || grid[r1][x];
      const hasY = grid[r0][y] || grid[r1][y];
      if (!hasX || !hasY) continue;
      // remove complements (target - x) and (target - y) from other rows
      const compX = target - x, compY = target - y;
      const comps = [];
      if (compX >= 1 && compX <= 10 && compX !== x && compX !== y) comps.push(compX);
      if (compY >= 1 && compY <= 10 && compY !== x && compY !== y && compY !== compX) comps.push(compY);
      if (comps.length === 0) continue;
      for (let ri = 0; ri < 6; ri++) {
        if (ri === r0 || ri === r1) continue;
        for (const comp of comps) clear(ri, comp);
      }
    }
  }

  // 4) Two-candidate self-block: if a single row has exactly two candidates {x,y}
  // and x + y === target, then remove x and y from all other rows.
  for (let ri = 0; ri < 6; ri++) {
    const vals = [];
    for (let v = 1; v <= 10; v++) if (grid[ri][v]) vals.push(v);
    if (vals.length === 2) {
      const [x, y] = vals;
      if (x + y === target) {
        for (let rj = 0; rj < 6; rj++) {
          if (rj === ri) continue;
          clear(rj, x);
          clear(rj, y);
        }
      }
    }
  }

  break;
}

case 'no product': {
  const target = c.Value;

  // 1) Pinned single value: remove complement (factor) everywhere
  for (let ri = 0; ri < 6; ri++) {
    let cnt = 0, single = 0;
    for (let v = 1; v <= 10; v++) if (grid[ri][v]) { cnt++; single = v; }
    if (cnt === 1) {
      if (single !== 0 && target % single === 0) {
        const comp = target / single;
        if (comp >= 1 && comp <= 10 && comp !== single) {
          for (let rj = 0; rj < 6; rj++) clear(rj, comp);
        }
      }
    }
  }

  // 2) Locked-pair complement elimination for product (same idea as sum)
  for (let x = 1; x <= 9; x++) {
    for (let y = x + 1; y <= 10; y++) {
      const rowsWithEither = [];
      for (let ri = 0; ri < 6; ri++) if (grid[ri][x] || grid[ri][y]) rowsWithEither.push(ri);
      if (rowsWithEither.length !== 2) continue;
      const r0 = rowsWithEither[0], r1 = rowsWithEither[1];
      let r0OnlyXY = true, r1OnlyXY = true;
      for (let v = 1; v <= 10; v++) {
        if (v !== x && v !== y) {
          if (grid[r0][v]) r0OnlyXY = false;
          if (grid[r1][v]) r1OnlyXY = false;
        }
      }
      if (!r0OnlyXY || !r1OnlyXY) continue;
      const hasX = grid[r0][x] || grid[r1][x];
      const hasY = grid[r0][y] || grid[r1][y];
      if (!hasX || !hasY) continue;
      // remove complementary factors target/x and target/y from other rows if integer and valid
      const compX = (target % x === 0) ? target / x : -1;
      const compY = (target % y === 0) ? target / y : -1;
      const comps = [];
      if (compX >= 1 && compX <= 10 && compX !== x && compX !== y) comps.push(compX);
      if (compY >= 1 && compY <= 10 && compY !== x && compY !== y && compY !== compX) comps.push(compY);
      if (comps.length === 0) continue;
      for (let ri = 0; ri < 6; ri++) {
        if (ri === r0 || ri === r1) continue;
        for (const comp of comps) clear(ri, comp);
      }
    }
  }

  // 3) Two-candidate self-block for product: if a single row has exactly two candidates {x,y}
  // and x * y === target, then remove x and y from all other rows.
  for (let ri = 0; ri < 6; ri++) {
    const vals = [];
    for (let v = 1; v <= 10; v++) if (grid[ri][v]) vals.push(v);
    if (vals.length === 2) {
      const [x, y] = vals;
      if (x * y === target) {
        for (let rj = 0; rj < 6; rj++) {
          if (rj === ri) continue;
          clear(rj, x);
          clear(rj, y);
        }
      }
    }
  }

  break;
}

        case 'xor even': {
          let ch=true; while(ch){ ch=false;
            const cands1=[],cands2=[];
            for(let v=1;v<=10;v++){if(grid[r1][v])cands1.push(v);if(grid[r2][v])cands2.push(v);}
            const allEven1=cands1.length>0&&cands1.every(v=>EvenLookup[v]);
            const allOdd1 =cands1.length>0&&cands1.every(v=>!EvenLookup[v]);
            const allEven2=cands2.length>0&&cands2.every(v=>EvenLookup[v]);
            const allOdd2 =cands2.length>0&&cands2.every(v=>!EvenLookup[v]);
            if(allEven1) for(let v=1;v<=10;v++) if(EvenLookup[v]&&grid[r2][v]){clear(r2,v);ch=true;}
            if(allOdd1)  for(let v=1;v<=10;v++) if(!EvenLookup[v]&&grid[r2][v]){clear(r2,v);ch=true;}
            if(allEven2) for(let v=1;v<=10;v++) if(EvenLookup[v]&&grid[r1][v]){clear(r1,v);ch=true;}
            if(allOdd2)  for(let v=1;v<=10;v++) if(!EvenLookup[v]&&grid[r1][v]){clear(r1,v);ch=true;}
            // Per-candidate: remove v from r1 if no opposite-parity candidate exists in r2
            for(let v=1;v<=10;v++) if(grid[r1][v]){
              const needEvenInR2=!EvenLookup[v]; // v is odd -> need even in r2, and vice versa
              let hasOpp=false;
              for(let y=1;y<=10;y++) if(grid[r2][y]&&EvenLookup[y]===needEvenInR2){hasOpp=true;break;}
              if(!hasOpp){clear(r1,v);ch=true;}
            }
            for(let v=1;v<=10;v++) if(grid[r2][v]){
              const needEvenInR1=!EvenLookup[v];
              let hasOpp=false;
              for(let y=1;y<=10;y++) if(grid[r1][y]&&EvenLookup[y]===needEvenInR1){hasOpp=true;break;}
              if(!hasOpp){clear(r2,v);ch=true;}
            }
          } break;
        }
        case 'xor prime': {
          let ch=true; while(ch){ ch=false;
            const cands1=[],cands2=[];
            for(let v=1;v<=10;v++){if(grid[r1][v])cands1.push(v);if(grid[r2][v])cands2.push(v);}
            const allP1 =cands1.length>0&&cands1.every(v=>PrimeLookup[v]);
            const allNP1=cands1.length>0&&cands1.every(v=>!PrimeLookup[v]);
            const allP2 =cands2.length>0&&cands2.every(v=>PrimeLookup[v]);
            const allNP2=cands2.length>0&&cands2.every(v=>!PrimeLookup[v]);
            if(allP1)  for(let v=1;v<=10;v++) if(PrimeLookup[v]&&grid[r2][v]){clear(r2,v);ch=true;}
            if(allNP1) for(let v=1;v<=10;v++) if(!PrimeLookup[v]&&grid[r2][v]){clear(r2,v);ch=true;}
            if(allP2)  for(let v=1;v<=10;v++) if(PrimeLookup[v]&&grid[r1][v]){clear(r1,v);ch=true;}
            if(allNP2) for(let v=1;v<=10;v++) if(!PrimeLookup[v]&&grid[r1][v]){clear(r1,v);ch=true;}
            // Per-candidate: remove v from r1 if no opposite-primality candidate exists in r2
            for(let v=1;v<=10;v++) if(grid[r1][v]){
              const needPrimeInR2=!PrimeLookup[v];
              let hasOpp=false;
              for(let y=1;y<=10;y++) if(grid[r2][y]&&PrimeLookup[y]===needPrimeInR2){hasOpp=true;break;}
              if(!hasOpp){clear(r1,v);ch=true;}
            }
            for(let v=1;v<=10;v++) if(grid[r2][v]){
              const needPrimeInR1=!PrimeLookup[v];
              let hasOpp=false;
              for(let y=1;y<=10;y++) if(grid[r1][y]&&PrimeLookup[y]===needPrimeInR1){hasOpp=true;break;}
              if(!hasOpp){clear(r2,v);ch=true;}
            }
          } break;
        }
      }
    }

    // UniqueEliminator: naked singles + naked pairs/triples/quads
    function uniqueElim() {
      let changed = true;
      while (changed) {
        changed = false;
        // Singles
        for (let ri=0;ri<6;ri++) {
          let cnt=0, sv=0;
          for (let v=1;v<=10;v++) if(grid[ri][v]){cnt++;sv=v;}
          if (cnt===1) {
            for (let rj=0;rj<6;rj++) if(rj!==ri && grid[rj][sv]) { grid[rj][sv]=false; changed=true; }
          }
        }
        // Naked pairs/triples/quads
        for (let size=2; size<=4; size++) {
          for (let ri=0;ri<6;ri++) {
            const cands = [];
            for (let v=1;v<=10;v++) if(grid[ri][v]) cands.push(v);
            if (cands.length !== size) continue;
            const key = cands.join(',');
            const matches = [ri];
            for (let rj=ri+1;rj<6;rj++) {
              const c2=[]; for(let v=1;v<=10;v++) if(grid[rj][v]) c2.push(v);
              if (c2.join(',')===key) matches.push(rj);
            }
            if (matches.length===size) {
              for (let rk=0;rk<6;rk++) {
                if (matches.includes(rk)) continue;
                for (const v of cands) if(grid[rk][v]){grid[rk][v]=false;changed=true;}
              }
            }
          }
        }
      }
    }

    // Iterate: apply all clues + unique eliminator until stable
    let prevCount = -1, count = 0;
    while (true) {
      count = 0;
      for (let ri=0;ri<6;ri++) for(let v=1;v<=10;v++) if(grid[ri][v]) count++;
      if (count === prevCount) break;
      prevCount = count;
      for (const c of clues) applyClue(c);
      uniqueElim();
    }

    return count; // remaining cells
  }

   // ── Clue complexity scores ──────────────────────────────────────────────────
  // Higher score = harder clue (more possibilities kept alive, or late-acting).
  function clueComplexityScore(c) {
    const op = c.Operator;
    const n  = c.Value;
    switch (op) {
      case '-': {
        const v = Math.round(n);
        if (v >= 1 && v <= 9) return -2*v+19; // N=9→1, N=1→17
      }
      case '+': {
        const v = Math.round(n);
        if (v===3||v===4||v===18||v===19) return 2;
        if (v===5||v===6||v===16||v===17) return 6;
        if (v===7||v===8||v===14||v===15) return 10;
        if (v===9||v===10||v===12||v===13) return 16;
        return 22;
      }
      case '*': {
        let pairs = 0;
        for (let f=1;f<=10;f++) { if (n%f===0) { const g=n/f; if (g>f&&g<=10) pairs++; } }
        return pairs <= 1 ? 2 : 6;
      }
      case 'largest':
      case 'smallest':     return 8;
      case 'adjacent':     return 30;
      case 'prime':        return 16;
      case 'xor prime':    return 48;
      case 'even':
      case 'odd':          return 18;
      case 'not prime':    return 24;
      case '>':
      case '<':            return 24;
      case 'xor even':     return 40;
      case 'between':      return 38;
      case 'closer':       return 85;
      case 'not between':  return 82;
      case 'not largest':
      case 'not smallest': return 90;
      case 'no sum': {
        const v = Math.round(n);
        if (v===9||v===10||v===12||v===13) return 25;
        if (v===7||v===8||v===14||v===15) return 40;
        return 55; // N=5,6,16,17
      }
      case 'no product': {
        let pairs = 0;
        for (let f=1;f<=10;f++) { if (n%f===0) { const g=n/f; if (g>f&&g<=10) pairs++; } }
        return pairs <= 1 ? 70 : 55;
      }
      default: return 45;
    }
  }

  // ── WED: Weighted Entry Depth ─────────────────────────────────────────────
  // For each variable independently (no cascade), find the minimum subset of
  // clues that uniquely pins it across ALL distinct 1-10 assignments.
  // EC = sum of complexity scores of that subset.
  // WED_raw = average EC across all 6 variables (equal weights, no cascade).
  // Returns { wed_norm, ecDetails, WED_raw }

  const GLOBAL_OPS_WED = new Set(['no sum','no product','largest','smallest','not largest','not smallest']);

  function computeWED(rawClues, sol) {
    const clueCount = rawClues.length;
    const varNames6 = ['A','B','C','D','E','F'];
    const solArr = [
      sol.a !== undefined ? sol.a : sol.A,
      sol.b !== undefined ? sol.b : sol.B,
      sol.c !== undefined ? sol.c : sol.C,
      sol.d !== undefined ? sol.d : sol.D,
      sol.e !== undefined ? sol.e : sol.E,
      sol.f !== undefined ? sol.f : sol.F
    ];

    // Backtracker: can a valid distinct-value assignment exist with varIdx=testVal
    // satisfying subsetIdxs? No fixedMap — full free search.
    function btAssign(toAssign, pos, assignment, usedMask, subsetIdxs) {
      if (pos === toAssign.length) {
        // Leaf: check ALL clues including globals
        const s = { a:assignment[0], b:assignment[1], c:assignment[2],
                    d:assignment[3], e:assignment[4], f:assignment[5] };
        for (const idx of subsetIdxs) {
          if (!checkClue(s, rawClues[idx])) return false;
        }
        return true;
      }
      const varI = toAssign[pos];
      for (let n = 1; n <= 10; n++) {
        const bit = 1 << (n - 1);
        if (usedMask & bit) continue;
        assignment[varI] = n;
        // Partial pruning: only non-global clues whose vars are all assigned
        let ok = true;
        for (const idx of subsetIdxs) {
          const c = rawClues[idx];
          if (GLOBAL_OPS_WED.has(c.Operator)) continue; // globals checked at leaf only
          const allAssigned =
            (!c.Var1Index || assignment[c.Var1Index-1]) &&
            (!c.Var2Index || assignment[c.Var2Index-1]) &&
            (!c.Var3Index || assignment[c.Var3Index-1]);
          if (allAssigned) {
            const s2 = { a:assignment[0], b:assignment[1], c:assignment[2],
                         d:assignment[3], e:assignment[4], f:assignment[5] };
            if (!checkClue(s2, c)) { ok = false; break; }
          }
        }
        if (ok && btAssign(toAssign, pos + 1, assignment, usedMask | bit, subsetIdxs)) {
          assignment[varI] = 0;
          return true;
        }
        assignment[varI] = 0;
      }
      return false;
    }

    function isValuePossible(varIdx, testVal, subsetIdxs) {
      const assignment = new Array(6).fill(0);
      assignment[varIdx] = testVal;
      const usedMask = 1 << (testVal - 1);
      const toAssign = [];
      for (let i = 0; i < 6; i++) { if (i !== varIdx) toAssign.push(i); }
      return btAssign(toAssign, 0, assignment, usedMask, subsetIdxs);
    }

    // Returns true if subsetIdxs uniquely pins varIdx (exactly one testVal possible)
    function subsetPinsVar(subsetIdxs, varIdx) {
      let possibleCount = 0;
      for (let testVal = 1; testVal <= 10; testVal++) {
        if (isValuePossible(varIdx, testVal, subsetIdxs)) {
          possibleCount++;
          if (possibleCount > 1) return false;
        }
      }
      return possibleCount === 1;
    }

    // Generate combinations of size k from 0..n-1
    function* combos(n, k) {
      const idx = Array.from({length: k}, (_, i) => i);
      while (true) {
        yield idx.slice();
        let i = k - 1;
        while (i >= 0 && idx[i] === n - k + i) i--;
        if (i < 0) break;
        idx[i]++;
        for (let j = i + 1; j < k; j++) idx[j] = idx[j-1] + 1;
      }
    }

    // Find minimum-EC subset for varIdx
    function findMinSubset(varIdx) {
      for (let size = 1; size <= clueCount; size++) {
        for (const combo of combos(clueCount, size)) {
          if (subsetPinsVar(combo, varIdx)) return combo;
        }
      }
      return Array.from({length: clueCount}, (_, i) => i);
    }

    // Compute EC for each variable independently
    const ecDetails = [];
    for (let vi = 0; vi < 6; vi++) {
      const subset = findMinSubset(vi);
      const ec = subset.reduce((sum, idx) => sum + clueComplexityScore(rawClues[idx]), 0);
      ecDetails.push({
        varName: varNames6[vi],
        ec,
        clueIndices: subset.map(i => i + 1)
      });
    }

    // Equal weights — no cascade justification for differential weighting
    const WED_raw = ecDetails.reduce((sum, d) => sum + d.ec, 0) / 6;

    // Normalize: min ~1 (A-B=9), max ~480 (super-six all hard clues)
   const WED_norm = Math.min(100, Math.max(0, (WED_raw - 1) / 223 * 100));

    return { wed_norm: WED_norm, ecDetails, WED_raw };
  }

  // ── Puzzle rating ─────────────────────────────────────────────────────────
  // Three components:
  //   E_norm  (elim score)           weight 0.30
  //   WED_norm (entry depth, avg EC) weight 0.55
  //   C_norm  (avg clue complexity)  weight 0.15
  //
  //   Rating = round(800 + (E*0.30 + WED*0.55 + C*0.15) * 15.5)
  //   Bands: Easy 800-1000 | Medium 1001-1400 | Hard 1401-1800 | Expert 1701+
  //
  //   NOTE: computePuzzleRating takes optional sol argument for WED.
  //   During generation screening (sol unknown) WED is skipped; only
  //   E_norm + C_norm used for fast pre-screening via difficultyFromElim.

function computePuzzleRating(rawClues, elim, sol) {
  // E_norm
  let E_norm;
  if (elim <= 6) {
    E_norm = 0;
  } else if (elim <= 45) {
    E_norm = Math.pow((elim - 6) / 39, 0.85) * 75;
  } else {
    E_norm = 75 + Math.pow((elim - 45) / 9, 0.60) * 25;
  }

  // WED_norm
  const wedResult = computeWED(rawClues, sol);
  const WED_norm = wedResult.wed_norm;

  // Rating
  const rating = Math.round(800 + (E_norm * 0.50 + WED_norm * 0.50) * 18);

  computePuzzleRating._lastDebug = { wedResult, E_norm, WED_norm, elim, rating };
  return rating;
}

  function ratingToDifficulty(rating) {
    if (rating <= 1000) return 'easy';
    if (rating <= 1400) return 'medium';
    if (rating <= 1800) return 'hard';
    return 'expert';
  }

 
  // Expose
  window._scorePuzzle         = scorePuzzle;
  window._computePuzzleRating = computePuzzleRating;
  window._ratingToDifficulty  = ratingToDifficulty;

  window.generatePuzzle    = generatePuzzleJS;
  window._checkCluePublic  = checkClue;

})(); // end IIFE


function applyNewPuzzle(sol) {
  // Normalize uppercase keys {A..F} → lowercase {a..f} for scorePuzzle/checkClue
  if (sol && sol.A !== undefined && sol.a === undefined) {
    sol.a = sol.A; sol.b = sol.B; sol.c = sol.C;
    sol.d = sol.D; sol.e = sol.E; sol.f = sol.F;
  }

  currentSolution = sol;
  resetGrid();
  undoStack.length = 0;
  redoStack.length = 0;
  updateUndoRedoBtns();
  inputIds.forEach(id => {
    const el = document.getElementById(id);
    el.value = '';
    el.classList.remove('answer-duplicate');
  });
  feedbackEl.textContent = '';
  feedbackEl.className = 'feedback';

  // Compute rating synchronously — WED runs inside generator loop now
  const ratingEl = document.getElementById('puzzleRating');
  if (ratingEl && sol._rawClues && sol._rawClues.length) {
    const elim   = window._scorePuzzle(sol._rawClues, sol);
    const rating = window._computePuzzleRating(sol._rawClues, elim, sol);
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
        attachClueTooltip(li, sol._rawClues ? sol._rawClues[idx] : null);
        cluesList.appendChild(li);
      });
    } else {
      const li = document.createElement('li');
      li.className = 'clue-placeholder';
      li.textContent = '(no clues)';
      cluesList.appendChild(li);
    }
  }
  startTimer();
}


function resetClueColors() {
  const cluesList = document.getElementById('cluesList');
  if (!cluesList) return;
  cluesList.querySelectorAll('li').forEach(li => {
    li.classList.remove('clue-ok', 'clue-fail');
  });
}

function checkAnswers() {
  if (!currentSolution) {
    feedbackEl.textContent = 'Generate a puzzle first.';
    feedbackEl.className = 'feedback incorrect';
    resetClueColors();
    return;
  }
  const user = {};
  let empty = false;
  inputIds.forEach(id => {
    const v = document.getElementById(id).value.trim();
    if (v === '') empty = true;
    user[id] = v;
  });
  if (empty) {
    feedbackEl.textContent = 'Please fill in all A–F.';
    feedbackEl.className = 'feedback incorrect';
    resetClueColors();
    return;
  }

  // Check for duplicate values among A-F
  const values = inputIds.map(id => user[id]);
  const unique = new Set(values);
  if (unique.size < values.length) {
    feedbackEl.textContent = '✗ Duplicate values not allowed.';
    feedbackEl.className = 'feedback incorrect';
    resetClueColors();
    return;
  }

  // Build a candidate solution object from user inputs (lowercase keys)
  const candidate = {
    a: Number(user['A']), b: Number(user['B']), c: Number(user['C']),
    d: Number(user['D']), e: Number(user['E']), f: Number(user['F'])
  };

  // Check each clue against the user's candidate and colour the list items
  const cluesList = document.getElementById('cluesList');
  const items = cluesList ? cluesList.querySelectorAll('li:not(.clue-placeholder)') : [];
  const rawClues = currentSolution._rawClues || [];
  let allCluesOk = true;

  items.forEach((li, idx) => {
    li.classList.remove('clue-ok', 'clue-fail');
    const raw = rawClues[idx];
    if (!raw) return; // safety
    const passes = window._checkCluePublic(candidate, raw);
    if (passes) {
      li.classList.add('clue-ok');
    } else {
      li.classList.add('clue-fail');
      allCluesOk = false;
    }
  });

  // Check correctness against the true solution
  const wrong = [];
  inputIds.forEach(id => {
    if (String(user[id]) !== String(currentSolution[id])) wrong.push(id);
  });

  if (wrong.length === 0) {
    feedbackEl.textContent = '✓ ALL CORRECT! - WELL DONE.';
    feedbackEl.className = 'feedback correct';
    stopTimer();
  } else {
    feedbackEl.textContent = '✗ Some clues not satisfied.';
    feedbackEl.className = 'feedback incorrect';
  }
}

// Wire events
newPuzzleBtn.addEventListener('click', () => {
  // Generation is now handled by popup.js — this listener only handles
  // the forfeit case (when gameActive), which _sfgame intercepts via capture phase.
  // If we reach here with no game active, popup.js capture phase already handled it.
  return;
  const gen = window.generatePuzzle;
  if (typeof gen !== 'function') { alert('generatePuzzle is not defined.'); return; }

  // Clear existing clues and reset state immediately
  const cluesList = document.getElementById('cluesList');
  if (cluesList) {
    cluesList.innerHTML = '<li class="clue-placeholder">Generating…</li>';
  }
  undoStack.length = 0;
  redoStack.length = 0;
  updateUndoRedoBtns();
  resetClueColors();
  feedbackEl.textContent = '';
  feedbackEl.className = 'feedback';

const originalText = newPuzzleBtn.innerHTML;
  newPuzzleBtn.innerHTML = '<span class="btn-icon"></span> Generating';
  newPuzzleBtn.disabled = true;
  // Immediately start fading down to 0.3 over 0.5s
  newPuzzleBtn.style.transition = 'opacity 0.5s ease';
  newPuzzleBtn.style.opacity = '0.3';
 
  // Run the search in small chunks separated by setTimeout(0) so the browser
  // can repaint between chunks — this is what actually makes the pulse visible.
  const CHUNK = 50;
  const MAX_TRIES = 5000;
  let tried = 0;
  let sol = null;

  function runChunk() {
    const end = Math.min(tried + CHUNK, MAX_TRIES);
    while (tried < end) {
      tried++;
      try {
        const candidate = gen();
        if (!candidate || !candidate._rawClues) continue;
        const elim   = window._scorePuzzle(candidate._rawClues, candidate);
        const rating = window._computePuzzleRating(candidate._rawClues, elim, candidate);
      } catch(err) {
        alert('Error: ' + err.message);
        finish();
        return;
      }
    }

    if (sol || tried >= MAX_TRIES) {
      if (!sol) { try { sol = gen(); } catch(e) { sol = null; } }
      if (sol) applyNewPuzzle(sol);
      finish();
    } else {
      setTimeout(runChunk, 0);
    }
  }

  function finish() {
    if (!window._sfgame || !window._sfgame.gameActive) {
      newPuzzleBtn.innerHTML = originalText;
      newPuzzleBtn.disabled = false;
      newPuzzleBtn.style.transition = '';
      newPuzzleBtn.style.opacity = '1';
    } else {
      newPuzzleBtn.disabled = false;
      // Swap text immediately
      newPuzzleBtn.innerHTML = '<span class="btn-icon"></span>Forfeit?';
      newPuzzleBtn.classList.remove('generating');
      newPuzzleBtn.style.opacity = '0.3';
      // Ensure we're at 0.3 before starting the slow fade-in
      newPuzzleBtn.style.transition = 'opacity 0.5s ease';
      newPuzzleBtn.style.opacity = '0.3';
      setTimeout(() => {
        // Now slowly fade back to full opacity over 10s
        newPuzzleBtn.style.transition = 'opacity 10s ease';
        newPuzzleBtn.style.opacity = '1';
      }, 500);
    }
  }

  // One rAF to let the browser paint the disabled+pulsing state before we start
  requestAnimationFrame(() => setTimeout(runChunk, 0));
});

checkBtn.addEventListener('click', checkAnswers);
resetGridBtn.addEventListener('click', resetGrid);

// ══════════════════════════════════════════
// MODAL
// ══════════════════════════════════════════
const modal        = document.getElementById('tutorialModal');
const howToPlayBtn = document.getElementById('howToPlayBtn');
const modalClose   = document.getElementById('modalClose');
const modalTabs    = document.querySelectorAll('.modal-tab');
const modalBodies  = document.querySelectorAll('.modal-body');

function openModal() { modal.classList.add('open'); }
function closeModal() { modal.classList.remove('open'); }

howToPlayBtn.addEventListener('click', openModal);
modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

modalTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    modalTabs.forEach(t => t.classList.remove('active'));
    modalBodies.forEach(b => b.classList.add('hidden'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.remove('hidden');
  });
});

// ══════════════════════════════════════════
// CLUE HOVER TOOLTIPS
// Attached when clues are rendered. Skip for +, -, * clues.
// ══════════════════════════════════════════
const NO_TIP_OPS = new Set(['+', '-', '*']);

function buildClueTip(c) {
  if (!c || NO_TIP_OPS.has(c.Operator)) return null;
  const A = c.Var1 || '?', B = c.Var2 || '?', C = c.Var3 || '?';
  switch (c.Operator) {
    case '>':           return `${A} is greater than ${B}.`;
    case '<':           return `${A} is less than ${B}.`;
    case 'even':        return `${A} must be 2, 4, 6, 8, or 10.`;
    case 'odd':         return `${A} must be 1, 3, 5, 7, or 9.`;
    case 'prime':       return `${A} must be 2, 3, 5, or 7. 
    Note: 1 is not prime.`;
    case 'not prime':   return `${A} must be 1, 4, 6, 8, 9, or 10. 
    Note: 1 is not prime.`;
    case 'largest':     return `${A} is greater than all other five values.  Does not mean ${A} = 10.`;
    case 'smallest':    return `${A} is less than all other five values.  Does not mean ${A} = 1.`;
    case 'not largest': return `At least one other letter is greater than ${A}.`;
    case 'not smallest':return `At least one other letter is less than ${A}.`;
    case 'adjacent':    return `|${A} – ${B}| = 1. They are consecutive integers.  ${A} could be above or below ${B}.`;
    case 'between':     return `min(${B}, ${C}) < ${A} < max(${B}, ${C}).  Order of ${B} and ${C} is not implied.`;
    case 'not between': return `${A} < min(${B}, ${C})  or  ${A} > max(${B}, ${C}).  ${A} is outside the range of ${B} and ${C}.`;
    case 'closer':      return `|${A}–${B}| < |${A}–${C}|. ${A} is nearer to ${B} than to ${C}.  Does not imply ${A} is between them.`;
    case 'xor even':    return `Exactly one of ${A} or ${B} is even; the other is odd.`;
    case 'xor prime':   return `Exactly one of ${A} or ${B} is prime; the other is not prime.`;
    case 'no sum':      return `No two values in the solution sum to ${c.Value}`;
    case 'no product':  return `No two values in the solution multiply to ${c.Value}`;
    default: return null;
  }
}

function attachClueTooltip(li, rawClue) {
  const tip = buildClueTip(rawClue);
  if (tip) li.setAttribute('data-tip', tip);
}

// Init
buildGridRows();
populateAnswerSelects();

// ══════════════════════════════════════════
// Six-Figure Logic Glicko-2 rating system
// ══════════════════════════════════════════

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
    const penalty    = penaltyPerMistake(puzzleRating);
    const effective  = solveSeconds + mistakes * penalty;
    const expected   = expectedTime(puzzleRating, playerRating);
    const ratio      = effective / expected;
    const time_score = Math.max(0.05, Math.min(1.25, 0.5 - 0.491 * Math.log(ratio)));

    // Remap so "solved in expected time" is always neutral (zero rating change),
    // regardless of the rating gap between player and puzzle.
    const mu    = (playerRating - 1500) / 173.7178;
    const mu_j  = (puzzleRating - 1500) / 173.7178;
    const phi_j = 350 / 173.7178;
    function g(p) { return 1 / Math.sqrt(1 + 3 * p * p / (Math.PI * Math.PI)); }
    const E_j = 1 / (1 + Math.exp(-g(phi_j) * (mu - mu_j)));

    return Math.max(0.0, Math.min(1.25, E_j + (time_score - 0.5)));
  }

  // ─── Glicko-2 update ─────────────────────────────────────────────────────
  // Uses continuous S in place of binary outcome.
  // puzzle is treated as the "opponent" with its own rating.
  // PUZZLE_RD raised to 200 so upsets against much-harder puzzles
  // yield appropriately large rating swings.
  const PUZZLE_RD = 200;

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

// ══════════════════════════════════════════
// Game state + rating integration for Six-Figure Logic
// ══════════════════════════════════════════

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
  // Mode pill is now inside the popup (popupModeCasual / popupModeRated)
  // We reference them safely; if absent they're null and we guard all access.
  const penaltyEl      = document.getElementById('penaltyTime');
  const mistakeEl      = document.getElementById('mistakeCounter'); // kept for compat but hidden
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
  // Mode pill now lives in the popup; popup.js owns its visual state.
  // _setMode() is called by popup.js before launching a puzzle.
  function setMode(mode) {
    gameMode = mode;
    // Sync popup pill if present
    const c = document.getElementById('popupModeCasual');
    const r = document.getElementById('popupModeRated');
    if (c) c.classList.toggle('active', mode === 'casual');
    if (r) r.classList.toggle('active', mode === 'rated');
  }
  setMode('casual');

  // ─── Penalty helpers ──────────────────────────────────────────────────────
  function formatMMSS(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  // ─── Mistake boxes (change 4) ─────────────────────────────────────────────
  function updateMistakeBoxes(count) {
    for (let i = 1; i <= 3; i++) {
      const box = document.getElementById('mistakeBox' + i);
      if (!box) continue;
      if (i <= count) {
        box.classList.add('active');
        box.textContent = '✗';
      } else {
        box.classList.remove('active');
        box.textContent = '';
      }
    }
  }

  function resetMistakeBoxes() {
    updateMistakeBoxes(0);
  }

  function addMistake() {
    mistakeCount++;
    penaltySecs += puzzlePenaltyPerMistake;

    // Update penalty display
    penaltyEl.textContent = '+' + formatMMSS(penaltySecs);
    penaltyEl.classList.add('visible');

    // Update mistake boxes
    updateMistakeBoxes(mistakeCount);

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

      // Show popup for rated; casual gets popup too on auto-forfeit (3 mistakes)
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

    // Lock popup mode pill buttons while game is active
    const _pc = document.getElementById('popupModeCasual');
    const _pr = document.getElementById('popupModeRated');
    if (_pc) _pc.disabled = true;
    if (_pr) _pr.disabled = true;

    // Button becomes "Forfeit?" while game is active
    newPuzzleBtn.innerHTML = '<span class="btn-icon"></span>Forfeit?';
    newPuzzleBtn.classList.remove('give-up-active');

    // Reset penalty display
    penaltyEl.textContent = '';
    penaltyEl.classList.remove('visible');

    // Reset mistake boxes
    resetMistakeBoxes();
  }

  function unlockGame() {
    gameActive = false;
    // Re-enable popup mode pill buttons
    const _pc2 = document.getElementById('popupModeCasual');
    const _pr2 = document.getElementById('popupModeRated');
    if (_pc2) _pc2.disabled = false;
    if (_pr2) _pr2.disabled = false;

    // Restore button text to "Play"
    newPuzzleBtn.innerHTML = '<span class="btn-icon">&#x25B6;</span> Play';
    newPuzzleBtn.classList.remove('give-up-active');
    penaltyEl.classList.remove('visible');

    // Mistake boxes persist until next puzzle starts (reset in lockGame)
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

    // Change 3: Casual give up → no popup at all; rated give up → show popup
    if (gameMode === 'rated') {
      showResultPopup(solveTime, true);
    }
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

    // Puzzle is active — this is "Give Up?"
    e.stopImmediatePropagation();

    showGiveUpConfirm();
  }, true); // capture phase

  // ─── Hook applyNewPuzzle to lock the game ────────────────────────────────
  const _originalApply = window.applyNewPuzzle;
  window.applyNewPuzzle = function (sol) {
    if (sol) {
      if (sol.A !== undefined && sol.a === undefined) {
        sol.a = sol.A; sol.b = sol.B; sol.c = sol.C;
        sol.d = sol.D; sol.e = sol.E; sol.f = sol.F;
      }
    }
    _originalApply(sol);
    window.currentSolution = sol;
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
    // Grade is based purely on time performance, independent of rating gap.
    // E_j remapping is only for Glicko rating changes, not for grading.
    const penalty   = window.SFLRating.penaltyPerMistake(puzzleRating);
    const effective = solveSeconds + mistakes * penalty;
    const expected  = window.SFLRating.expectedTime(puzzleRating, playerRating);
    const ratio     = effective / expected;
    const time_score = Math.max(0.05, Math.min(1.25, 0.5 - 0.491 * Math.log(ratio)));
    if (time_score >= 0.95) return 'A+';
    if (time_score >= 0.87) return 'A';
    if (time_score >= 0.80) return 'A−';
    if (time_score >= 0.72) return 'B+';
    if (time_score >= 0.64) return 'B';
    if (time_score >= 0.49) return 'B−';
    if (time_score >= 0.42) return 'C+';
    if (time_score >= 0.35) return 'C';
    if (time_score >= 0.28) return 'C−';
    if (time_score >= 0.21) return 'D+';
    if (time_score >= 0.14) return 'D';
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
    if (rating <= 1400) return 'var(--accent)';
    if (rating <= 1800) return '#ffa032';
    return 'var(--danger)';
  }

  function difficultyLabel(rating) {
    if (rating <= 1000) return 'EASY';
    if (rating <= 1400) return 'MEDIUM';
    if (rating <= 1800) return 'HARD';
    return 'EXPERT';
  }

  // ─── Result popup ─────────────────────────────────────────────────────────
  function showResultPopup(solveTime, gaveUp) {
    if (window._sflShareContext) window._sflShareContext.set(gaveUp, mistakeCount);
    const puzzleRating = (window.currentSolution && window.currentSolution._rating) || 1000;
    const isRated = gameMode === 'rated';
    const title   = document.getElementById('resultTitle');
    const statsEl = document.getElementById('resultStats');
    const ratingRowEl = document.getElementById('resultRatingRow');
    const casualNoteEl = document.getElementById('resultCasualNote');

    if (gaveUp) {
      title.textContent = '✗  PUZZLE FAILED';
      title.className   = 'result-title failed-title';
    } else {
      title.textContent = '✓  PUZZLE SOLVED';
      title.className   = 'result-title' + (isRated ? '' : ' casual-title');
    }

    const p = window.SFLRating.getProfile();
    const grade = computeLetterGrade(solveTime, mistakeCount, puzzleRating, p.rating, gaveUp);
    const gc = gradeColor(grade);
    const dc = difficultyColor(puzzleRating);

    const mistakesDisplay = mistakeCount > 0 ? '\u2009'.repeat(6) + mistakeCount : '\u2009'.repeat(6) + '—';
    const mistakesColor = mistakeCount > 0 ? 'var(--danger)' : 'var(--success)';
    const autoForfeit = gaveUp && mistakeCount >= 3;
    const penaltyDisplay = autoForfeit ? 'LOSS' : (penaltySecs > 0 ? '+' + formatMMSS(penaltySecs) : '—'+'\u2009'.repeat(6));
    const penaltyColor = autoForfeit ? 'var(--danger)' : (penaltySecs > 0 ? 'var(--danger)' : 'var(--success)');

    // Change 2: show "N/A" for solve time when gave up
    const solveTimeDisplay = gaveUp ? 'N/A' : formatMMSS(solveTime);

    statsEl.innerHTML = `
    <div class="result-stat result-stat-grade">
        <span class="result-stat-label">PUZZLE RATING</span>
        <span class="result-stat-value" style="color:${dc}">${puzzleRating}</span>
      </div>
      <div class="result-stat result-stat-grade">
        <span class="result-stat-label">SOLVE TIME</span>
        <span class="result-stat-value">${solveTimeDisplay}</span>
      </div>
      <div class="result-stat result-stat-combined">
        <div class="result-stat-row">
          <span class="result-stat-label">MISTAKES</span>
          <span class="result-stat-label">PENALTY</span>
        </div>
        <div class="result-stat-row">
          <span class="result-stat-value" style="font-size:12pt; color:${mistakesColor}">${mistakesDisplay}</span>
          <span class="result-stat-value" style="font-size:12pt; color:${penaltyColor}">${penaltyDisplay}</span>
        </div>
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
      } else {
        result = _lastGiveUpRatingResult || { oldRating: '?', newRating: '?', ratingDelta: 0 };
      }

      const deltaSign  = result.ratingDelta >= 0 ? '+' : '';
      const deltaClass = result.ratingDelta > 0 ? 'positive' : result.ratingDelta < 0 ? 'negative' : 'neutral';

      ratingRowEl.style.display = 'flex';
      ratingRowEl.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
          <span style="font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:0.18em;color:var(--text-muted);">OLD RATING</span>
          <span class="result-old-rating">${result.oldRating}</span>
        </div>
        <span class="result-arrow">→</span>
        <div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
          <span style="font-family:var(--mono);font-size:9px;font-weight:700;letter-spacing:0.18em;color:var(--text-muted);">NEW RATING</span>
          <span class="result-new-rating" id="animNewRating">${result.oldRating}</span>
        </div>
        <span class="result-delta ${deltaClass}">${deltaSign}${result.ratingDelta}</span>
      `;
      casualNoteEl.style.display = 'none';

      // Animate for both solve and give-up; also refresh header rating now
      refreshRatingDisplay();
      animateRating(result.oldRating, result.newRating, 1800);
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

  // Close result popup
  document.getElementById('resultCloseBtn').addEventListener('click', () => {
    resultOverlay.classList.remove('open');
  });
  resultOverlay.addEventListener('click', (e) => {
    if (e.target === resultOverlay) resultOverlay.classList.remove('open');
  });

  // Expose for external access if needed
window._sfgame = {
    refreshRatingDisplay,
    get gameActive() { return gameActive; },
    _setMistakeState(count, penaltyTxt) {
      mistakeCount = count;
      const match = penaltyTxt.match(/\+(\d+):(\d+)/);
      penaltySecs  = match ? parseInt(match[1],10)*60 + parseInt(match[2],10) : 0;
    },
    _setMode(m) { setMode(m); },
    _getMode()  { return gameMode; },
  };

})();





/*═══════════════════════ TUTORIAL WALKTHROUGH ════════════════════ -->*/

(function () {
  'use strict';

  
  /* ══════════════════════════════════════════
     Worked Example Sub-Modal
  ══════════════════════════════════════════ */

  const WE_ROWS = ['A','B','C','D','E','F'];
  
  let weGrid = [], weStep = 0;

  function weMakeGrid() {
    weGrid = WE_ROWS.map(() => {
      const r = {};
      for (let v = 1; v <= 10; v++) r[v] = 'open';
      return r;
    });
  }

  const WE_STEPS = [
    {
      title: 'Start with the clues',
      body: `We have five clues and six unknowns. Every value must be a <strong>unique integer from 1–10</strong>. The grid starts fully open.`,
      activeClues:[], doneClues:[], cross:{}, solve:{}, highlight:{}
    },
    {
      title: 'Clue 2: B * C = 24',
      body: `<code>B * C = 24</code> — valid pairs from 1–10 are <strong>[3×8]</strong> and <strong>[4×6]</strong>.<br>So B ∈ {3,4,6,8} and C ∈ {3,4,6,8}.`,
      activeClues:[1], doneClues:[],
      cross:{ 1:[1,2,5,7,9,10], 2:[1,2,5,7,9,10] },
      solve:{}, highlight:{ 1:[3,4,6,8], 2:[3,4,6,8] }
    },
    {
      title: 'Clue 4: D – E = 5  →  D ≥ 6',
      body: `<code>D – E = 5</code>. Since E ≥ 1, D = E + 5 ≥ <strong>6</strong>.<br>So D ∈ {6,7,8,9,10} and E ∈ {1,2,3,4,5}.`,
      activeClues:[3], doneClues:[],
      cross:{ 3:[1,2,3,4,5], 4:[6,7,8,9,10] },
      solve:{}, highlight:{ 3:[6,7,8,9,10], 4:[1,2,3,4,5] }
    },
    {
      title: 'Clue 3: C > D  →  C = 8, B = 3',
      body: `<code>C > D</code> and D ≥ 6, so C ≥ 7.<br>But C ∈ {3,4,6,8} — only value ≥ 7 is <span class="hl-green">C = 8</span>.<br>Then <code>B * 8 = 24</code> → <span class="hl-green">B = 3</span>.`,
      activeClues:[2,1], doneClues:[1,2],
      cross:{ 2:[1,2,3,4,5,6,7,9,10], 1:[1,2,4,5,6,7,8,9,10] },
      solve:{ 2:8, 1:3 }, highlight:{}
    },
    {
      title: 'Clue 1: A + B = 7  →  A = 4',
      body: `<code>A + B = 7</code> and B = 3.<br>So A = 7 – 3 = <span class="hl-green">A = 4</span>.`,
      activeClues:[0], doneClues:[0,1,2],
      cross:{ 0:[1,2,3,5,6,7,8,9,10] },
      solve:{ 0:4 }, highlight:{}
    },
    {
      title: 'Clue 3 + 4: D ∈ {6,7}',
      body: `C = 8 and <code>C > D</code> → D ≤ 7. Combined with D ≥ 6: <strong>D ∈ {6,7}</strong>.<br>From <code>D – E = 5</code>: D=6 → E=1; D=7 → E=2.`,
      activeClues:[3,2], doneClues:[0,1,2],
      cross:{ 3:[8,9,10], 4:[3,4,5] },
      solve:{}, highlight:{ 3:[6,7], 4:[1,2] }
    },
    {
      title: 'Clue 5: F + E = 6  →  F=5, E=1, D=6',
      body: `<code>F + E = 6</code>, E ∈ {1,2} → F ∈ {5,4}.<br><span class="hl-red">A = 4 already</span> — no duplicates → <span class="hl-green">F ≠ 4</span>.<br>So <span class="hl-green">F = 5</span>, E = 6–5 = <span class="hl-green">E = 1</span>, D = 1+5 = <span class="hl-green">D = 6</span>.`,
      activeClues:[4,3], doneClues:[0,1,2,3,4],
      cross:{ 5:[1,2,3,4,6,7,8,9,10], 4:[2,3,4,5,6,7,8,9,10], 3:[7] },
      solve:{ 5:5, 4:1, 3:6 }, highlight:{}
    },
    {
      title: '✓ Solution found!',
      body: `All six values uniquely determined:`,
      activeClues:[], doneClues:[0,1,2,3,4],
      cross:{}, solve:{}, highlight:{}, isFinal:true
    }
  ];

  const WE_TOTAL = WE_STEPS.length - 1;

  function weApplyStep(si) {
    const s = WE_STEPS[si];
    for (const [ri, vals] of Object.entries(s.cross))
      vals.forEach(v => { if (weGrid[ri][v] !== 'solved') weGrid[ri][v] = 'crossed'; });
    for (const [ri, val] of Object.entries(s.solve))
      weGrid[ri][val] = 'solved';
    for (let ri = 0; ri < 6; ri++)
      for (let v = 1; v <= 10; v++)
        if (weGrid[ri][v] === 'highlight') weGrid[ri][v] = 'open';
    for (const [ri, vals] of Object.entries(s.highlight))
      vals.forEach(v => { if (weGrid[ri][v] === 'open') weGrid[ri][v] = 'highlight'; });
  }

  function weRebuildTo(si) {
    weMakeGrid();
    for (let s = 1; s <= si; s++) weApplyStep(s);
  }

  function weRenderGrid() {
    const container = document.getElementById('weGrid');
    if (!container) return;
    container.innerHTML = '';
    // Column headers
    const hrow = document.createElement('div');
    hrow.className = 'we-row';
    const sp = document.createElement('div');
    sp.style.cssText = 'width:18px;flex-shrink:0';
    hrow.appendChild(sp);
    const hcells = document.createElement('div');
    hcells.className = 'we-cells';
    for (let v = 1; v <= 10; v++) {
      const hc = document.createElement('div');
      hc.style.cssText = 'width:28px;height:14px;display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:9px;color:var(--text-muted);font-weight:700;flex-shrink:0';
      hc.textContent = v;
      hcells.appendChild(hc);
    }
    hrow.appendChild(hcells);
    container.appendChild(hrow);

    WE_ROWS.forEach((row, ri) => {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'we-row';
      const lbl = document.createElement('div');
      lbl.className = 'we-row-label';
      lbl.textContent = row;
      rowDiv.appendChild(lbl);
      const cells = document.createElement('div');
      cells.className = 'we-cells';
      for (let v = 1; v <= 10; v++) {
        const cell = document.createElement('div');
        cell.className = 'we-cell';
        cell.textContent = v;
        const st = weGrid[ri][v];
        if (st === 'crossed')   cell.classList.add('we-crossed');
        if (st === 'highlight') cell.classList.add('we-highlight');
        if (st === 'solved')    cell.classList.add('we-solved');
        cells.appendChild(cell);
      }
      rowDiv.appendChild(cells);
      container.appendChild(rowDiv);
    });
  }

  function weRenderStep(si) {
    const s = WE_STEPS[si];
    document.getElementById('weStepBadge').textContent = `STEP ${si} / ${WE_TOTAL}`;
    const titleEl = document.getElementById('weStepTitle');
    titleEl.textContent = s.title;
    titleEl.className = 'we-step-title' + (s.isFinal ? ' is-final' : '');

    let body = s.body;
    if (s.isFinal) {
      body += `<div class="we-solution-row">
        <span class="we-sol-chip">A = 4</span><span class="we-sol-chip">B = 3</span>
        <span class="we-sol-chip">C = 8</span><span class="we-sol-chip">D = 6</span>
        <span class="we-sol-chip">E = 1</span><span class="we-sol-chip">F = 5</span>
      </div>`;
    }
    document.getElementById('weStepBody').innerHTML = body;

    document.querySelectorAll('.we-clues-list li').forEach((li, i) => {
      li.classList.remove('we-clue-active','we-clue-done');
      if (s.doneClues.includes(i))   li.classList.add('we-clue-done');
      if (s.activeClues.includes(i)) li.classList.add('we-clue-active');
    });

    const dots = document.getElementById('weStepDots');
    if (dots) {
      dots.innerHTML = '';
      for (let i = 0; i <= WE_TOTAL; i++) {
        const d = document.createElement('div');
        d.className = 'we-dot' + (i < si ? ' done' : i === si ? ' active' : '');
        dots.appendChild(d);
      }
    }

    document.getElementById('wePrevBtn').disabled = (si === 0);
    const nxt = document.getElementById('weNextBtn');
    if (si >= WE_TOTAL) {
      nxt.innerHTML = 'Done ✓';
      nxt.disabled = false; // "Done" closes the sub-modal
      nxt.dataset.done = '1';
    } else {
      nxt.innerHTML = 'Next Step &#x2192;';
      nxt.dataset.done = '';
    }
  }

  function weGoTo(si) {
    weStep = Math.max(0, Math.min(WE_TOTAL, si));
    weRebuildTo(weStep);
    weRenderGrid();
    weRenderStep(weStep);
  }

function openWorkedExample() {
  const overlay = document.getElementById('workedExampleModal');
  if (!overlay) return;

  overlay.classList.add('open');
  weGoTo(0);
}

  function closeWorkedExample() {
    const overlay = document.getElementById('workedExampleModal');
    if (overlay) overlay.classList.remove('open');
  }


  document.addEventListener('DOMContentLoaded', function () {
    const openBtn    = document.getElementById('openWorkedExampleBtn');
    const backBtn    = document.getElementById('weBackBtn');
    const closeBtn   = document.getElementById('weCloseBtn');
    const nextBtn    = document.getElementById('weNextBtn');
    const prevBtn    = document.getElementById('wePrevBtn');
    const restartBtn = document.getElementById('weRestartBtn');
    const overlay    = document.getElementById('workedExampleModal');

if (openBtn) openBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  openWorkedExample();
});

    if (backBtn)  backBtn.addEventListener('click',  closeWorkedExample);
    if (closeBtn) closeBtn.addEventListener('click', closeWorkedExample);
    if (overlay)  overlay.addEventListener('click', e => {
      if (e.target === overlay) closeWorkedExample();
    });

    if (nextBtn) nextBtn.addEventListener('click', () => {
      if (nextBtn.dataset.done === '1') { closeWorkedExample(); return; }
      weGoTo(weStep + 1);
    });
    if (prevBtn)    prevBtn.addEventListener('click',    () => weGoTo(weStep - 1));
    if (restartBtn) restartBtn.addEventListener('click', () => weGoTo(0));

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        const we = document.getElementById('workedExampleModal');
        if (we && we.classList.contains('open')) { closeWorkedExample(); }
      }
    });
  });

  /*═══════════════════════ END OF TUTORIAL WALKTHROUGH ════════════════════ -->*/

  /* ══════════════════════════════════════════
     FEATURE B — Share Popover
  ══════════════════════════════════════════ */

  let _shareGaveUp = false;
  let _shareMistakes = 0;

  window._sflShareContext = {
    set: function(gaveUp, mistakes) {
      _shareGaveUp = gaveUp;
      _shareMistakes = mistakes;
    }
  };

function diffEmoji(r) {
  if (r <= 1000) return '\uD83D\uDFE2';   // 🟢
  if (r <= 1300) return '\uD83D\uDFE1';   // 🟡
  if (r <= 1800) return '\uD83D\uDFE0';   // 🟠
  return '\uD83D\uDD34';                   // 🔴
}
function gradeEmoji(g) {
  if (!g || g === 'F') return '\uD83D\uDC80';           // 💀
  if (g.startsWith('A')) return '\uD83C\uDFC6';         // 🏆
  if (g.startsWith('B')) return '\u26A1';               // ⚡
  return '\u2705';                                       // ✅
}
  function mistakeBar(n) {
    let s = ''; for (let i = 0; i < 3; i++) s += (i < n ? '✗' : '○'); return s;
  }

function buildShareText(solveTime, gaveUp, puzzleRating, grade, mistakes) {
  const site = 'sixfigurelogic.com';
  const diff = (window._ratingToDifficulty ? window._ratingToDifficulty(puzzleRating) : 'puzzle').toUpperCase();
  const m = Math.floor(solveTime / 60), s = String(solveTime % 60).padStart(2,'0');
  const timeStr = gaveUp ? '--:--' : `${m}:${s}`;
  const de = diffEmoji(puzzleRating), ge = gradeEmoji(grade);

  const mistakeWord = mistakes === 0 ? 'zero mistakes' : mistakes === 1 ? '1 mistake' : `${mistakes} mistakes`;

  if (gaveUp) {
    return `🧩 Six-Figure Logic\n\nThis ${diff} puzzle beat me today (rating ${puzzleRating}) — can you crack it?\n\n👉 ${site}`;
  }
  const article = /^[AEIOU]/.test(diff) ? 'an' : 'a';
  return `🧩 Six-Figure Logic\n\nJust solved ${article} ${diff} puzzle! ${de}\n\n• ⏱ ${timeStr}  \n• ${mistakeWord}  \n• Grade ${grade} ${ge}\n• Puzzle rating: ${puzzleRating}\n\n👉 ${site}`;
}

  function getRenderedGrade() {
    const el = document.querySelector('.result-grade-value');
    return el ? el.textContent.trim() : '?';
  }
  function getRenderedSolveTime() {
    const stats = document.getElementById('resultStats');
    if (!stats) return 0;
    const rows = stats.querySelectorAll('.result-stat-value');
    if (rows.length >= 2) {
      const t = rows[1].textContent.trim();
      if (t === 'N/A') return 0;
      const parts = t.split(':');
      if (parts.length === 2) return parseInt(parts[0],10)*60 + parseInt(parts[1],10);
    }
    return 0;
  }

  function isMobileDevice() {
    return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  }

  document.addEventListener('DOMContentLoaded', function () {
    const shareBtn  = document.getElementById('resultShareBtn');
    const popover   = document.getElementById('sharePopover');
    const copyBtn   = document.getElementById('shareCopyBtn');
    const twitterA  = document.getElementById('shareTwitter');
    const whatsappA = document.getElementById('shareWhatsapp');
    const facebookA = document.getElementById('shareFacebook');
    if (!shareBtn || !popover) return;

    function getShareData() {
      const puzzleRating = (window.currentSolution && window.currentSolution._rating) || 1000;
      const grade = getRenderedGrade();
      const solveTime = getRenderedSolveTime();
      const text = buildShareText(solveTime, _shareGaveUp, puzzleRating, grade, _shareMistakes);
      const url = 'https://sixfigurelogic.com';
      return { text, url, puzzleRating };
    }

    shareBtn.addEventListener('click', async function (e) {
      e.stopPropagation();

      // Mobile: native share
      if (isMobileDevice() && navigator.share) {
        const { text } = getShareData();
        try { await navigator.share({ text }); } catch(err) {}
        return;
      }

      // Desktop: toggle popover
      const isOpen = popover.classList.contains('open');
      popover.classList.toggle('open', !isOpen);

      if (!isOpen) {
        // Populate share links
        const { text, url } = getShareData();
        const enc = encodeURIComponent(text);
        if (twitterA)  twitterA.href  = `https://twitter.com/intent/tweet?text=${enc}`;
        if (whatsappA) whatsappA.href = `https://wa.me/?text=${encodeURIComponent(text)}`;
       if (facebookA) {
  facebookA.removeAttribute('href');
  facebookA.style.cursor = 'pointer';
  facebookA.addEventListener('click', async function(e) {
    e.preventDefault();
    e.stopPropagation();  // ← prevent outside-click handler closing popover
    const { text } = getShareData();
    try {
      await navigator.clipboard.writeText(text);
    } catch(err) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    }
    // Flash green
    const label = facebookA.querySelector('span');
    facebookA.classList.add('copied');
    if (label) label.textContent = '\u2713 Copied! Opening Facebook\u2026';
    // Wait 1s then open Facebook
    setTimeout(() => {
      window.open('https://www.facebook.com/', '_blank', 'noopener');
    }, 1000);
    // Reset label after 3s
    setTimeout(() => {
      facebookA.classList.remove('copied');
      if (label) label.textContent = 'Facebook (copy + open)';
    }, 3000);
  });
}
        // Reset copy btn
        const copyLabel = document.getElementById('copyBtnLabel');
        if (copyLabel) copyLabel.textContent = 'Copy Text';
        if (copyBtn) copyBtn.classList.remove('copied');
      }
    });

    // Copy button
    if (copyBtn) {
  copyBtn.addEventListener('click', async function (e) {
    e.stopPropagation();  // ← ADD THIS LINE
    const { text } = getShareData();
    try {
      await navigator.clipboard.writeText(text);
    } catch(e) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    }
    const copyLabel = document.getElementById('copyBtnLabel');
    if (copyLabel) copyLabel.textContent = '\u2713 Copied!';
    copyBtn.classList.add('copied');
    setTimeout(() => {
      if (copyLabel) copyLabel.textContent = 'Copy Text';
      copyBtn.classList.remove('copied');
    }, 2500);
  });
}

    // Close popover on outside click
    document.addEventListener('click', function (e) {
      if (!popover.contains(e.target) && e.target !== shareBtn) {
        popover.classList.remove('open');
      }
    });

    // Also close when result overlay closes
    const resultCloseBtn = document.getElementById('resultCloseBtn');
    if (resultCloseBtn) resultCloseBtn.addEventListener('click', () => popover.classList.remove('open'));
    const resultOverlay = document.getElementById('resultOverlay');
    if (resultOverlay) resultOverlay.addEventListener('click', () => popover.classList.remove('open'));
  });

})();