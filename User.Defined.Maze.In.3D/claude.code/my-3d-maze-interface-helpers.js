//my-3d-maze-interface-helpers.js// my-3d-maze-interface-helpers.js
// =========================================================================
// STRUCTURAL COUPLING ADAPTERS (The Object Interface)
// =========================================================================

// =========================================================================
// DIRECTION SEMANTIC COMPASS MAPPINGS
// =========================================================================
const COMPASS_2D_MAP = {
  0: "East",
  1: "South",
  2: "West",
  3: "North"
};

const COMPASS_SYMBOL_MAP = {
  0: "▶",
  1: "▼",
  2: "◀",
  3: "▲"
};

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
 * using absolute global positions, allowing lookup from either connected hallway.
 */
function findActiveTunnel() {
  const state = window.My3dMazeAppState;
  if (!state || !state.WorldGrid || !state.activeHallway || !state.user) return null;

  // 1. If there are no tunnels in the array at all, return null immediately
  if (!state.WorldGrid.interconnectingHallways || state.WorldGrid.interconnectingHallways.length === 0) {
    return null;
  }

  // When already inside a tunnel, return it by stored index. This avoids false matches
  // when two tunnels share the same global X column (inline tunnels on adjacent hallways).
  if (state.user.movementMode === 'interconnecting') {
    const idx = state.user.activeTunnelIndex;
    if (idx >= 0 && idx < state.WorldGrid.interconnectingHallways.length) {
      return state.WorldGrid.interconnectingHallways[idx];
    }
  }

  // 2. Determine local door data index
  let doorDataIdx = getCurrentNodeIndex();
  if (doorDataIdx === -1) {
    const doorNodes = [0, 2, 4, 6, 8];
    doorDataIdx = doorNodes.indexOf(state.user.nodeIndex);
  }
  if (doorDataIdx === -1) return null;

  const currentHallwayIdx = state.WorldGrid.mainHallways.findIndex(h => h.id === state.activeHallway.id);
  const currentHallway = state.WorldGrid.mainHallways[currentHallwayIdx];
  if (!currentHallway) return null;

  // 3. Compute the absolute global X coordinate on the universe grid axis
  const globalX = currentHallway.startOffsetFromS + doorDataIdx;

  // Direction guard only applies from a hallway (normal mode). When the player is
  // already inside the tunnel (interconnecting mode), any facing direction is valid —
  // we identify the tunnel by position alone.
  const applyDirectionGuard = state.user.movementMode !== 'interconnecting';

  // 4. Scan for any tunnel that physically links to this location from either side
  return state.WorldGrid.interconnectingHallways.find(conn => {
    // Only check tunnels that involve our current hallway
    if (conn.fromHallwayIndex !== currentHallwayIdx && conn.toHallwayIndex !== currentHallwayIdx) {
      return false;
    }

    const fromHallway = state.WorldGrid.mainHallways[conn.fromHallwayIndex];
    if (!fromHallway) return false;

    // The absolute X coordinate where this specific tunnel is located
    const connGlobalX = fromHallway.startOffsetFromS + conn.doorIndex;

    if (connGlobalX !== globalX) return false;

    // When inside the tunnel, position match alone is sufficient.
    if (!applyDirectionGuard) return true;

    // When in a hallway, only match if the player faces the side the tunnel is on.
    const playerDir = state.user.direction;
    if (currentHallwayIdx === conn.fromHallwayIndex) return playerDir === conn.direction;
    if (currentHallwayIdx === conn.toHallwayIndex)   return playerDir !== conn.direction;

    return false;
  }) || null;
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
 * Uses our position-agnostic global lookup.
 * @returns {boolean}
 */
function hasTunnelAtCurrentNode() {
  return findActiveTunnel() !== null;
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
 * Smart master reset: Instantly closes all doors for the currently active hallway 
 * AND any active interconnecting tunnel link the player is currently near or inside.
 */
function resetAllDoors() {
  const state = window.My3dMazeAppState;
  if (!state) return;

  // 1. Automatically locate and clear the anchored main hallway
  if (state.activeHallway) {
    if (state.activeHallway.doorOpenStatus) state.activeHallway.doorOpenStatus.fill(0);
    if (state.activeHallway.doorTargets) state.activeHallway.doorTargets.fill(0);
  }

  // 2. Automatically locate and clear the tunnel (if inside one, or standing at an entrance)
  const activeTunnel = findActiveTunnel();
  if (activeTunnel) {
    activeTunnel.entranceDoorTarget = 0;
    activeTunnel.entranceDoorOpenStatus = 0;
    activeTunnel.exitDoorTarget = 0;
    activeTunnel.exitDoorOpenStatus = 0;
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

/**
 * Returns true if the player is looking off the edge of the known universe map.
 */
function isSideViewFacingVoid() {
  const state = window.My3dMazeAppState;
  if (!state || !state.WorldGrid || !state.activeHallway || !state.user) return false;

  const view = getRelativeViewOrientation();
  const currentHallwayIdx = state.WorldGrid.mainHallways.findIndex(h => h.id === state.activeHallway.id);

  // Left side boundary check (West wall index 0)
  if (view === 'left' && currentHallwayIdx === 0) return true;
  // Right side boundary check (East wall index 6)
  if (view === 'right' && currentHallwayIdx === 6) return true;

  return false;
}

/**
 * Returns true if a tunnel exists matching the current doorway slot node sequence,
 * properly acknowledging links regardless of whether this is the 'from' or 'to' hallway.
 */
function isSideViewFacingTunnel(nodeIndex) {
  const state = window.My3dMazeAppState;
  if (!state || !state.WorldGrid || !state.activeHallway || !state.user) return false;

  const currentHallwayIdx = state.WorldGrid.mainHallways.findIndex(h => h.id === state.activeHallway.id);
  const currentHallway = state.WorldGrid.mainHallways[currentHallwayIdx];
  if (!currentHallway) return false;

  // 1. Compute absolute global X coordinate for the queried door slot
  const globalX = currentHallway.startOffsetFromS + nodeIndex;

  // 2. Scan for any registered tunnel whose absolute global position matches our current slot
  return state.WorldGrid.interconnectingHallways.some(conn => {
    // Only consider the tunnel if the current hallway is part of its connection pair
    if (conn.fromHallwayIndex !== currentHallwayIdx && conn.toHallwayIndex !== currentHallwayIdx) {
      return false;
    }

    const fromHallway = state.WorldGrid.mainHallways[conn.fromHallwayIndex];
    if (!fromHallway) return false;

    // Calculate the absolute global X position where this tunnel was original spawned
    const connGlobalX = fromHallway.startOffsetFromS + conn.doorIndex;

    if (connGlobalX !== globalX) return false;

    // Only match if the player is facing the side the tunnel is actually on.
    const playerDir = state.user.direction;
    if (currentHallwayIdx === conn.fromHallwayIndex) return playerDir === conn.direction;
    if (currentHallwayIdx === conn.toHallwayIndex)   return playerDir !== conn.direction;

    return false;
  });
}

/**
 * Clean layout checker for drawInterconnectingPerspective.
 * Validates map topology when standing inside a tunnel staring at the end door.
 */
function doesMainHallwayExistAtTunnelTerminal(activeLink, view) {
  if (!activeLink) return false;

  const state = window.My3dMazeAppState;
  if (!state || !state.WorldGrid || !state.WorldGrid.mainHallways) return false;

  // We are looking forward through the tunnel toward the destination
  if (view === 'forward') {
    return doesMainHallwayExistAtCoordinates(
      activeLink.fromHallwayIndex, 
      activeLink.toHallwayIndex, 
      activeLink.doorIndex
    );
  }

  // We are looking backward through the tunnel toward where it spawned.
  // The original doorway slot is ALREADY on the fromHallwayIndex track!
  // We simply verify that the originating hallway structure itself is valid.
  if (view === 'backward') {
    const originHallway = state.WorldGrid.mainHallways[activeLink.fromHallwayIndex];
    return !!originHallway;
  }

  return false;
}

/**
 * Instantly exits the player from a tunnel structure directly onto the destination 
 * hallway's center line, dynamically calculating the alignment by global position.
 */
function exitTunnelToCorridor() {
  const state = window.My3dMazeAppState;
  if (!state || !state.user) return;

  const user = state.user;
  const activeTunnel = findActiveTunnel();
  if (!activeTunnel) return;

  const viewOrientation = getRelativeViewOrientation();

  if (!doesAnyStructureExistAtTunnelTerminal(activeTunnel, viewOrientation)) {
    // Literal edge of the universe. Keep them locked inside the tube.
    if (user.interconnectingProgress >= 1.6) {
      user.interconnectingProgress = 3.16;
    } else {
      user.interconnectingProgress = 0.04;
    }

    if (window.My3dMazeDiagnostics && typeof window.My3dMazeDiagnostics.logHistoryEvent === 'function') {
      window.My3dMazeDiagnostics.logHistoryEvent('🕳️');
    }
    user.flashFrames = 5;
    return; // Hard Abort
  }
  
  // If a hallway is there, handle normal hallway transition logic
  if (doesMainHallwayExistAtTunnelTerminal(activeTunnel, viewOrientation)) {
    let targetHallwayIdx = activeTunnel.fromHallwayIndex;
    let localDoorIdx = activeTunnel.doorIndex;

    if (user.interconnectingProgress >= 1.6) {
      targetHallwayIdx = activeTunnel.toHallwayIndex;
      const fromHallway = state.WorldGrid.mainHallways[activeTunnel.fromHallwayIndex];
      const toHallway = state.WorldGrid.mainHallways[activeTunnel.toHallwayIndex];
      if (fromHallway && toHallway) {
        const globalX = fromHallway.startOffsetFromS + activeTunnel.doorIndex;
        localDoorIdx = globalX - toHallway.startOffsetFromS;
      }
    }

    const targetHallway = state.WorldGrid.mainHallways[targetHallwayIdx];
    if (!targetHallway) return;

    activeTunnel.entranceDoorTarget = 0;
    activeTunnel.entranceDoorOpenStatus = 0;
    activeTunnel.exitDoorTarget = 0;
    activeTunnel.exitDoorOpenStatus = 0;

    state.activeHallway = targetHallway;
    user.movementMode = 'normal';
    user.interconnectingProgress = 0.0;
    user.transitionProgress = 0.0;
    user.activeTunnelIndex = -1;

    const nodeIndex = localDoorIdx * 2;
    user.nodeIndex = nodeIndex;
    if (targetHallway.nodes && targetHallway.nodes[nodeIndex] !== undefined) {
      user.forwardOffset = targetHallway.nodes[nodeIndex];
    }

    if (targetHallway.doorOpenStatus) targetHallway.doorOpenStatus.fill(0);
    if (targetHallway.doorTargets) targetHallway.doorTargets.fill(0);
  } else {
    // Tunnel-to-tunnel chaining not yet implemented. Block and flash.
    if (user.interconnectingProgress >= 1.6) user.interconnectingProgress = 3.16;
    else user.interconnectingProgress = 0.04;
    user.flashFrames = 5;
  }
}

/**
 * Advanced layout checker for tunnel exits.
 * Validates if ANY solid structure (Hallway OR another Tunnel) exists on the other side.
 */
function doesAnyStructureExistAtTunnelTerminal(activeLink, view) {
  if (!activeLink) return false;

  const state = window.My3dMazeAppState;
  if (!state || !state.WorldGrid) return false;

  // 1. First, check if a standard hallway is there
  const hallwayExists = doesMainHallwayExistAtTunnelTerminal(activeLink, view);
  if (hallwayExists) return true;

  // 2. FUTURE-PROOFING: Check if a chained tunnel link is attached here instead!
  // Determine the absolute global X coordinate where this tunnel segment ends
  let exitGlobalX = 0;
  const fromHallway = state.WorldGrid.mainHallways[activeLink.fromHallwayIndex];
  
  if (fromHallway) {
    exitGlobalX = fromHallway.startOffsetFromS + activeLink.doorIndex;
  }

  // A chained tunnel must connect on the correct terminal side, not just share the same X column.
  // For 'forward': the other tunnel must touch activeLink.toHallwayIndex.
  // For 'backward': the other tunnel must touch activeLink.fromHallwayIndex.
  const relevantSideIndex = view === 'forward' ? activeLink.toHallwayIndex : activeLink.fromHallwayIndex;

  const chainedTunnelExists = state.WorldGrid.interconnectingHallways.some(otherTunnel => {
    // Ignore the tunnel we are currently standing inside
    if (otherTunnel === activeLink) return false;

    const otherFromHallway = state.WorldGrid.mainHallways[otherTunnel.fromHallwayIndex];
    if (!otherFromHallway) return false;

    const otherGlobalX = otherFromHallway.startOffsetFromS + otherTunnel.doorIndex;
    if (otherGlobalX !== exitGlobalX) return false;

    return otherTunnel.fromHallwayIndex === relevantSideIndex
        || otherTunnel.toHallwayIndex === relevantSideIndex;
  });

  return chainedTunnelExists;
}

/**
 * Centralized proxy to update player orientation, sync string tags, and append metrics.
 * @param {number} newDirection - Integer index (0-3).
 * @param {string|null} actionSymbol - '↺' or '↻' to construct historical logs.
 */
function updateUserDirection(newDirection, actionSymbol = null) {
  const state = window.My3dMazeAppState;
  if (!state || !state.user) return;

  state.user.direction = newDirection;
  state.user.directionString = COMPASS_2D_MAP[newDirection] || "Unknown";

  // Append compound turn string (e.g., "↺◀") cleanly onto diagnostic logs
  if (actionSymbol && window.My3dMazeDiagnostics && typeof window.My3dMazeDiagnostics.logHistoryEvent === 'function') {
    window.My3dMazeDiagnostics.logHistoryEvent(`${actionSymbol}`);
  }
}

/**
 * Force-configures baseline startup direction definitions when the file loads.
 */
function initializeStartupDirection() {
  const state = window.My3dMazeAppState;
  if (!state || !state.user) return;

  state.user.directionString = COMPASS_2D_MAP[state.user.direction] || "North";
  
  if (state.DiagnosticHistory) {
    state.DiagnosticHistory.initialPlayerState.spawnedDirection = state.user.direction;
    state.DiagnosticHistory.initialPlayerState.spawnedDirectionString = state.user.directionString;
  }
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
  doesAnyStructureExistAtTunnelTerminal: doesAnyStructureExistAtTunnelTerminal,
  updateVoidSmokeState: updateVoidSmokeState,
  getTrueActiveHallway: getTrueActiveHallway,
  getRelativeViewOrientation: getRelativeViewOrientation,
  isSideViewFacingVoid: isSideViewFacingVoid,
  isSideViewFacingTunnel: isSideViewFacingTunnel,
  doesMainHallwayExistAtTunnelTerminal: doesMainHallwayExistAtTunnelTerminal,
  exitTunnelToCorridor: exitTunnelToCorridor,
  updateUserDirection: updateUserDirection,
  initializeStartupDirection: initializeStartupDirection
};
