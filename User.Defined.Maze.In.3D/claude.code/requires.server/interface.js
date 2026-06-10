// GEMINI.3 interface.js
import { GameState } from './game-state.js';
import { GameDiagnostics } from './game-diagnostics.js';

const DIRECTIONS = ['EAST', 'SOUTH', 'WEST', 'NORTH'];
let wasBlocked = false;

export const GameInterface = {
  // --- Structural Space Translators ---
  getLocalZToGlobalX(hallIndex, localZ, entityId = 'player') {
    if (entityId === 'player' && GameState.player.inTunnel && hallIndex === GameState.player.currentHall) {
      return GameState.player.tunnelGlobalX;
    }
    if (entityId === 'ball' && GameState.ball.inTunnel && hallIndex === GameState.ball.currentHall) {
      return GameState.ball.tunnelGlobalX;
    }
    const hall = GameState.halls[hallIndex];
    return hall ? (hall.worldXOffset + localZ) : localZ;
  },

  getGlobalXToLocalZ(targetHallIndex, globalX) {
    const targetHall = GameState.halls[targetHallIndex];
    return globalX - targetHall.worldXOffset;
  },

  // --- Semantic Environment Queries ---
  isOpeningAt(hallIndex, localZ) {
    const roundedZ = Math.floor(localZ);
    const hall = GameState.halls[hallIndex];
    return hall ? hall.openings.includes(roundedZ) : false;
  },

  checkTunnelConnection(sourceHallIndex, sourceLocalZ, direction) {
    if (sourceHallIndex === 0 && direction === 'NORTH') return null;
    if (sourceHallIndex === GameState.constants.maxHalls - 1 && direction === 'SOUTH') return null;

    const globalX = this.getLocalZToGlobalX(sourceHallIndex, sourceLocalZ, 'player');
    const step = (direction === 'SOUTH') ? 1 : -1;
    let targetHallIndex = sourceHallIndex + step;

    while (targetHallIndex >= 0 && targetHallIndex < GameState.constants.maxHalls) {
      const targetLocalZ = this.getGlobalXToLocalZ(targetHallIndex, globalX);
      if (targetLocalZ >= 0 && targetLocalZ <= GameState.constants.hallLength) {
        if (this.isOpeningAt(targetHallIndex, targetLocalZ)) {
          return { hallIndex: targetHallIndex, localZ: targetLocalZ };
        }
      }
      targetHallIndex += step;
    }
    return null;
  },

  turnPlayer(side) {
    const currentIndex = DIRECTIONS.indexOf(GameState.player.orientation);
    let newIndex = currentIndex;

    if (side === 'LEFT') {
      newIndex = (currentIndex - 1 + DIRECTIONS.length) % DIRECTIONS.length;
    } else if (side === 'RIGHT') {
      newIndex = (currentIndex + 1) % DIRECTIONS.length;
    }

    const nextOrientation = DIRECTIONS[newIndex];
    GameState.player.orientation = nextOrientation;

    GameState.player.justExitedTunnel = false;

    if (nextOrientation === 'NORTH' || nextOrientation === 'SOUTH') {
      GameState.player.localZ = Math.floor(GameState.player.localZ) + 0.5;
    }
  },

  attemptEntityMovement(entityId, deltaZ) {
    const entity = entityId === 'player' ? GameState.player : GameState.ball;
    if (!entity) return;

    if (deltaZ === 0) {
      wasBlocked = false;
      entity.justExitedTunnel = false;
      return;
    }

    const hallId = this.getEntityHallId(entityId);
    const globalX = entity.inTunnel || entity.inFakeHall ? entity.tunnelGlobalX : this.getLocalZToGlobalX(entity.currentHall, entity.localZ, entityId);

    // ── CASE AA: ENTITY IS WALKING INSIDE A TESSERACT VOID NODE (FAKE HALLWAY) ──
    if (entity.inFakeHall) {
      // If facing EAST or WEST, they are staring directly at a solid lateral torch wall panel
      if (entity.orientation === 'EAST' || entity.orientation === 'WEST') {
        if (!wasBlocked && entityId === 'player') {
          GameDiagnostics.logPlayer('BLKD', 'SOLID_WLL', hallId, entity.localZ);
          GameDiagnostics.captureSnapshot();
          wasBlocked = true;
        }
        return;
      }

      // Forward Step (arrowup / positive deltaZ) -> Forge next vertical bridge segment
      if (deltaZ > 0) {
        if (entity.orientation === 'SOUTH') {
          const targetHallIdx = entity.currentHall + 1;
          if (targetHallIdx >= GameState.constants.maxHalls) {
            if (!wasBlocked && entityId === 'player') {
              GameDiagnostics.logPlayer('BLKD', 'SOUTH_OOB', hallId, entity.localZ);
              GameDiagnostics.captureSnapshot();
              wasBlocked = true;
            }
            return;
          }
          entity.inTunnel = true;
          entity.inFakeHall = false;
          entity.tunnelDirection = 'SOUTH';
          entity.localZ = 0.0 + Math.abs(deltaZ);
          entity.currentTunnelId = `X${globalX.toFixed(1)}_H${entity.currentHall + 1}_H${entity.currentHall + 2}`;
        } else if (entity.orientation === 'NORTH') {
          const targetHallIdx = entity.currentHall - 1;
          if (targetHallIdx < 0) {
            if (!wasBlocked && entityId === 'player') {
              GameDiagnostics.logPlayer('BLKD', 'NORTH_OOB', hallId, entity.localZ);
              GameDiagnostics.captureSnapshot();
              wasBlocked = true;
            }
            return;
          }
          entity.inTunnel = true;
          entity.inFakeHall = false;
          entity.tunnelDirection = 'NORTH';
          entity.localZ = GameState.constants.hallLength - Math.abs(deltaZ);
          entity.currentTunnelId = `X${globalX.toFixed(1)}_H${entity.currentHall}_H${entity.currentHall + 1}`;
        }

        if (!GameState.tunnels[entity.currentTunnelId]) {
          GameState.tunnels[entity.currentTunnelId] = {
            id: entity.currentTunnelId,
            globalX: globalX,
            startHall: entity.orientation === 'SOUTH' ? entity.currentHall : (entity.currentHall - 1),
            endHall: entity.orientation === 'SOUTH' ? (entity.currentHall + 1) : entity.currentHall
          };
        }
        if (entityId === 'player') GameDiagnostics.logPlayer('ENT', 'ENT_TUN_' + entity.orientation[0], this.getEntityHallId(entityId), entity.localZ);
        GameDiagnostics.captureSnapshot();
        return;
      }

      // Backward Step (arrowdown / negative deltaZ) -> Retreat back into previous segment (No skips/zooms)
      if (deltaZ < 0) {
        entity.inTunnel = true;
        entity.inFakeHall = false;
        if (entity.orientation === 'SOUTH') {
          entity.tunnelDirection = 'NORTH';
          entity.localZ = GameState.constants.hallLength - Math.abs(deltaZ);
          entity.currentTunnelId = `X${globalX.toFixed(1)}_H${entity.currentHall}_H${entity.currentHall + 1}`;
        } else if (entity.orientation === 'NORTH') {
          entity.tunnelDirection = 'SOUTH';
          entity.localZ = 0.0 + Math.abs(deltaZ);
          entity.currentTunnelId = `X${globalX.toFixed(1)}_H${entity.currentHall + 1}_H${entity.currentHall + 2}`;
        }
        if (entityId === 'player') GameDiagnostics.logPlayer('ENT', 'RET_TUN_' + entity.orientation[0], this.getEntityHallId(entityId), entity.localZ);
        GameDiagnostics.captureSnapshot();
        return;
      }
      return;
    }

    // ── CASE A: ENTITY IS WALKING INSIDE A VERTICAL TUNNEL PIPELINE ──
    if (entity.inTunnel) {
      if (entity.orientation === 'EAST' || entity.orientation === 'WEST') {
        if (!wasBlocked && entityId === 'player') {
          GameDiagnostics.logPlayer('BLKD', 'SOLID_WLL', hallId, entity.localZ);
          GameDiagnostics.captureSnapshot();
          wasBlocked = true;
        }
        return;
      }

      const movementSign = (entity.orientation === 'NORTH') ? -1 : 1;
      let targetZ = entity.localZ + deltaZ * movementSign;

      // ── FIXED: DIRECTION-AWARE NORTH LIP TUNNEL EXIT GATE ──
      if (targetZ <= 0.0) {
        // If tunnel direction was SOUTH, exiting North means backing out to the original entry hall
        // If tunnel direction was NORTH, exiting North means successfully reaching the next hall up
        const targetHallIdx = (entity.tunnelDirection === 'SOUTH') ? entity.currentHall : (entity.currentHall - 1);
        
        if (targetHallIdx >= 0 && targetHallIdx < GameState.constants.maxHalls) {
          const hallLocalZ = this.getGlobalXToLocalZ(targetHallIdx, entity.tunnelGlobalX);
          const hasOpening = this.isOpeningAt(targetHallIdx, hallLocalZ);
          
          entity.currentHall = targetHallIdx; 
          entity.inTunnel = false;
          entity.currentTunnelId = null;
          entity.localZ = hallLocalZ; 
          entity.justExitedTunnel = true; 
          
          if (hasOpening) {
            entity.inFakeHall = false;
            if (entityId === 'player') GameDiagnostics.logPlayer('EXT', 'EXT_TUN_N', this.getEntityHallId(entityId), entity.localZ);
          } else {
            entity.inFakeHall = true; // Safely hold entity inside the Tesseract Void Node
            if (entityId === 'player') GameDiagnostics.logPlayer('EXT', 'FAKE_HAL_N', this.getEntityHallId(entityId), entity.localZ);
          }
          GameDiagnostics.captureSnapshot();
        } else {
          entity.localZ = 0.0; 
        }
        return;
      }

      // ── FIXED: DIRECTION-AWARE SOUTH LIP TUNNEL EXIT GATE ──
      if (targetZ >= GameState.constants.hallLength) {
        // If tunnel direction was SOUTH, exiting South means successfully reaching the next hall down
        // If tunnel direction was NORTH, exiting South means backing out to the original entry hall
        const targetHallIdx = (entity.tunnelDirection === 'SOUTH') ? (entity.currentHall + 1) : entity.currentHall;
        
        if (targetHallIdx >= 0 && targetHallIdx < GameState.constants.maxHalls) {
          const hallLocalZ = this.getGlobalXToLocalZ(targetHallIdx, entity.tunnelGlobalX);
          const hasOpening = this.isOpeningAt(targetHallIdx, hallLocalZ);
          
          entity.currentHall = targetHallIdx;
          entity.inTunnel = false;
          entity.currentTunnelId = null;
          entity.localZ = hallLocalZ; 
          entity.justExitedTunnel = true; 
          
          if (hasOpening) {
            entity.inFakeHall = false;
            if (entityId === 'player') GameDiagnostics.logPlayer('EXT', 'EXT_TUN_S', this.getEntityHallId(entityId), entity.localZ);
          } else {
            entity.inFakeHall = true; // Safely hold entity inside the Tesseract Void Node
            if (entityId === 'player') GameDiagnostics.logPlayer('EXT', 'FAKE_HAL_S', this.getEntityHallId(entityId), entity.localZ);
          }
          GameDiagnostics.captureSnapshot();
        } else {
          entity.localZ = GameState.constants.hallLength; 
        }
        return;
      }

      entity.localZ = targetZ;
      return;
    }

    // ── CASE B: ENTITY IS WALKING LATERALLY WHILE FACING NORTH OR SOUTH ──
    if (entity.orientation === 'NORTH' || entity.orientation === 'SOUTH') {
      // FIX: Reject tunnel initialization loops if the decouple gate lock is armed
      if (entity.justExitedTunnel) return;

      const hasOpening = this.isOpeningAt(entity.currentHall, entity.localZ);

      let headingDirection = entity.orientation;
      if (deltaZ < 0) {
        headingDirection = (entity.orientation === 'SOUTH') ? 'NORTH' : 'SOUTH';
      }

      if (!hasOpening) {
        if (!wasBlocked && entityId === 'player') {
          GameDiagnostics.logPlayer('BLKD', 'SOLID_WLL', hallId, entity.localZ);
          GameDiagnostics.captureSnapshot();
          wasBlocked = true;
        }
        return;
      }

      if (headingDirection === 'NORTH' && entity.currentHall === 0) {
        if (!wasBlocked && entityId === 'player') {
          GameDiagnostics.logPlayer('BLKD', 'NORTH_OOB', hallId, entity.localZ);
          GameDiagnostics.captureSnapshot();
          wasBlocked = true;
        }
        return;
      }

      if (headingDirection === 'SOUTH' && entity.currentHall === GameState.constants.maxHalls - 1) {
        if (!wasBlocked && entityId === 'player') {
          GameDiagnostics.logPlayer('BLKD', 'SOUTH_OOB', hallId, entity.localZ);
          GameDiagnostics.captureSnapshot();
          wasBlocked = true;
        }
        return;
      }

      entity.inTunnel = true;
      entity.tunnelGlobalX = globalX; 
      entity.tunnelDirection = headingDirection;

      if (headingDirection === 'SOUTH') {
        entity.currentTunnelId = `X${globalX.toFixed(1)}_H${entity.currentHall + 1}_H${entity.currentHall + 2}`;
        entity.localZ = 0.0 + Math.abs(deltaZ); 
        if (entityId === 'player') GameDiagnostics.logPlayer('ENT', 'ENT_TUN_S', hallId, entity.localZ);
      } else {
        entity.currentTunnelId = `X${globalX.toFixed(1)}_H${entity.currentHall}_H${entity.currentHall + 1}`;
        entity.localZ = GameState.constants.hallLength - Math.abs(deltaZ); 
        if (entityId === 'player') GameDiagnostics.logPlayer('ENT', 'ENT_TUN_N', hallId, entity.localZ);
      }

      if (entityId === 'player' && !GameState.tunnels[entity.currentTunnelId]) {
        GameState.tunnels[entity.currentTunnelId] = {
          id: entity.currentTunnelId,
          globalX: globalX,
          startHall: entity.currentHall,
          endHall: headingDirection === 'SOUTH' ? (entity.currentHall + 1) : (entity.currentHall - 1)
        };
      }

      GameDiagnostics.captureSnapshot();
      return;
    }

    // ── CASE C: STANDARD HORIZONTAL EAST / WEST CORRIDOR DISPLACEMENT ──
    let targetZ = entity.localZ + deltaZ;
    if (targetZ < 0 || targetZ > GameState.constants.hallLength) return;
    entity.localZ = targetZ;
  },

  getSceneRenderContext() {
    return {
      player: GameState.player,
      ball: GameState.ball,
      activeHallLayout: GameState.halls[GameState.player.currentHall]
    };
  },

  getEntityHallId(entityId) {
    const entity = entityId === 'player' ? GameState.player : GameState.ball;
    if (!entity) return '??';
    const hall = GameState.halls[entity.currentHall];
    return hall ? hall.id : '??';
  },

  getBirdsEyeContext() {
    const player = GameState.player;
    const ball = GameState.ball;

    let playerGlobalX = player.inTunnel || player.inFakeHall ? player.tunnelGlobalX : this.getLocalZToGlobalX(player.currentHall, player.localZ, 'player');
    let playerHallContinuous = player.currentHall;
    if (player.inTunnel) {
      const progress = player.localZ / GameState.constants.hallLength;
      playerHallContinuous = (player.tunnelDirection === 'SOUTH') ? (player.currentHall + progress) : (player.currentHall - 1.0 + progress);
    }

    let ballGlobalX = ball.inTunnel || ball.inFakeHall ? ball.tunnelGlobalX : this.getLocalZToGlobalX(ball.currentHall, ball.localZ, 'ball');
    let ballHallContinuous = ball.currentHall;
    if (ball.inTunnel) {
      const progress = ball.localZ / GameState.constants.hallLength;
      ballHallContinuous = (ball.tunnelDirection === 'SOUTH') ? (ball.currentHall + progress) : (ball.currentHall - 1.0 + progress);
    }

    return {
      halls: GameState.halls.map(h => ({ id: h.id, worldXOffset: h.worldXOffset, openings: [...h.openings] })),
      tunnels: Object.values(GameState.tunnels),
      constants: { ...GameState.constants },
      player: {
        hall: playerHallContinuous,
        localZ: player.localZ,
        orientation: player.orientation,
        globalX: playerGlobalX,
        inTunnel: player.inTunnel,
        inFakeHall: player.inFakeHall,
        tunnelId: player.currentTunnelId,
        tunnelX: player.tunnelGlobalX,
        tunnelDir: player.tunnelDirection,
        decoupleLock: player.justExitedTunnel
      },
      ball: {
        hall: ballHallContinuous,
        localZ: ball.localZ,
        globalX: ballGlobalX,
        isAlive: ball.isAlive,
        inTunnel: ball.inTunnel,
        inFakeHall: ball.inFakeHall,
        tunnelId: ball.currentTunnelId,
        tunnelX: ball.tunnelGlobalX,
        tunnelDir: ball.tunnelDirection,
        decoupleLock: ball.justExitedTunnel
      }
    };
  }
};
