// ball-movement-controller.js
// =========================================================================
// BALL AI & KINEMATICS CONTROLLER
// =========================================================================

(function() {
  const state     = window.My3dMazeAppState;
  const WorldGrid = state.WorldGrid;

  // -------------------------------------------------------------------------
  // Diagnostics emit helpers
  // -------------------------------------------------------------------------

  function _logBall(evt, loc, detail) {
    if (window.My3dMazeDiagnostics && typeof window.My3dMazeDiagnostics.logBallEvent === 'function') {
      window.My3dMazeDiagnostics.logBallEvent(evt, loc, detail);
    }
  }

  // Returns the gX (global column) nearest to ball.offset within a hallway.
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

  // Returns the gX of a tunnel link.
  function _tunnelGx(link) {
    if (link.chainGlobalX !== undefined) return link.chainGlobalX;
    const fh = WorldGrid.mainHallways[link.fromHallwayIndex];
    return fh ? fh.startOffsetFromS + link.doorIndex : link.doorIndex;
  }

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
    if (ball._seenHallwayId === undefined)  ball._seenHallwayId = null;
    if (ball._seenTunnelIdx === undefined)  ball._seenTunnelIdx = -1;
    if (ball._coiCooldown === undefined)    ball._coiCooldown = 0;

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
      _seenHallwayId:  null,
      _seenTunnelIdx:  -1,
      _coiCooldown:    0,
    };
    const gx = _nearestGx(state.rollingBall, spawnHallway);
    _logBall('SPN', `${spawnHallway.id}:gx${gx}`, `← v=${state.BASE_SPEED.toFixed(3)}`);
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

    // SEE / COI checks while traversing the tunnel
    const user = state.user;
    if (user.movementMode === 'interconnecting') {
      const ballTunnelIdx = WorldGrid.interconnectingHallways.indexOf(ball.tunnelLink);
      if (ballTunnelIdx === user.activeTunnelIndex) {
        const gx = _tunnelGx(ball.tunnelLink);
        if (ball._seenTunnelIdx !== ballTunnelIdx) {
          const pd = Math.abs(ball.tunnelProgress - user.interconnectingProgress).toFixed(1);
          _logBall('SEE', `TUN:gx${gx}`, `player Δ=${pd} (progress)`);
          ball._seenTunnelIdx = ballTunnelIdx;
        }
        const pd = Math.abs(ball.tunnelProgress - user.interconnectingProgress);
        if (pd <= 0.5 && ball._coiCooldown <= 0) {
          const gx2 = _tunnelGx(ball.tunnelLink);
          _logBall('COI', `TUN:gx${gx2}`, `Δ=${pd.toFixed(2)} !KIL`);
          ball._coiCooldown = 120;
        }
      }
    }
    if (ball._coiCooldown > 0) ball._coiCooldown--;

    if (ball.tunnelProgress < 3.2) return;

    const currentLink = ball.tunnelLink;
    const destIdx     = currentLink.toHallwayIndex;
    const destHallway = WorldGrid.mainHallways[destIdx];

    if (!destHallway) {
      _logBall('KIL', `TUN:gx${_tunnelGx(currentLink)}`, 'missing dest hallway');
      destroy();
      return;
    }

    const fromHallway = WorldGrid.mainHallways[currentLink.fromHallwayIndex];
    const exitGlobalX = (currentLink.chainGlobalX !== undefined)
      ? currentLink.chainGlobalX
      : (fromHallway ? fromHallway.startOffsetFromS + currentLink.doorIndex : 0);
    const rawDoorIdx  = Math.round(exitGlobalX - destHallway.startOffsetFromS);

    // Find next chain segment via explicit forwardChainIndex only.
    // Verify the candidate actually originates from destHallway — a mismatched pointer
    // would send the ball into a tunnel that doesn't connect from here.
    let nextLink = null;
    if (currentLink.forwardChainIndex !== undefined && currentLink.forwardChainIndex >= 0) {
      const candidate = WorldGrid.interconnectingHallways[currentLink.forwardChainIndex] || null;
      if (candidate && candidate.fromHallwayIndex === destIdx) {
        nextLink = candidate;
      }
    }

    // Close the exit door behind the ball
    currentLink.exitDoorTarget     = 0;
    currentLink.exitDoorOpenStatus = 0;

    // Final-destination guard: the shaft must exit through a real door slot (rawDoorIdx 0–4).
    // Intermediate chain-hop hallways are exempt — the shaft passes through their walls.
    // If the column doesn't land on an actual door in the destination hallway, refuse entry.
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
      // Chain-hop — stay in tunnel mode, enter next segment immediately
      const gx = exitGlobalX;
      _logBall('CHP', `${destHallway.id}:gx${gx}`, 'chain');
      ball.tunnelLink     = nextLink;
      ball.tunnelProgress = 0;
      ball._seenTunnelIdx = -1;
    } else {
      // Arrived in destination hallway — close the landing door too
      if (destHallway.doorOpenStatus) {
        destHallway.doorOpenStatus[localDoorIdx] = 0;
        destHallway.doorTargets[localDoorIdx]    = 0;
      }
      const arrDir = ball.direction === -1 ? '←' : '→';
      _logBall('ARV', `${destHallway.id}:gx${exitGlobalX}`, `${arrDir} v=${ball.speed.toFixed(3)}`);
      ball.movementMode    = 'hallway';
      ball.tunnelLink      = null;
      ball.tunnelProgress  = 0;
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
    const currentHallway = WorldGrid.mainHallways.find(h => h.id === ball.hallwayId);
    if (!currentHallway) { destroy(); return; }

    const hallIdx      = WorldGrid.mainHallways.findIndex(h => h.id === ball.hallwayId);
    const farWall      = currentHallway.baseDistances[currentHallway.baseDistances.length - 1];
    const WAIT_TIMEOUT = 600; // ~10 s at 60 fps
    const user         = state.user;

    // SEE: ball entered the same hallway as the player for the first time this visit
    const ballInActiveHall = state.activeHallway && ball.hallwayId === state.activeHallway.id;
    if (ballInActiveHall && user.movementMode !== 'interconnecting' && ball._seenHallwayId !== ball.hallwayId) {
      const dist = Math.abs(ball.offset - user.forwardOffset).toFixed(1);
      _logBall('SEE', ball.hallwayId, `player Δ=${dist}`);
      ball._seenHallwayId = ball.hallwayId;
    }

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

    // COI + KIL: proximity and collision checks
    if (ballInActiveHall && user.movementMode === 'normal') {
      const dist = Math.abs(ball.offset - user.forwardOffset);
      if (dist <= 0.5 && ball._coiCooldown <= 0) {
        const gx = _nearestGx(ball, currentHallway);
        _logBall('COI', `${ball.hallwayId}:gx${gx}`, `Δ=${dist.toFixed(2)}`);
        ball._coiCooldown = 120;
      }
      if (dist <= 0.4) {
        const gx = _nearestGx(ball, currentHallway);
        _logBall('KIL', `${ball.hallwayId}:gx${gx}`, 'player 💥');
        destroy();
        user.flashFrames = 5;
        return;
      }
    }

    if (ball._coiCooldown > 0) ball._coiCooldown--;
  }

  function _waitAtDoor(ball, hallway, hallIdx, timeout) {
    const di   = ball.waitingAtNode;
    ball.offset = hallway.nodes[di * 2]; // keep pinned

    const _rawLink = WorldGrid.interconnectingHallways.find(
      c => c.fromHallwayIndex === hallIdx && c.doorIndex === di
    );
    const link = (() => {
      if (!_rawLink) return null;
      const _fromHw = WorldGrid.mainHallways[_rawLink.fromHallwayIndex];
      const _linkGx = _rawLink.chainGlobalX !== undefined
          ? _rawLink.chainGlobalX
          : (_fromHw ? _fromHw.startOffsetFromS + _rawLink.doorIndex : _rawLink.doorIndex);
      return _linkGx === hallway.startOffsetFromS + di ? _rawLink : null;
    })();

    if (link && hallway.doorOpenStatus && hallway.doorOpenStatus[di] > 0.5) {
      // Door opened — enter and close it behind the ball
      _enterTunnel(ball, link, hallway, di);
    } else {
      // Still closed — ball requests the door to open, then waits
      if (link && hallway.doorTargets) hallway.doorTargets[di] = 1;
      ball.waitFrames++;
      if (ball.waitFrames >= timeout) {
        // Nobody opened it in time — give up and reverse
        const newDir = ball.direction === -1 ? 1 : -1;
        const gx     = hallway.startOffsetFromS + di;
        const dirStr = newDir === 1 ? '→' : '←';
        _logBall('ABO', `${ball.hallwayId}:gx${gx}`, `${dirStr} ${ball.waitFrames}f`);
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

      // Did ball's path cross this door node this frame?
      const crossed = (ball.direction ===  1 && ball.offset <= nodeOffset && nextOffset >= nodeOffset)
                   || (ball.direction === -1 && ball.offset >= nodeOffset && nextOffset <= nodeOffset);
      if (!crossed) continue;

      const link = WorldGrid.interconnectingHallways.find(
        c => c.fromHallwayIndex === hallIdx && c.doorIndex === di
      );
      if (!link) continue; // no tunnel at this node — pass through freely

      // Reject chain-segment tunnels whose logical gX doesn't match this door's
      // physical gX. These are shaft pass-throughs — no valid entry from this hallway.
      const _fromHw = WorldGrid.mainHallways[link.fromHallwayIndex];
      const _linkGx = link.chainGlobalX !== undefined
          ? link.chainGlobalX
          : (_fromHw ? _fromHw.startOffsetFromS + link.doorIndex : link.doorIndex);
      if (_linkGx !== hallway.startOffsetFromS + di) continue;

      ball.offset = nodeOffset; // snap to exact node position

      if (hallway.doorOpenStatus && hallway.doorOpenStatus[di] > 0.5) {
        _enterTunnel(ball, link, hallway, di);
      } else {
        // Closed door with tunnel — stop and wait (ball will open it next frame)
        const gx    = hallway.startOffsetFromS + di;
        const destHw = WorldGrid.mainHallways[link.toHallwayIndex];
        _logBall('STP', `${hallway.id}:gx${gx}`, '●');
        if (window.BallMemory && destHw) window.BallMemory.recordBlock(hallway.id, gx, destHw.id);
        ball.waitingAtNode = di;
        ball.waitFrames    = 0;
      }
      enteredTunnel = true;
      break; // process only the first crossed door per frame
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

  function _enterTunnel(ball, link, hallway, di) {
    const destHallway = WorldGrid.mainHallways[link.toHallwayIndex];
    const destId      = destHallway ? destHallway.id : '?';
    const gx          = hallway.startOffsetFromS + di;
    _logBall('ENT', `${hallway.id}→${destId} gx${gx}`, `○ ${ball.waitFrames}f`);
    if (window.BallMemory && destHallway) window.BallMemory.recordEntry(hallway.id, gx, destId);
    hallway.doorTargets[di]     = 0;
    hallway.doorOpenStatus[di]  = 0;
    link.entranceDoorTarget     = 0;
    link.entranceDoorOpenStatus = 0;
    ball.movementMode   = 'tunnel';
    ball.tunnelLink     = link;
    ball.tunnelProgress = 0;
    ball.waitingAtNode  = null;
    ball.waitFrames     = 0;
    ball._seenHallwayId = null;
    ball._seenTunnelIdx = -1;
  }

  window.BallController = { update, spawn, destroy };
})();
