// ball-movement-controller.js
// =========================================================================
// BALL AI & KINEMATICS CONTROLLER
// =========================================================================

(function() {
  const state     = window.My3dMazeAppState;
  const WorldGrid = state.WorldGrid;

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  function update() {
    const ball = state.rollingBall;
    if (!ball) return;

    // Animate this hallway's doors when ball is somewhere the player isn't,
    // so the ball can open them independently.
    if (ball.movementMode === 'hallway') {
      const ballHallway = WorldGrid.mainHallways.find(h => h.id === ball.hallwayId);
      if (ballHallway && ballHallway !== state.activeHallway) {
        for (let i = 0; i < 5; i++) {
          window.MazeInterface.stepAnimation(ballHallway, i, 0.06);
        }
      }
    }

    // Legacy field guard — tolerates ball objects created before new fields existed
    if (ball.direction === undefined)       ball.direction = -1;
    if (ball.targetDoorIndex === undefined) ball.targetDoorIndex = null;
    if (ball.movementMode === undefined)    ball.movementMode = 'hallway';
    if (ball.tunnelLink === undefined)      ball.tunnelLink = null;
    if (ball.tunnelProgress === undefined)  ball.tunnelProgress = 0;
    if (ball.waitingAtNode === undefined)   ball.waitingAtNode = null;
    if (ball.waitFrames === undefined)      ball.waitFrames = 0;

    if (ball.movementMode === 'tunnel' && ball.tunnelLink) {
      _updateTunnel(ball);
    } else {
      _updateHallway(ball);
    }
  }

  function spawn(spawnHallway) {
    if (state.rollingBall) return;
    if (!spawnHallway) return;
    state.rollingBall = {
      offset:          spawnHallway.baseDistances[spawnHallway.baseDistances.length - 1],
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
    };
    if (window.MazeAudioController) window.MazeAudioController.startBallRollingSound();
  }

  function destroy() {
    if (window.MazeAudioController) window.MazeAudioController.stopBallRollingSound();
    state.rollingBall = null;
  }

  // -------------------------------------------------------------------------
  // Tunnel traversal
  // -------------------------------------------------------------------------

  function _updateTunnel(ball) {
    ball.tunnelProgress += ball.speed;
    ball.rotation       += ball.speed * 18;

    if (ball.tunnelProgress < 3.2) return;

    const currentLink = ball.tunnelLink;
    const destIdx     = currentLink.toHallwayIndex;
    const destHallway = WorldGrid.mainHallways[destIdx];

    if (!destHallway) { destroy(); return; }

    const fromHallway    = WorldGrid.mainHallways[currentLink.fromHallwayIndex];
    const exitGlobalX    = (currentLink.chainGlobalX !== undefined)
      ? currentLink.chainGlobalX
      : (fromHallway ? fromHallway.startOffsetFromS + currentLink.doorIndex : 0);
    const rawDoorIdx     = Math.round(exitGlobalX - destHallway.startOffsetFromS);
    const localDoorIdx   = Math.max(0, Math.min(4, rawDoorIdx));
    const doorNodeOffset = (destHallway.nodes && destHallway.nodes[localDoorIdx * 2] !== undefined)
      ? destHallway.nodes[localDoorIdx * 2]
      : 0;

    // Find next chain segment (prefer direct forwardChainIndex pointer)
    let nextLink = null;
    if (currentLink.forwardChainIndex !== undefined && currentLink.forwardChainIndex >= 0) {
      nextLink = WorldGrid.interconnectingHallways[currentLink.forwardChainIndex] || null;
    }
    if (!nextLink) {
      nextLink = WorldGrid.interconnectingHallways.find(c => {
        if (c === currentLink) return false;
        const cFrom   = WorldGrid.mainHallways[c.fromHallwayIndex];
        if (!cFrom) return false;
        const cGlobalX = (c.chainGlobalX !== undefined) ? c.chainGlobalX : cFrom.startOffsetFromS + c.doorIndex;
        if (cGlobalX !== exitGlobalX) return false;
        return c.fromHallwayIndex === destIdx || c.toHallwayIndex === destIdx;
      }) || null;
    }

    // Close the exit door behind the ball
    currentLink.exitDoorTarget     = 0;
    currentLink.exitDoorOpenStatus = 0;

    ball.hallwayId = destHallway.id;
    ball.offset    = doorNodeOffset;

    if (nextLink) {
      // Chain-hop — stay in tunnel mode, enter next segment immediately
      ball.tunnelLink     = nextLink;
      ball.tunnelProgress = 0;
    } else {
      // Arrived in destination hallway — close the landing door too
      if (destHallway.doorOpenStatus) {
        destHallway.doorOpenStatus[localDoorIdx] = 0;
        destHallway.doorTargets[localDoorIdx]    = 0;
      }
      ball.movementMode    = 'hallway';
      ball.tunnelLink      = null;
      ball.tunnelProgress  = 0;
      ball.targetDoorIndex = null;
      ball.waitingAtNode   = null;
      ball.waitFrames      = 0;
      ball.direction       = Math.random() < 0.5 ? -1 : 1;
    }
  }

  // -------------------------------------------------------------------------
  // Hallway movement
  // -------------------------------------------------------------------------

  function _updateHallway(ball) {
    const currentHallway = WorldGrid.mainHallways.find(h => h.id === ball.hallwayId);
    if (!currentHallway) { destroy(); return; }

    const hallIdx      = WorldGrid.mainHallways.findIndex(h => h.id === ball.hallwayId);
    const farWall      = currentHallway.baseDistances[currentHallway.baseDistances.length - 1];
    const WAIT_TIMEOUT = 600; // ~10 s at 60 fps
    const user         = state.user;

    if (ball.waitingAtNode !== null) {
      _waitAtDoor(ball, currentHallway, hallIdx, WAIT_TIMEOUT);
    } else {
      _moveAndScanDoors(ball, currentHallway, hallIdx, farWall);
    }

    // Audio — only audible when ball is in the same hallway as the player
    const ballZ = ball.offset - user.forwardOffset;
    if (window.MazeAudioController) {
      window.MazeAudioController.updateBallRollingSoundVolume(ballZ);
    }

    // Collision with player destroys ball
    const ballInActiveHall = state.activeHallway && ball.hallwayId === state.activeHallway.id;
    if (user.movementMode === 'normal' && ballInActiveHall &&
        Math.abs(ball.offset - user.forwardOffset) <= 0.4) {
      destroy();
      user.flashFrames = 5;
    }
  }

  function _waitAtDoor(ball, hallway, hallIdx, timeout) {
    const di   = ball.waitingAtNode;
    ball.offset = hallway.nodes[di * 2]; // keep pinned

    const link = WorldGrid.interconnectingHallways.find(
      c => c.fromHallwayIndex === hallIdx && c.doorIndex === di
    );

    if (link && hallway.doorOpenStatus && hallway.doorOpenStatus[di] > 0.5) {
      // Door opened — enter and close it behind the ball
      _enterTunnel(ball, link, hallway, di);
    } else {
      // Still closed — ball requests the door to open, then waits
      if (link && hallway.doorTargets) hallway.doorTargets[di] = 1;
      ball.waitFrames++;
      if (ball.waitFrames >= timeout) {
        // Nobody opened it in time — give up and reverse
        ball.waitingAtNode = null;
        ball.waitFrames    = 0;
        ball.direction     = ball.direction === -1 ? 1 : -1;
      }
    }
  }

  function _moveAndScanDoors(ball, hallway, hallIdx, farWall) {
    const nextOffset    = ball.offset + ball.direction * ball.speed;
    let   enteredTunnel = false;

    for (let di = 0; di < 5; di++) {
      if (!hallway.nodes) break;
      const nodeOffset = hallway.nodes[di * 2];
      if (nodeOffset === undefined) continue;

      // Did ball's path cross this door node this frame?
      const crossed = (ball.direction ===  1 && ball.offset <= nodeOffset && nextOffset >= nodeOffset)
                   || (ball.direction === -1 && ball.offset >= nodeOffset && nextOffset <= nodeOffset);
      if (!crossed) continue;

      const link = WorldGrid.interconnectingHallways.find(
        c => c.fromHallwayIndex === hallIdx && c.doorIndex === di
      );
      if (!link) continue; // no tunnel at this node — pass through freely

      ball.offset = nodeOffset; // snap to exact node position

      if (hallway.doorOpenStatus && hallway.doorOpenStatus[di] > 0.5) {
        _enterTunnel(ball, link, hallway, di);
      } else {
        // Closed door with tunnel — stop and wait (ball will open it next frame)
        ball.waitingAtNode = di;
        ball.waitFrames    = 0;
      }
      enteredTunnel = true;
      break; // process only the first crossed door per frame
    }

    if (!enteredTunnel) {
      if (ball.direction === -1 && ball.offset - ball.speed <= 0.0) {
        ball.direction = 1;
      } else if (ball.direction === 1 && ball.offset + ball.speed >= farWall) {
        ball.direction = -1;
      }
      ball.offset   += ball.direction * ball.speed;
      ball.rotation += ball.speed * 18;
    }
  }

  function _enterTunnel(ball, link, hallway, di) {
    hallway.doorTargets[di]     = 0;
    hallway.doorOpenStatus[di]  = 0;
    link.entranceDoorTarget     = 0;
    link.entranceDoorOpenStatus = 0;
    ball.movementMode   = 'tunnel';
    ball.tunnelLink     = link;
    ball.tunnelProgress = 0;
    ball.waitingAtNode  = null;
    ball.waitFrames     = 0;
  }

  window.BallController = { update, spawn, destroy };
})();
