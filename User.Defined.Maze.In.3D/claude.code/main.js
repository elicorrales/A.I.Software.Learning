// =========================================================================
// 1. STATE BINDINGS & SINGLETON ALIASES
// =========================================================================
const state = window.My3dMazeAppState;
const user = state.user;
const WorldGrid = state.WorldGrid;

// =========================================================================
// 2. DOM CONTEXT & COMPONENT BINDINGS
// =========================================================================
const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');

const minimapCanvas = document.getElementById('minimapCanvas');
const minimapCtx = minimapCanvas.getContext('2d');
const minimapOverlay = document.getElementById('minimapOverlay');
const menuToggleBtn = document.getElementById('menuToggleBtn');

const stateToggleBtn = document.getElementById('stateToggleBtn');
const historyToggleBtn = document.getElementById('historyToggleBtn');
const mapToggleBtn = document.getElementById('mapToggleBtn');
const bToggleBtn = document.getElementById('bToggleBtn');
const stateOverlay = document.getElementById('stateOverlay');
const historyOverlay = document.getElementById('historyOverlay');
const mapOverlay = document.getElementById('mapOverlay');
const ballOverlay = document.getElementById('ballOverlay');

const historyCounterEl = document.getElementById('historyCounter');
const ballCounterEl    = document.getElementById('ballHistoryCounter');

window.My3dMazeDiagnostics.onHistoryUpdate = (count, max) => {
  if (historyCounterEl) historyCounterEl.textContent = `(${count}/${max})`;
};
window.My3dMazeDiagnostics.onBallUpdate = (count, max) => {
  if (ballCounterEl) ballCounterEl.textContent = `(${count}/${max})`;
};

// Interactive Dragging Core UI State Trackers
let isDraggingGrid = false;
let dragStartX = 0;
let dragStartY = 0;
let elementStartX = 0;
let elementStartY = 0;

let movementFrameThrottle = 0;
const FRAMES_PER_STEP = 12;

// =========================================================================
// 3. UTILITIES
// =========================================================================

// =========================================================================
// 4. ANIMATION LOGIC ENGINE & ENGINE CONTROLLER
// =========================================================================

function animationLoop() {

  const trueHallway = window.MazeInterface.getTrueActiveHallway();

  if (trueHallway && user.movementMode === 'normal') {
    user.nodeIndex = window.MazeInterface.snapToNearestNodeIndex(user.forwardOffset, trueHallway);
  }

  if (state.activeHallway) {
    // 1. Animate Main Corridor Doors cleanly using structural indices
    for (let i = 0; i < 5; i++) {
      window.MazeInterface.stepAnimation(state.activeHallway, i, 0.06);
    }

    // --- ANIMATE ISOLATED TUNNEL DOORS ---
    // 2. Animate Interconnecting Tunnel Doors cleanly using string contexts
    WorldGrid.interconnectingHallways.forEach(link => {
      window.MazeInterface.stepAnimation(link, 'entrance', 0.05);
      window.MazeInterface.stepAnimation(link, 'exit', 0.05);
    });
  }

  // Tick down the chain-hop flash counter; clear it if the player leaves interconnecting mode
  if (user.movementMode !== 'interconnecting') {
    user.chainHopOriginProgress = -1;
  } else if (user.chainHopOriginProgress > 0) {
    user.chainHopOriginProgress -= 1;
    if (user.chainHopOriginProgress === 0) user.chainHopOriginProgress = -1;
  }

  // === INSERT THE SMOKE UPDATE STEP HERE ===
  // Animates the physical smoke particles if they exist in state
  if (typeof window.MazeInterface.updateVoidSmokeState === 'function') {
    window.MazeInterface.updateVoidSmokeState();
  }
  // =========================================

  // === ROLLING BALL UPDATE ===
  window.BallController.update();
  // ===========================

  // Inject updated context pointers straight to renderer engines
  drawPlayerView(ctx, canvas, WorldGrid, trueHallway, user);

  // --- FLASH OVERLAY SYSTEM RENDERER ---
  if (user.flashFrames > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${user.flashFrames / 5})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    user.flashFrames--;
  }

  if (minimapOverlay.style.display !== 'none') {
    drawBirdseyeView(minimapCtx, minimapCanvas, WorldGrid, state.activeHallway, user);
  }

  requestAnimationFrame(animationLoop);
}

function resizeCanvas() {
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight - document.querySelector('.controls-container').offsetHeight;
  minimapCanvas.width = minimapCanvas.parentElement.clientWidth;
  minimapCanvas.height = minimapCanvas.parentElement.clientHeight;
}

// =========================================================================
// 5. USER CONTEXT EVENT CAPTURE MANAGERS
// =========================================================================

menuToggleBtn.addEventListener('click', () => {
  minimapOverlay.style.display = (minimapOverlay.style.display === 'none') ? 'block' : 'none';
});

window.addEventListener('keydown', (e) => {
  const isMinimapFocused = (document.activeElement === minimapOverlay);

  if (isMinimapFocused && (e.key === '=' || e.key === '+' || e.key === '-')) {
    if (e.ctrlKey) {
      e.preventDefault();
      if (e.key === '=' || e.key === '+') {
        state.UI_SCALE.currentGridScale = Math.min(state.UI_SCALE.MAX_SCALE, state.UI_SCALE.currentGridScale + state.UI_SCALE.SCALE_STEP);
      } else if (e.key === '-') {
        state.UI_SCALE.currentGridScale = Math.max(state.UI_SCALE.MIN_SCALE, state.UI_SCALE.currentGridScale - state.UI_SCALE.SCALE_STEP);
      }
      minimapOverlay.style.transform = `scale(${state.UI_SCALE.currentGridScale})`;
      return;
    }
  }

  if (e.key === 'Shift') user.isShiftPressed = true;

  // --- ARROW UP (FORWARD / ENTER DOOR) ---
  if (e.key === 'ArrowUp') {

    playerForwardMovement(e);
  }
  // --- ARROW DOWN (BACKWARD / RETREAT) ---
  if (e.key === 'ArrowDown') {

    playerBackwardMovement(e);
  }
  // --- ARROW LEFT (ROTATE LEFT) ---
  else if (e.key === 'ArrowLeft') {
    playerRotateLeftMovement(e);
  }
  // --- ARROW RIGHT (ROTATE RIGHT) ---
  else if (e.key === 'ArrowRight') {
    playerRotateRightMovement(e);
  }

  // --- SPACEBAR (TOGGLE DOORS VIA INTERFACE FACADE) ---
  else if (e.key === ' ' || e.key === 'Spacebar') {
    e.preventDefault();

    if (user.movementMode === 'interconnecting') {
      const activeLink = window.MazeInterface.findActiveTunnel();
      if (activeLink) {
        const positionContext = user.interconnectingProgress >= 1.6 ? 'exit' : 'entrance';
        window.MazeInterface.toggleTarget(activeLink, positionContext);
        // === PLAY SLIDING DOOR SOUND ===
        if (window.MazeAudioController) {
          window.MazeAudioController.handleMovementAudioCadence('door');
        }
        if (window.My3dMazeDiagnostics && typeof window.My3dMazeDiagnostics.logHistoryEvent === 'function') {
            window.My3dMazeDiagnostics.logHistoryEvent('🚪');
        }
      }
    } else if (state.activeHallway) {
      const nodeIndex = window.MazeInterface.getCurrentNodeIndex();
      if (nodeIndex !== -1 && (user.direction === 1 || user.direction === 3)) {
        window.MazeInterface.toggleTarget(state.activeHallway, nodeIndex);
        // === PLAY SLIDING DOOR SOUND ===
        if (window.MazeAudioController) {
          window.MazeAudioController.handleMovementAudioCadence('door');
        }
        if (window.My3dMazeDiagnostics && typeof window.My3dMazeDiagnostics.logHistoryEvent === 'function') {
            window.My3dMazeDiagnostics.logHistoryEvent('🚪');
        }
      }
    }
  }

  else if (e.key === 'm' || e.key === 'M') {
    state.cheatMapVisible = !state.cheatMapVisible;
  }

  else if (e.key === 'b' || e.key === 'B') {
    if (state.rollingBall) {
      window.BallController.destroy();
    } else {
      const spawnHall = (window.MazeInterface && window.MazeInterface.getTrueActiveHallway()) || state.activeHallway;
      window.BallController.spawn(spawnHall);
    }
  }

  else if (e.key === 'n' || e.key === 'N') {
    if (user.movementMode === 'normal' && state.activeHallway && (user.direction === 1 || user.direction === 3)) {
      const nodeIndex = window.MazeInterface.getCurrentNodeIndex();

      if (nodeIndex !== -1) {
        // Use facade to check standard door visibility state cleanly
        if (window.MazeInterface.getOpenStatus(state.activeHallway, nodeIndex) > 0.95) {
          window.MazeInterface.createInterconnectingHallway();
          if (window.My3dMazeDiagnostics && typeof window.My3dMazeDiagnostics.logHistoryEvent === 'function') {
            window.My3dMazeDiagnostics.logHistoryEvent('🛠️');
          }
        }
      }
    } else if (user.movementMode === 'interconnecting') {
      window.MazeInterface.createChainedTunnelFromDeadEnd();
    }
  }

  const validActionKeys = [
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 
    ' ', 'Spacebar', 'n', 'N'
  ];

  if (validActionKeys.includes(e.key)) {
    if (typeof window.captureDiagnosticSnapshot === 'function') {
      window.captureDiagnosticSnapshot(e.key);
    }
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'Shift') user.isShiftPressed = false;
});

// Dragging Mechanics Setup
minimapOverlay.addEventListener('mousedown', (e) => {
  minimapOverlay.focus();
  isDraggingGrid = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;

  // FIX: Get the true post-scale rendering coordinates on screen
  const rect = minimapOverlay.getBoundingClientRect();
  elementStartX = rect.left;
  elementStartY = rect.top;

  e.preventDefault();
});

window.addEventListener('mousemove', (e) => {
  if (!isDraggingGrid) return;

  const deltaX = e.clientX - dragStartX;
  const deltaY = e.clientY - dragStartY;
  const newTop = elementStartY + deltaY;

  const currentComputedLeft = elementStartX + deltaX;
  const newRight = window.innerWidth - (currentComputedLeft + minimapOverlay.offsetWidth * state.UI_SCALE.currentGridScale);

  minimapOverlay.style.left = 'auto';
  minimapOverlay.style.right = `${newRight}px`;
  minimapOverlay.style.top = `${newTop}px`;
});

window.addEventListener('mouseup', () => {
  isDraggingGrid = false;
});

window.addEventListener('load', () => {
  resizeCanvas();
  window.MazeInterface.initializeAllMainHallways();

  // Clean initialization passing index boundary logic off to the interface helper
  window.MazeInterface.setActiveHallwayByIndex(0);

  // --- ADDED HERE FOR BASELINE SNAPSHOT ---
  if (typeof window.captureDiagnosticSnapshot === 'function') {
    window.captureDiagnosticSnapshot("onload");
  }

  // When clicked, the modal goes away. That's all.
  const startModal = document.getElementById('startGameModal');
  const startBtn = document.getElementById('startGameModalBtn');
  if (startBtn && startModal) {
    startBtn.addEventListener('click', () => {
      startModal.style.display = 'none';
    });
  }

  animationLoop();
});

// Toggle State Overlay
stateToggleBtn.addEventListener('click', () => {
  if (stateOverlay.style.display === 'flex') {
    stateOverlay.style.display = 'none';
  } else {
    historyOverlay.style.display = 'none';
    mapOverlay.style.display = 'none';
    ballOverlay.style.display = 'none';
    const contentArea = document.getElementById('statePanelContent');
    if (contentArea && typeof window.My3dMazeDiagnostics.getSerializedStateData === 'function') {
      contentArea.textContent = window.My3dMazeDiagnostics.getSerializedStateData();
    }
    stateOverlay.style.display = 'flex';
  }
});

// Toggle History Overlay
historyToggleBtn.addEventListener('click', () => {
  if (historyOverlay.style.display === 'flex') {
    historyOverlay.style.display = 'none';
  } else {
    stateOverlay.style.display = 'none';
    mapOverlay.style.display = 'none';
    ballOverlay.style.display = 'none';
    historyOverlay.style.display = 'flex';

    if (window.My3dMazeDiagnostics && Array.isArray(window.My3dMazeDiagnostics.historyChain)) {
      const historyText = window.My3dMazeDiagnostics.historyChain.join(' ');
      const historyContentArea = document.getElementById('historyPanelContent');
      if (historyContentArea) {
        historyContentArea.textContent = historyText || "No events recorded yet. Walk around or turn to populate history!";
      }
    }
  }
});

// Toggle Map Overlay
mapToggleBtn.addEventListener('click', () => {
  if (mapOverlay.style.display === 'flex') {
    mapOverlay.style.display = 'none';
  } else {
    stateOverlay.style.display = 'none';
    historyOverlay.style.display = 'none';
    ballOverlay.style.display = 'none';
    const contentArea = document.getElementById('mapPanelContent');
    if (contentArea && typeof window.My3dMazeDiagnostics.getMazeMapDiagram === 'function') {
      contentArea.textContent = window.My3dMazeDiagnostics.getMazeMapDiagram();
    }
    mapOverlay.style.display = 'flex';
  }
});

// Toggle Ball History Overlay
bToggleBtn.addEventListener('click', () => {
  if (ballOverlay.style.display === 'flex') {
    ballOverlay.style.display = 'none';
  } else {
    stateOverlay.style.display = 'none';
    historyOverlay.style.display = 'none';
    mapOverlay.style.display = 'none';
    const contentArea = document.getElementById('ballPanelContent');
    if (contentArea && typeof window.My3dMazeDiagnostics.getBallHistoryText === 'function') {
      contentArea.textContent = window.My3dMazeDiagnostics.getBallHistoryText();
    }
    ballOverlay.style.display = 'flex';
  }
});

// Clipboard functionality for State Overlay panel (Scrapes literal visible UI text)
document.getElementById('copyStateBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  
  // 1. Locate the exact DOM text element you are looking at
  const contentArea = document.getElementById('statePanelContent');
  
  if (contentArea) {
    // 2. Extract the exact text string currently rendered on your screen
    const visibleUiText = contentArea.textContent;
    
    // 3. Push that literal screen text straight to the native clipboard
    navigator.clipboard.writeText(visibleUiText)
      .then(() => {
        alert("Success! Visible panel state copied to clipboard.");
      })
      .catch(err => {
        console.error("Could not copy panel text: ", err);
        alert("Clipboard error. Check browser console.");
      });
  } else {
    alert("Error: Panel text container element could not be found.");
  }
});

// Clipboard functionality for History Overlay panel (Scrapes literal visible UI text)
document.getElementById('copyHistoryBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  
  // 1. Locate the exact DOM text element you are looking at
  const contentArea = document.getElementById('historyPanelContent');
  
  if (contentArea) {
    // 2. Extract the exact text shorthand chain string currently rendered on your screen
    const visibleUiText = contentArea.textContent;
    
    // 3. Push that literal screen text straight to the native clipboard
    navigator.clipboard.writeText(visibleUiText)
      .then(() => {
        alert("Success! Notation history chain copied to clipboard.");
      })
      .catch(err => {
        console.error("Could not copy history text: ", err);
        alert("Clipboard error. Check browser console.");
      });
  } else {
    alert("Error: History text container element could not be found.");
  }
});

document.getElementById('copyMapBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  const contentArea = document.getElementById('mapPanelContent');
  if (contentArea) {
    navigator.clipboard.writeText(contentArea.textContent)
      .then(() => { alert("Map copied to clipboard."); })
      .catch(err => { console.error("Could not copy map:", err); alert("Clipboard error. Check browser console."); });
  } else {
    alert("Error: Map panel content element could not be found.");
  }
});

document.getElementById('copyBallBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  const contentArea = document.getElementById('ballPanelContent');
  if (contentArea) {
    navigator.clipboard.writeText(contentArea.textContent)
      .then(() => { alert("Ball history copied to clipboard."); })
      .catch(err => { console.error("Could not copy ball history:", err); alert("Clipboard error. Check browser console."); });
  } else {
    alert("Error: Ball history panel content element could not be found.");
  }
});

// =========================================================================
// NAVIGATION HISTORY PANEL DYNAMIC FONT ZOOM ENGINE
// =========================================================================
(function() {
    // Local configuration metrics for structural scaling bounds
    let currentHistoryZoomScale = 1.0;
    const ZOOM_STEP = 0.1;
    const MIN_ZOOM_SCALE = 0.7;
    const MAX_ZOOM_SCALE = 2.5;

    // Defined explicit base values in pixels to apply calculations against
    const BASE_SIZES = {
        title: 14,      // Main title text base size
        buttons: 12,    // All action and zoom buttons base size
        legend: 11,     // Map legend block key base size
        counter: 11,    // Live tracker digits font base size
        content: 14     // Scrolling symbols history chain content base size
    };

    const historyOverlay = document.getElementById('historyOverlay');

    function applyHistoryPanelFontScale() {
        if (!historyOverlay) return;

        // 1. Locate all specific individual child items inside our target container boundary
        const titleSpan = historyOverlay.querySelector('.zoom-target-title');
        const actionButtons = historyOverlay.querySelectorAll('.panel-copy-btn');
        const legendContainer = historyOverlay.querySelector('.history-legend');
        const historyCounter = historyOverlay.querySelector('#historyCounter');
        const historyContent = document.getElementById('historyPanelContent');

        // Scale Title Text Size
        if (titleSpan) {
            titleSpan.style.fontSize = (BASE_SIZES.title * currentHistoryZoomScale) + 'px';
        }

        // Scale Buttons Uniformly
        actionButtons.forEach(btn => {
            btn.style.fontSize = (BASE_SIZES.buttons * currentHistoryZoomScale) + 'px';
        });

        // Scale Explanatory Legend Block
        if (legendContainer) {
            legendContainer.style.fontSize = (BASE_SIZES.legend * currentHistoryZoomScale) + 'px';
        }

        // Scale N of Max Live Counter
        if (historyCounter) {
            historyCounter.style.fontSize = (BASE_SIZES.counter * currentHistoryZoomScale) + 'px';
        }

        // Scale Active Output Log Icons
        if (historyContent) {
            historyContent.style.fontSize = (BASE_SIZES.content * currentHistoryZoomScale) + 'px';
        }
    }

    // Bind event hook listeners directly to the new central zoom buttons
    document.getElementById('zoomInHistoryBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentHistoryZoomScale < MAX_ZOOM_SCALE) {
            currentHistoryZoomScale += ZOOM_STEP;
            applyHistoryPanelFontScale();
        }
    });

    document.getElementById('zoomOutHistoryBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentHistoryZoomScale > MIN_ZOOM_SCALE) {
            currentHistoryZoomScale -= ZOOM_STEP;
            applyHistoryPanelFontScale();
        }
    });
})();

// =========================================================================
// MAZE MAP PANEL DYNAMIC FONT ZOOM ENGINE
// =========================================================================
(function() {
    let currentMapZoomScale = 1.0;
    const ZOOM_STEP = 0.1;
    const MIN_ZOOM_SCALE = 0.7;
    const MAX_ZOOM_SCALE = 2.5;

    const BASE_SIZES = {
        title:   14,
        buttons: 12,
        content: 11
    };

    const mapOverlayEl = document.getElementById('mapOverlay');

    function applyMapPanelFontScale() {
        if (!mapOverlayEl) return;

        const titleSpan     = mapOverlayEl.querySelector('.zoom-target-title');
        const actionButtons = mapOverlayEl.querySelectorAll('.panel-copy-btn');
        const mapContent    = document.getElementById('mapPanelContent');

        if (titleSpan)  titleSpan.style.fontSize  = (BASE_SIZES.title   * currentMapZoomScale) + 'px';
        actionButtons.forEach(btn => { btn.style.fontSize = (BASE_SIZES.buttons * currentMapZoomScale) + 'px'; });
        if (mapContent) mapContent.style.fontSize  = (BASE_SIZES.content * currentMapZoomScale) + 'px';
    }

    document.getElementById('zoomInMapBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentMapZoomScale < MAX_ZOOM_SCALE) {
            currentMapZoomScale += ZOOM_STEP;
            applyMapPanelFontScale();
        }
    });

    document.getElementById('zoomOutMapBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentMapZoomScale > MIN_ZOOM_SCALE) {
            currentMapZoomScale -= ZOOM_STEP;
            applyMapPanelFontScale();
        }
    });
})();

// =========================================================================
// BALL TRAVEL HISTORY PANEL DYNAMIC FONT ZOOM ENGINE
// =========================================================================
(function() {
    let currentBallZoomScale = 1.0;
    const ZOOM_STEP = 0.1;
    const MIN_ZOOM_SCALE = 0.7;
    const MAX_ZOOM_SCALE = 2.5;

    const BASE_SIZES = {
        title:   14,
        buttons: 12,
        legend:  11,
        counter: 11,
        content: 11
    };

    const ballOverlayEl = document.getElementById('ballOverlay');

    function applyBallPanelFontScale() {
        if (!ballOverlayEl) return;

        const titleSpan      = ballOverlayEl.querySelector('.zoom-target-title');
        const actionButtons  = ballOverlayEl.querySelectorAll('.panel-copy-btn');
        const legendContainer = ballOverlayEl.querySelector('.history-legend');
        const ballCounter    = document.getElementById('ballHistoryCounter');
        const ballContent    = document.getElementById('ballPanelContent');

        if (titleSpan)       titleSpan.style.fontSize       = (BASE_SIZES.title   * currentBallZoomScale) + 'px';
        actionButtons.forEach(btn => { btn.style.fontSize   = (BASE_SIZES.buttons * currentBallZoomScale) + 'px'; });
        if (legendContainer) legendContainer.style.fontSize = (BASE_SIZES.legend  * currentBallZoomScale) + 'px';
        if (ballCounter)     ballCounter.style.fontSize     = (BASE_SIZES.counter * currentBallZoomScale) + 'px';
        if (ballContent)     ballContent.style.fontSize     = (BASE_SIZES.content * currentBallZoomScale) + 'px';
    }

    document.getElementById('zoomInBallBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentBallZoomScale < MAX_ZOOM_SCALE) {
            currentBallZoomScale += ZOOM_STEP;
            applyBallPanelFontScale();
        }
    });

    document.getElementById('zoomOutBallBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentBallZoomScale > MIN_ZOOM_SCALE) {
            currentBallZoomScale -= ZOOM_STEP;
            applyBallPanelFontScale();
        }
    });
})();


window.addEventListener('resize', resizeCanvas);
