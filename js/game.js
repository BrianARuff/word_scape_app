// Core game state and logic

import { generatePuzzle } from './puzzle-generator.js';
import { saveState, loadState, showToast } from './utils.js';
import { initGrid, revealWord, pulseWord } from './grid.js';
import { initWheel, destroyWheel } from './wheel.js';
import { useHint } from './hints.js';

const state = {
  currentLevel: 1,
  foundWords: [],
  bonusWordsFound: [],
  hintsRemaining: 3,
};

let currentPuzzle = null;
let submitting = false;

export function initGame() {
  state.currentLevel = loadState('wordscape_level', 1);
  state.hintsRemaining = loadState('wordscape_hints', 3);

  document.getElementById('hint-btn').addEventListener('click', onHintClick);
  document.getElementById('reset-btn').addEventListener('click', onResetClick);
  document.getElementById('bonus-btn').addEventListener('click', toggleBonusPanel);
  document.getElementById('bonus-close').addEventListener('click', closeBonusPanel);
  document.getElementById('bonus-backdrop').addEventListener('click', closeBonusPanel);

  loadLevel(state.currentLevel);
}

function loadLevel(levelNum) {
  // Try to restore a saved puzzle for this level (in case of mid-level page refresh)
  let puzzle = loadState('wordscape_current_puzzle', null);
  if (!puzzle || puzzle.id !== levelNum) {
    puzzle = generatePuzzle(levelNum);
    saveState('wordscape_current_puzzle', puzzle);
  }

  currentPuzzle = puzzle;
  state.currentLevel = levelNum;
  state.foundWords = [];
  state.bonusWordsFound = [];

  document.getElementById('level-display').textContent = `Level ${levelNum}`;
  document.getElementById('current-word').textContent = '';
  updateHintDisplay();
  updateBonusDisplay();
  closeBonusPanel();

  initGrid(currentPuzzle);

  requestAnimationFrame(() => {
    initWheel(currentPuzzle.letters, onWordSwiped);
  });

  hideOverlay();
}

function onWordSwiped(word) {
  if (submitting) return;
  const upperWord = word.toUpperCase();
  const display = document.getElementById('current-word');

  // Check if it's a puzzle word
  if (currentPuzzle.words.includes(upperWord)) {
    if (state.foundWords.includes(upperWord)) {
      showToast('Already found!');
      pulseWord(upperWord);
      clearWordDisplay(400);
      return;
    }
    // Correct word!
    submitting = true;
    state.foundWords.push(upperWord);

    display.classList.add('correct');
    clearWordDisplay(500);

    revealWord(upperWord).then(() => {
      submitting = false;
      checkLevelComplete();
    });
    return;
  }

  // Check if it's a bonus word
  if (currentPuzzle.bonusWords && currentPuzzle.bonusWords.includes(upperWord)) {
    if (state.bonusWordsFound.includes(upperWord)) {
      showToast('Already found!');
      clearWordDisplay(400);
      return;
    }
    state.bonusWordsFound.push(upperWord);
    showToast('Bonus word! +1');
    updateBonusDisplay();
    clearWordDisplay(400);
    return;
  }

  // Invalid word
  display.classList.add('shake');
  clearWordDisplay(500);
}

function clearWordDisplay(afterMs) {
  setTimeout(() => {
    const display = document.getElementById('current-word');
    display.textContent = '';
    display.classList.remove('shake', 'correct', 'active');
  }, afterMs);
}

function checkLevelComplete() {
  if (state.foundWords.length < currentPuzzle.words.length) return;
  setTimeout(() => showLevelComplete(), 600);
}

function showLevelComplete() {
  const overlay = document.getElementById('level-complete');
  document.getElementById('complete-level-num').textContent = state.currentLevel;
  overlay.classList.add('visible');

  if (state.currentLevel % 3 === 0) {
    state.hintsRemaining++;
    saveState('wordscape_hints', state.hintsRemaining);
    updateHintDisplay();
    showToast('Bonus hint earned!', 2000);
  }

  saveState('wordscape_level', state.currentLevel + 1);
  saveState('wordscape_current_puzzle', null);

  document.getElementById('next-level-btn').onclick = () => {
    destroyWheel();
    loadLevel(state.currentLevel + 1);
  };
}

function hideOverlay() {
  document.getElementById('level-complete').classList.remove('visible');
}

function onHintClick() {
  if (state.hintsRemaining <= 0) {
    showToast('No hints left!');
    return;
  }
  if (!currentPuzzle) return;

  const result = useHint(currentPuzzle, state.foundWords);
  if (result.used) {
    state.hintsRemaining--;
    saveState('wordscape_hints', state.hintsRemaining);
    updateHintDisplay();

    // If the hint completed all letters of a word, auto-find it
    if (result.completed) {
      state.foundWords.push(result.word);
      showToast('Word complete!');
      checkLevelComplete();
    }
  } else {
    showToast('Nothing to reveal!');
  }
}

function updateHintDisplay() {
  document.getElementById('hint-count').textContent = state.hintsRemaining;
}

// ─── Bonus Words Panel ───

function updateBonusDisplay() {
  const count = state.bonusWordsFound.length;
  document.getElementById('bonus-count').textContent = count;

  const list = document.getElementById('bonus-words-list');
  list.innerHTML = '';

  if (count === 0) {
    const empty = document.createElement('p');
    empty.className = 'bonus-empty';
    empty.textContent = 'Find bonus words from the letter wheel!';
    list.appendChild(empty);
  } else {
    for (const word of state.bonusWordsFound) {
      const chip = document.createElement('span');
      chip.className = 'bonus-word-chip';
      chip.textContent = word;
      list.appendChild(chip);
    }
  }
}

function toggleBonusPanel() {
  const panel = document.getElementById('bonus-panel');
  const backdrop = document.getElementById('bonus-backdrop');
  if (panel.classList.contains('visible')) {
    closeBonusPanel();
  } else {
    panel.classList.add('visible');
    backdrop.classList.add('visible');
  }
}

function closeBonusPanel() {
  document.getElementById('bonus-panel').classList.remove('visible');
  document.getElementById('bonus-backdrop').classList.remove('visible');
}

function onResetClick() {
  if (confirm('Reset all progress? This cannot be undone.')) {
    state.currentLevel = 1;
    state.hintsRemaining = 3;
    saveState('wordscape_level', 1);
    saveState('wordscape_hints', 3);
    saveState('wordscape_current_puzzle', null);
    destroyWheel();
    loadLevel(1);
    showToast('Progress reset');
  }
}
