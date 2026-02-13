// Encrypted progress persistence.
// This raises the bar versus plain localStorage values while keeping browser-only hosting.

const STORAGE_KEY = "__ws_secure_state_v2__";
const LEGACY_KEYS = [
  "wordscape_level",
  "wordscape_hints",
  "wordscape_current_puzzle",
];

const STORAGE_VERSION = 2;
const MAX_SIGNATURE_HISTORY = 25000;
const CONSOLE_DECRYPT_KEY = "decrypt_secret_string";

const SECRET = "wordscape::state::vault::v2::2026";
const SALT = "wordscape::state::salt::v2";
const PBKDF2_ITERATIONS = 180000;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const DEFAULT_PROGRESS = Object.freeze({
  version: STORAGE_VERSION,
  currentLevel: 1,
  hintsRemaining: 5,
  bonusWordsTowardHint: 0,
  currentPuzzle: null,
  usedPuzzleSignatures: [],
});

let keyPromise = null;
let saveQueue = Promise.resolve();

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function hasStorage() {
  try {
    if (typeof localStorage === "undefined") return false;
    const probe = "__ws_probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function hasCrypto() {
  return typeof crypto !== "undefined" && !!crypto.subtle;
}

function clampInt(value, fallback, min, max) {
  if (!Number.isFinite(value)) return fallback;
  const n = Math.trunc(value);
  return Math.min(max, Math.max(min, n));
}

function sanitizeWordList(words, maxItems = 256) {
  if (!Array.isArray(words)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of words) {
    if (typeof raw !== "string") continue;
    const word = raw.toUpperCase().trim();
    if (!/^[A-Z]{2,12}$/.test(word)) continue;
    if (seen.has(word)) continue;
    seen.add(word);
    out.push(word);
    if (out.length >= maxItems) break;
  }
  return out;
}

function sanitizeLetters(letters, maxItems = 12) {
  if (!Array.isArray(letters)) return [];
  const out = [];
  for (const raw of letters) {
    if (typeof raw !== "string") continue;
    const ch = raw.toUpperCase().trim();
    if (!/^[A-Z]$/.test(ch)) continue;
    out.push(ch);
    if (out.length >= maxItems) break;
  }
  return out;
}

function sanitizePuzzle(puzzle) {
  if (!puzzle || typeof puzzle !== "object") return null;

  const id = clampInt(puzzle.id, 1, 1, 1000000);
  const letters = sanitizeLetters(puzzle.letters, 10);
  const words = sanitizeWordList(puzzle.words, 40);
  const bonusWords = sanitizeWordList(puzzle.bonusWords, 600);

  if (letters.length < 3 || words.length === 0) return null;

  const out = { id, letters, words, bonusWords };
  if (typeof puzzle.signature === "string" && puzzle.signature.length <= 600) {
    out.signature = puzzle.signature;
  }
  if (typeof puzzle.seed === "string" && /^[A-Z]{3,10}$/.test(puzzle.seed)) {
    out.seed = puzzle.seed;
  }
  if (typeof puzzle.difficulty === "string" && puzzle.difficulty.length <= 32) {
    out.difficulty = puzzle.difficulty;
  }
  return out;
}

function sanitizeSignatures(signatures) {
  if (!Array.isArray(signatures)) return [];
  const out = [];
  const seen = new Set();
  const start = Math.max(0, signatures.length - MAX_SIGNATURE_HISTORY);
  for (let i = start; i < signatures.length; i++) {
    const sig = signatures[i];
    if (typeof sig !== "string") continue;
    const trimmed = sig.trim();
    if (!trimmed || trimmed.length > 800) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function sanitizeProgress(raw) {
  const base = cloneJson(DEFAULT_PROGRESS);
  if (!raw || typeof raw !== "object") return base;

  const currentLevel = clampInt(raw.currentLevel, base.currentLevel, 1, 1000000);
  const hintsRemaining = clampInt(raw.hintsRemaining, base.hintsRemaining, 0, 1000000);
  const bonusWordsTowardHint = clampInt(
    raw.bonusWordsTowardHint,
    base.bonusWordsTowardHint,
    0,
    2
  );
  const currentPuzzle = sanitizePuzzle(raw.currentPuzzle);
  const usedPuzzleSignatures = sanitizeSignatures(raw.usedPuzzleSignatures);

  return {
    version: STORAGE_VERSION,
    currentLevel,
    hintsRemaining,
    bonusWordsTowardHint,
    currentPuzzle,
    usedPuzzleSignatures,
  };
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function xorObfuscate(input) {
  const key = `${SECRET}|${location.origin}`;
  const out = new Uint8Array(input.length);
  for (let i = 0; i < input.length; i++) {
    out[i] = input.charCodeAt(i) ^ key.charCodeAt(i % key.length);
  }
  return bytesToBase64(out);
}

function xorDeobfuscate(token) {
  const key = `${SECRET}|${location.origin}`;
  const bytes = base64ToBytes(token);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i] ^ key.charCodeAt(i % key.length));
  }
  return out;
}

async function getCryptoKey() {
  if (keyPromise) return keyPromise;
  keyPromise = (async () => {
    const material = await crypto.subtle.importKey(
      "raw",
      textEncoder.encode(`${SECRET}|${location.origin}`),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: textEncoder.encode(SALT),
        iterations: PBKDF2_ITERATIONS,
        hash: "SHA-256",
      },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  })();
  return keyPromise;
}

async function encryptPayload(plainText) {
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    textEncoder.encode(plainText)
  );
  return JSON.stringify({
    v: STORAGE_VERSION,
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(cipher)),
  });
}

async function decryptPayload(raw) {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") return null;
  if (typeof parsed.iv !== "string" || typeof parsed.data !== "string") {
    return null;
  }
  const key = await getCryptoKey();
  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(parsed.iv) },
    key,
    base64ToBytes(parsed.data)
  );
  return textDecoder.decode(plainBuffer);
}

async function readStoredProgress() {
  if (!hasStorage()) return null;

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  return decryptStoredProgressValue(raw);
}

async function decryptStoredProgressValue(raw) {
  if (!raw || typeof raw !== "string") return null;

  // Fallback format when WebCrypto is unavailable.
  if (raw.startsWith("obf:")) {
    try {
      return sanitizeProgress(JSON.parse(xorDeobfuscate(raw.slice(4))));
    } catch {
      return null;
    }
  }

  if (!hasCrypto()) return null;

  try {
    const decrypted = await decryptPayload(raw);
    if (!decrypted) return null;
    return sanitizeProgress(JSON.parse(decrypted));
  } catch {
    return null;
  }
}

async function writeStoredProgress(progress) {
  if (!hasStorage()) return false;

  const payload = JSON.stringify(sanitizeProgress(progress));

  if (hasCrypto()) {
    try {
      const encrypted = await encryptPayload(payload);
      localStorage.setItem(STORAGE_KEY, encrypted);
      return true;
    } catch {
      // Fall through to obfuscated fallback.
    }
  }

  try {
    localStorage.setItem(STORAGE_KEY, `obf:${xorObfuscate(payload)}`);
    return true;
  } catch {
    return false;
  }
}

function readLegacyProgress() {
  if (!hasStorage()) return null;

  let found = false;
  const legacy = {};

  try {
    const levelRaw = localStorage.getItem("wordscape_level");
    if (levelRaw !== null) {
      legacy.currentLevel = JSON.parse(levelRaw);
      found = true;
    }
  } catch {
    // Ignore malformed legacy values.
  }

  try {
    const hintRaw = localStorage.getItem("wordscape_hints");
    if (hintRaw !== null) {
      legacy.hintsRemaining = JSON.parse(hintRaw);
      found = true;
    }
  } catch {
    // Ignore malformed legacy values.
  }

  try {
    const puzzleRaw = localStorage.getItem("wordscape_current_puzzle");
    if (puzzleRaw !== null) {
      legacy.currentPuzzle = JSON.parse(puzzleRaw);
      found = true;
    }
  } catch {
    // Ignore malformed legacy values.
  }

  return found ? sanitizeProgress(legacy) : null;
}

function clearLegacyKeys() {
  if (!hasStorage()) return;
  for (const key of LEGACY_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore.
    }
  }
}

export function createDefaultProgress() {
  return cloneJson(DEFAULT_PROGRESS);
}

export async function loadProgress() {
  const secure = await readStoredProgress();
  if (secure) {
    clearLegacyKeys();
    return secure;
  }

  const legacy = readLegacyProgress();
  if (legacy) {
    await writeStoredProgress(legacy);
    clearLegacyKeys();
    return legacy;
  }

  return createDefaultProgress();
}

export function queueSaveProgress(progress) {
  const snapshot = sanitizeProgress(cloneJson(progress));
  saveQueue = saveQueue
    .catch(() => {})
    .then(() => writeStoredProgress(snapshot));
  return saveQueue;
}

export function exposeProgressDecryptor() {
  if (typeof window === "undefined") return;
  if (window.decryptGameState) return;

  window.decryptGameState = async function decryptGameState(
    key,
    storageKey = STORAGE_KEY
  ) {
    if (key !== CONSOLE_DECRYPT_KEY) {
      throw new Error("Invalid decryption key.");
    }
    if (!hasStorage()) {
      throw new Error("localStorage is unavailable in this context.");
    }

    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;

    const decrypted = await decryptStoredProgressValue(raw);
    if (!decrypted) {
      throw new Error("Failed to decrypt or parse stored game state.");
    }
    return cloneJson(decrypted);
  };
}
