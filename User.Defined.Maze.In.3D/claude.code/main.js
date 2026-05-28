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

function createChainedTunnelFromDeadEnd() {
  const activeTunnel = window.MazeInterface.findActiveTunnel();
  if (!activeTunnel) return;

  // Only chain in the tunnel's forward direction
  if (user.direction !== activeTunnel.direction) return;
  // Must be at the dead-end wall (player gets pinned at 3.16 when hitting a void)
  if (user.interconnectingProgress < 3.10) return;
  // Exit door must be open — consistent with normal tunnel creation requiring open door
  if (activeTunnel.exitDoorOpenStatus <= 0.95) return;
  // Forward terminal must be empty (true dead end)
  if (window.MazeInterface.doesMainHallwayExistAtTunnelTerminal(activeTunnel, 'forward')) return;
  // A chain must not already be linked from this tunnel
  if (activeTunnel.forwardChainIndex !== undefined && activeTunnel.forwardChainIndex >= 0) return;

  const newFromIdx = activeTunnel.toHallwayIndex;
  const newToIdx = activeTunnel.direction === 1 ? newFromIdx + 1 : newFromIdx - 1;

  // Universe boundary — cannot chain past the outermost hallway row
  if (newToIdx < 0 || newToIdx >= WorldGrid.mainHallways.length) {
    user.flashFrames = 5;
    return;
  }

  // Reuse the same relative door slot (0–4) — always valid, avoids globalX alignment issues
  const newDoorIdx = activeTunnel.doorIndex;

  // Preserve the visual X column from the originating tunnel for the 2D minimap.
  // Each hallway has a random startOffsetFromS, so doorIndex alone shifts the column.
  // chainGlobalX pins all segments in the chain to the same rendered X.
  const originHallway = WorldGrid.mainHallways[activeTunnel.fromHallwayIndex];
  const chainGlobalX = (activeTunnel.chainGlobalX !== undefined)
    ? activeTunnel.chainGlobalX
    : (originHallway ? originHallway.startOffsetFromS + activeTunnel.doorIndex : newDoorIdx);

  const newTunnel = {
    fromHallwayIndex:       newFromIdx,
    toHallwayIndex:         newToIdx,
    doorIndex:              newDoorIdx,
    direction:              activeTunnel.direction,
    chainGlobalX:           chainGlobalX,
    entranceDoorTarget:     0,
    entranceDoorOpenStatus: 0.0,
    exitDoorTarget:         0,
    exitDoorOpenStatus:     0.0
  };

  WorldGrid.interconnectingHallways.push(newTunnel);
  const newTunnelIdx = WorldGrid.interconnectingHallways.length - 1;

  // Directly link this tunnel to its forward chain segment — transition code uses this
  activeTunnel.forwardChainIndex = newTunnelIdx;

  if (window.My3dMazeDiagnostics && typeof window.My3dMazeDiagnostics.logHistoryEvent === 'function') {
    window.My3dMazeDiagnostics.logHistoryEvent('🛠️⛓️');
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
  if (state.rollingBall) {
    const ball = state.rollingBall;

    // Initialise AI fields on legacy ball objects
    if (ball.direction === undefined)       ball.direction = -1;
    if (ball.targetDoorIndex === undefined) ball.targetDoorIndex = null;
    if (ball.movementMode === undefined)    ball.movementMode = 'hallway';
    if (ball.tunnelLink === undefined)      ball.tunnelLink = null;
    if (ball.tunnelProgress === undefined)  ball.tunnelProgress = 0;

    if (ball.movementMode === 'tunnel' && ball.tunnelLink) {
      // --- TUNNEL TRAVERSAL ---
      ball.tunnelProgress += ball.speed;
      ball.rotation += ball.speed * 18;

      if (ball.tunnelProgress >= 3.2) {
        const currentLink = ball.tunnelLink;
        const destIdx     = currentLink.toHallwayIndex;
        const destHallway = WorldGrid.mainHallways[destIdx];

        if (destHallway) {
          // Resolve exit position using chainGlobalX (mirrors player exitTunnelToCorridor logic)
          const fromHallway  = WorldGrid.mainHallways[currentLink.fromHallwayIndex];
          const exitGlobalX  = (currentLink.chainGlobalX !== undefined)
            ? currentLink.chainGlobalX
            : (fromHallway ? fromHallway.startOffsetFromS + currentLink.doorIndex : 0);
          const localDoorIdx = Math.round(exitGlobalX - destHallway.startOffsetFromS);
          const doorNodeOffset = (destHallway.nodes && destHallway.nodes[localDoorIdx * 2] !== undefined)
            ? destHallway.nodes[localDoorIdx * 2]
            : 0;

          // Find next chain segment — prefer forwardChainIndex pointer, fallback to globalX column search
          let nextLink = null;
          if (currentLink.forwardChainIndex !== undefined && currentLink.forwardChainIndex >= 0) {
            nextLink = WorldGrid.interconnectingHallways[currentLink.forwardChainIndex] || null;
          }
          if (!nextLink) {
            nextLink = WorldGrid.interconnectingHallways.find(c => {
              if (c === currentLink) return false;
              const cFrom    = WorldGrid.mainHallways[c.fromHallwayIndex];
              if (!cFrom) return false;
              const cGlobalX = (c.chainGlobalX !== undefined) ? c.chainGlobalX : cFrom.startOffsetFromS + c.doorIndex;
              if (cGlobalX !== exitGlobalX) return false;
              return c.fromHallwayIndex === destIdx || c.toHallwayIndex === destIdx;
            }) || null;
          }

          ball.hallwayId = destHallway.id;
          ball.offset    = doorNodeOffset;

          if (nextLink) {
            // Chain-hop: stay in tunnel mode, enter next segment immediately
            ball.tunnelLink     = nextLink;
            ball.tunnelProgress = 0;
          } else {
            // End of chain — arrive in destination hallway, resume random
            ball.movementMode    = 'hallway';
            ball.tunnelLink      = null;
            ball.tunnelProgress  = 0;
            ball.targetDoorIndex = null;
            ball.direction       = -1;
          }
        } else {
          if (window.MazeAudioController) window.MazeAudioController.stopBallRollingSound();
          state.rollingBall = null;
        }
      }

    } else {
      // --- HALLWAY MOVEMENT ---
      const currentHallway = WorldGrid.mainHallways.find(h => h.id === ball.hallwayId);

      if (!currentHallway) {
        if (window.MazeAudioController) window.MazeAudioController.stopBallRollingSound();
        state.rollingBall = null;
      } else {
        const farWall = currentHallway.baseDistances[currentHallway.baseDistances.length - 1];

        // Capture target when player enters a tunnel from this hallway (ball has LoS)
        if (ball.targetDoorIndex === null &&
            state.activeHallway && ball.hallwayId === state.activeHallway.id &&
            user.movementMode === 'interconnecting') {
          const activeLink = window.MazeInterface.findActiveTunnel();
          if (activeLink) {
            const hallIdx = WorldGrid.mainHallways.findIndex(h => h.id === ball.hallwayId);
            if (activeLink.fromHallwayIndex === hallIdx) {
              ball.targetDoorIndex = activeLink.doorIndex;
            }
          }
        }

        if (ball.targetDoorIndex !== null) {
          // Chase mode: steer toward target door position each frame
          const targetOffset = currentHallway.nodes[ball.targetDoorIndex * 2];
          ball.direction = ball.offset > targetOffset ? -1 : 1;

          if (Math.abs(ball.offset - targetOffset) < ball.speed * 3) {
            // Reached door — enter tunnel if it exists and is open
            const hallIdx = WorldGrid.mainHallways.findIndex(h => h.id === ball.hallwayId);
            const link = WorldGrid.interconnectingHallways.find(
              c => c.fromHallwayIndex === hallIdx && c.doorIndex === ball.targetDoorIndex
            );
            if (link && currentHallway.doorOpenStatus &&
                currentHallway.doorOpenStatus[ball.targetDoorIndex] > 0.5) {
              ball.movementMode   = 'tunnel';
              ball.tunnelLink     = link;
              ball.tunnelProgress = 0;
              ball.offset         = targetOffset;
            } else {
              // Door closed or tunnel gone — fall back to random
              ball.targetDoorIndex = null;
            }
          }
        } else {
          // Random mode: bounce between near wall and far wall
          if (ball.direction === -1 && ball.offset - ball.speed <= 0.0) {
            ball.direction = 1;
          } else if (ball.direction === 1 && ball.offset + ball.speed >= farWall) {
            ball.direction = -1;
          }
        }

        // Apply movement
        ball.offset   += ball.direction * ball.speed;
        ball.rotation += ball.speed * 18;

        // Audio
        const ballZ = ball.offset - user.forwardOffset;
        if (window.MazeAudioController) {
          window.MazeAudioController.updateBallRollingSoundVolume(ballZ);
        }

        // Collision with player
        const ballInActiveHall = state.activeHallway && ball.hallwayId === state.activeHallway.id;
        if (user.movementMode === 'normal' && ballInActiveHall &&
            Math.abs(ball.offset - user.forwardOffset) <= 0.4) {
          if (window.MazeAudioController) window.MazeAudioController.stopBallRollingSound();
          state.rollingBall = null;
          user.flashFrames = 5;
        }
      }
    }
  }
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
    if (!state.rollingBall) {
      const spawnHall = (window.MazeInterface && window.MazeInterface.getTrueActiveHallway()) || state.activeHallway;
      if (spawnHall) {
        state.rollingBall = {
          offset: spawnHall.baseDistances[spawnHall.baseDistances.length - 1],
          speed: state.BASE_SPEED,
          rotation: 0,
          hallwayId: spawnHall.id,
          direction: -1,
          targetDoorIndex: null,
          movementMode: 'hallway',
          tunnelLink: null,
          tunnelProgress: 0,
        };
        if (window.MazeAudioController) {
          window.MazeAudioController.startBallRollingSound();
        }
      }
    }
  }

  else if (e.key === 'n' || e.key === 'N') {
    if (user.movementMode === 'normal' && state.activeHallway && (user.direction === 1 || user.direction === 3)) {
      const nodeIndex = window.MazeInterface.getCurrentNodeIndex();

      if (nodeIndex !== -1) {
        // Use facade to check standard door visibility state cleanly
        if (window.MazeInterface.getOpenStatus(state.activeHallway, nodeIndex) > 0.95) {
          createInterconnectingHallway();
          if (window.My3dMazeDiagnostics && typeof window.My3dMazeDiagnostics.logHistoryEvent === 'function') {
            window.My3dMazeDiagnostics.logHistoryEvent('🛠️');
          }
        }
      }
    } else if (user.movementMode === 'interconnecting') {
      createChainedTunnelFromDeadEnd();
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
  initializeAllMainHallways();

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
    // Hide history so panels don't visually stack on top of each other
    historyOverlay.style.display = 'none'; 
    // Purely UI/DOM Layer operation inside main.js
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
    // Hide state so panels don't visually stack on top of each other
    stateOverlay.style.display = 'none';
    historyOverlay.style.display = 'flex';

    // Fetch the raw history notation chain array and join tokens into a readable text line
    if (window.My3dMazeDiagnostics && Array.isArray(window.My3dMazeDiagnostics.historyChain)) {
      const historyText = window.My3dMazeDiagnostics.historyChain.join(' ');
      
      // Target your text content display box inside the history panel
      const historyContentArea = document.getElementById('historyPanelContent');
      if (historyContentArea) {
        historyContentArea.textContent = historyText || "No events recorded yet. Walk around or turn to populate history!";
      }
    }
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


window.addEventListener('resize', resizeCanvas);
