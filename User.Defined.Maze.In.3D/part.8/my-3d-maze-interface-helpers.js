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

// Global window exposure updated with the missing callers!
window.MazeInterface = {
  isTunnel: isTunnelStructure,
  getOpenStatus: getStructureDoorOpenStatus,
  getTarget: getStructureDoorTarget,
  toggleTarget: toggleStructureDoorTarget,
  getCurrentNodeIndex: getCurrentNodeIndex, // Now available to Spacebar!
  findActiveTunnel: findActiveTunnel         // Now available to Spacebar!
};
