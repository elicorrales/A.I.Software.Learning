// GEMINI.3 interface.js
import { GameState } from './game-state.js';
import { GameDiagnostics } from './game-diagnostics.js';

const DIRECTIONS = ['EAST', 'SOUTH', 'WEST', 'NORTH'];
let wasBlocked = false;

export const GameInterface = {
  // --- Structural Space Translators ---
  getLocalZToGlobalX(hallIndex, localZ) {
    if (GameState.player.inTunnel && hallIndex === GameState.player.currentHall) {
      return GameState.player.tunnelGlobalX;
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

    const globalX = this.getLocalZToGlobalX(sourceHallIndex, sourceLocalZ);
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

    // FIX: Clear the decouple gate lock instantly if the player turns their gaze
    GameState.player.justExitedTunnel = false;

    if (nextOrientation === 'NORTH' || nextOrientation === 'SOUTH') {
      GameState.player.localZ = Math.floor(GameState.player.localZ) + 0.5;
    }
  },

  attemptEntityMovement(entityId, deltaZ) {
    const entity = entityId === 'player' ? GameState.player : GameState.ball;
    if (!entity) return;

    // FIX: Reset tracking blocks and clear the decouple gate the instant input rest velocity is hit
    if (deltaZ === 0) {
      wasBlocked = false;
      entity.justExitedTunnel = false;
      return;
    }

    const hallId = this.getEntityHallId(entityId);

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

      // ── PROCEDURAL TUNNEL EXIT GATES ──
      if (targetZ <= 0.0) {
        const targetHallIdx = entity.currentHall;
        const hallLocalZ = this.getGlobalXToLocalZ(targetHallIdx, entity.tunnelGlobalX);
        
        entity.inTunnel = false;
        entity.currentTunnelId = null;
        entity.localZ = hallLocalZ; 
        
        // FIX: Arm the decouple filter gate to prevent instant vacuum-back loops
        entity.justExitedTunnel = true;
        
        if (entityId === 'player') {
          GameDiagnostics.logPlayer('EXT', 'EXT_TUN_N', this.getEntityHallId(entityId), entity.localZ);
          GameDiagnostics.captureSnapshot();
        }
        return;
      }

      if (targetZ >= GameState.constants.hallLength) {
        const targetHallIdx = entity.currentHall + 1;
        
        if (targetHallIdx < GameState.constants.maxHalls) {
          const hallLocalZ = this.getGlobalXToLocalZ(targetHallIdx, entity.tunnelGlobalX);
          entity.currentHall = targetHallIdx;
          entity.inTunnel = false;
          entity.currentTunnelId = null;
          entity.localZ = hallLocalZ; 
          
          // FIX: Arm the decouple filter gate to prevent instant vacuum-back loops
          entity.justExitedTunnel = true;
          
          if (entityId === 'player') {
            GameDiagnostics.logPlayer('EXT', 'EXT_TUN_S', this.getEntityHallId(entityId), entity.localZ);
            GameDiagnostics.captureSnapshot();
          }
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

      const globalX = this.getLocalZToGlobalX(entity.currentHall, entity.localZ);
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

    let playerGlobalX = player.inTunnel ? player.tunnelGlobalX : this.getLocalZToGlobalX(player.currentHall, player.localZ);
    let playerHallContinuous = player.currentHall;
    if (player.inTunnel) {
      const progress = player.localZ / GameState.constants.hallLength;
      playerHallContinuous = (player.tunnelDirection === 'SOUTH') ? (player.currentHall + progress) : (player.currentHall - 1.0 + progress);
    }

    let ballGlobalX = ball.inTunnel ? ball.tunnelGlobalX : this.getLocalZToGlobalX(ball.currentHall, ball.localZ);
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
        // ── EXPANDED TELEMETRY TRACERS ──
        inTunnel: player.inTunnel,
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
        // ── EXPANDED TELEMETRY TRACERS ──
        inTunnel: ball.inTunnel,
        tunnelId: ball.currentTunnelId,
        tunnelX: ball.tunnelGlobalX,
        tunnelDir: ball.tunnelDirection,
        decoupleLock: ball.justExitedTunnel
      }
    };
  }
};
