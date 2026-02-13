// Core game state and logic

import { initGrid, pulseWord, revealWord } from "./grid.js";
import { useHint } from "./hints.js";
import { createPuzzleSignature, generatePuzzle } from "./puzzle-generator.js";
import {
  createDefaultProgress,
  exposeProgressDecryptor,
  loadProgress,
  queueSaveProgress,
} from "./progress-store.js";
import { showToast } from "./utils.js";
import { destroyWheel, initWheel } from "./wheel.js";

const MAX_SIGNATURE_HISTORY = 25000;

const state = {
  currentLevel: 1,
  foundWords: [],
  bonusWordsFound: [],
  hintsRemaining: 5,
  bonusWordsTowardHint: 0,
  usedPuzzleSignatures: [],
};

let usedSignatureSet = new Set();
let restoredPuzzle = null;
let currentPuzzle = null;
let submitting = false;

export async function initGame() {
  exposeProgressDecryptor();
  const progress = await loadProgress().catch(() => createDefaultProgress());

  state.currentLevel = progress.currentLevel;
  state.hintsRemaining = progress.hintsRemaining;
  state.bonusWordsTowardHint = progress.bonusWordsTowardHint;
  state.usedPuzzleSignatures = [...progress.usedPuzzleSignatures];
  usedSignatureSet = new Set(state.usedPuzzleSignatures);
  restoredPuzzle = progress.currentPuzzle;

  document.getElementById("hint-btn").addEventListener("click", onHintClick);
  document.getElementById("reset-btn").addEventListener("click", onResetClick);
  document
    .getElementById("bonus-btn")
    .addEventListener("click", toggleBonusPanel);
  document
    .getElementById("bonus-close")
    .addEventListener("click", closeBonusPanel);
  document
    .getElementById("bonus-backdrop")
    .addEventListener("click", closeBonusPanel);

  loadLevel(state.currentLevel);
}

function buildProgressSnapshot(overrides = {}) {
  return {
    currentLevel: overrides.currentLevel ?? state.currentLevel,
    hintsRemaining: overrides.hintsRemaining ?? state.hintsRemaining,
    bonusWordsTowardHint:
      overrides.bonusWordsTowardHint ?? state.bonusWordsTowardHint,
    currentPuzzle:
      overrides.currentPuzzle !== undefined ? overrides.currentPuzzle : currentPuzzle,
    usedPuzzleSignatures: [...state.usedPuzzleSignatures],
  };
}

function persistProgress(overrides = {}) {
  void queueSaveProgress(buildProgressSnapshot(overrides));
}

function registerPuzzleSignature(puzzle) {
  const signature = puzzle.signature || createPuzzleSignature(puzzle);
  puzzle.signature = signature;

  if (usedSignatureSet.has(signature)) return;
  usedSignatureSet.add(signature);
  state.usedPuzzleSignatures.push(signature);

  if (state.usedPuzzleSignatures.length > MAX_SIGNATURE_HISTORY) {
    const overflow = state.usedPuzzleSignatures.length - MAX_SIGNATURE_HISTORY;
    state.usedPuzzleSignatures.splice(0, overflow);
    usedSignatureSet = new Set(state.usedPuzzleSignatures);
  }
}

function loadLevel(levelNum) {
  let puzzle = null;

  // Try to restore a saved puzzle for this level (mid-level page refresh).
  if (restoredPuzzle && restoredPuzzle.id === levelNum) {
    puzzle = restoredPuzzle;
  } else {
    puzzle = generatePuzzle(levelNum, state.usedPuzzleSignatures);
  }
  restoredPuzzle = null;
  registerPuzzleSignature(puzzle);

  currentPuzzle = puzzle;
  state.currentLevel = levelNum;
  state.foundWords = [];
  state.bonusWordsFound = [];

  document.getElementById("level-display").textContent = `Level ${levelNum}`;
  document.getElementById("current-word").textContent = "";
  updateHintDisplay();
  updateBonusDisplay();
  closeBonusPanel();

  initGrid(currentPuzzle);

  requestAnimationFrame(() => {
    initWheel(currentPuzzle.letters, onWordSwiped);
  });

  persistProgress({ currentLevel: levelNum, currentPuzzle: currentPuzzle });
  hideOverlay();
}

function awardHintsFromBonusWords(count = 1) {
  state.bonusWordsTowardHint += count;
  let hintsEarned = 0;

  while (state.bonusWordsTowardHint >= 3) {
    state.bonusWordsTowardHint -= 3;
    hintsEarned++;
  }

  if (hintsEarned > 0) {
    state.hintsRemaining += hintsEarned;
    updateHintDisplay();
  }

  return hintsEarned;
}

function restartAnimation(el, className) {
  if (!el) return;
  el.classList.remove(className);
  // Reflow so repeated events can replay the same animation class.
  void el.offsetWidth;
  el.classList.add(className);
}

function animateBonusUiGain(hintsEarned) {
  const bonusBtn = document.getElementById("bonus-btn");
  const bonusBadge = document.getElementById("bonus-count");
  const chargeMeter = document.getElementById("bonus-charge-meter");
  const hintBtn = document.getElementById("hint-btn");

  restartAnimation(bonusBtn, "bonus-gain");
  restartAnimation(bonusBadge, "bonus-gain");
  restartAnimation(chargeMeter, "bonus-gain");

  if (hintsEarned > 0) {
    restartAnimation(chargeMeter, "charge-reset");
    restartAnimation(hintBtn, "hint-reward");
  }
}

function updateBonusChargeMeter() {
  const pips = document.querySelectorAll(".bonus-charge-pip");
  pips.forEach((pip, idx) => {
    pip.classList.toggle("filled", idx < state.bonusWordsTowardHint);
  });
}

function onWordSwiped(word) {
  if (submitting) return;
  const upperWord = word.toUpperCase();
  const display = document.getElementById("current-word");

  // Check if it's a puzzle word
  if (currentPuzzle.words.includes(upperWord)) {
    if (state.foundWords.includes(upperWord)) {
      showToast("Already found!");
      pulseWord(upperWord);
      clearWordDisplay(400);
      return;
    }
    // Correct word!
    submitting = true;
    state.foundWords.push(upperWord);

    display.classList.add("correct");
    clearWordDisplay(500);

    revealWord(upperWord).then(() => {
      submitting = false;
      checkLevelComplete();
    });
    return;
  }

  // Check if it's a bonus word
  if (
    currentPuzzle.bonusWords &&
    currentPuzzle.bonusWords.includes(upperWord)
  ) {
    if (state.bonusWordsFound.includes(upperWord)) {
      showToast("Already found!");
      clearWordDisplay(400);
      return;
    }
    state.bonusWordsFound.push(upperWord);
    const hintsEarned = awardHintsFromBonusWords(1);
    if (hintsEarned > 0) {
      const label = hintsEarned === 1 ? "hint" : "hints";
      showToast(`Bonus word! +${hintsEarned} ${label}`);
    } else {
      const toNextHint = 3 - state.bonusWordsTowardHint;
      showToast(`Bonus word! ${toNextHint} to next hint`);
    }
    updateBonusDisplay();
    animateBonusUiGain(hintsEarned);
    persistProgress();
    clearWordDisplay(400);
    return;
  }

  // Invalid word
  display.classList.add("shake");
  clearWordDisplay(500);
}

function clearWordDisplay(afterMs) {
  setTimeout(() => {
    const display = document.getElementById("current-word");
    display.textContent = "";
    display.classList.remove("shake", "correct", "active");
  }, afterMs);
}

function checkLevelComplete() {
  if (state.foundWords.length < currentPuzzle.words.length) return;
  setTimeout(() => showLevelComplete(), 600);
}

function showLevelComplete() {
  const overlay = document.getElementById("level-complete");
  document.getElementById("complete-level-num").textContent =
    state.currentLevel;
  overlay.classList.add("visible");

  const nextLevel = state.currentLevel + 1;
  persistProgress({ currentLevel: nextLevel, currentPuzzle: null });

  document.getElementById("next-level-btn").onclick = () => {
    destroyWheel();
    loadLevel(nextLevel);
  };
}

function hideOverlay() {
  document.getElementById("level-complete").classList.remove("visible");
}

function onHintClick() {
  if (state.hintsRemaining <= 0) {
    showToast("No hints left!");
    return;
  }
  if (!currentPuzzle) return;

  const result = useHint(currentPuzzle, state.foundWords);
  if (result.used) {
    state.hintsRemaining--;
    updateHintDisplay();
    persistProgress();

    // If the hint completed all letters of a word, auto-find it
    if (result.completed && !state.foundWords.includes(result.word)) {
      state.foundWords.push(result.word);
      showToast("Word complete!");
      checkLevelComplete();
    }
  } else {
    showToast("Nothing to reveal!");
  }
}

function updateHintDisplay() {
  document.getElementById("hint-count").textContent = state.hintsRemaining;
}

// ─── Bonus Words Panel ───

function updateBonusDisplay() {
  const count = state.bonusWordsFound.length;
  document.getElementById("bonus-count").textContent = count;
  updateBonusChargeMeter();

  const list = document.getElementById("bonus-words-list");
  list.innerHTML = "";

  if (count === 0) {
    const empty = document.createElement("p");
    empty.className = "bonus-empty";
    empty.textContent = "Find bonus words from the letter wheel!";
    list.appendChild(empty);
  } else {
    for (const word of state.bonusWordsFound) {
      const chip = document.createElement("span");
      chip.className = "bonus-word-chip";
      chip.textContent = word;
      list.appendChild(chip);
    }
  }
}

function toggleBonusPanel() {
  const panel = document.getElementById("bonus-panel");
  const backdrop = document.getElementById("bonus-backdrop");
  if (panel.classList.contains("visible")) {
    closeBonusPanel();
  } else {
    panel.classList.add("visible");
    backdrop.classList.add("visible");
  }
}

function closeBonusPanel() {
  document.getElementById("bonus-panel").classList.remove("visible");
  document.getElementById("bonus-backdrop").classList.remove("visible");
}

function onResetClick() {
  if (confirm("Reset all progress? This cannot be undone.")) {
    state.currentLevel = 1;
    state.hintsRemaining = 5;
    state.bonusWordsTowardHint = 0;
    restoredPuzzle = null;
    currentPuzzle = null;
    persistProgress({
      currentLevel: 1,
      hintsRemaining: 5,
      bonusWordsTowardHint: 0,
      currentPuzzle: null,
    });
    destroyWheel();
    loadLevel(1);
    showToast("Progress reset");
  }
}
