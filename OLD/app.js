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
let selectedDifficulty = 'easy'; // default

// Difficulty button wiring
document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedDifficulty = btn.dataset.diff;
  });
});

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

function toggleCell(cell) {
  const isCrossed = cell.classList.toggle('crossed');
  cell.setAttribute('aria-pressed', String(isCrossed));
}

function resetGrid() {
  gridEl.querySelectorAll('.cell.crossed').forEach(c => {
    c.classList.remove('crossed');
    c.setAttribute('aria-pressed','false');
  });
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

  for (const c of clues) {
    const maxIdx = Math.max(c.Var1Index || 0, c.Var2Index || 0, c.Var3Index || 0);
    if (maxIdx === 0) globalClues.push(c);  // no sum, no product, largest, smallest etc.
    else partialClues.push({ clue: c, maxIdx });
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
function generatePuzzleJS(maxAttempts = 2000) {
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

  const DIFF_THRESHOLDS = { easy: 6, medium: 22, hard: 42 };
  // remaining cells after full deduction:
  // easy=6 (fully solved by clues), medium=7-22, hard=23-42, expert>42

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
          let ch=true; while(ch){ ch=false;
            const mx=getMax(r1);
            for(let ri=0;ri<6;ri++) if(ri!==r1) for(let v=mx;v<=10;v++) if(grid[ri][v]){clear(ri,v);ch=true;}
            for(let ri=0;ri<6;ri++) if(ri!==r1){ const mn=getMin(ri); for(let v=1;v<=mn;v++) if(grid[r1][v]){clear(r1,v);ch=true;} }
          } break;
        }
        case 'smallest': {
          let ch=true; while(ch){ ch=false;
            const mn=getMin(r1);
            for(let ri=0;ri<6;ri++) if(ri!==r1) for(let v=1;v<=mn;v++) if(grid[ri][v]){clear(ri,v);ch=true;}
            for(let ri=0;ri<6;ri++) if(ri!==r1){ const mx=getMax(ri); for(let v=mx;v<=10;v++) if(grid[r1][v]){clear(r1,v);ch=true;} }
          } break;
        }
        case 'not largest': {
          let best=0; for(let ri=0;ri<6;ri++) if(ri!==r1){const m=getMax(ri);if(m>best)best=m;}
          for(let v=best;v<=10;v++) clear(r1,v); break;
        }
        case 'not smallest': {
          let best=11; for(let ri=0;ri<6;ri++) if(ri!==r1){const m=getMin(ri);if(m>0&&m<best)best=m;}
          for(let v=1;v<=best;v++) clear(r1,v); break;
        }
        case 'between': {
          let ch=true; while(ch){ ch=false;
            const mnY=getMin(r2),mxY=getMax(r2),mnZ=getMin(r3),mxZ=getMax(r3);
            const mnYZ=Math.min(mnY,mnZ), mxYZ=Math.max(mxY,mxZ);
            for(let v=1;v<=10;v++) if(grid[r1][v]&&(v<=mnYZ||v>=mxYZ)){clear(r1,v);ch=true;}
          } break;
        }
        case 'not between': {
          const mnY=getMin(r2),mxY=getMax(r2),mnZ=getMin(r3),mxZ=getMax(r3);
          const minOfMax=Math.min(mxY,mxZ), maxOfMin=Math.max(mnY,mnZ);
          if(minOfMax<=maxOfMin) for(let v=minOfMax;v<=maxOfMin;v++) clear(r1,v); break;
        }
        case 'closer': {
          // remove x if min|x-y| >= max|x-z| for all y,z
          for(let v=1;v<=10;v++) if(grid[r1][v]){
            let maxXZ=-1; for(let z=1;z<=10;z++) if(grid[r2][z]&&z!==v) maxXZ=Math.max(maxXZ,Math.abs(v-z));
            if(maxXZ<0) continue;
            let minXY=999; for(let y=1;y<=10;y++) if(grid[r2][y]&&y!==v) minXY=Math.min(minXY,Math.abs(v-y));
            if(minXY>=maxXZ) clear(r1,v);
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
          // if all r1 even -> remove evens from r2; if all r1 odd -> remove odds from r2; symmetric
          const allEven1=Array.from({length:10},(_,i)=>i+1).filter(v=>grid[r1][v]).every(v=>EvenLookup[v]);
          const allOdd1 =Array.from({length:10},(_,i)=>i+1).filter(v=>grid[r1][v]).every(v=>!EvenLookup[v]);
          const allEven2=Array.from({length:10},(_,i)=>i+1).filter(v=>grid[r2][v]).every(v=>EvenLookup[v]);
          const allOdd2 =Array.from({length:10},(_,i)=>i+1).filter(v=>grid[r2][v]).every(v=>!EvenLookup[v]);
          if(allEven1) for(let v=1;v<=10;v++) if(EvenLookup[v]) clear(r2,v);
          if(allOdd1)  for(let v=1;v<=10;v++) if(!EvenLookup[v]) clear(r2,v);
          if(allEven2) for(let v=1;v<=10;v++) if(EvenLookup[v]) clear(r1,v);
          if(allOdd2)  for(let v=1;v<=10;v++) if(!EvenLookup[v]) clear(r1,v);
          break;
        }
        case 'xor prime': {
          const allP1 =Array.from({length:10},(_,i)=>i+1).filter(v=>grid[r1][v]).every(v=>PrimeLookup[v]);
          const allNP1=Array.from({length:10},(_,i)=>i+1).filter(v=>grid[r1][v]).every(v=>!PrimeLookup[v]);
          const allP2 =Array.from({length:10},(_,i)=>i+1).filter(v=>grid[r2][v]).every(v=>PrimeLookup[v]);
          const allNP2=Array.from({length:10},(_,i)=>i+1).filter(v=>grid[r2][v]).every(v=>!PrimeLookup[v]);
          if(allP1)  for(let v=1;v<=10;v++) if(PrimeLookup[v]) clear(r2,v);
          if(allNP1) for(let v=1;v<=10;v++) if(!PrimeLookup[v]) clear(r2,v);
          if(allP2)  for(let v=1;v<=10;v++) if(PrimeLookup[v]) clear(r1,v);
          if(allNP2) for(let v=1;v<=10;v++) if(!PrimeLookup[v]) clear(r1,v);
          break;
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

  function difficultyLabel(remaining) {
    if (remaining <= DIFF_THRESHOLDS.easy)   return 'easy';
    if (remaining <= DIFF_THRESHOLDS.medium) return 'medium';
    if (remaining <= DIFF_THRESHOLDS.hard)   return 'hard';
    return 'expert';
  }

  // Expose scorePuzzle and difficultyLabel
  window._scorePuzzle = scorePuzzle;
  window._difficultyLabel = difficultyLabel;

  // Expose generatePuzzleJS as generatePuzzle for compatibility
  window.generatePuzzle = generatePuzzleJS;
  // Expose checkClue so the UI can validate individual clues against user inputs
  window._checkCluePublic = checkClue;

})(); // end IIFE


function applyNewPuzzle(sol) {
  currentSolution = sol;
  resetGrid();
  inputIds.forEach(id => document.getElementById(id).value = '');
  feedbackEl.textContent = '';
  feedbackEl.className = 'feedback';

  // Render clues into the page
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

  // Console output for debugging
  console.log('Generated puzzle:', sol);
}


function checkAnswers() {
  if (!currentSolution) {
    feedbackEl.textContent = 'Generate a puzzle first.';
    feedbackEl.className = 'feedback incorrect';
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
    return;
  }

  // Check for duplicate values among A-F
  const values = inputIds.map(id => user[id]);
  const unique = new Set(values);
  if (unique.size < values.length) {
    feedbackEl.textContent = '✗ Each letter must have a different value.';
    feedbackEl.className = 'feedback incorrect';
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
    feedbackEl.textContent = '✓ All correct — well done!';
    feedbackEl.className = 'feedback correct';
  } else {
    feedbackEl.textContent = '✗ Some clues not satisfied.';
    feedbackEl.className = 'feedback incorrect';
  }
}

// Wire events
newPuzzleBtn.addEventListener('click', () => {
  const gen = window.generatePuzzle;
  if (typeof gen !== 'function') { alert('generatePuzzle is not defined.'); return; }

  const originalText = newPuzzleBtn.innerHTML;
  newPuzzleBtn.innerHTML = '<span class="btn-icon">⟳</span> Generating';
  newPuzzleBtn.disabled = true;

  // Use setTimeout so the UI updates before the blocking loop
  setTimeout(() => {
    try {
      let sol = null;
      const maxTries = 2000;
      for (let t = 0; t < maxTries; t++) {
        const candidate = gen();
        if (!candidate || !candidate._rawClues) continue;
        const remaining = window._scorePuzzle(candidate._rawClues, candidate);
        const label = window._difficultyLabel(remaining);
        if (label === selectedDifficulty) { sol = candidate; break; }
      }
      // Fallback: if no match found, use last generated regardless
      if (!sol) sol = gen();
      applyNewPuzzle(sol);
    } catch(err) {
      alert('Error: ' + err.message);
    } finally {
      newPuzzleBtn.innerHTML = originalText;
      newPuzzleBtn.disabled = false;
    }
  }, 20);
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
