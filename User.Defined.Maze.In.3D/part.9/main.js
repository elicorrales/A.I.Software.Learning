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

function playerForwardMovement(e) {
    // Situation A: Inside the continuous interconnecting tube
    if (user.movementMode === 'interconnecting') {
      // BLOCK SIDEWAYS SLIDING: Direction must be 1 (Right) or 3 (Left) to move through tubes
      if (user.direction === 0 || user.direction === 2) {
        user.flashFrames = 5; // Flash the screen to indicate blocked movement
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        return;
      }

      // Grab the live occupying link directly via the object interface layer
      const activeLink = window.MazeInterface.findActiveTunnel();

      // If looking backward from the link's forward vector, walk backward numerically
      const multiplier = (activeLink && user.direction !== activeLink.direction) ? -1 : 1;

      // Calculate next progressive step position
      const nextProgress = user.interconnectingProgress + user.speed * multiplier;

      // TARGET ACTION: Check the entry door if moving backward out, or the exit door if moving forward in
      const isMovingTowardsExit = nextProgress > user.interconnectingProgress;
      if (isMovingTowardsExit) {
        if (activeLink && activeLink.exitDoorOpenStatus <= 0.95 && nextProgress >= 3.20) {
          user.flashFrames = 5;
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          return;
        }
      } else {
        if (activeLink && activeLink.entranceDoorOpenStatus <= 0.95 && nextProgress <= 0.0) {
          user.flashFrames = 5;
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          return;
        }
      }

      // --- FIXED BOUNDARY & CLOSED EXIT DOOR BLOCK RULE ---
      if (nextProgress >= 3.20) {
        if (activeLink) {
          // Use our standardized helper to get the tunnel's exit door status!
          const exitDoorOpenAmt = window.MazeInterface.getOpenStatus(activeLink, 'exit');

          if (exitDoorOpenAmt <= 0.95) {
            user.interconnectingProgress = 3.16;
            user.flashFrames = 5;
            if (e && typeof e.preventDefault === 'function') e.preventDefault();
            return;
          }
        }
      }

      user.interconnectingProgress = nextProgress;

      // Check exit boundaries if open or exceeded on either side of the tube
      if (user.interconnectingProgress <= 0.0 || user.interconnectingProgress >= 3.20) {
        window.MazeInterface.exitTunnelToCorridor();
      }
      return;
    }

    // Situation B: Inside the wall transition lip space
    if (user.movementMode === 'transition') {
      user.transitionProgress += user.speed;
      if (user.transitionProgress >= 0.4) {
        // Hand-off! Cross threshold into the independent tunnel system
        user.movementMode = 'interconnecting';
        
        // Contextual Entry Fix: Check which hallway we are stepping out of
        const activeLink = window.MazeInterface.findActiveTunnel();
        const currentHallwayIdx = WorldGrid.mainHallways.findIndex(h => h.id === state.activeHallway.id);
        
        if (activeLink && currentHallwayIdx === activeLink.toHallwayIndex) {
          // Entering tunnel from the terminal/destination end -> start at max progress
          user.interconnectingProgress = 3.20;
        } else {
          // Entering tunnel from the originating end -> start at zero progress
          user.interconnectingProgress = 0.0;
        }
      }
      return;
    }


    // Situation C: Normal navigation, facing a door node, and trying to step into it
    if (user.movementMode === 'normal' && (user.direction === 1 || user.direction === 3)) {
      const nodeIndex = window.MazeInterface.getCurrentNodeIndex();

      if (nodeIndex !== -1) {
        // Read the current door status seamlessly from the interface facade
        if (window.MazeInterface.getOpenStatus(state.activeHallway, nodeIndex) <= 0.95) {
          user.flashFrames = 5;
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          return;
        }

        // 1. Find the current hallway's relative index in the world array
        const currentHallwayIdx = WorldGrid.mainHallways.findIndex(h => h.id === state.activeHallway.id);

        // 2. Identify if this door leads outside the universe boundaries (Red X)
        const isWorldBoundaryVoid = (user.direction === 3 && currentHallwayIdx === 0) || (user.direction === 1 && currentHallwayIdx === 6);

        if (isWorldBoundaryVoid) {
          user.flashFrames = 5; // Re-instate visual screen flash feedback for illegal moves
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          return; // RULE RE-INSTATED: Direct early return to completely block movement
        }

        // 3. NEW RULE: Even if open and legal, if no interconnecting side hallway has been spawned ('N' key), flash and block
        if (!window.MazeInterface.hasTunnelAtCurrentNode()) {
          user.flashFrames = 5;
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          return;
        }

        // Switch to transition mode and push forward off the center line
        user.movementMode = 'transition';
        user.transitionProgress = user.speed;
        return;
      }
    }

    // Situation D: Standard forward movement down main corridor (Facing Direction 0 or 2)
    if (user.movementMode === 'normal' && state.activeHallway) {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();

      const speedModifier = user.isShiftPressed ? user.speed * 3 : user.speed;

      // Forward movement based on facing direction
      if (user.direction === 0) user.forwardOffset += speedModifier;
      if (user.direction === 2) user.forwardOffset -= speedModifier;

      // Clamp to hallway boundaries
      user.forwardOffset = Math.max(
        state.activeHallway.nodes[0],
        Math.min(state.activeHallway.nodes[state.activeHallway.nodes.length - 1], user.forwardOffset)
      );
    }
}

function playerBackwardMovement(e) {
    // Situation A: Retreating backward down the connector tube
    if (user.movementMode === 'interconnecting') {
      // BLOCK SIDEWAYS SLIDING: Direction must be 1 (Right) or 3 (Left) to back up through tubes
      if (user.direction === 0 || user.direction === 2) {
        user.flashFrames = 5; // Flash the screen to indicate blocked movement
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        return;
      }

      // Find active link to check its native layout direction
      // Grab the live occupying link directly via the object interface layer
      const activeLink = window.MazeInterface.findActiveTunnel();

      // If looking backward, hitting ArrowDown moves you deeper towards the destination channel
      const multiplier = (activeLink && user.direction !== activeLink.direction) ? -1 : 1;

      // Calculate next backward step position
      const nextProgress = user.interconnectingProgress - user.speed * multiplier;

      // --- FIXED BOUNDARY & CLOSED EXIT DOOR BLOCK RULE ---
      if (nextProgress >= 3.20 && activeLink) {
        // Use the interface helper to read the tunnel's exit door status!
        const exitDoorStatus = window.MazeInterface.getOpenStatus(activeLink, 'exit');

        if (exitDoorStatus <= 0.95) {
          user.interconnectingProgress = 3.16;
          user.flashFrames = 5;
          if (e && typeof e.preventDefault === 'function') e.preventDefault();
          return;
        }
      }

user.interconnectingProgress = nextProgress;

      // Handle direct corridor drop boundary checks
      if (user.interconnectingProgress <= 0.0 || user.interconnectingProgress >= 3.20) {
        window.MazeInterface.exitTunnelToCorridor();
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

    // Situation C: Standard backward movement down main corridor (Facing Direction 0 or 2)
    if (user.movementMode === 'normal' && state.activeHallway) {
      e.preventDefault();

      const speedModifier = user.isShiftPressed ? user.speed * 3 : user.speed;

      // Backward movement based on facing direction
      if (user.direction === 0) user.forwardOffset -= speedModifier;
      if (user.direction === 2) user.forwardOffset += speedModifier;

      // Clamp to hallway boundaries
      user.forwardOffset = Math.max(
        state.activeHallway.nodes[0],
        Math.min(state.activeHallway.nodes[state.activeHallway.nodes.length - 1], user.forwardOffset)
      );
    }
}

function playerRotateLeftMovement(e) {
    if (user.movementMode === 'transition') return; // user not allowed to turn during transition
    if (user.movementMode === 'normal' && state.activeHallway) {
      user.nodeIndex = snapToNearestNodeIndex(user.forwardOffset, state.activeHallway);
      user.forwardOffset = state.activeHallway.nodes[user.nodeIndex];

      // Reset doors on rotation via facade helper
      window.MazeInterface.resetAllDoors(state.activeHallway);
    }
    user.direction = (user.direction + 3) % 4;
}

function playerRotateRightMovement(e) {
    if (user.movementMode === 'transition') return; // user not allowed to turn during transition
    if (user.movementMode === 'normal' && state.activeHallway) {
      user.nodeIndex = snapToNearestNodeIndex(user.forwardOffset, state.activeHallway);
      user.forwardOffset = state.activeHallway.nodes[user.nodeIndex];

      // Reset doors on rotation via facade helper
      window.MazeInterface.resetAllDoors(state.activeHallway);
    }
    user.direction = (user.direction + 1) % 4;
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

  animationLoop();
});

window.addEventListener('resize', resizeCanvas);
