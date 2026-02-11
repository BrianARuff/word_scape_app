// Hint system — reveals a random unrevealed letter in the word list.

import { getUnrevealedIndices, revealHintLetter } from './grid.js';

// Reveal one random letter from an unfound word.
// Returns { used: false } if nothing to reveal,
// or { used: true, word, completed: bool } if a letter was revealed.
export function useHint(puzzle, foundWords) {
  // Collect unfound words that still have unrevealed letters
  const candidates = [];
  for (const word of puzzle.words) {
    if (foundWords.includes(word)) continue;
    const unrevealed = getUnrevealedIndices(word);
    if (unrevealed.length > 0) {
      candidates.push({ word, unrevealed });
    }
  }

  if (candidates.length === 0) return { used: false };

  // Pick a random unfound word, then a random unrevealed letter
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  const idx = pick.unrevealed[Math.floor(Math.random() * pick.unrevealed.length)];
  revealHintLetter(pick.word, idx);

  // Check if this was the last unrevealed letter (word is now fully visible)
  const remaining = getUnrevealedIndices(pick.word);
  return { used: true, word: pick.word, completed: remaining.length === 0 };
}
