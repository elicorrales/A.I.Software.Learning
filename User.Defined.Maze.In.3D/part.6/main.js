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

// Interactive Dragging Core UI State Trackers
let isDraggingGrid = false;
let dragStartX = 0;
let dragStartY = 0;
let elementStartX = 0;
let elementStartY = 0;

let movementFrameThrottle = 0;
const FRAMES_PER_STEP = 12;

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

  const doorNodeIndices = [0, 2, 4, 6, 8];
  const currentDoorIdx = doorNodeIndices.indexOf(user.nodeIndex);
  if (currentDoorIdx === -1) return;

  const currentHallwayIdx = WorldGrid.mainHallways.findIndex(h => h.id === state.activeHallway.id);
  const targetHallwayIdx = user.direction === 3 ? currentHallwayIdx - 1 : currentHallwayIdx + 1;

  if (targetHallwayIdx < 0 || targetHallwayIdx >= WorldGrid.mainHallways.length) return;

  const alreadyExists = WorldGrid.interconnectingHallways.some(conn =>
    conn.fromHallwayIndex === currentHallwayIdx &&
    conn.doorIndex === currentDoorIdx &&
    conn.direction === user.direction
  );
  if (alreadyExists) return;

  WorldGrid.interconnectingHallways.push({
    fromHallwayIndex: currentHallwayIdx,
    toHallwayIndex: targetHallwayIdx, 
    doorIndex: currentDoorIdx,        
    direction: user.direction
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

// =========================================================================
// 4. ANIMATION LOGIC ENGINE & ENGINE CONTROLLER
// =========================================================================

function animationLoop() {
  if (state.activeHallway) {
    user.nodeIndex = snapToNearestNodeIndex(user.forwardOffset, state.activeHallway);
  }

  if (state.activeHallway) {
    for (let i = 0; i < state.activeHallway.doorOpenStatus.length; i++) {
      const diff = state.activeHallway.doorTargets[i] - state.activeHallway.doorOpenStatus[i];
      if (Math.abs(diff) > 0.01) {
        state.activeHallway.doorOpenStatus[i] += Math.sign(diff) * 0.06;
      } else {
        state.activeHallway.doorOpenStatus[i] = state.activeHallway.doorTargets[i];
      }
    }
  }

  // Inject updated context pointers straight to renderer engines
  drawHallwayView(ctx, canvas, WorldGrid, state.activeHallway, user);

  // Inject updated context pointers straight to renderer engines
  drawHallwayView(ctx, canvas, WorldGrid, state.activeHallway, user);

  // --- FLASH OVERLAY SYSTEM RENDERER ---
  if (user.flashFrames > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${user.flashFrames / 5})`; // Smoothly fades out quickly over 5 frames
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    user.flashFrames--; // Decrement the global operational ticking block loop frame counter
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

  // --- ARROW UP (FORWARD / ENTER) ---
  if (e.key === 'ArrowUp') {
    // Situation A: Already in the continuous interconnecting tube
    if (user.movementMode === 'interconnecting') {
      user.interconnectingProgress += user.speed;
      // Max boundary threshold hand-off (Phase 'e') will be calculated here later
      return;
    }

    // Situation B: Already in the wall transition lip space
    if (user.movementMode === 'transition') {
      user.transitionProgress += user.speed;
      if (user.transitionProgress >= 0.4) {
        // Hand-off! Cross threshold into the independent tunnel system
        user.movementMode = 'interconnecting';
        user.interconnectingProgress = 0.0;
      }
      return;
    }

    // Situation C: Normal navigation, but facing a door node and trying to enter
    if (user.movementMode === 'normal' && (user.direction === 1 || user.direction === 3)) {
      const doorNodes = [0.0, 0.75, 1.95, 3.95, 5.75];
      const roundedOffset = Math.round(user.forwardOffset * 100) / 100;
      const nodeIndex = doorNodes.findIndex(v => Math.abs(v - roundedOffset) < 0.05);

      if (nodeIndex !== -1 && state.activeHallway.doorOpenStatus[nodeIndex] > 0.95) {
        // Switch to transition mode and push forward off the center line
        user.movementMode = 'transition';
        user.transitionProgress = user.speed;
        return;
      }
    }
    
    // Default: Standard forward movement down main corridor
    if (user.movementMode === 'normal') {
      user.isMovingForward = true;
    }
  }

  // --- ARROW DOWN (BACKWARD / RETREAT) ---
  if (e.key === 'ArrowDown') {
    // Situation A: Retreating backward down the connector tube
    if (user.movementMode === 'interconnecting') {
      user.interconnectingProgress -= user.speed;
      if (user.interconnectingProgress <= 0.0) {
        // Fall back into the doorway transition space
        user.movementMode = 'transition';
        user.transitionProgress = 0.4;
        user.interconnectingProgress = 0.0;
      }
      return;
    }

    // Situation B: Retreating out of the doorway lip back to center line
    if (user.movementMode === 'transition') {
      user.transitionProgress -= user.speed;
      if (user.transitionProgress <= 0.0) {
        // Fall back onto the main corridor center line track
        user.movementMode = 'normal';
        user.transitionProgress = 0.0;
      }
      return;
    }

    // Default: Standard backward movement down main corridor
    if (user.movementMode === 'normal') {
      user.isMovingBackward = true;
    }
  }

   else if (e.key === 'ArrowLeft') {
    if (state.activeHallway) {
      user.nodeIndex = snapToNearestNodeIndex(user.forwardOffset, state.activeHallway);
      user.forwardOffset = state.activeHallway.nodes[user.nodeIndex];

      state.activeHallway.doorOpenStatus = [0, 0, 0, 0, 0];
      state.activeHallway.doorTargets = [0, 0, 0, 0, 0];
    }
    user.direction = (user.direction + 3) % 4;
  } else if (e.key === 'ArrowRight') {
    if (state.activeHallway) {
      user.nodeIndex = snapToNearestNodeIndex(user.forwardOffset, state.activeHallway);
      user.forwardOffset = state.activeHallway.nodes[user.nodeIndex];

      state.activeHallway.doorOpenStatus = [0, 0, 0, 0, 0];
      state.activeHallway.doorTargets = [0, 0, 0, 0, 0];
    }
    user.direction = (user.direction + 1) % 4;
  } else if (e.key === ' ' || e.key === 'Spacebar') {
    if (state.activeHallway && (user.direction === 1 || user.direction === 3)) {
      const roundedOffset = Math.round(user.forwardOffset * 100) / 100;
      const doorNodes = [0.0, 0.75, 1.95, 3.95, 5.75];
      const nodeIndex = doorNodes.findIndex(v => Math.abs(v - roundedOffset) < 0.05);
      if (nodeIndex !== -1) {
        e.preventDefault();
        state.activeHallway.doorTargets[nodeIndex] = state.activeHallway.doorTargets[nodeIndex] === 0 ? 1 : 0;
      }
    }
  } else if (e.key === 'n' || e.key === 'N') {
    if (state.activeHallway && (user.direction === 1 || user.direction === 3)) {
      const roundedOffset = Math.round(user.forwardOffset * 100) / 100;
      const doorNodes = [0.0, 0.75, 1.95, 3.95, 5.75];
      const nodeIndex = doorNodes.findIndex(v => Math.abs(v - roundedOffset) < 0.05);

      if (nodeIndex !== -1) {
        if (state.activeHallway.doorOpenStatus[nodeIndex] > 0.95) {
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

  const style = window.getComputedStyle(minimapOverlay);
  elementStartX = parseInt(style.left || "0", 10);
  elementStartY = parseInt(style.top || "0", 10);
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
  // Assign value cleanly directly to the object property tracked by the application singleton
  state.activeHallway = WorldGrid.mainHallways[0];
  animationLoop();
});

window.addEventListener('resize', resizeCanvas);
