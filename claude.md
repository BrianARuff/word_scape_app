# Wordscapes Browser Game — Build Prompt

## Overview

Build a browser-based Wordscapes clone — a single-player word puzzle game where the player swipes across letters arranged in a circle (the "letter wheel") to form words that fill into a crossword-style grid. This is a gift for my mother so she can play ad-free on her phone browser. It must work great on mobile (touch) AND desktop (mouse).

## Project Structure

```
wordscapes/
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── main.js          # App entry point, initializes game
│   ├── game.js           # Core game state & logic
│   ├── wheel.js          # Letter wheel rendering & swipe interaction
│   ├── grid.js           # Crossword grid rendering & word placement
│   ├── puzzles.js         # Puzzle data (all levels)
│   ├── hints.js           # Hint system logic
│   └── utils.js           # Shared helpers
└── README.md
```

Use ES modules (`type="module"` in the script tag, `import/export` in JS files). No build tools, no npm, no frameworks, no dependencies. Pure vanilla HTML/CSS/JS.

## Game Mechanics (Exactly How Wordscapes Works)

### The Letter Wheel

- Letters are arranged in a **circle** at the bottom of the screen (like a clock face).
- Each letter sits in its own circular button evenly spaced around the wheel.
- The player **swipes/drags from letter to letter** to spell a word. They do NOT tap individual letters — it's a continuous swipe gesture.
- As the player drags across letters, a **visible line** follows their finger connecting the selected letters in order (like drawing a path).
- Selected letters **highlight** and the **current word-in-progress displays** above the wheel.
- Lifting the finger (releasing) **submits** the word.
- If the word is correct (exists in the puzzle's answer list), it **fills into the crossword grid** with a brief celebration animation.
- If the word is wrong, the letters shake briefly and reset.
- The player can swipe **back** over an already-selected letter to deselect it (backtrack the path).
- The same letter in the wheel CAN be selected only once per swipe (no reusing the same position).

### The Crossword Grid

- Displayed in the **top portion** of the screen.
- It's a compact crossword layout — words interlock sharing common letters (like a real crossword but smaller, typically 4-7 words per puzzle).
- Initially all letter cells are **blank/hidden** (show as empty styled boxes).
- When a word is correctly guessed, its letters **reveal in the grid** with a fill-in animation.
- Letters shared between intersecting words reveal for both words.
- The grid should be **centered** and sized to fit the screen.
- Each cell shows the letter once revealed and is otherwise a styled empty box. Black/absent cells should be invisible (not rendered).

### Word Validation

- Each puzzle has a predefined list of **answer words** that go into the grid.
- Each puzzle also has a list of **bonus words** — valid English words formable from the letters but NOT in the crossword. Guessing a bonus word should show a brief "Bonus word found!" toast notification and track it. This is optional/stretch — implement if straightforward.
- Invalid words (not in answers or bonus list) get the shake/reject animation.
- Words already found should briefly indicate "Already found!" and not re-animate.

### Level Progression

- The game has **at least 25 levels**, increasing in difficulty (more letters in the wheel, longer words, more words to find).
- After all words in a level are found, show a **"Level Complete!"** celebration screen with a continue/next button.
- The current level number is displayed in the UI.
- Track the player's current level in **localStorage** so progress persists across browser sessions.

### Hint System

- A **hint button** is always visible in the UI.
- The player starts with **3 hints**. Display the hint count on/near the button.
- Tapping the hint button **reveals one random unrevealed letter** in the crossword grid (pick a random unfound word, reveal a random letter in it, with a subtle highlight animation).
- Earn **1 bonus hint** every 3 levels completed.
- Hint count persists in localStorage.

## Puzzle Data Generation

**You must generate the puzzle data yourself.** Create at least 25 puzzles with this structure for each puzzle:

```js
{
  id: 1,
  letters: ['S', 'U', 'N', 'R', 'I', 'E'],  // letters for the wheel
  words: ['SUN', 'RUN', 'RUNE', 'RUNS', 'RUIN', 'RUINS', 'RINSE', 'NURSE', 'SUNRISE'],
  grid: [  // pre-computed crossword layout — see below
    { word: 'SUNRISE', x: 0, y: 3, direction: 'across' },
    { word: 'SUN', x: 0, y: 1, direction: 'down' },
    // ... etc
  ],
  bonusWords: ['SIR', 'IRE', 'USE']  // optional bonus words
}
```

**Important crossword grid rules:**

- Words must interlock (share at least one letter with another word at crossing points).
- The grid coordinates use a simple (x, y) system where (0,0) is top-left.
- `direction` is either `'across'` (left to right) or `'down'` (top to bottom).
- **Validate that all crossword intersections are consistent** — where words cross, the letter must match in both words.
- Start simple: levels 1-8 use 3-4 letter wheels with 3-4 words. Levels 9-16 use 5 letter wheels with 4-6 words. Levels 17-25 use 6-7 letter wheels with 5-9 words.

**Take your time on puzzle generation — incorrect/impossible crossword layouts will break the game. Double-check every intersection.**

## Interaction — Pointer Events

Use the **Pointer Events API** (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`) for ALL interactions on the letter wheel. This unifies mouse and touch into one clean event model.

Critical implementation details:

- On `pointerdown` on a letter: begin the swipe, select that letter, start drawing the connecting line.
- On `pointermove`: use `document.elementFromPoint(e.clientX, e.clientY)` to detect which letter the pointer is currently over. If it's a new unselected letter, add it to the path. If it's the previous letter (backtracking), remove the last letter from the path.
- On `pointerup` / `pointercancel`: submit the formed word for validation, then clear the selection and line.
- **Add `touch-action: none`** CSS on the wheel container to prevent scroll/zoom interference on mobile.
- Call `element.setPointerCapture(e.pointerId)` on pointerdown so moves are tracked even if the pointer leaves the element.

### Connecting Line

Draw the line connecting selected letters using either:

- An **SVG overlay** on top of the wheel (preferred — easier hit testing), or
- A **Canvas overlay**.

The line should:

- Connect the centers of selected letter circles in order.
- Have a final segment from the last selected letter to the **current pointer position** (so the line follows the finger in real time).
- Be styled as a thick, rounded, semi-transparent colored line (match the playful theme).
- Clear instantly on release.

## Visual Design — Bright & Playful Theme

### Color Palette

- **Background**: Warm gradient — e.g., `linear-gradient(135deg, #667eea 0%, #764ba2 100%)` or a cheerful sky-blue-to-pink-sunset gradient.
- **Letter wheel circle buttons**: White or light-colored circles with bold, large letters. On selection, they turn a vibrant highlight color (e.g., bright orange or yellow).
- **Crossword grid cells**: White/cream with soft rounded corners and subtle shadows. Revealed letters use a bold readable font.
- **Connecting line**: Bright, semi-transparent (e.g., `rgba(255, 165, 0, 0.7)`) with `stroke-linecap: round`.
- **Buttons (hint, etc.)**: Rounded pill-shaped, colorful, with subtle hover/active states.
- **Level complete screen**: Confetti-like feel, big celebratory text, bright colors.

### Typography

- Use a clean, rounded, friendly font. Load **one** Google Font: `Nunito` or `Poppins` (with `font-display: swap`).
- Letters in the wheel should be **large and bold** (easy to see and tap on mobile).
- Grid letters should be clearly readable.

### Layout (Mobile-First)

- **Top**: Level indicator + hint button (small bar)
- **Middle**: Crossword grid (takes available space, centered, scrollable if needed)
- **Bottom**: Current word display + letter wheel (fixed to bottom ~40% of viewport)
- Use `dvh` (dynamic viewport height) units to handle mobile browser chrome (address bar).
- **Min touch target size: 44px × 44px** for all interactive elements (Apple HIG / WCAG guideline).
- On wider desktop screens, cap the game width at ~500px and center it (it's a phone game).

### Animations

- **Letter select**: Quick scale-up + color change (CSS transition, ~150ms).
- **Correct word**: Letters fill into grid with a cascading pop-in (each letter slightly delayed, scale from 0→1). Brief green flash or glow on the word.
- **Wrong word**: Shake animation on the current-word display (CSS keyframes).
- **Already found**: Gentle pulse on the already-revealed word in the grid.
- **Level complete**: Scale-in overlay with a star or party emoji, maybe a simple CSS confetti animation.
- **Hint reveal**: The revealed letter cell glows/pulses briefly.
- Keep all animations performant — use `transform` and `opacity` only, avoid layout thrashing.

## State Management

All game state lives in a simple JS object, something like:

```js
const state = {
  currentLevel: 1,
  foundWords: [], // words found in current puzzle
  bonusWordsFound: [], // bonus words found in current puzzle
  hintsRemaining: 5,
  currentSwipe: [], // letters currently being swiped (indices into the wheel)
  revealedCells: new Set(), // grid cells that have been revealed (by hint or word found)
};
```

- Save `currentLevel` and `hintsRemaining` to **localStorage** on every level change / hint use.
- Load from localStorage on game start.
- Add a small **"Reset Progress"** option somewhere unobtrusive (settings gear icon or long-press the level indicator) so she can restart if wanted.

## Error Handling & Edge Cases

- If localStorage is unavailable (private browsing), fall back gracefully — just don't persist.
- Prevent double-submission of the same swipe.
- Handle `pointercancel` (e.g., incoming call interrupts the gesture) — just clear the current swipe.
- If the pointer leaves the wheel area during a swipe, keep tracking via pointer capture and submit on release wherever it happens.
- Make sure the crossword grid handles puzzles of varying sizes without breaking layout.

## Testing Checklist (Verify Before Finishing)

- [ ] Can complete Level 1 by swiping words on the wheel
- [ ] Correct words fill into the grid with animation
- [ ] Wrong words shake and reset
- [ ] Already-found words show feedback
- [ ] Connecting line follows finger/mouse in real time
- [ ] Backtracking (swiping back) deselects the last letter
- [ ] Hint button reveals a letter and decrements count
- [ ] Level complete screen appears when all words are found
- [ ] Next level loads correctly
- [ ] Progress persists across page reload (localStorage)
- [ ] Works on mobile viewport (responsive, no scroll issues during play)
- [ ] Touch-action: none prevents page scrolling during swipe
- [ ] All 25 puzzles have valid crossword layouts (no letter conflicts at intersections)

## Final Notes

- **No external dependencies.** No npm. No build step. Just files you open in a browser.
- **Mobile-first but works on desktop.** Pointer events handle both.
- Optimize for her phone screen — assume ~375px wide (iPhone SE size) as the minimum.
- Keep the code clean and well-commented — I may want to add more levels later.
- If you're unsure about a crossword layout, use fewer intersections rather than risk a broken one. A simple valid grid is better than an ambitious broken one.
