// GEMINI.3 main.js
import { GameInterface } from './interface.js';
import { PlayerMovementSystem } from './player-movement.js';
import { BallMovementSystem } from './ball-movement.js';
import { initRenderer, drawScene } from './scene-renderer.js'; 
import { BirdsEyeView } from './2d-birds-eye-view.js'; 

const canvas = document.getElementById('hall');
const ctx = canvas.getContext('2d');
const mapCanvas = document.getElementById('birdsEye');

// DOM Element Component Node References
const miniMapWindow = document.getElementById('mini-map-window');
const toggle2dBtn = document.getElementById('toggle-2d-btn');
const resizeHandle = document.getElementById('mini-map-resize-handle');

window.myGameInterface = GameInterface;
window.myBallMovementSystem = BallMovementSystem;
window.myPlayerMovementSystem = PlayerMovementSystem;

// Initialize graphic loops
initRenderer(canvas); 
BirdsEyeView.init(mapCanvas);

let lastTimestamp = 0;
PlayerMovementSystem.init();

// ── FIXED WINDOW RESIZE LISTENER TRACKING MATRIX ───────────────────────────
// Listens for browser boundary mutations and scales the canvas buffers on the fly
window.addEventListener('resize', () => {
  initRenderer(canvas);
});
// ────────────────────────────────────────────────────────────────────────────

// ── VISIBILITY MATRIX CACHE LOOP CONTEXTS ───────────────────────────────────
// FIX 1: Changed default initial visibility assignment state variables to false
let isMapVisible = false;
let savedWidth = 250;  // Retains customized width parameters across states
let savedHeight = 250; // Retains customized height parameters across states

// Note: No active initialization styles needed since it boots closed naturally

toggle2dBtn.addEventListener('click', () => {
  isMapVisible = !isMapVisible;
  if (isMapVisible) {
    miniMapWindow.style.display = 'block';
    miniMapWindow.style.width = `${savedWidth}px`;
    miniMapWindow.style.height = `${savedHeight}px`;
    toggle2dBtn.classList.add('active');
  } else {
    miniMapWindow.style.display = 'none';
    toggle2dBtn.classList.remove('active');
  }
});

// ── DRAG-TO-RESIZE INTERACTION TRACKING ENGINE ──────────────────────────────
let isResizing = false;
let startX, startY, startWidth, startHeight;

resizeHandle.addEventListener('mousedown', (e) => {
  e.preventDefault(); 
  isResizing = true;
  
  startX = e.clientX;
  startY = e.clientY;
  
  startWidth = parseInt(document.defaultView.getComputedStyle(miniMapWindow).width, 10);
  startHeight = parseInt(document.defaultView.getComputedStyle(miniMapWindow).height, 10);
  
  document.addEventListener('mousemove', processResizeDrag);
  document.addEventListener('mouseup', terminateResizeDrag);
});

function processResizeDrag(e) {
  if (!isResizing) return;
  
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;
  
  const currentWidth = Math.max(140, Math.min(600, startWidth - dx));
  const currentHeight = Math.max(140, Math.min(600, startHeight + dy));
  
  miniMapWindow.style.width = `${currentWidth}px`;
  miniMapWindow.style.height = `${currentHeight}px`;
  
  savedWidth = currentWidth;
  savedHeight = currentHeight;
}

function terminateResizeDrag() {
  isResizing = false;
  document.removeEventListener('mousemove', processResizeDrag);
  document.removeEventListener('mouseup', terminateResizeDrag);
}

// ── CORE GAME LOOP ENGINE ───────────────────────────────────────────────────
function gameLoop(currentTimestamp) {
  const deltaTime = (currentTimestamp - lastTimestamp) / 1000;
  lastTimestamp = currentTimestamp;

  PlayerMovementSystem.update(deltaTime);
  BallMovementSystem.update(deltaTime);

  const renderContext = GameInterface.getSceneRenderContext();

  drawScene(ctx, renderContext, currentTimestamp / 1000);
  
  // Only evaluate map rendering commands if panel visibility toggle is live
  if (isMapVisible) {
    BirdsEyeView.draw();
  }

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
