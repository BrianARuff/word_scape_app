// Dynamic puzzle generator — creates a new puzzle for each level at runtime.
// Uses pre-extracted dictionary and seed pools from dictionary.js.

import { commonWords, seedPool } from './dictionary.js';

// Build lookup set once on import
const commonSet = new Set(commonWords);

// ─── Helpers ───

function getCharFrequency(word) {
  const freq = {};
  for (const ch of word) freq[ch] = (freq[ch] || 0) + 1;
  return freq;
}

function canFormWord(candidate, sourceFreq) {
  const cf = getCharFrequency(candidate);
  for (const ch in cf) {
    if (!sourceFreq[ch] || cf[ch] > sourceFreq[ch]) return false;
  }
  return true;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Find all sub-anagrams of a seed word from the common dictionary
function findSubAnagrams(seed) {
  const sourceFreq = getCharFrequency(seed);
  const results = [];
  for (const word of commonWords) {
    if (word.length < 3 || word.length > seed.length) continue;
    if (canFormWord(word, sourceFreq)) results.push(word);
  }
  return results;
}

// Select which sub-anagrams become puzzle words (randomized each time)
function selectPuzzleWords(allSubs, seed, level) {
  const selected = new Set();

  // Always include the seed word itself
  if (commonSet.has(seed)) selected.add(seed);

  // Shuffle so different words get picked each play
  const shuffled = shuffle(allSubs.filter(w => w !== seed));

  // Group by length
  const byLength = {};
  for (const w of shuffled) {
    const len = w.length;
    if (!byLength[len]) byLength[len] = [];
    byLength[len].push(w);
  }

  // Target count scales with level
  const targetCount = Math.min(5 + Math.floor((level - 1) / 4), 12);

  // Pick words from each length bucket, spreading evenly
  const lengths = Object.keys(byLength).map(Number).sort();
  let round = 0;
  while (selected.size < targetCount && round < 8) {
    for (const len of lengths) {
      if (selected.size >= targetCount) break;
      const words = byLength[len];
      if (round < words.length) {
        selected.add(words[round]);
      }
    }
    round++;
  }

  return [...selected].sort((a, b) => a.length - b.length || a.localeCompare(b));
}

// Generate a fresh puzzle for the given level number.
export function generatePuzzle(level) {
  // Determine seed length based on level difficulty
  let seedLength;
  if (level <= 8) seedLength = 5;
  else if (level <= 17) seedLength = 6;
  else seedLength = 7;

  // Pick a random seed from the pool
  const pool = seedPool[seedLength];
  const seed = pool[Math.floor(Math.random() * pool.length)];

  // Find all sub-anagrams
  const allSubs = findSubAnagrams(seed);

  // Select puzzle words (randomized)
  const puzzleWords = selectPuzzleWords(allSubs, seed, level);
  const puzzleSet = new Set(puzzleWords);

  // Bonus words: remaining sub-anagrams not selected as puzzle words
  const bonusWords = allSubs.filter(w => !puzzleSet.has(w));

  return {
    id: level,
    letters: shuffle(seed.toUpperCase().split('')),
    words: puzzleWords.map(w => w.toUpperCase()),
    bonusWords: bonusWords.map(w => w.toUpperCase()),
  };
}
