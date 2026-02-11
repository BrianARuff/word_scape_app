#!/usr/bin/env node

// Puzzle generator — uses wordlist-english to build levels from seed words.
// Uses tiered word lists: common words for puzzle words, broader list for bonus.
// Run:  node scripts/generate-puzzles.js > js/puzzles.js

const wordlistData = require('wordlist-english');

// Build tiered dictionaries by combining SCOWL frequency levels.
// english/10 = most common ~4K, english/20 = next ~7K, english/35 = next ~27K
function buildWordSet(...keys) {
  const words = new Set();
  for (const key of keys) {
    for (const w of wordlistData[key]) {
      const lower = w.toLowerCase().trim();
      if (/^[a-z]+$/.test(lower)) words.add(lower);
    }
  }
  return words;
}

// Common words — used for puzzle words the player must find
const commonDict = buildWordSet('english/10', 'english/20', 'english/35');
// Extended — used for bonus words (includes less common but still real words)
const extendedDict = buildWordSet('english/10', 'english/20', 'english/35', 'english/40', 'english/50');

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

// Find all sub-anagrams of a seed word from a given dictionary
function findSubAnagrams(seed, dict) {
  const sourceFreq = getCharFrequency(seed);
  const results = [];
  for (const word of dict) {
    if (word.length < 3 || word.length > seed.length) continue;
    if (canFormWord(word, sourceFreq)) results.push(word);
  }
  return results.sort((a, b) => a.length - b.length || a.localeCompare(b));
}

// ─── Seed words for 25 levels ───
const seedWords = [
  // 5-letter seeds (levels 1-8) — easier
  'store', 'plant', 'share', 'cream', 'trail', 'spoke', 'crane', 'stove',
  // 6-letter seeds (levels 9-17) — medium
  'flower', 'garden', 'castle', 'planet', 'throne', 'wander', 'silver', 'candle', 'hunter',
  // 7-letter seeds (levels 18-25) — harder
  'painter', 'strange', 'monster', 'plaster', 'chapter', 'cluster', 'roasted', 'blanket',
];

// ─── Generate one level ───

function generateLevel(id, seed) {
  // Find sub-anagrams from each tier
  const commonWords = findSubAnagrams(seed, commonDict);
  const extendedWords = findSubAnagrams(seed, extendedDict);

  // Puzzle words come from the common dictionary
  const puzzleWords = selectPuzzleWords(commonWords, seed, id);

  // Bonus words: anything valid (from extended dict) that's not already a puzzle word
  const puzzleSet = new Set(puzzleWords);
  const bonusWords = extendedWords.filter(w => !puzzleSet.has(w));

  return {
    id,
    letters: shuffle(seed.toUpperCase().split('')),
    words: puzzleWords.map(w => w.toUpperCase()),
    bonusWords: bonusWords.map(w => w.toUpperCase()),
  };
}

function selectPuzzleWords(commonWords, seed, level) {
  const selected = new Set();

  // Always include the seed word
  if (commonDict.has(seed)) selected.add(seed);

  // Group by length
  const byLength = {};
  for (const w of commonWords) {
    if (w === seed) continue;
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

// ─── Generate all levels ───

const puzzles = seedWords.map((seed, i) => {
  const level = generateLevel(i + 1, seed);
  process.stderr.write(
    `Level ${level.id}: seed="${seed}" → ${level.words.length} puzzle, ${level.bonusWords.length} bonus  [${level.words.join(', ')}]\n`
  );
  return level;
});

// ─── Output as ES module ───

const output = `// Auto-generated puzzle data — do not edit manually.
// Generated from seed words using wordlist-english dictionary.
// Re-generate: node scripts/generate-puzzles.js > js/puzzles.js

const puzzles = ${JSON.stringify(puzzles, null, 2)};

export default puzzles;
`;

process.stdout.write(output);
