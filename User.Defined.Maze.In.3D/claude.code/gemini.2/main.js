// GEMINI.2 main.js
import { GameInterface } from './interface.js';
import { initRenderer, drawScene } from './scene-renderer.js';

const canvas = document.getElementById('hall');
const ctx = canvas.getContext('2d');

// Initialize canvas configuration bounds
initRenderer(canvas);

// Input Event Handling (Ready for expansion)
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp' || e.key === 'w') GameInterface.moveForward(0.05);
  if (e.key === 'ArrowDown' || e.key === 's') GameInterface.moveBackward(0.05);
});

function animate(timestamp) {
  const time = timestamp / 1000;

  // 1. Grab a read-only snapshot data package from our state controller
  const renderContext = GameInterface.getRenderContext();

  // 2. Pass it directly into our stateless render cycle
  drawScene(ctx, renderContext, time);

  requestAnimationFrame(animate);
}

// Start game loop
requestAnimationFrame(animate);
