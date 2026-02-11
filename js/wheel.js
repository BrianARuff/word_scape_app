// Letter wheel rendering and swipe interaction

let wheelContainer = null;
let svgOverlay = null;
let letterEls = [];        // DOM elements for each letter
let letterPositions = [];   // {x, y} center of each letter (relative to wheel)
let selectedIndices = [];   // indices into letterEls currently selected
let isSwiping = false;
let currentPointer = null;  // {x, y} of current pointer (for trailing line)
let onSwipeComplete = null; // callback(word: string)

export function initWheel(letters, callback) {
  onSwipeComplete = callback;
  wheelContainer = document.getElementById('wheel-container');
  wheelContainer.innerHTML = '';

  // Create SVG overlay for connecting lines
  svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgOverlay.setAttribute('class', 'wheel-svg');
  wheelContainer.appendChild(svgOverlay);

  // Create wheel circle background
  const wheelCircle = document.createElement('div');
  wheelCircle.className = 'wheel-circle';
  wheelContainer.appendChild(wheelCircle);

  letterEls = [];
  letterPositions = [];

  const count = letters.length;
  // Wheel sizing — letters placed in a circle
  const wheelRect = wheelContainer.getBoundingClientRect();
  const size = Math.min(wheelRect.width, wheelRect.height);
  const radius = size * 0.32;
  const centerX = wheelRect.width / 2;
  const centerY = wheelRect.height / 2;

  // Position the background circle
  const circleSize = radius * 2 + 60;
  wheelCircle.style.width = circleSize + 'px';
  wheelCircle.style.height = circleSize + 'px';

  for (let i = 0; i < count; i++) {
    // Start from top (-90°), go clockwise
    const angle = ((2 * Math.PI) / count) * i - Math.PI / 2;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);

    const btn = document.createElement('div');
    btn.className = 'wheel-letter';
    btn.textContent = letters[i];
    btn.dataset.index = i;
    btn.style.left = x + 'px';
    btn.style.top = y + 'px';
    wheelContainer.appendChild(btn);

    letterEls.push(btn);
    letterPositions.push({ x, y });
  }

  // Set SVG viewBox to match container
  svgOverlay.setAttribute('viewBox', `0 0 ${wheelRect.width} ${wheelRect.height}`);

  setupPointerEvents();
}

function setupPointerEvents() {
  wheelContainer.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', onPointerUp);
}

export function destroyWheel() {
  if (wheelContainer) {
    wheelContainer.removeEventListener('pointerdown', onPointerDown);
  }
  document.removeEventListener('pointermove', onPointerMove);
  document.removeEventListener('pointerup', onPointerUp);
  document.removeEventListener('pointercancel', onPointerUp);
}

function onPointerDown(e) {
  if (e.button !== 0 && e.pointerType === 'mouse') return;

  const idx = getLetterIndexFromEvent(e);
  if (idx === -1) return;

  e.preventDefault();
  wheelContainer.setPointerCapture(e.pointerId);

  isSwiping = true;
  selectedIndices = [idx];
  letterEls[idx].classList.add('selected');
  updateCurrentWord();

  const rect = wheelContainer.getBoundingClientRect();
  currentPointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  drawLines();
}

function onPointerMove(e) {
  if (!isSwiping) return;
  e.preventDefault();

  const rect = wheelContainer.getBoundingClientRect();
  currentPointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };

  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (el && el.classList.contains('wheel-letter')) {
    const idx = parseInt(el.dataset.index, 10);

    if (selectedIndices.length >= 2 && idx === selectedIndices[selectedIndices.length - 2]) {
      // Backtracking — deselect the last letter
      const removed = selectedIndices.pop();
      letterEls[removed].classList.remove('selected');
      updateCurrentWord();
    } else if (!selectedIndices.includes(idx)) {
      // New letter — add to path
      selectedIndices.push(idx);
      el.classList.add('selected');
      updateCurrentWord();
    }
  }

  drawLines();
}

function onPointerUp(e) {
  if (!isSwiping) return;
  isSwiping = false;
  currentPointer = null;

  // Build the swiped word
  const word = selectedIndices
    .map(i => letterEls[i].textContent)
    .join('');

  // Clear letter highlight visuals and lines
  for (const idx of selectedIndices) {
    letterEls[idx].classList.remove('selected');
  }
  selectedIndices = [];
  clearLines();

  // Keep the word displayed for feedback animation (game.js will clear it)
  const display = document.getElementById('current-word');
  if (display) display.classList.remove('active');

  if (word.length >= 2 && onSwipeComplete) {
    onSwipeComplete(word);
  } else {
    // Too short — just clear the display
    if (display) display.textContent = '';
  }
}

function getLetterIndexFromEvent(e) {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (el && el.classList.contains('wheel-letter')) {
    return parseInt(el.dataset.index, 10);
  }
  return -1;
}

function updateCurrentWord() {
  const display = document.getElementById('current-word');
  if (!display) return;
  const word = selectedIndices.map(i => letterEls[i].textContent).join('');
  display.textContent = word;
  if (word.length > 0) {
    display.classList.add('active');
  } else {
    display.classList.remove('active');
  }
}

// ─── SVG line drawing ───

function drawLines() {
  while (svgOverlay.firstChild) svgOverlay.removeChild(svgOverlay.firstChild);

  if (selectedIndices.length === 0) return;

  const points = selectedIndices.map(i => letterPositions[i]);
  const allPoints = [...points];
  if (currentPointer) {
    allPoints.push(currentPointer);
  }

  if (allPoints.length < 2) return;

  const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  const pointsStr = allPoints.map(p => `${p.x},${p.y}`).join(' ');
  polyline.setAttribute('points', pointsStr);
  polyline.setAttribute('class', 'swipe-line');
  svgOverlay.appendChild(polyline);
}

function clearLines() {
  while (svgOverlay.firstChild) svgOverlay.removeChild(svgOverlay.firstChild);
}
