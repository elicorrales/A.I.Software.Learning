// maze-tunnel-topology.js
// =========================================================================
// TUNNEL TOPOLOGY QUERIES
// Answers all spatial questions about tunnels: where they are, what exists
// at their terminals, and how the player traverses them.
// Loaded before my-3d-maze-interface-helpers.js; re-exported via MazeInterface.
// Direct state access is intentional — this file is part of the interface layer.
// =========================================================================
(function() {

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

    // The absolute X coordinate where this specific tunnel is located.
    // Chained tunnels store chainGlobalX to preserve the origin column across hallways with
    // different startOffsetFromS values — use it when present.
    const connGlobalX = (conn.chainGlobalX !== undefined)
      ? conn.chainGlobalX
      : fromHallway.startOffsetFromS + conn.doorIndex;

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

    // Calculate the absolute global X position where this tunnel was originally spawned.
    // Chained tunnels carry chainGlobalX to stay aligned with the origin column.
    const connGlobalX = (conn.chainGlobalX !== undefined)
      ? conn.chainGlobalX
      : fromHallway.startOffsetFromS + conn.doorIndex;

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
    // Chained tunnels carry chainGlobalX — use it directly to avoid re-deriving globalX
    // from a fromHallway that isn't the origin of the chain.
    if (activeLink.chainGlobalX !== undefined) {
      const destHallway = state.WorldGrid.mainHallways[activeLink.toHallwayIndex];
      if (!destHallway) return false;
      const localDestX = activeLink.chainGlobalX - destHallway.startOffsetFromS;
      return localDestX >= 0 && localDestX <= 4 && Number.isInteger(localDestX);
    }
    return doesMainHallwayExistAtCoordinates(
      activeLink.fromHallwayIndex,
      activeLink.toHallwayIndex,
      activeLink.doorIndex
    );
  }

  // We are looking backward through the tunnel toward where it spawned.
  if (view === 'backward') {
    const originHallway = state.WorldGrid.mainHallways[activeLink.fromHallwayIndex];
    if (!originHallway) return false;

    // For chained tunnels, chainGlobalX may not align with any door in fromHallway
    // (the fromHallway is an intermediate row, not the chain origin).
    // Validate the column before claiming a hallway is there.
    if (activeLink.chainGlobalX !== undefined) {
      const localFromX = activeLink.chainGlobalX - originHallway.startOffsetFromS;
      return localFromX >= 0 && localFromX <= 4 && Number.isInteger(localFromX);
    }

    return true;
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

  const exitingFromFarEnd = user.interconnectingProgress >= 1.6;
  const tunnelExitView = exitingFromFarEnd ? 'forward' : 'backward';

  if (!doesAnyStructureExistAtTunnelTerminal(activeTunnel, tunnelExitView)) {
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
  if (doesMainHallwayExistAtTunnelTerminal(activeTunnel, tunnelExitView)) {
    let targetHallwayIdx = activeTunnel.fromHallwayIndex;
    let localDoorIdx = activeTunnel.doorIndex;

    if (user.interconnectingProgress >= 1.6) {
      targetHallwayIdx = activeTunnel.toHallwayIndex;
      const fromHallway = state.WorldGrid.mainHallways[activeTunnel.fromHallwayIndex];
      const toHallway = state.WorldGrid.mainHallways[activeTunnel.toHallwayIndex];
      if (fromHallway && toHallway) {
        const globalX = (activeTunnel.chainGlobalX !== undefined)
          ? activeTunnel.chainGlobalX
          : fromHallway.startOffsetFromS + activeTunnel.doorIndex;
        localDoorIdx = globalX - toHallway.startOffsetFromS;
      }
    }

    const targetHallway = state.WorldGrid.mainHallways[targetHallwayIdx];
    if (!targetHallway) return;

    activeTunnel.entranceDoorTarget = 0;
    activeTunnel.entranceDoorOpenStatus = 0;
    activeTunnel.exitDoorTarget = 0;
    activeTunnel.exitDoorOpenStatus = 0;

    // Close the door in the hallway the player just left.
    // Forward exit: fromHallway's door at doorIndex was opened when the player entered.
    // Backward exit: fill(0) below already resets all of fromHallway's doors.
    if (exitingFromFarEnd) {
      const srcHallway = state.WorldGrid.mainHallways[activeTunnel.fromHallwayIndex];
      if (srcHallway) {
        setDoorStateImmediate(srcHallway, activeTunnel.doorIndex, 0);
      }
    }

    state.activeHallway = targetHallway;
    markHallwayVisited(targetHallway.id);
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
    // A chained tunnel segment exists at this terminal — resolve it and transition.

    // Prefer the direct forward chain link created by createChainedTunnelFromDeadEnd()
    let chainedTunnel = null;
    if (tunnelExitView === 'forward'
        && activeTunnel.forwardChainIndex !== undefined
        && activeTunnel.forwardChainIndex >= 0) {
      chainedTunnel = state.WorldGrid.interconnectingHallways[activeTunnel.forwardChainIndex] || null;
    }

    // Fallback: globalX column search for any tunnel that connects at this terminal
    if (!chainedTunnel) {
      const fromHallway = state.WorldGrid.mainHallways[activeTunnel.fromHallwayIndex];
      if (fromHallway) {
        const exitGlobalX = (activeTunnel.chainGlobalX !== undefined)
          ? activeTunnel.chainGlobalX
          : fromHallway.startOffsetFromS + activeTunnel.doorIndex;
        const relevantSideIdx = tunnelExitView === 'forward'
          ? activeTunnel.toHallwayIndex
          : activeTunnel.fromHallwayIndex;
        chainedTunnel = state.WorldGrid.interconnectingHallways.find(otherTunnel => {
          if (otherTunnel === activeTunnel) return false;
          const otherFrom = state.WorldGrid.mainHallways[otherTunnel.fromHallwayIndex];
          if (!otherFrom) return false;
          const otherGlobalX = (otherTunnel.chainGlobalX !== undefined)
            ? otherTunnel.chainGlobalX
            : otherFrom.startOffsetFromS + otherTunnel.doorIndex;
          if (otherGlobalX !== exitGlobalX) return false;
          return otherTunnel.fromHallwayIndex === relevantSideIdx
              || otherTunnel.toHallwayIndex   === relevantSideIdx;
        }) || null;
      }
    }

    if (!chainedTunnel) {
      if (user.interconnectingProgress >= 1.6) user.interconnectingProgress = 3.16;
      else user.interconnectingProgress = 0.04;
      user.flashFrames = 5;
      return;
    }

    const chainedTunnelIdx = state.WorldGrid.interconnectingHallways.indexOf(chainedTunnel);
    const relevantSideIndex = tunnelExitView === 'forward'
      ? activeTunnel.toHallwayIndex
      : activeTunnel.fromHallwayIndex;

    // Close the segment we just traversed
    activeTunnel.entranceDoorTarget     = 0;
    activeTunnel.entranceDoorOpenStatus = 0;
    activeTunnel.exitDoorTarget         = 0;
    activeTunnel.exitDoorOpenStatus     = 0;

    state.activeHallway    = state.WorldGrid.mainHallways[relevantSideIndex];
    user.activeTunnelIndex = chainedTunnelIdx;

    // Place player at the near end of the chained segment and open that door
    if (chainedTunnel.fromHallwayIndex === relevantSideIndex) {
      user.interconnectingProgress         = 0.0;
      chainedTunnel.entranceDoorTarget     = 1;
      chainedTunnel.entranceDoorOpenStatus = 1.0;
    } else {
      user.interconnectingProgress     = 3.20;
      chainedTunnel.exitDoorTarget     = 1;
      chainedTunnel.exitDoorOpenStatus = 1.0;
    }
    user.chainHopOriginProgress = 18;
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

  // 0. Direct chain link — takes priority over globalX scan for chained segments
  if (view === 'forward'
      && activeLink.forwardChainIndex !== undefined
      && activeLink.forwardChainIndex >= 0
      && activeLink.forwardChainIndex < state.WorldGrid.interconnectingHallways.length) {
    return true;
  }

  // 1. First, check if a standard hallway is there
  const hallwayExists = doesMainHallwayExistAtTunnelTerminal(activeLink, view);
  if (hallwayExists) return true;

  // 2. FUTURE-PROOFING: Check if a chained tunnel link is attached here instead!
  // Determine the absolute global X coordinate where this tunnel segment ends
  let exitGlobalX = 0;
  const fromHallway = state.WorldGrid.mainHallways[activeLink.fromHallwayIndex];

  if (fromHallway) {
    exitGlobalX = (activeLink.chainGlobalX !== undefined)
      ? activeLink.chainGlobalX
      : fromHallway.startOffsetFromS + activeLink.doorIndex;
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

    const otherGlobalX = (otherTunnel.chainGlobalX !== undefined)
      ? otherTunnel.chainGlobalX
      : otherFromHallway.startOffsetFromS + otherTunnel.doorIndex;
    if (otherGlobalX !== exitGlobalX) return false;

    return otherTunnel.fromHallwayIndex === relevantSideIndex
        || otherTunnel.toHallwayIndex === relevantSideIndex;
  });

  return chainedTunnelExists;
}

/**
 * Returns true if the given tunnel terminal faces the hard edge of the universe —
 * i.e., the adjacent hallway slot that a chain would need to occupy is out of bounds.
 * Used to show the red X instead of void smoke on dead-end tunnel exits.
 */
function isTunnelTerminalVoid(activeLink, view) {
  const state = window.My3dMazeAppState;
  if (!activeLink || !state || !state.WorldGrid) return false;

  if (view === 'forward') {
    const nextIdx = activeLink.direction === 1
      ? activeLink.toHallwayIndex + 1
      : activeLink.toHallwayIndex - 1;
    return nextIdx < 0 || nextIdx >= state.WorldGrid.mainHallways.length;
  }

  if (view === 'backward') {
    const nextIdx = activeLink.direction === 1
      ? activeLink.fromHallwayIndex - 1
      : activeLink.fromHallwayIndex + 1;
    return nextIdx < 0 || nextIdx >= state.WorldGrid.mainHallways.length;
  }

  return false;
}

// =========================================================================

window.MazeTunnelTopology = {
  findActiveTunnel,
  hasTunnelAtCurrentNode,
  getNormalizedTunnelContext,
  doesMainHallwayExistAtCoordinates,
  getTrueActiveHallway,
  getRelativeViewOrientation,
  isSideViewFacingVoid,
  isSideViewFacingTunnel,
  doesMainHallwayExistAtTunnelTerminal,
  exitTunnelToCorridor,
  doesAnyStructureExistAtTunnelTerminal,
  isTunnelTerminalVoid,
};
})();
