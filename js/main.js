// App entry point
import { initGame } from './game.js';

// Prevent iOS Safari rubber-band bounce when dragging near screen edges.
// Allow scrolling only inside the bonus words list panel.
document.addEventListener('touchmove', function (e) {
  if (!e.target.closest('#bonus-words-list')) {
    e.preventDefault();
  }
}, { passive: false });

document.addEventListener('DOMContentLoaded', () => {
  initGame();
});
