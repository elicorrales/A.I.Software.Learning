//my-3d-maze-interface-helpers.js// my-3d-maze-interface-helpers.js
// =========================================================================
// STRUCTURAL COUPLING ADAPTERS (The Object Interface)
// =========================================================================

/**
 * Determines if a given object structure is an Interconnecting Tunnel.
 * @param {Object} structure - Either a Main Hallway or a Tunnel link.
 * @returns {boolean}
 */
function isTunnelStructure(structure) {
  return structure && ('entranceDoorOpenStatus' in structure);
}

/**
 * Returns the current door open status (0.0 to 1.0) for a structure.
 * @param {Object} structure - The active main hallway object or tunnel link object.
 * @param {string|number} context - For a tunnel: 'entrance' or 'exit'. For a hallway: the numeric door array index.
 * @returns {number} Open value from 0.0 (fully closed) to 1.0 (fully open).
 */
function getStructureDoorOpenStatus(structure, context) {
  if (!structure) return 0.0;

  if (isTunnelStructure(structure)) {
    // It's a tunnel link! Use direct custom state variables
    return context === 'exit' ? structure.exitDoorOpenStatus : structure.entranceDoorOpenStatus;
  }

  // It's a main hallway! Use the standard door state array index
  if (structure.doorOpenStatus && structure.doorOpenStatus[context] !== undefined) {
    return structure.doorOpenStatus[context];
  }

  return 0.0;
}

/**
 * Returns the target door state (0 or 1) that a door is animating towards.
 * @param {Object} structure - The active main hallway object or tunnel link object.
 * @param {string|number} context - For a tunnel: 'entrance' or 'exit'. For a hallway: the numeric door array index.
 * @returns {number} 0 for closing/closed, 1 for opening/open.
 */
function getStructureDoorTarget(structure, context) {
  if (!structure) return 0;

  if (isTunnelStructure(structure)) {
    return context === 'exit' ? structure.exitDoorTarget : structure.entranceDoorTarget;
  }

  if (structure.doorTargets && structure.doorTargets[context] !== undefined) {
    return structure.doorTargets[context];
  }

  return 0;
}

/**
 * Safely toggles a door's target state between 0 (closed) and 1 (open).
 * @param {Object} structure - The active main hallway object or tunnel link object.
 * @param {string|number} context - For a tunnel: 'entrance' or 'exit'. For a hallway: the numeric door array index.
 */
function toggleStructureDoorTarget(structure, context) {
  if (!structure) return;

  if (isTunnelStructure(structure)) {
    if (context === 'exit') {
      structure.exitDoorTarget = structure.exitDoorTarget === 0 ? 1 : 0;
    } else {
      structure.entranceDoorTarget = structure.entranceDoorTarget === 0 ? 1 : 0;
    }
    return;
  }

  // Main Hallway array toggle
  if (structure.doorTargets && structure.doorTargets[context] !== undefined) {
    structure.doorTargets[context] = structure.doorTargets[context] === 0 ? 1 : 0;
  }
}

/**
 * Calculates and returns the valid door array index (0-4) based on the 
 * player's current forward position offset within a Main Hallway corridor.
 */
function getCurrentNodeIndex() {
  const state = window.My3dMazeAppState;
  if (!state || !state.user) return -1;
  
  const roundedOffset = Math.round(state.user.forwardOffset * 100) / 100;
  const doorNodes = [0.0, 0.75, 1.95, 3.95, 5.75];
  return doorNodes.findIndex(v => Math.abs(v - roundedOffset) < 0.05);
}

/**
 * Searches the world graph registry to extract the live Tunnel link object 
 * that the player is currently occupying based on active location and node alignment.
 */
function findActiveTunnel() {
  const state = window.My3dMazeAppState;
  if (!state || !state.activeHallway || !state.user) return null;

  const doorNodes = [0, 2, 4, 6, 8];
  const doorDataIdx = doorNodes.indexOf(state.user.nodeIndex);
  const currentHallwayIdx = state.WorldGrid.mainHallways.findIndex(h => h.id === state.activeHallway.id);

  return state.WorldGrid.interconnectingHallways.find(conn =>
    (conn.fromHallwayIndex === currentHallwayIdx && conn.doorIndex === doorDataIdx) ||
    (conn.toHallwayIndex === currentHallwayIdx && conn.doorIndex === doorDataIdx)
  );
}

/**
 * Unifies transition calculations to incrementally animate doors over time.
 * Automatically accommodates numeric indices for main hallways or context strings for tunnels.
 * @param {Object} structure - Either a Main Hallway or an Interconnecting Tunnel.
 * @param {string|number} context - Numeric index (0-4) or string context ('entrance' / 'exit').
 * @param {number} rate - Animation frame increments (e.g., 0.05).
 */
function stepStructureDoorAnimation(structure, context, rate = 0.05) {
  if (!structure) return;

  if (isTunnelStructure(structure)) {
    // Tunnel link calculations
    if (context === 'exit') {
      if (structure.exitDoorTarget === 1 && structure.exitDoorOpenStatus < 1.0) {
        structure.exitDoorOpenStatus = Math.min(1.0, structure.exitDoorOpenStatus + rate);
      } else if (structure.exitDoorTarget === 0 && structure.exitDoorOpenStatus > 0.0) {
        structure.exitDoorOpenStatus = Math.max(0.0, structure.exitDoorOpenStatus - rate);
      }
    } else { // 'entrance' context
      if (structure.entranceDoorTarget === 1 && structure.entranceDoorOpenStatus < 1.0) {
        structure.entranceDoorOpenStatus = Math.min(1.0, structure.entranceDoorOpenStatus + rate);
      } else if (structure.entranceDoorTarget === 0 && structure.entranceDoorOpenStatus > 0.0) {
        structure.entranceDoorOpenStatus = Math.max(0.0, structure.entranceDoorOpenStatus - rate);
      }
    }
    return;
  }

  // Main Hallway array calculations
  if (structure.doorTargets && structure.doorOpenStatus && structure.doorTargets[context] !== undefined) {
    const target = structure.doorTargets[context];
    const current = structure.doorOpenStatus[context];

    if (target === 1 && current < 1.0) {
      structure.doorOpenStatus[context] = Math.min(1.0, current + rate);
    } else if (target === 0 && current > 0.0) {
      structure.doorOpenStatus[context] = Math.max(0.0, current - rate);
    }
  }
}

/**
 * Checks if an interconnecting tunnel already exists at the player's current location.
 * Eliminates manual array .some() filtration inside main.js.
 * @returns {boolean}
 */
function hasTunnelAtCurrentNode() {
  const state = window.My3dMazeAppState;
  if (!state || !state.activeHallway || !state.user) return false;

  const currentDoorIdx = getCurrentNodeIndex();
  if (currentDoorIdx === -1) return false;

  const currentHallwayIdx = state.WorldGrid.mainHallways.findIndex(h => h.id === state.activeHallway.id);

  return state.WorldGrid.interconnectingHallways.some(conn =>
    conn.fromHallwayIndex === currentHallwayIdx &&
    conn.doorIndex === currentDoorIdx &&
    conn.direction === state.user.direction
  );
}

/**
 * Normalizes directional orientation context strings ('entrance' vs 'exit') contextually
 * depending on whether the player entered from the 'from' hallway or the 'to' hallway.
 * Resolves the "Directional Symmetry" flaw for physics and door checks.
 * @param {Object} tunnel - The active interconnecting tunnel link object.
 * @param {string} rawContext - The perspective string from the player's viewpoint ('entrance' or 'exit').
 * @returns {string} The structurally true property context string ('entrance' or 'exit').
 */
function getNormalizedTunnelContext(tunnel, rawContext) {
  const state = window.My3dMazeAppState;
  if (!state || !state.activeHallway || !tunnel) return rawContext;

  const currentHallwayIdx = state.WorldGrid.mainHallways.findIndex(h => h.id === state.activeHallway.id);

  // If we are navigating the tunnel from the destination side ('to' side), 
  // entrance and exit structural properties are inverted relative to our movement direction.
  if (currentHallwayIdx === tunnel.toHallwayIndex) {
    return rawContext === 'entrance' ? 'exit' : 'entrance';
  }
  return rawContext;
}

/**
 * Safely updates the active hallway context tracking state via index parameters,
 * isolating main.js from direct global object state mutations.
 * @param {number} hallwayIndex - The index of the hallway in the world registry array.
 */
function setActiveHallwayByIndex(hallwayIndex) {
  const state = window.My3dMazeAppState;
  if (!state || !state.WorldGrid.mainHallways[hallwayIndex]) return;
  
  state.activeHallway = state.WorldGrid.mainHallways[hallwayIndex];
}

/**
 * Resets all door open statuses and targets back to zero for a given hallway.
 * @param {Object} hallway - The active hallway object structure.
 */
function resetAllDoors(hallway) {
  if (!hallway) return;
  if (hallway.doorOpenStatus) {
    hallway.doorOpenStatus.fill(0);
  }
  if (hallway.doorTargets) {
    hallway.doorTargets.fill(0);
  }
}

/**
 * Verifies if a main hallway actually exists at the absolute physical grid alignment 
 * of a specific originating hallway door slot.
 */
function doesMainHallwayExistAtCoordinates(originatingHallwayIdx, destinationHallwayIdx, doorIndex) {
  const state = window.My3dMazeAppState;
  if (!state || !state.WorldGrid || !state.WorldGrid.mainHallways) return false;

  const originHallway = state.WorldGrid.mainHallways[originatingHallwayIdx];
  const destHallway = state.WorldGrid.mainHallways[destinationHallwayIdx];
  if (!originHallway || !destHallway) return false;

  // 1. Calculate the absolute global X position of the originating door from 'S'
  const globalDoorX = originHallway.startOffsetFromS + doorIndex;

  // 2. Translate that global X position back into the destination hallway's local space
  const localDestX = globalDoorX - destHallway.startOffsetFromS;

  // 3. To hit an actual door on the destination hallway, localDestX must land 
  //    perfectly on an integer index from 0 to 4 (matching your UNIFORM_2D_DOORS positions)
  if (localDestX >= 0 && localDestX <= 4 && Number.isInteger(localDestX)) {
    return true;
  }

  return false;
}

/**
 * Ensures 10 smoke particles exist and updates their positions.
 */
function updateVoidSmokeState() {
  const state = window.My3dMazeAppState;
  if (!state) return;

  // Initialize particles if empty
  if (state.smokeParticles.length === 0) {
    for (let i = 0; i < 10; i++) {
      state.smokeParticles.push(createNewSmokeParticle(true));
    }
  }

  // Animate particles
  state.smokeParticles.forEach(p => {
    p.y -= p.vy;         // Float upward
    p.x += p.vx;         // Drift sideways
    p.radius += 0.2;     // Expand size
    p.opacity -= 0.005;  // Fade out

    // Respawn at bottom if completely faded or out of frame bounds
    if (p.opacity <= 0) {
      Object.assign(p, createNewSmokeParticle(false));
    }
  });
}

function createNewSmokeParticle(randomInitialAge = false) {
  return {
    x: Math.random(), // Normalized 0.0 to 1.0 inside door frame width
    y: 0.8 + Math.random() * 0.2, // Start near the bottom edge
    radius: 10 + Math.random() * 20,
    vx: (Math.random() - 0.5) * 0.005,
    vy: 0.002 + Math.random() * 0.004,
    opacity: randomInitialAge ? Math.random() : 1.0
  };
}

/**
 * Dynamically resolves and returns the true active hallway object 
 * based on the player's real-time spatial position and movement mode.
 * @returns {Object|null} The current active main hallway structure.
 */
function getTrueActiveHallway() {
  const state = window.My3dMazeAppState;
  if (!state || !state.WorldGrid || !state.user) return null;

  // If navigating a tunnel, calculate proximity to the connected hallways
  if (state.user.movementMode === 'interconnecting') {
    const activeTunnel = findActiveTunnel();
    if (activeTunnel) {
      // 1.6 is the exact halfway point of a 3.20 length tunnel
      const trueIndex = (state.user.interconnectingProgress >= 1.6) 
        ? activeTunnel.toHallwayIndex 
        : activeTunnel.fromHallwayIndex;
        
      return state.WorldGrid.mainHallways[trueIndex] || state.activeHallway;
    }
  }

  // Fallback to the standard active hallway context for normal/transition modes
  return state.activeHallway;
}

/**
 * Resolves absolute compass integers into a unified, semantic language string.
 * This completely isolates the calling engine from tracking numeric dimensions.
 * @returns {string} 'forward' | 'backward' | 'left' | 'right'
 */
function getRelativeViewOrientation() {
  const state = window.My3dMazeAppState;
  if (!state || !state.user) return 'forward';

  const userDir = state.user.direction;
  const mode = state.user.movementMode;

  // Real-time calculation when the player is traveling inside a tunnel link
  if (mode === 'interconnecting') {
    const activeTunnel = findActiveTunnel();
    if (activeTunnel) {
      // Is our compass direction aligned with the tunnel's forward vector?
      if (userDir === activeTunnel.direction) return 'forward';
      if (Math.abs(userDir - activeTunnel.direction) === 2) return 'backward';
      
      // If we are looking at the tunnel's side walls
      return userDir === 0 ? 'left' : 'right'; 
    }
  }

  // Real-time calculation when the player is navigating a Main Hallway
  if (userDir === 0) return 'forward';
  if (userDir === 2) return 'backward';
  return userDir === 3 ? 'left' : 'right';
}


// Global window exposure updated with the newly established callers!
window.MazeInterface = {
  isTunnel: isTunnelStructure,
  getOpenStatus: getStructureDoorOpenStatus,
  getTarget: getStructureDoorTarget,
  toggleTarget: toggleStructureDoorTarget,
  getCurrentNodeIndex: getCurrentNodeIndex,
  findActiveTunnel: findActiveTunnel,
  stepAnimation: stepStructureDoorAnimation,
  
  // NEW FACADE METHOD ADDITIONS
  hasTunnelAtCurrentNode: hasTunnelAtCurrentNode,
  getNormalizedTunnelContext: getNormalizedTunnelContext,
  setActiveHallwayByIndex: setActiveHallwayByIndex,
  resetAllDoors: resetAllDoors,
  doesMainHallwayExistAtCoordinates: doesMainHallwayExistAtCoordinates,
  updateVoidSmokeState: updateVoidSmokeState,
  getTrueActiveHallway: getTrueActiveHallway,
  getRelativeViewOrientation: getRelativeViewOrientation,
};
