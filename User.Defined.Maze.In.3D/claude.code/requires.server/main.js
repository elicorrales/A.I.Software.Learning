// GEMINI.3 main.js
import { GameInterface } from './interface.js';
import { PlayerMovementSystem } from './player-movement.js';
import { BallMovementSystem } from './ball-movement.js';
import { BallSoundSystem } from './ball-sounds.js';
import { PlayerSoundSystem } from './player-sounds.js';
import { initRenderer, drawScene } from './scene-renderer.js'; 
import { BirdsEyeView } from './2d-birds-eye-view.js'; 
import { GameDiagnostics } from './game-diagnostics.js'; 

const canvas = document.getElementById('hall');
const ctx = canvas.getContext('2d');
const mapCanvas = document.getElementById('birdsEye');

const miniMapWindow = document.getElementById('mini-map-window');
const toggle2dBtn = document.getElementById('toggle-2d-btn');
const resizeHandle = document.getElementById('mini-map-resize-handle');

const toggleSBtn = document.getElementById('toggle-diag-s-btn');
const togglePBtn = document.getElementById('toggle-diag-p-btn');
const toggleBBtn = document.getElementById('toggle-diag-b-btn');
const toggleMBtn = document.getElementById('toggle-diag-m-btn');
const zoomInBtn = document.getElementById('diag-zoom-in-btn');
const zoomOutBtn = document.getElementById('diag-zoom-out-btn');
const copyBtn = document.getElementById('diag-copy-btn');

// Modal Elements Latching
const startModalOverlay = document.getElementById('start-modal-overlay');
const startGameBtn = document.getElementById('start-game-btn');

window.myGameInterface = GameInterface;
window.myBallMovementSystem = BallMovementSystem;
window.myPlayerMovementSystem = PlayerMovementSystem;

initRenderer(canvas); 
BirdsEyeView.init(mapCanvas);
GameDiagnostics.init();

let lastTimestamp = 0;
PlayerMovementSystem.init();

window.addEventListener('resize', () => {
  initRenderer(canvas);
});

toggleSBtn.addEventListener('click', () => GameDiagnostics.togglePanel('S'));
togglePBtn.addEventListener('click', () => GameDiagnostics.togglePanel('P'));
toggleBBtn.addEventListener('click', () => GameDiagnostics.togglePanel('B'));
toggleMBtn.addEventListener('click', () => GameDiagnostics.togglePanel('M'));

if (copyBtn) {
  copyBtn.addEventListener('click', () => GameDiagnostics.copyToClipboard());
}

function getActivePanelId() {
  if (toggleSBtn.classList.contains('active')) return 'S';
  if (togglePBtn.classList.contains('active')) return 'P';
  if (toggleBBtn.classList.contains('active')) return 'B';
  if (toggleMBtn.classList.contains('active')) return 'M';
  return null;
}

zoomInBtn.addEventListener('click', () => {
  const activePanel = getActivePanelId();
  if (activePanel) GameDiagnostics.adjustZoom(activePanel, 'IN');
});

zoomOutBtn.addEventListener('click', () => {
  const activePanel = getActivePanelId();
  if (activePanel) GameDiagnostics.adjustZoom(activePanel, 'OUT');
});

let isMovingForward = false;
let isMovingBackward = false;

window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  const up = key === 'arrowup';      
  const down = key === 'arrowdown';  

  if (up || down) {
    const wasMoving = isMovingForward || isMovingBackward;
    const prevForward = isMovingForward;
    const prevBackward = isMovingBackward;

    if (up) {
      isMovingForward = true;
      isMovingBackward = false;
    } else if (down) {
      isMovingBackward = true;
      isMovingForward = false;
    }

    const hallId = GameInterface.getEntityHallId('player');
    const localZ = GameInterface.getSceneRenderContext().player.localZ;

    if (!wasMoving) {
      const action = isMovingForward ? 'MOV_FWD' : 'MOV_BCK';
      GameDiagnostics.logPlayer('INI', action, hallId, localZ);
      GameDiagnostics.captureSnapshot();
    } else if ((up && prevBackward) || (down && prevForward)) {
      const action = isMovingForward ? 'MOV_FWD' : 'MOV_BCK';
      GameDiagnostics.logPlayer('TRN', action, hallId, localZ);
      GameDiagnostics.captureSnapshot();
    }
  }
});

window.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase();
  const up = key === 'arrowup';      
  const down = key === 'arrowdown';  

  if (up || down) {
    setTimeout(() => {
      const keys = PlayerMovementSystem.keysPressed;
      const stillMovingUp = keys['arrowup'];      
      const stillMovingDown = keys['arrowdown'];  

      if (!stillMovingUp && !stillMovingDown && (isMovingForward || isMovingBackward)) {
        isMovingForward = false;
        isMovingBackward = false;
        
        const hallId = GameInterface.getEntityHallId('player');
        const localZ = GameInterface.getSceneRenderContext().player.localZ;
        
        GameInterface.attemptEntityMovement('player', 0); 
        GameDiagnostics.logPlayer('STP', 'AT_REST', hallId, localZ);
        GameDiagnostics.captureSnapshot();
      }
    }, 0);
  }
});

const initBallHall = GameInterface.getEntityHallId('ball');
const initBallZ = GameInterface.getSceneRenderContext().ball.localZ;
GameDiagnostics.logBall('ROL', 'MOV_FWD', initBallHall, initBallZ);

let isMapVisible = false;
let savedWidth = 250;  
let savedHeight = 250; 

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

let lastBallDir = 1;

function gameLoop(currentTimestamp) {
  const deltaTime = (currentTimestamp - lastTimestamp) / 1000;
  lastTimestamp = currentTimestamp;

  PlayerMovementSystem.update(deltaTime);
  BallMovementSystem.update(deltaTime);
  
  // Continuous Audio Spatialization update for ball only
  BallSoundSystem.update();

  const currentBallDir = BallMovementSystem.direction;
  if (currentBallDir !== lastBallDir) {
    const ballHall = GameInterface.getEntityHallId('ball');
    const ballZ = GameInterface.getSceneRenderContext().ball.localZ;
    
    if (currentBallDir === 1) {
      GameDiagnostics.logBall('BNC', 'NEAR_LIP', ballHall, ballZ);
    } else {
      GameDiagnostics.logBall('BNC', 'FAR_END', ballHall, ballZ);
    }
    GameDiagnostics.captureSnapshot();
    lastBallDir = currentBallDir;
  }

  const renderContext = GameInterface.getSceneRenderContext();

  drawScene(ctx, renderContext, currentTimestamp / 1000);
  
  if (isMapVisible) {
    BirdsEyeView.draw();
  }

  requestAnimationFrame(gameLoop);
}

// CONTROLLED GATEWAY INITIALIZATION TRIGGERED BY USER GESTURE
startGameBtn.addEventListener('click', () => {
  // Fire audio engines instantly on user gesture
  BallSoundSystem.init();
  PlayerSoundSystem.init();

  // Tear down splash graphic layer safely
  startModalOverlay.style.display = 'none';

  // Lock target alignment timestamp instantly before processing the loop to prevent time jumps
  lastTimestamp = performance.now();
  requestAnimationFrame(gameLoop);
});
