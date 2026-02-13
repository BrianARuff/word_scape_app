// Dynamic puzzle generator with progressive difficulty and uniqueness guarantees.

import { commonWords, seedPool } from "./dictionary.js";

const commonSet = new Set(commonWords);
const subAnagramCache = new Map();

const MAX_RANDOM_ATTEMPTS = 160;
const MAX_LETTER_VARIANTS = 40;

const DIFFICULTY_PROFILES = {
  easy: {
    name: "easy",
    startLevel: 1,
    seedLengths: [5],
    minWordLength: 3,
    maxWordLength: 5,
    minWords: 5,
    maxWords: 7,
    rampEvery: 3,
    lengthOrder: [3, 4, 5],
    minLongWords: 0,
    longWordLength: 5,
  },
  medium: {
    name: "medium",
    startLevel: 11,
    seedLengths: [6],
    minWordLength: 3,
    maxWordLength: 6,
    minWords: 7,
    maxWords: 9,
    rampEvery: 4,
    lengthOrder: [4, 5, 3, 6],
    minLongWords: 1,
    longWordLength: 6,
  },
  challenging: {
    name: "challenging",
    startLevel: 21,
    seedLengths: [6, 7, 7],
    minWordLength: 4,
    maxWordLength: 7,
    minWords: 8,
    maxWords: 10,
    rampEvery: 4,
    lengthOrder: [5, 6, 4, 7],
    minLongWords: 2,
    longWordLength: 6,
  },
  hard: {
    name: "hard",
    startLevel: 31,
    seedLengths: [7],
    minWordLength: 4,
    maxWordLength: 7,
    minWords: 10,
    maxWords: 12,
    rampEvery: 8,
    lengthOrder: [6, 7, 5, 4],
    minLongWords: 3,
    longWordLength: 6,
  },
};

function getDifficultyProfile(level) {
  if (level <= 10) return DIFFICULTY_PROFILES.easy;
  if (level <= 20) return DIFFICULTY_PROFILES.medium;
  if (level <= 30) return DIFFICULTY_PROFILES.challenging;
  return DIFFICULTY_PROFILES.hard;
}

function getTargetWordCount(level, profile) {
  const scaledLevel = Math.max(0, level - profile.startLevel);
  const growth = Math.floor(scaledLevel / profile.rampEvery);
  return Math.min(profile.maxWords, profile.minWords + growth);
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function getCharFrequency(word) {
  const freq = {};
  for (const ch of word) freq[ch] = (freq[ch] || 0) + 1;
  return freq;
}

function canFormWord(candidate, sourceFreq) {
  const candidateFreq = getCharFrequency(candidate);
  for (const ch in candidateFreq) {
    if (!sourceFreq[ch] || candidateFreq[ch] > sourceFreq[ch]) return false;
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

function findSubAnagrams(seed) {
  if (subAnagramCache.has(seed)) return subAnagramCache.get(seed);

  const sourceFreq = getCharFrequency(seed);
  const results = [];
  for (const word of commonWords) {
    if (word.length < 3 || word.length > seed.length) continue;
    if (canFormWord(word, sourceFreq)) results.push(word);
  }
  subAnagramCache.set(seed, results);
  return results;
}

function countLongWords(words, threshold) {
  let count = 0;
  for (const word of words) {
    if (word.length >= threshold) count++;
  }
  return count;
}

function getWordFamilyKey(word) {
  const lower = word.toLowerCase();
  const candidates = [lower];

  if (lower.endsWith("ies") && lower.length > 4) {
    candidates.push(`${lower.slice(0, -3)}y`);
  }
  if (lower.endsWith("es") && lower.length > 3) {
    candidates.push(lower.slice(0, -2));
  }
  if (lower.endsWith("s") && !lower.endsWith("ss") && lower.length > 3) {
    candidates.push(lower.slice(0, -1));
  }

  const unique = [...new Set(candidates)];
  const known = unique.filter(w => commonSet.has(w));
  if (known.length === 0) return lower;
  known.sort((a, b) => a.length - b.length || a.localeCompare(b));
  return known[0];
}

function selectPuzzleWords(candidates, seed, targetCount, profile) {
  const selected = [];
  const selectedSet = new Set();
  const selectedFamilies = new Set();

  function addWord(word) {
    if (selectedSet.has(word)) return false;
    const family = getWordFamilyKey(word);
    if (selectedFamilies.has(family)) return false;
    selected.push(word);
    selectedSet.add(word);
    selectedFamilies.add(family);
    return true;
  }

  if (commonSet.has(seed) && candidates.includes(seed)) {
    addWord(seed);
  }

  const byLength = new Map();
  for (const word of shuffle(candidates)) {
    const len = word.length;
    if (!byLength.has(len)) byLength.set(len, []);
    byLength.get(len).push(word);
  }

  let round = 0;
  while (selected.length < targetCount && round < 24) {
    for (const len of profile.lengthOrder) {
      if (selected.length >= targetCount) break;
      const words = byLength.get(len);
      if (!words || round >= words.length) continue;
      addWord(words[round]);
    }
    round++;
  }

  if (selected.length < targetCount) {
    for (const word of shuffle(candidates)) {
      addWord(word);
      if (selected.length >= targetCount) break;
    }
  }

  if (selected.length < targetCount) return null;

  if (profile.minLongWords > 0) {
    let longCount = countLongWords(selected, profile.longWordLength);
    if (longCount < profile.minLongWords) {
      const availableLongWords = shuffle(
        candidates.filter(
          w => w.length >= profile.longWordLength && !selectedSet.has(w)
        )
      );

      for (const longWord of availableLongWords) {
        const longWordFamily = getWordFamilyKey(longWord);
        if (selectedFamilies.has(longWordFamily)) continue;

        const replaceable = selected
          .filter(w => w.length < profile.longWordLength && w !== seed)
          .sort((a, b) => a.length - b.length || a.localeCompare(b));
        if (replaceable.length === 0) break;

        const removeWord = replaceable[0];
        const removeIdx = selected.indexOf(removeWord);
        const removeFamily = getWordFamilyKey(removeWord);
        if (removeIdx < 0) continue;

        selected.splice(removeIdx, 1);
        selectedSet.delete(removeWord);
        selectedFamilies.delete(removeFamily);

        if (!addWord(longWord)) {
          addWord(removeWord);
          continue;
        }

        longCount = countLongWords(selected, profile.longWordLength);
        if (longCount >= profile.minLongWords) break;
      }
    }
  }

  if (profile.minLongWords > 0) {
    const longCount = countLongWords(selected, profile.longWordLength);
    if (longCount < profile.minLongWords) return null;
  }

  return selected
    .slice(0, targetCount)
    .sort((a, b) => a.length - b.length || a.localeCompare(b));
}

export function createPuzzleSignature(puzzle) {
  const seed = typeof puzzle.seed === "string" ? puzzle.seed.toUpperCase() : "";
  const letters = Array.isArray(puzzle.letters)
    ? puzzle.letters.map(ch => String(ch).toUpperCase()).join("")
    : "";
  const words = Array.isArray(puzzle.words)
    ? [...puzzle.words]
        .map(word => String(word).toUpperCase())
        .sort((a, b) => a.localeCompare(b))
        .join(",")
    : "";
  const seedPart = seed || letters;
  return `${seedPart}|${letters}|${words}`;
}

function buildPuzzleFromSeed(level, profile, seed, usedSet) {
  const allSubs = findSubAnagrams(seed);
  const eligible = allSubs.filter(
    w => w.length >= profile.minWordLength && w.length <= profile.maxWordLength
  );

  const targetCount = getTargetWordCount(level, profile);
  if (eligible.length < targetCount) return null;

  const puzzleWords = selectPuzzleWords(eligible, seed, targetCount, profile);
  if (!puzzleWords || puzzleWords.length < targetCount) return null;

  const puzzleWordSet = new Set(puzzleWords);
  const wordsUpper = puzzleWords.map(w => w.toUpperCase());
  const seedUpper = seed.toUpperCase();
  const seedLetters = seedUpper.split("");

  for (let i = 0; i < MAX_LETTER_VARIANTS; i++) {
    const letters = shuffle(seedLetters);
    const signature = createPuzzleSignature({
      seed: seedUpper,
      letters,
      words: wordsUpper,
    });
    if (usedSet.has(signature)) continue;

    return {
      id: level,
      seed: seedUpper,
      letters,
      words: wordsUpper,
      bonusWords: allSubs
        .filter(w => !puzzleWordSet.has(w) && w.length >= 3)
        .map(w => w.toUpperCase()),
      difficulty: profile.name,
      signature,
    };
  }

  return null;
}

export function generatePuzzle(level, usedSignatures = []) {
  const usedSet =
    usedSignatures instanceof Set
      ? usedSignatures
      : new Set(Array.isArray(usedSignatures) ? usedSignatures : []);
  const profile = getDifficultyProfile(level);

  for (let attempt = 0; attempt < MAX_RANDOM_ATTEMPTS; attempt++) {
    const seedLength = pickRandom(profile.seedLengths);
    const pool = seedPool[seedLength];
    if (!pool || pool.length === 0) continue;
    const seed = pickRandom(pool);
    const puzzle = buildPuzzleFromSeed(level, profile, seed, usedSet);
    if (puzzle) return puzzle;
  }

  const uniqueSeedLengths = [...new Set(profile.seedLengths)];
  for (const seedLength of uniqueSeedLengths) {
    const pool = shuffle(seedPool[seedLength] || []);
    for (const seed of pool) {
      const retries = profile.name === "hard" ? 4 : 2;
      for (let i = 0; i < retries; i++) {
        const puzzle = buildPuzzleFromSeed(level, profile, seed, usedSet);
        if (puzzle) return puzzle;
      }
    }
  }

  throw new Error("Unable to generate a unique puzzle for this level.");
}
