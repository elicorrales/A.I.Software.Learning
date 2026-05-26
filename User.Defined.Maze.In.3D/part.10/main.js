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
const stateOverlay = document.getElementById('stateOverlay');
const historyOverlay = document.getElementById('historyOverlay');

// Interactive Dragging Core UI State Trackers
let isDraggingGrid = false;
let dragStartX = 0;
let dragStartY = 0;
let elementStartX = 0;
let elementStartY = 0;

let movementFrameThrottle = 0;
const FRAMES_PER_STEP = 12;

let lastStepTimestamp = 0;

// =========================================================================
// 3. PROCEDURAL CONSTRUCTORS & UTILITIES
// =========================================================================

function createHallway(id, farLabel, nearLabel, farColor, nearColor, leftDoorColor, rightDoorColor) {
  return {
    id: id,
    farWallLabel: farLabel,
    nearWallLabel: nearLabel,
    farWallColor: farColor,
    nearWallColor: nearColor,
    leftSideDoorColor: leftDoorColor,
    rightSideDoorColor: rightDoorColor,
    baseDistances: [1.1, 1.6, 2.4, 3.8, 6.5, 12.0],
    nodes: [...state.ENGINE_3D_NODES], // Clean single point of cloning here
    doorOpenStatus: [0, 0, 0, 0, 0],
    doorTargets: [0, 0, 0, 0, 0],
    startOffsetFromS: 0
  };
}

function createMainHallway(id, orderIndex) {
  const numLabel = orderIndex + 1;
  const labelA = numLabel + "a";
  const labelB = numLabel + "b";
  const colorScheme = state.UNIQUE_HALLWAY_COLORS[orderIndex];

  const newHallway = createHallway(
    id, labelB, labelA,
    colorScheme.far, colorScheme.near,
    colorScheme.near, colorScheme.far
  );

  const maxGridShiftUnits = 4;
  newHallway.startOffsetFromS = Math.floor(Math.random() * (maxGridShiftUnits + 1));
  return newHallway;
}

function initializeAllMainHallways() {
  WorldGrid.mainHallways = [];
  for (let i = 0; i < 7; i++) {
    const hallwayInstance = createMainHallway('H' + (i + 1), i);
    WorldGrid.mainHallways.push(hallwayInstance);
  }
}

function createInterconnectingHallway() {
  // Read target exclusively from our structured application state
  if (!state.activeHallway || (user.direction !== 1 && user.direction !== 3)) return;

  const currentDoorIdx = window.MazeInterface.getCurrentNodeIndex();
  if (currentDoorIdx === -1) return;

  const currentHallwayIdx = WorldGrid.mainHallways.findIndex(h => h.id === state.activeHallway.id);
  const targetHallwayIdx = user.direction === 3 ? currentHallwayIdx - 1 : currentHallwayIdx + 1;

  if (targetHallwayIdx < 0 || targetHallwayIdx >= WorldGrid.mainHallways.length) return;

  // Leverage the facade to determine if a tunnel already exists here
  if (window.MazeInterface.hasTunnelAtCurrentNode()) return;

  WorldGrid.interconnectingHallways.push({
    fromHallwayIndex: currentHallwayIdx,
    toHallwayIndex: targetHallwayIdx,
    doorIndex: currentDoorIdx,
    direction: user.direction,
    entranceDoorTarget: 1,      // Starts open because you just walked out of a main hallway door
    entranceDoorOpenStatus: 1.0,
    exitDoorTarget: 0,          // Starts closed at the far end of the tube
    exitDoorOpenStatus: 0.0
  });
}

function snapToNearestNode(offset, hallwayModel) {
  let closestOffset = hallwayModel.nodes[0];
  let minDiff = Math.abs(offset - closestOffset);

  for (let i = 1; i < hallwayModel.nodes.length; i++) {
    let diff = Math.abs(offset - hallwayModel.nodes[i]);
    if (diff < minDiff) {
      minDiff = diff;
      closestOffset = hallwayModel.nodes[i];
    }
  }
  return closestOffset;
}

/**
 * Handles the smart timing gate and routes commands to the dumb audio controller.
 * @param {boolean} isShiftPressed - True if sprinting/running, false if walking.
 */
function handleMovementAudioCadence(isShiftPressed) {
  // If the audio controller isn't loaded yet, bail safely
  if (!window.MazeAudioController) return;

  const now = performance.now();
  
  // Set human stride pacing: ~330ms for running, ~530ms for walking
  const stepCooldownInterval = isShiftPressed ? 330 : 530;

  // Gate Check: If the required time hasn't passed since the last step, ignore this event frame
  if (now - lastStepTimestamp < stepCooldownInterval) {
    return;
  }

  // Update timestamp immediately so subsequent held frames are locked out
  lastStepTimestamp = now;

  // Execute the exact plain English call requested
  if (isShiftPressed) {
    window.MazeAudioController.doRunningStep();
  } else {
    window.MazeAudioController.doWalkingStep();
  }
}

// =========================================================================
// 4. ANIMATION LOGIC ENGINE & ENGINE CONTROLLER
// =========================================================================

function animationLoop() {

  const trueHallway = window.MazeInterface.getTrueActiveHallway();

  if (trueHallway && user.movementMode === 'normal') {
    user.nodeIndex = snapToNearestNodeIndex(user.forwardOffset, trueHallway);
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

  // === INSERT THE SMOKE UPDATE STEP HERE ===
  // Animates the physical smoke particles if they exist in state
  if (typeof window.MazeInterface.updateVoidSmokeState === 'function') {
    window.MazeInterface.updateVoidSmokeState();
  }
  // =========================================

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

function snapToNearestNodeIndex(offset, hallwayModel) {
  let closestIdx = 0;
  let minDiff = Math.abs(offset - hallwayModel.nodes[0]);

  for (let i = 1; i < hallwayModel.nodes.length; i++) {
    let diff = Math.abs(offset - hallwayModel.nodes[i]);
    if (diff < minDiff) {
      minDiff = diff;
      closestIdx = i;
    }
  }
  return closestIdx;
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
    if (typeof window.captureDiagnosticSnapshot === 'function') {
      window.captureDiagnosticSnapshot(e.key);
    }
    handleMovementAudioCadence(user.isShiftPressed);
    playerForwardMovement(e);
  }
  // --- ARROW DOWN (BACKWARD / RETREAT) ---
  if (e.key === 'ArrowDown') {
    if (typeof window.captureDiagnosticSnapshot === 'function') {
      window.captureDiagnosticSnapshot(e.key);
    }
    handleMovementAudioCadence(user.isShiftPressed);
    playerBackwardMovement(e);
  }
  // --- ARROW LEFT (ROTATE LEFT) ---
  else if (e.key === 'ArrowLeft') {
    if (typeof window.captureDiagnosticSnapshot === 'function') {
      window.captureDiagnosticSnapshot(e.key);
    }
    playerRotateLeftMovement(e);
  }
  // --- ARROW RIGHT (ROTATE RIGHT) ---
  else if (e.key === 'ArrowRight') {
    if (typeof window.captureDiagnosticSnapshot === 'function') {
      window.captureDiagnosticSnapshot(e.key);
    }
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
      }
    } else if (state.activeHallway) {
      const nodeIndex = window.MazeInterface.getCurrentNodeIndex();
      if (nodeIndex !== -1 && (user.direction === 1 || user.direction === 3)) {
        window.MazeInterface.toggleTarget(state.activeHallway, nodeIndex);
      }
    }
  }

  else if (e.key === 'n' || e.key === 'N') {
    if (state.activeHallway && (user.direction === 1 || user.direction === 3)) {
      const nodeIndex = window.MazeInterface.getCurrentNodeIndex();

      if (nodeIndex !== -1) {
        // Use facade to check standard door visibility state cleanly
        if (window.MazeInterface.getOpenStatus(state.activeHallway, nodeIndex) > 0.95) {
          createInterconnectingHallway();
        }
      }
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
  initializeAllMainHallways();

  // Clean initialization passing index boundary logic off to the interface helper
  window.MazeInterface.setActiveHallwayByIndex(0);

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
    // Hide history so panels don't visually stack on top of each other
    historyOverlay.style.display = 'none'; 
    stateOverlay.style.display = 'flex';
  }
});

// Toggle History Overlay
historyToggleBtn.addEventListener('click', () => {
  if (historyOverlay.style.display === 'flex') {
    historyOverlay.style.display = 'none';
  } else {
    // Hide state so panels don't visually stack on top of each other
    stateOverlay.style.display = 'none';
    historyOverlay.style.display = 'flex';
  }
});

// Clipboard placeholders for testing UI feedback
document.getElementById('copyStateBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  alert("State copied stub functionality!");
});

document.getElementById('copyHistoryBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  alert("History copied stub functionality!");
});

window.addEventListener('resize', resizeCanvas);
