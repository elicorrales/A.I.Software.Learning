// --- DUAL COORDINATE MAPPING REFERENCE ---
// 3D Engine Physics Map (Non-linear depth intervals)
const ENGINE_3D_NODES = [0.0, 0.35, 0.75, 1.25, 1.95, 2.7, 3.95, 5.0, 5.75];

// 2D Structural Grid Map (Uniform layout spaces)
// Matches your 5 door nodes at indices: 0, 2, 4, 6, 8
const UNIFORM_2D_DOORS = [0.0, 1.0, 2.0, 3.0, 4.0];

const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');

// Mini-map interface bindings
const minimapCanvas = document.getElementById('minimapCanvas');
const minimapCtx = minimapCanvas.getContext('2d');
const minimapOverlay = document.getElementById('minimapOverlay');
const menuToggleBtn = document.getElementById('menuToggleBtn');

// =========================================================================
// 1. GLOBAL STATE DATA MODELS
// =========================================================================

const BASE_SPEED = 0.04;

const user = {
  forwardOffset: 0,
  nodeIndex: 0, // NEW: Absolute structural step index (0 to 8) - Source of Truth
  direction: 0, // 0: Forward (1b), 1: Right, 2: Backward (1a), 3: Left
  isMovingForward: false,
  isMovingBackward: false,
  isShiftPressed: false,
  speed: BASE_SPEED
};

// Globally active hallway container
let activeHallway = null;

// Master coordinator keeping track of absolute positions and connectivity bounds
const WorldGrid = {
  mainHallways: [], // Stores exactly 7 fixed structural objects
  interconnectingHallways: [], // Dynamic tracking matrix array for built connections

  // diagnostic view settings
  name: "DiagnosticWorldGridMonitor"
};

// UI Interactive Scaling and Dragging State Management variables
let currentGridScale = 1.0;
const SCALE_STEP = 0.1;
const MIN_SCALE = 0.5;
const MAX_SCALE = 3.0;

let isDraggingGrid = false;
let dragStartX = 0;
let dragStartY = 0;
let elementStartX = 0;
let elementStartY = 0;

// --- CONTINUOUS MOVEMENT SYSTEM RESTORATION ---
let movementFrameThrottle = 0;
const FRAMES_PER_STEP = 12; // Adjust this number lower for faster movement speed, higher for slower.

// =========================================================================
// 2. PROCEDURAL CONSTRUCTORS & UTILITIES
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
    nodes: [0.0, 0.35, 0.75, 1.25, 1.95, 2.7, 3.95, 5.0, 5.75],
    doorOpenStatus: [0, 0, 0, 0, 0],
    doorTargets: [0, 0, 0, 0, 0],
    startOffsetFromS: 0
  };
}

const UNIQUE_HALLWAY_COLORS = [
  { near: '#556b2f', far: '#a0522d' },
  { near: '#4682b4', far: '#d2691e' },
  { near: '#8b0000', far: '#483d8b' },
  { near: '#2e8b57', far: '#8b008b' },
  { near: '#b8860b', far: '#008b8b' },
  { near: '#5c3a21', far: '#708090' },
  { near: '#4a0e4e', far: '#2f4f4f' }
];

function createMainHallway(id, orderIndex) {
  const numLabel = orderIndex + 1;
  const labelA = numLabel + "a";
  const labelB = numLabel + "b";
  const colorScheme = UNIQUE_HALLWAY_COLORS[orderIndex];

  const newHallway = createHallway(
    id,
    labelB,
    labelA,
    colorScheme.far,
    colorScheme.near,
    colorScheme.near,
    colorScheme.far
  );

  // Set up standard physics nodes array for the 3D raycaster depth loops
  newHallway.nodes = [...ENGINE_3D_NODES];
  // --- STAGGER GRID SNAP ---
  // Every hallway is shifted by a clean whole unit along our uniform 2D grid system.
  // This allows complete horizontal randomness without ever breaking alignment.
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
  // Check context rules: Player must look Left/Right and stand directly on a door node
  if (!activeHallway || (user.direction !== 1 && user.direction !== 3)) return;

  // Use the player's discrete step index to map directly to our 5 door slots
  // Indices: 0->Door0, 2->Door1, 4->Door2, 6->Door3, 8->Door4
  const doorNodeIndices = [0, 2, 4, 6, 8];
  const currentDoorIdx = doorNodeIndices.indexOf(user.nodeIndex);
  if (currentDoorIdx === -1) return;

  const currentHallwayIdx = WorldGrid.mainHallways.findIndex(h => h.id === activeHallway.id);

  // Determine neighboring hallway row index
  const targetHallwayIdx = user.direction === 3 ? currentHallwayIdx - 1 : currentHallwayIdx + 1;
  
  // LIMIT OF THE WORLD: Prevent building past the first or last track row boundaries
  if (targetHallwayIdx < 0 || targetHallwayIdx >= WorldGrid.mainHallways.length) return;

  // --- MINIMAL CHANGE HERE ---
  // We completely remove the "targetDoorIdx" search block that checked for an existing aligned door.
  // Instead, we just check if this specific door connection already exists to avoid duplicates.

  // Prevent duplicate records
  const alreadyExists = WorldGrid.interconnectingHallways.some(conn =>
    conn.fromHallwayIndex === currentHallwayIdx &&
    conn.doorIndex === currentDoorIdx &&
    conn.direction === user.direction
  );
  if (alreadyExists) return;

  // Save connection specifying explicit structural layout alignments
  WorldGrid.interconnectingHallways.push({
    fromHallwayIndex: currentHallwayIdx,
    toHallwayIndex: targetHallwayIdx, // NEW: Track the destination row index explicitly
    doorIndex: currentDoorIdx,        // Local door index on origin track (0-4)
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
  if (activeHallway) {
    // Dynamic Passive Index Syncer: 
    // Always calculate which grid interval node you are currently drifting past 
    user.nodeIndex = snapToNearestNodeIndex(user.forwardOffset, activeHallway);
  }

  if (activeHallway) {
    for (let i = 0; i < activeHallway.doorOpenStatus.length; i++) {
      const diff = activeHallway.doorTargets[i] - activeHallway.doorOpenStatus[i];
      if (Math.abs(diff) > 0.01) {
        activeHallway.doorOpenStatus[i] += Math.sign(diff) * 0.06;
      } else {
        activeHallway.doorOpenStatus[i] = activeHallway.doorTargets[i];
      }
    }
  }

  drawHallwayView(ctx, canvas, WorldGrid, activeHallway, user);

  if (minimapOverlay.style.display !== 'none') {
    drawBirdseyeView(minimapCtx, minimapCanvas, WorldGrid, activeHallway, user);
  }

  requestAnimationFrame(animationLoop);
}

function resizeCanvas() {
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight - document.querySelector('.controls-container').offsetHeight;

  // Adjust internal viewport buffer dimensions to match standard wrapper allocations
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
  if (minimapOverlay.style.display === 'none') {
    minimapOverlay.style.display = 'block';
  } else {
    minimapOverlay.style.display = 'none';
  }
});

// Feature 1 & 2: Mouse selection focus and Ctrl +/- scaling controls
window.addEventListener('keydown', (e) => {
  // Check if World Grid mini-map panel currently holds interface focus selection
  const isMinimapFocused = (document.activeElement === minimapOverlay);

  if (isMinimapFocused && (e.key === '=' || e.key === '+' || e.key === '-')) {
    // Intercept execution path if tracking Ctrl modifying conditions
    if (e.ctrlKey) {
      e.preventDefault();
      if (e.key === '=' || e.key === '+') {
        currentGridScale = Math.min(MAX_SCALE, currentGridScale + SCALE_STEP);
      } else if (e.key === '-') {
        currentGridScale = Math.max(MIN_SCALE, currentGridScale - SCALE_STEP);
      }
      // Apply visual scaling transformations directly onto the elements wrapper bounding container
      minimapOverlay.style.transform = `scale(${currentGridScale})`;
      return;
    }
  }

  if (e.key === 'Shift') user.isShiftPressed = true;

  if (e.key === 'ArrowUp') {
    if (activeHallway) {
      e.preventDefault();
      const speedModifier = user.isShiftPressed ? user.speed * 3 : user.speed;
      
      // Freely move the offset forward based on the orientation direction
      if (user.direction === 0) user.forwardOffset += speedModifier;
      if (user.direction === 2) user.forwardOffset -= speedModifier;

      // Restrict position within physical boundaries of the hallway array bounds
      user.forwardOffset = Math.max(activeHallway.nodes[0], 
                           Math.min(activeHallway.nodes[activeHallway.nodes.length - 1], user.forwardOffset));
    }
  } else if (e.key === 'ArrowDown') {
    if (activeHallway) {
      e.preventDefault();
      const speedModifier = user.isShiftPressed ? user.speed * 3 : user.speed;

      // Freely move the offset backward based on orientation direction
      if (user.direction === 0) user.forwardOffset -= speedModifier;
      if (user.direction === 2) user.forwardOffset += speedModifier;

      // Restrict position within boundaries
      user.forwardOffset = Math.max(activeHallway.nodes[0], 
                           Math.min(activeHallway.nodes[activeHallway.nodes.length - 1], user.forwardOffset));
    }
} else if (e.key === 'ArrowLeft') {
    if (activeHallway) {
      // Find the nearest structural 2D grid index before making the turn
      user.nodeIndex = snapToNearestNodeIndex(user.forwardOffset, activeHallway);
      user.forwardOffset = activeHallway.nodes[user.nodeIndex]; // Snap camera clean
      
      activeHallway.doorOpenStatus = [0, 0, 0, 0, 0];
      activeHallway.doorTargets = [0, 0, 0, 0, 0];
    }
    user.direction = (user.direction + 3) % 4;
  } else if (e.key === 'ArrowRight') {
    if (activeHallway) {
      // Find the nearest structural 2D grid index before making the turn
      user.nodeIndex = snapToNearestNodeIndex(user.forwardOffset, activeHallway);
      user.forwardOffset = activeHallway.nodes[user.nodeIndex]; // Snap camera clean
      
      activeHallway.doorOpenStatus = [0, 0, 0, 0, 0];
      activeHallway.doorTargets = [0, 0, 0, 0, 0];
    }
    user.direction = (user.direction + 1) % 4;
  } 
else if (e.key === ' ' || e.key === 'Spacebar') {
    if (activeHallway && (user.direction === 1 || user.direction === 3)) {
      const roundedOffset = Math.round(user.forwardOffset * 100) / 100;
      const doorNodes = [0.0, 0.75, 1.95, 3.95, 5.75];
      const nodeIndex = doorNodes.findIndex(v => Math.abs(v - roundedOffset) < 0.05);
      if (nodeIndex !== -1) {
        e.preventDefault();
        activeHallway.doorTargets[nodeIndex] = activeHallway.doorTargets[nodeIndex] === 0 ? 1 : 0;
      }
    }
  } else if (e.key === 'n' || e.key === 'N') {
    if (activeHallway && (user.direction === 1 || user.direction === 3)) {
      const roundedOffset = Math.round(user.forwardOffset * 100) / 100;
      const doorNodes = [0.0, 0.75, 1.95, 3.95, 5.75];
      const nodeIndex = doorNodes.findIndex(v => Math.abs(v - roundedOffset) < 0.05);

      if (nodeIndex !== -1) {
        if (activeHallway.doorOpenStatus[nodeIndex] > 0.95) {
          createInterconnectingHallway();
        }
      }
    }
  }
});

window.addEventListener('keyup', (e) => {
  if (e.key === 'Shift') user.isShiftPressed = false;
});

// Feature 3: Dragging logic handlers mapped onto overlay container space
minimapOverlay.addEventListener('mousedown', (e) => {
  // Selectively acquire element focus state when clicking inside the window panel interface
  minimapOverlay.focus();

  isDraggingGrid = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;

  // Capture historical rendering coordinate locations using computed structural positioning models
  const style = window.getComputedStyle(minimapOverlay);
  elementStartX = parseInt(style.left || "0", 10);
  elementStartY = parseInt(style.top || "0", 10);

  // Prevent text highlights while shifting items around screen profiles
  e.preventDefault();
});

window.addEventListener('mousemove', (e) => {
  if (!isDraggingGrid) return;

  const deltaX = e.clientX - dragStartX;
  const deltaY = e.clientY - dragStartY;

  // Calculate a new top position based on initial location + mouse movement delta
  const newTop = elementStartY + deltaY;

  // Convert the horizontal position to keep a dynamic, responsive anchor to the right viewport edge
  const currentComputedLeft = elementStartX + deltaX;
  const newRight = window.innerWidth - (currentComputedLeft + minimapOverlay.offsetWidth * currentGridScale);

  // Apply style parameters cleanly to ensure responsiveness to window scales remains active
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
  activeHallway = WorldGrid.mainHallways[0];
  animationLoop();
});

// Feature 4: Layout resize observer handling changes implicitly via dynamic resize binds
window.addEventListener('resize', resizeCanvas);
