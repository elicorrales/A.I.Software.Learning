// ball-movement-controller.js
// =========================================================================
// BALL AI & KINEMATICS CONTROLLER
// All world/state queries and mutations go through window.MazeInterface.
// =========================================================================

(function() {
  const MI   = window.MazeInterface;
  const BMem = window.BallMemory;

  // -------------------------------------------------------------------------
  // Diagnostics emit
  // -------------------------------------------------------------------------

  function _logBall(evt, loc, detail) {
    if (window.My3dMazeDiagnostics && typeof window.My3dMazeDiagnostics.logBallEvent === 'function') {
      window.My3dMazeDiagnostics.logBallEvent(evt, loc, detail);
    }
  }

  // Returns the nearest door gX for a given ball offset within a hallway.
  function _nearestGx(ball, hallway) {
    if (!hallway || !hallway.nodes) return '?';
    let bestDi = 0, diff = Infinity;
    for (let di = 0; di < 5; di++) {
      const nd = hallway.nodes[di * 2];
      if (nd === undefined) continue;
      const d = Math.abs(ball.offset - nd);
      if (d < diff) { diff = d; bestDi = di; }
    }
    return hallway.startOffsetFromS + bestDi;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  function update() {
    const ball = MI.getRollingBall();
    if (!ball) return;

    // Always animate the ball's hallway doors — no active-hallway guard.
    // The guard caused a gap when getTrueActiveHallway() returned the ball's hall
    // while state.activeHallway (used by main.js) still pointed elsewhere (e.g.
    // during a chain hop), leaving the ball's doors animated by nobody.
    if (ball.movementMode === 'hallway') {
      const ballHallway = MI.getHallwayById(ball.hallwayId);
      if (ballHallway) {
        for (let i = 0; i < 5; i++) MI.stepAnimation(ballHallway, i, 0.06);
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
    if (ball._seenHallwayId === undefined)  ball._seenHallwayId = null;
    if (ball._seenTunnelIdx === undefined)  ball._seenTunnelIdx = -1;
    if (ball._coiCooldown === undefined)    ball._coiCooldown = 0;
    if (ball.tunnelReverse === undefined)   ball.tunnelReverse = false;

    if (ball.movementMode === 'tunnel' && ball.tunnelLink) {
      _updateTunnel(ball);
    } else {
      _updateHallway(ball);
    }
  }

  function spawn(spawnHallway) {
    if (!spawnHallway) return;
    MI.spawnBall(spawnHallway);
    const ball = MI.getRollingBall();
    if (!ball) return;
    const gx = _nearestGx(ball, spawnHallway);
    _logBall('SPN', `${spawnHallway.id}:gx${gx}`, `← v=${ball.speed.toFixed(3)}`);
    if (window.MazeAudioController) window.MazeAudioController.startBallRollingSound();
  }

  function destroy() {
    if (window.MazeAudioController) window.MazeAudioController.stopBallRollingSound();
    MI.destroyBall();
  }

  // -------------------------------------------------------------------------
  // Tunnel traversal
  // -------------------------------------------------------------------------

  function _updateTunnel(ball) {
    ball.tunnelProgress += ball.speed;
    ball.rotation       += ball.speed * 18;

    // SEE / COI checks while traversing
    if (MI.getUserMovementMode() === 'interconnecting') {
      const ballTunnelIdx = MI.getTunnelIndex(ball.tunnelLink);
      if (ballTunnelIdx === MI.getUserActiveTunnelIndex()) {
        const gx = MI.getTunnelGlobalX(ball.tunnelLink);
        if (ball._seenTunnelIdx !== ballTunnelIdx) {
          const pd = Math.abs(ball.tunnelProgress - MI.getUserInterconnectingProgress()).toFixed(1);
          _logBall('SEE', `TUN:gx${gx}`, `player Δ=${pd} (progress)`);
          ball._seenTunnelIdx = ballTunnelIdx;
        }
        const pd = Math.abs(ball.tunnelProgress - MI.getUserInterconnectingProgress());
        if (pd <= 0.5 && ball._coiCooldown <= 0) {
          _logBall('COI', `TUN:gx${gx}`, `Δ=${pd.toFixed(2)} !KIL`);
          ball._coiCooldown = 120;
        }
      }
    }
    if (ball._coiCooldown > 0) ball._coiCooldown--;

    if (ball.tunnelProgress < 3.2) return;

    const currentLink = ball.tunnelLink;
    const reverse     = ball.tunnelReverse;

    // Destination: forward → toHallwayIndex, reverse → fromHallwayIndex
    const destIdx     = reverse ? currentLink.fromHallwayIndex : currentLink.toHallwayIndex;
    const destHallway = MI.getHallwayByIndex(destIdx);

    if (!destHallway) {
      _logBall('KIL', `TUN:gx${MI.getTunnelGlobalX(currentLink)}`, 'missing dest hallway');
      destroy();
      return;
    }

    const exitGlobalX = MI.getTunnelGlobalX(currentLink);
    const rawDoorIdx  = Math.round(exitGlobalX - destHallway.startOffsetFromS);

    // forwardChainIndex only valid when traversing forward
    let nextLink = null;
    if (!reverse && currentLink.forwardChainIndex !== undefined && currentLink.forwardChainIndex >= 0) {
      const candidate = MI.getTunnelByIndex(currentLink.forwardChainIndex);
      if (candidate && candidate.fromHallwayIndex === currentLink.toHallwayIndex) {
        nextLink = candidate;
      }
    }

    // Close the door we are exiting through
    MI.setDoorStateImmediate(currentLink, reverse ? 'entrance' : 'exit', false);

    if (!nextLink && (rawDoorIdx < 0 || rawDoorIdx > 4)) {
      _logBall('KIL', `TUN:gx${exitGlobalX}`, `no door in ${destHallway.id} (col ${rawDoorIdx})`);
      destroy();
      return;
    }

    const localDoorIdx   = Math.max(0, Math.min(4, rawDoorIdx));
    const doorNodeOffset = (destHallway.nodes && destHallway.nodes[localDoorIdx * 2] !== undefined)
      ? destHallway.nodes[localDoorIdx * 2]
      : 0;

    ball.hallwayId = destHallway.id;
    ball.offset    = doorNodeOffset;

    if (nextLink) {
      _logBall('CHP', `${destHallway.id}:gx${exitGlobalX}`, 'chain');
      ball.tunnelLink     = nextLink;
      ball.tunnelProgress = 0;
      ball.tunnelReverse  = false; // chain hops always go forward
      ball._seenTunnelIdx = -1;
    } else {
      MI.setDoorStateImmediate(destHallway, localDoorIdx, false);
      const arrDir = ball.direction === -1 ? '←' : '→';
      _logBall('ARV', `${destHallway.id}:gx${exitGlobalX}`, `${arrDir} v=${ball.speed.toFixed(3)}`);
      ball.movementMode    = 'hallway';
      ball.tunnelLink      = null;
      ball.tunnelProgress  = 0;
      ball.tunnelReverse   = false;
      ball.targetDoorIndex = null;
      ball.waitingAtNode   = null;
      ball.waitFrames      = 0;
      ball.direction       = Math.random() < 0.5 ? -1 : 1;
      ball._seenHallwayId  = null;
      ball._seenTunnelIdx  = -1;
    }
  }

  // -------------------------------------------------------------------------
  // Hallway movement
  // -------------------------------------------------------------------------

  function _updateHallway(ball) {
    const currentHallway = MI.getHallwayById(ball.hallwayId);
    if (!currentHallway) { destroy(); return; }

    const hallIdx      = MI.getHallwayIndex(ball.hallwayId);
    const farWall      = currentHallway.nodes[currentHallway.nodes.length - 1];
    const WAIT_TIMEOUT = 600;

    // SEE: ball entered the same hallway as the player for the first time this visit
    const activeHallway    = MI.getTrueActiveHallway();
    const ballInActiveHall = activeHallway && ball.hallwayId === activeHallway.id;
    if (ballInActiveHall && MI.getUserMovementMode() !== 'interconnecting' && ball._seenHallwayId !== ball.hallwayId) {
      const dist = Math.abs(ball.offset - MI.getUserForwardOffset()).toFixed(1);
      _logBall('SEE', ball.hallwayId, `player Δ=${dist}`);
      ball._seenHallwayId = ball.hallwayId;
    }

    if (ball.waitingAtNode !== null) {
      _waitAtDoor(ball, currentHallway, hallIdx, WAIT_TIMEOUT);
    } else {
      _moveAndScanDoors(ball, currentHallway, hallIdx, farWall);
    }

    // Audio — volume based on distance from player
    const ballZ = ball.offset - MI.getUserForwardOffset();
    if (window.MazeAudioController) window.MazeAudioController.updateBallRollingSoundVolume(ballZ);

    // COI + KIL: proximity and collision checks
    if (ballInActiveHall && MI.getUserMovementMode() === 'normal') {
      const dist = Math.abs(ball.offset - MI.getUserForwardOffset());
      if (dist <= 0.5 && ball._coiCooldown <= 0) {
        const gx = _nearestGx(ball, currentHallway);
        _logBall('COI', `${ball.hallwayId}:gx${gx}`, `Δ=${dist.toFixed(2)}`);
        ball._coiCooldown = 120;
      }
      if (dist <= 0.4) {
        const gx = _nearestGx(ball, currentHallway);
        _logBall('KIL', `${ball.hallwayId}:gx${gx}`, 'player 💥');
        destroy();
        MI.setUserFlashFrames(5);
        return;
      }
    }

    if (ball._coiCooldown > 0) ball._coiCooldown--;
  }

  // Ball waits at a door node it stopped at, requests it open, and reacts to what it finds.
  function _waitAtDoor(ball, hallway, hallIdx, timeout) {
    const di = ball.waitingAtNode;
    ball.offset = hallway.nodes[di * 2]; // keep pinned

    // Ball always requests the door open — it has no prior knowledge of what's behind it
    MI.requestDoorOpen(hallway, di);

    if (MI.getOpenStatus(hallway, di) > 0.5) {
      // Door is open — bidirectional tunnel search, same logic as isSideViewFacingTunnel
      const gx    = hallway.startOffsetFromS + di;
      const found = MI.findTunnelAtDoor(hallIdx, gx);

      if (found) {
        _enterTunnel(ball, found.link, hallway, di, found.reverse);
      } else {
        // Empty door — ball learned this leads nowhere
        _logBall('EMP', `${hallway.id}:gx${gx}`, '○ empty');
        BMem.recordBlock(hallway.id, gx, null);
        MI.requestDoorClose(hallway, di);
        ball.waitingAtNode = null;
        ball.waitFrames    = 0;
        // Ball continues in current direction — no reversal needed
      }
    } else {
      // Door still closed — keep waiting
      ball.waitFrames++;
      if (ball.waitFrames >= timeout) {
        const gx     = hallway.startOffsetFromS + di;
        const newDir = ball.direction === -1 ? 1 : -1;
        _logBall('ABO', `${hallway.id}:gx${gx}`, `${newDir === 1 ? '→' : '←'} ${ball.waitFrames}f`);
        MI.requestDoorClose(hallway, di);
        ball.waitingAtNode = null;
        ball.waitFrames    = 0;
        ball.direction     = newDir;
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

      // Strict < / > prevents re-triggering when ball.offset === nodeOffset after reversal
      const crossed = (ball.direction ===  1 && ball.offset <  nodeOffset && nextOffset >= nodeOffset)
                   || (ball.direction === -1 && ball.offset >  nodeOffset && nextOffset <= nodeOffset);
      if (!crossed) continue;

      const gx = hallway.startOffsetFromS + di;

      // Skip doors the ball already opened and found empty
      if (BMem.getBlockCount(hallway.id, gx, null) > 0) continue;

      // If this tunnel entrance was already used, only stop here as a last resort.
      // If a fresher (unvisited, unblocked) door exists further in the current
      // direction, skip this one so the ball explores deeper instead of looping.
      if (BMem.getEntryCount(hallway.id, gx, null) > 0) {
        let freshAhead = false;
        for (let di2 = di + ball.direction; di2 >= 0 && di2 < 5; di2 += ball.direction) {
          const gx2 = hallway.startOffsetFromS + di2;
          if (BMem.getBlockCount(hallway.id, gx2, null) > 0) continue;
          if (BMem.getEntryCount(hallway.id, gx2, null) === 0) { freshAhead = true; break; }
        }
        if (freshAhead) continue;
      }

      ball.offset    = nodeOffset;
      _logBall('STP', `${hallway.id}:gx${gx}`, '?');
      ball.waitingAtNode = di;
      ball.waitFrames    = 0;
      enteredTunnel = true;
      break;
    }

    if (!enteredTunnel) {
      if (ball.direction === -1 && ball.offset - ball.speed <= 0.0) {
        ball.direction = 1;
        _logBall('BNC', `${hallway.id}:near`, '→');
      } else if (ball.direction === 1 && ball.offset + ball.speed >= farWall) {
        ball.direction = -1;
        _logBall('BNC', `${hallway.id}:far`, '←');
      }
      ball.offset   += ball.direction * ball.speed;
      ball.rotation += ball.speed * 18;
    }
  }

  // reverse=true means ball entered from the tunnel's exit side and will arrive at fromHallwayIndex.
  function _enterTunnel(ball, link, hallway, di, reverse = false) {
    const destHallway = MI.getHallwayByIndex(reverse ? link.fromHallwayIndex : link.toHallwayIndex);
    const destId      = destHallway ? destHallway.id : '?';
    const gx          = hallway.startOffsetFromS + di;
    _logBall('ENT', `${hallway.id}→${destId} gx${gx}`, `○ ${ball.waitFrames}f`);
    if (BMem && destHallway) BMem.recordEntry(hallway.id, gx, destId);
    MI.setDoorStateImmediate(hallway, di, false);
    MI.setDoorStateImmediate(link, reverse ? 'exit' : 'entrance', false);
    ball.movementMode    = 'tunnel';
    ball.tunnelLink      = link;
    ball.tunnelProgress  = 0;
    ball.tunnelReverse   = reverse;
    ball.waitingAtNode   = null;
    ball.waitFrames      = 0;
    ball._seenHallwayId  = null;
    ball._seenTunnelIdx  = -1;
  }

  window.BallController = { update, spawn, destroy };
})();
