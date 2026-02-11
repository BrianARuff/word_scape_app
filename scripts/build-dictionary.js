#!/usr/bin/env node

// Extracts word lists and good seed words from wordlist-english npm package.
// Only keeps 3-7 letter alphabetic words for the game.
// Run:  node scripts/build-dictionary.js > js/dictionary.js

const wordlistData = require('wordlist-english');

function buildWordList(...keys) {
  const words = new Set();
  for (const key of keys) {
    for (const w of wordlistData[key]) {
      const lower = w.toLowerCase().trim();
      if (/^[a-z]+$/.test(lower) && lower.length >= 3 && lower.length <= 7) {
        words.add(lower);
      }
    }
  }
  return [...words].sort();
}

const commonWords = buildWordList('english/10', 'english/20', 'english/35');

process.stderr.write(`Common words (3-7 letters): ${commonWords.length}\n`);

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

function countSubAnagrams(seed) {
  const sourceFreq = getCharFrequency(seed);
  let count = 0;
  for (const word of commonWords) {
    if (word.length >= 3 && word.length <= seed.length && word !== seed) {
      if (canFormWord(word, sourceFreq)) count++;
    }
  }
  return count;
}

// ─── Find good seed words for each length ───

function findGoodSeeds(length, minSubs, minUnique) {
  const candidates = [];
  for (const word of commonWords) {
    if (word.length !== length) continue;
    const uniqueLetters = new Set(word).size;
    if (uniqueLetters < minUnique) continue;

    const subCount = countSubAnagrams(word);
    if (subCount >= minSubs) {
      candidates.push({ word, subCount });
    }
  }
  candidates.sort((a, b) => b.subCount - a.subCount);
  return candidates.slice(0, 200).map(c => c.word);
}

process.stderr.write('Finding 5-letter seeds...\n');
const seeds5 = findGoodSeeds(5, 4, 4);
process.stderr.write(`  Found ${seeds5.length} good 5-letter seeds\n`);

process.stderr.write('Finding 6-letter seeds...\n');
const seeds6 = findGoodSeeds(6, 6, 5);
process.stderr.write(`  Found ${seeds6.length} good 6-letter seeds\n`);

process.stderr.write('Finding 7-letter seeds...\n');
const seeds7 = findGoodSeeds(7, 8, 5);
process.stderr.write(`  Found ${seeds7.length} good 7-letter seeds\n`);

// ─── Output as ES module ───

const output = `// Auto-generated dictionary data — do not edit manually.
// Extracted from wordlist-english npm package (english/10 + english/20 + english/35).
// Re-generate: node scripts/build-dictionary.js > js/dictionary.js

// Common words, 3-7 letters, alphabetic only
export const commonWords = ${JSON.stringify(commonWords)};

// Pre-computed good seed words by length (diverse letters, many sub-anagrams)
export const seedPool = {
  5: ${JSON.stringify(seeds5)},
  6: ${JSON.stringify(seeds6)},
  7: ${JSON.stringify(seeds7)},
};
`;

process.stdout.write(output);
