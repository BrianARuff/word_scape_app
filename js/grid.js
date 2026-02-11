// Word list rendering — displays puzzle words as a vertical list of horizontal letter boxes.

let wordRows = new Map(); // word → DOM row element

export function initGrid(puzzle) {
  const container = document.getElementById('grid-container');
  container.innerHTML = '';
  wordRows.clear();

  const wordList = document.createElement('div');
  wordList.className = 'word-list';

  // Sort words by length, then alphabetically (for nice visual stacking)
  const sorted = [...puzzle.words].sort(
    (a, b) => a.length - b.length || a.localeCompare(b)
  );

  for (const word of sorted) {
    const row = document.createElement('div');
    row.className = 'word-row';
    row.dataset.word = word;

    for (let i = 0; i < word.length; i++) {
      const cell = document.createElement('div');
      cell.className = 'word-cell';
      cell.dataset.letter = word[i];
      cell.dataset.index = i;

      const span = document.createElement('span');
      span.className = 'cell-letter';
      cell.appendChild(span);
      row.appendChild(cell);
    }

    wordList.appendChild(row);
    wordRows.set(word, row);
  }

  container.appendChild(wordList);

  // Dynamically size cells to fill available grid space
  fitCells(sorted);
}

// Compute optimal cell size so the word list fills the grid area without overflow.
function fitCells(words) {
  const area = document.getElementById('grid-area');
  const availH = area.clientHeight - 8;   // subtract vertical padding (4px top + 4px bottom)
  const availW = area.clientWidth - 24;   // subtract horizontal padding (12px each side)

  const numRows = words.length;
  const maxLen = Math.max(...words.map(w => w.length));

  // Tighten gaps when many rows to save space
  const gap = numRows <= 8 ? 6 : 4;

  const maxByHeight = (availH - (numRows - 1) * gap) / numRows;
  const maxByWidth = (availW - (maxLen - 1) * gap) / maxLen;

  const cellSize = Math.max(24, Math.min(60, Math.floor(Math.min(maxByHeight, maxByWidth))));
  const fontSize = Math.max(12, Math.round(cellSize * 0.5));

  const container = document.getElementById('grid-container');
  container.style.setProperty('--cell-size', cellSize + 'px');
  container.style.setProperty('--cell-gap', gap + 'px');
  container.style.setProperty('--cell-font', fontSize + 'px');
}

// Reveal all letters of a word with cascading pop-in animation.
// Returns a promise that resolves when the animation finishes.
export function revealWord(word) {
  const row = wordRows.get(word);
  if (!row) return Promise.resolve();

  const cells = row.querySelectorAll('.word-cell');
  let maxDelay = 0;

  cells.forEach((cell, i) => {
    if (cell.classList.contains('revealed')) return;
    const delay = i * 60;
    maxDelay = delay;
    setTimeout(() => {
      const span = cell.querySelector('.cell-letter');
      span.textContent = cell.dataset.letter;
      cell.classList.add('revealed');
      cell.classList.add('pop-in');
      setTimeout(() => cell.classList.remove('pop-in'), 400);
    }, delay);
  });

  return new Promise(r => setTimeout(r, maxDelay + 400));
}

// Reveal a single letter in a word by index (for hints).
// Returns true if a letter was revealed, false if already visible.
export function revealHintLetter(word, letterIndex) {
  const row = wordRows.get(word);
  if (!row) return false;

  const cell = row.querySelectorAll('.word-cell')[letterIndex];
  if (!cell || cell.classList.contains('revealed')) return false;

  const span = cell.querySelector('.cell-letter');
  span.textContent = cell.dataset.letter;
  cell.classList.add('revealed', 'hint-glow');
  setTimeout(() => cell.classList.remove('hint-glow'), 1200);
  return true;
}

// Get indices of unrevealed letters in a word.
export function getUnrevealedIndices(word) {
  const row = wordRows.get(word);
  if (!row) return [];

  const indices = [];
  row.querySelectorAll('.word-cell').forEach((cell, i) => {
    if (!cell.classList.contains('revealed')) indices.push(i);
  });
  return indices;
}

// Pulse animation on an already-found word row.
export function pulseWord(word) {
  const row = wordRows.get(word);
  if (!row) return;

  row.querySelectorAll('.word-cell').forEach(cell => {
    cell.classList.add('pulse');
    setTimeout(() => cell.classList.remove('pulse'), 600);
  });
}
