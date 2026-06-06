//my-3d-maze-interface-helpers.js// my-3d-maze-interface-helpers.js
// =========================================================================
// STRUCTURAL COUPLING ADAPTERS (The Object Interface)
// =========================================================================

// =========================================================================
// TUNNEL TOPOLOGY — re-aliased from maze-tunnel-topology.js
// =========================================================================
const findActiveTunnel                      = window.MazeTunnelTopology.findActiveTunnel;
const hasTunnelAtCurrentNode                = window.MazeTunnelTopology.hasTunnelAtCurrentNode;
const getNormalizedTunnelContext            = window.MazeTunnelTopology.getNormalizedTunnelContext;
const doesMainHallwayExistAtCoordinates     = window.MazeTunnelTopology.doesMainHallwayExistAtCoordinates;
const getTrueActiveHallway                  = window.MazeTunnelTopology.getTrueActiveHallway;
const getRelativeViewOrientation            = window.MazeTunnelTopology.getRelativeViewOrientation;
const isSideViewFacingVoid                  = window.MazeTunnelTopology.isSideViewFacingVoid;
const isSideViewFacingTunnel                = window.MazeTunnelTopology.isSideViewFacingTunnel;
const doesMainHallwayExistAtTunnelTerminal  = window.MazeTunnelTopology.doesMainHallwayExistAtTunnelTerminal;
const exitTunnelToCorridor                  = window.MazeTunnelTopology.exitTunnelToCorridor;
const doesAnyStructureExistAtTunnelTerminal = window.MazeTunnelTopology.doesAnyStructureExistAtTunnelTerminal;
const isTunnelTerminalVoid                  = window.MazeTunnelTopology.isTunnelTerminalVoid;

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
 * Records a hallway as visited so the 2D minimap can reveal it.
 */
function markHallwayVisited(hallwayId) {
  const state = window.My3dMazeAppState;
  if (!state || !state.WorldGrid || !hallwayId) return;
  if (!state.WorldGrid.visitedHallwayIds.includes(hallwayId)) {
    state.WorldGrid.visitedHallwayIds.push(hallwayId);
  }
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
  markHallwayVisited(state.activeHallway.id);
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



/**
 * Immediately forces a door to a target value (0 = closed, 1 = open),
 * setting both the target and the current open status with no animation.
 * @param {Object} structure - Main hallway or tunnel link.
 * @param {string|number} context - 'entrance'/'exit' for tunnels; numeric index for hallways.
 * @param {number} value - 0 to close, 1 to open.
 */
function setDoorStateImmediate(structure, context, value) {
  if (!structure) return;
  const v = value ? 1 : 0;

  if (isTunnelStructure(structure)) {
    if (context === 'exit') {
      structure.exitDoorTarget = v;
      structure.exitDoorOpenStatus = v;
    } else {
      structure.entranceDoorTarget = v;
      structure.entranceDoorOpenStatus = v;
    }
    return;
  }

  if (structure.doorTargets && structure.doorOpenStatus && structure.doorTargets[context] !== undefined) {
    structure.doorTargets[context] = v;
    structure.doorOpenStatus[context] = v;
  }
}

// =========================================================================
// SHARED UTILITIES
// =========================================================================

function snapToNearestNodeIndex(offset, hallwayModel) {
  let closestIdx = 0;
  let minDiff = Math.abs(offset - hallwayModel.nodes[0]);
  for (let i = 1; i < hallwayModel.nodes.length; i++) {
    const diff = Math.abs(offset - hallwayModel.nodes[i]);
    if (diff < minDiff) { minDiff = diff; closestIdx = i; }
  }
  return closestIdx;
}

// =========================================================================
// MAZE WORLD BUILDERS
// =========================================================================

function createHallway(id, farLabel, nearLabel, farColor, nearColor, leftDoorColor, rightDoorColor) {
  const state = window.My3dMazeAppState;
  return {
    id: id,
    farWallLabel: farLabel,
    nearWallLabel: nearLabel,
    farWallColor: farColor,
    nearWallColor: nearColor,
    leftSideDoorColor: leftDoorColor,
    rightSideDoorColor: rightDoorColor,
    baseDistances: [1.1, 1.6, 2.4, 3.8, 6.5, 12.0],
    nodes: [...state.ENGINE_3D_NODES],
    doorOpenStatus: [0, 0, 0, 0, 0],
    doorTargets: [0, 0, 0, 0, 0],
    startOffsetFromS: 0
  };
}

function createMainHallway(id, orderIndex) {
  const state = window.My3dMazeAppState;
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
  const WorldGrid = window.My3dMazeAppState.WorldGrid;
  WorldGrid.mainHallways = [];
  for (let i = 0; i < 7; i++) {
    WorldGrid.mainHallways.push(createMainHallway('H' + (i + 1), i));
  }
}

function createInterconnectingHallway() {
  const state = window.My3dMazeAppState;
  const user = state.user;
  const WorldGrid = state.WorldGrid;

  if (!state.activeHallway || (user.direction !== 1 && user.direction !== 3)) return;

  const currentDoorIdx = window.MazeInterface.getCurrentNodeIndex();
  if (currentDoorIdx === -1) return;

  const currentHallwayIdx = WorldGrid.mainHallways.findIndex(h => h.id === state.activeHallway.id);
  const targetHallwayIdx = user.direction === 3 ? currentHallwayIdx - 1 : currentHallwayIdx + 1;

  if (targetHallwayIdx < 0 || targetHallwayIdx >= WorldGrid.mainHallways.length) return;

  if (window.MazeInterface.hasTunnelAtCurrentNode()) return;

  WorldGrid.interconnectingHallways.push({
    fromHallwayIndex: currentHallwayIdx,
    toHallwayIndex: targetHallwayIdx,
    doorIndex: currentDoorIdx,
    direction: user.direction,
    entranceDoorTarget: 1,
    entranceDoorOpenStatus: 1.0,
    exitDoorTarget: 0,
    exitDoorOpenStatus: 0.0
  });

  // Erase stale "empty door" ball memory on both sides — the ball may have
  // checked this door before this tunnel existed and recorded it as blocked.
  if (state.ballMemory) {
    const gx = state.activeHallway.startOffsetFromS + currentDoorIdx;
    delete state.ballMemory.blocked[_ballMemKey(state.activeHallway.id, gx, null)];
    const destHallway = WorldGrid.mainHallways[targetHallwayIdx];
    if (destHallway) {
      delete state.ballMemory.blocked[_ballMemKey(destHallway.id, gx, null)];
    }
  }
}

function createChainedTunnelFromDeadEnd() {
  const state = window.My3dMazeAppState;
  const user = state.user;
  const WorldGrid = state.WorldGrid;

  const activeTunnel = window.MazeInterface.findActiveTunnel();
  if (!activeTunnel) return;

  if (user.direction !== activeTunnel.direction) return;
  if (user.interconnectingProgress < 3.10) return;
  if (activeTunnel.exitDoorOpenStatus <= 0.95) return;
  if (window.MazeInterface.doesMainHallwayExistAtTunnelTerminal(activeTunnel, 'forward')) return;
  if (activeTunnel.forwardChainIndex !== undefined && activeTunnel.forwardChainIndex >= 0) return;

  const newFromIdx = activeTunnel.toHallwayIndex;
  const newToIdx = activeTunnel.direction === 1 ? newFromIdx + 1 : newFromIdx - 1;

  if (newToIdx < 0 || newToIdx >= WorldGrid.mainHallways.length) {
    user.flashFrames = 5;
    return;
  }

  const newDoorIdx = activeTunnel.doorIndex;
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
  activeTunnel.forwardChainIndex = WorldGrid.interconnectingHallways.length - 1;

  // Erase stale "empty door" ball memory on both sides of the new chain segment.
  if (state.ballMemory) {
    const fromHallway = WorldGrid.mainHallways[newFromIdx];
    if (fromHallway) {
      delete state.ballMemory.blocked[_ballMemKey(fromHallway.id, chainGlobalX, null)];
    }
    const toHallway = WorldGrid.mainHallways[newToIdx];
    if (toHallway) {
      delete state.ballMemory.blocked[_ballMemKey(toHallway.id, chainGlobalX, null)];
    }
  }

  if (window.My3dMazeDiagnostics && typeof window.My3dMazeDiagnostics.logHistoryEvent === 'function') {
    window.My3dMazeDiagnostics.logHistoryEvent('🛠️⛓️');
  }
}

// =========================================================================
// BALL SESSION MEMORY ACCESSORS
// =========================================================================

// =========================================================================
// BALL AI INTERFACE — world queries and mutations for ball-movement-controller
// All direct state access lives here; the ball controller calls these only.
// =========================================================================

function getHallwayById(id) {
  const state = window.My3dMazeAppState;
  if (!state || !state.WorldGrid) return null;
  return state.WorldGrid.mainHallways.find(h => h.id === id) || null;
}

function getHallwayIndex(id) {
  const state = window.My3dMazeAppState;
  if (!state || !state.WorldGrid) return -1;
  return state.WorldGrid.mainHallways.findIndex(h => h.id === id);
}

function getHallwayByIndex(idx) {
  const state = window.My3dMazeAppState;
  if (!state || !state.WorldGrid) return null;
  return state.WorldGrid.mainHallways[idx] || null;
}

function getTunnelFrom(hallwayIndex, doorIndex) {
  const state = window.My3dMazeAppState;
  if (!state || !state.WorldGrid) return null;
  return state.WorldGrid.interconnectingHallways.find(
    c => c.fromHallwayIndex === hallwayIndex && c.doorIndex === doorIndex
  ) || null;
}

function getTunnelByIndex(idx) {
  const state = window.My3dMazeAppState;
  if (!state || !state.WorldGrid) return null;
  return state.WorldGrid.interconnectingHallways[idx] || null;
}

function getTunnelIndex(link) {
  const state = window.My3dMazeAppState;
  if (!state || !state.WorldGrid || !link) return -1;
  return state.WorldGrid.interconnectingHallways.indexOf(link);
}

function getTunnelGlobalX(link) {
  if (!link) return 0;
  if (link.chainGlobalX !== undefined) return link.chainGlobalX;
  const fh = getHallwayByIndex(link.fromHallwayIndex);
  return fh ? fh.startOffsetFromS + link.doorIndex : link.doorIndex;
}

function getUserForwardOffset() {
  const state = window.My3dMazeAppState;
  return (state && state.user) ? state.user.forwardOffset : 0;
}

function getUserMovementMode() {
  const state = window.My3dMazeAppState;
  return (state && state.user) ? state.user.movementMode : 'normal';
}

function getUserActiveTunnelIndex() {
  const state = window.My3dMazeAppState;
  return (state && state.user) ? state.user.activeTunnelIndex : -1;
}

function getUserInterconnectingProgress() {
  const state = window.My3dMazeAppState;
  return (state && state.user) ? state.user.interconnectingProgress : 0;
}

function setUserFlashFrames(n) {
  const state = window.My3dMazeAppState;
  if (state && state.user) state.user.flashFrames = n;
}

function requestDoorOpen(hallway, di) {
  if (hallway && hallway.doorTargets) hallway.doorTargets[di] = 1;
}

function requestDoorClose(hallway, di) {
  if (hallway && hallway.doorTargets) hallway.doorTargets[di] = 0;
}

function spawnBall(spawnHallway) {
  const state = window.My3dMazeAppState;
  if (!state || !spawnHallway || state.rollingBall) return;
  state.rollingBall = {
    offset:          spawnHallway.nodes[spawnHallway.nodes.length - 1],
    speed:           state.BASE_SPEED,
    rotation:        0,
    hallwayId:       spawnHallway.id,
    direction:       -1,
    targetDoorIndex: null,
    movementMode:    'hallway',
    tunnelLink:      null,
    tunnelProgress:  0,
    waitingAtNode:   null,
    waitFrames:      0,
    _seenHallwayId:  null,
    _seenTunnelIdx:  -1,
    _coiCooldown:    0,
    tunnelReverse:   false,
  };
}

function destroyBall() {
  const state = window.My3dMazeAppState;
  if (state) state.rollingBall = null;
}

// Finds any tunnel whose mouth touches gx in hallwayIndex — from either the
// entrance OR exit side, mirroring the bidirectional check in isSideViewFacingTunnel.
// Returns { link, reverse: false } if ball is at the entrance,
//         { link, reverse: true  } if ball is at the exit (reverse traversal needed),
//         or null if no tunnel is present.
function findTunnelAtDoor(hallwayIndex, gx) {
  const state = window.My3dMazeAppState;
  if (!state || !state.WorldGrid) return null;

  const currentHallway = state.WorldGrid.mainHallways[hallwayIndex];
  if (!currentHallway) return null;

  const matches = [];

  for (const conn of state.WorldGrid.interconnectingHallways) {
    if (conn.fromHallwayIndex !== hallwayIndex && conn.toHallwayIndex !== hallwayIndex) continue;

    const fromHallway = state.WorldGrid.mainHallways[conn.fromHallwayIndex];
    if (!fromHallway) continue;

    const connGlobalX = (conn.chainGlobalX !== undefined)
      ? conn.chainGlobalX
      : fromHallway.startOffsetFromS + conn.doorIndex;

    if (conn.fromHallwayIndex === hallwayIndex) {
      if (connGlobalX === gx) {
        const destHallway = state.WorldGrid.mainHallways[conn.toHallwayIndex];
        matches.push({ link: conn, reverse: false, destId: destHallway ? destHallway.id : null });
      }
    } else {
      const toHallway = state.WorldGrid.mainHallways[conn.toHallwayIndex];
      if (!toHallway) continue;
      const rawIdx = Math.round(connGlobalX - toHallway.startOffsetFromS);
      if (rawIdx >= 0 && rawIdx <= 4 && toHallway.startOffsetFromS + rawIdx === gx) {
        // No reverseArrivalIdx guard: chain dead-end handling will hop back through
        // the chain even if intermediate hallways have out-of-range landing positions.
        matches.push({ link: conn, reverse: true, destId: fromHallway.id });
      }
    }
  }

  if (matches.length === 0) return null;
  if (matches.length === 1) return { link: matches[0].link, reverse: matches[0].reverse };

  // Multiple tunnels share this gx — pick the least-visited destination.
  // Ties broken randomly so the ball doesn't always prefer the same one.
  const opened = (state.ballMemory && state.ballMemory.opened) || {};
  let minCount = Infinity;
  let minMatches = [];
  for (const m of matches) {
    const count = m.destId ? (opened[_ballMemKey(currentHallway.id, gx, m.destId)] || 0) : 0;
    if (count < minCount) { minCount = count; minMatches = [m]; }
    else if (count === minCount) { minMatches.push(m); }
  }

  const chosen = minMatches[Math.floor(Math.random() * minMatches.length)];
  return { link: chosen.link, reverse: chosen.reverse };
}

// =========================================================================

function _ballMemKey(hallwayId, gx, toHallwayId) {
  return `${hallwayId}:gx${gx}→${toHallwayId}`;
}

function recordBallEntry(hallwayId, gx, toHallwayId) {
  const state = window.My3dMazeAppState;
  if (!state || !state.ballMemory) return;
  const k = _ballMemKey(hallwayId, gx, toHallwayId);
  state.ballMemory.opened[k] = (state.ballMemory.opened[k] || 0) + 1;
  // Also write a destination-agnostic key so getEntryCount(id, gx, null) works
  // as a "was this door ever used as a tunnel entrance" check.
  const kAny = _ballMemKey(hallwayId, gx, null);
  state.ballMemory.opened[kAny] = (state.ballMemory.opened[kAny] || 0) + 1;
}

function recordBallBlock(hallwayId, gx, toHallwayId) {
  const state = window.My3dMazeAppState;
  if (!state || !state.ballMemory) return;
  const k = _ballMemKey(hallwayId, gx, toHallwayId);
  state.ballMemory.blocked[k] = (state.ballMemory.blocked[k] || 0) + 1;
}

function getBallEntryCount(hallwayId, gx, toHallwayId) {
  const state = window.My3dMazeAppState;
  if (!state || !state.ballMemory) return 0;
  return state.ballMemory.opened[_ballMemKey(hallwayId, gx, toHallwayId)] || 0;
}

function getBallBlockCount(hallwayId, gx, toHallwayId) {
  const state = window.My3dMazeAppState;
  if (!state || !state.ballMemory) return 0;
  return state.ballMemory.blocked[_ballMemKey(hallwayId, gx, toHallwayId)] || 0;
}

function getBallMemorySnapshot() {
  const state = window.My3dMazeAppState;
  if (!state || !state.ballMemory) return { opened: {}, blocked: {} };
  return {
    opened:  Object.assign({}, state.ballMemory.opened),
    blocked: Object.assign({}, state.ballMemory.blocked)
  };
}

function getBallMemorySummaryText() {
  const state = window.My3dMazeAppState;
  if (!state || !state.ballMemory) return '(no ball memory)';
  const allKeys = new Set([
    ...Object.keys(state.ballMemory.opened),
    ...Object.keys(state.ballMemory.blocked)
  ]);
  if (allKeys.size === 0) return '(no door interactions recorded yet)';
  return Array.from(allKeys).sort().map(k => {
    const o = state.ballMemory.opened[k]  || 0;
    const b = state.ballMemory.blocked[k] || 0;
    return `${k}  ✓${o}  ✗${b}`;
  }).join('\n');
}

function getChainPredecessor(link) {
  const state = window.My3dMazeAppState;
  if (!state || !state.WorldGrid || !link) return null;
  const idx = state.WorldGrid.interconnectingHallways.indexOf(link);
  if (idx < 0) return null;
  return state.WorldGrid.interconnectingHallways.find(t => t.forwardChainIndex === idx) || null;
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
  initializeStartupDirection: initializeStartupDirection,
  isTunnelTerminalVoid: isTunnelTerminalVoid,
  setDoorStateImmediate: setDoorStateImmediate,
  getRollingBall: function() {
    const state = window.My3dMazeAppState;
    return state ? state.rollingBall : null;
  },
  getSmokeParticles: function() {
    const state = window.My3dMazeAppState;
    return state ? state.smokeParticles : null;
  },
  getCheatMapVisible: function() {
    const state = window.My3dMazeAppState;
    return state ? !!state.cheatMapVisible : false;
  },
  initializeAllMainHallways: initializeAllMainHallways,
  createInterconnectingHallway: createInterconnectingHallway,
  createChainedTunnelFromDeadEnd: createChainedTunnelFromDeadEnd,
  snapToNearestNodeIndex: snapToNearestNodeIndex,
  recordBallEntry: recordBallEntry,
  recordBallBlock: recordBallBlock,
  getBallEntryCount: getBallEntryCount,
  getBallBlockCount: getBallBlockCount,
  getBallMemorySnapshot: getBallMemorySnapshot,
  getBallMemorySummaryText: getBallMemorySummaryText,

  // Ball AI interface
  getHallwayById: getHallwayById,
  getHallwayIndex: getHallwayIndex,
  getHallwayByIndex: getHallwayByIndex,
  getTunnelFrom: getTunnelFrom,
  getTunnelByIndex: getTunnelByIndex,
  getTunnelIndex: getTunnelIndex,
  getTunnelGlobalX: getTunnelGlobalX,
  getUserForwardOffset: getUserForwardOffset,
  getUserMovementMode: getUserMovementMode,
  getUserActiveTunnelIndex: getUserActiveTunnelIndex,
  getUserInterconnectingProgress: getUserInterconnectingProgress,
  setUserFlashFrames: setUserFlashFrames,
  requestDoorOpen: requestDoorOpen,
  requestDoorClose: requestDoorClose,
  spawnBall: spawnBall,
  destroyBall: destroyBall,
  findTunnelAtDoor: findTunnelAtDoor,
  getChainPredecessor: getChainPredecessor,

};
