// GEMINI.3 interface.js
import { GameState } from './game-state.js';

// Sequential clockwise indexing loop representing looking directions around a compass
const DIRECTIONS = ['EAST', 'SOUTH', 'WEST', 'NORTH'];

export const GameInterface = {
  // --- Structural Space Translators ---
  getLocalZToGlobalX(hallIndex, localZ) {
    const hall = GameState.halls[hallIndex];
    return hall.worldXOffset + localZ;
  },

  getGlobalXToLocalZ(targetHallIndex, globalX) {
    const targetHall = GameState.halls[targetHallIndex];
    return globalX - targetHall.worldXOffset;
  },

  // --- Semantic Environment Queries ---
  isOpeningAt(hallIndex, localZ) {
    const roundedZ = Math.floor(localZ);
    const hall = GameState.halls[hallIndex];
    return hall.openings.includes(roundedZ);
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

  // ── INJECTED DISCRETE COMPASS ROTATION MATRIX MACHINE ──────────────────────
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

    // IMPLEMENTATION: Automatically snap to segment center-line upon entering 90-deg angles
    if (nextOrientation === 'NORTH' || nextOrientation === 'SOUTH') {
      GameState.player.localZ = Math.floor(GameState.player.localZ) + 0.5;
    }
  },

  // --- Entity Movement Processing ---
  attemptEntityMovement(entityId, deltaZ) {
    const entity = entityId === 'player' ? GameState.player : GameState.ball;
    if (!entity) return;

    // RULE IMPLEMENTATION: If player is looking North/South, completely block step displacement for now
    if (entityId === 'player' && (entity.orientation === 'NORTH' || entity.orientation === 'SOUTH')) {
      return; 
    }

    let targetZ = entity.localZ + deltaZ;

    if (targetZ < 0 || targetZ > GameState.constants.hallLength) {
      return; // Cap hard boundaries
    }

    entity.localZ = targetZ; // Safely modifies true state point references
  },

  // Packaging method tailored for the 3D first-person renderer
  getSceneRenderContext() {
    return {
      player: GameState.player,
      ball: GameState.ball,
      activeHallLayout: GameState.halls[GameState.player.currentHall]
    };
  },

  // ── DIAGNOSTIC LOGGING UTILITIES ──────────────────────────────────────────
  getEntityHallId(entityId) {
    const entity = entityId === 'player' ? GameState.player : GameState.ball;
    if (!entity) return '??';
    const hall = GameState.halls[entity.currentHall];
    return hall ? hall.id : '??';
  },

  // ── ARCHITECTURAL EXTENSION ───────────────────────────────────────────────
  getBirdsEyeContext() {
    return {
      halls: GameState.halls.map(h => ({ id: h.id, worldXOffset: h.worldXOffset, openings: [...h.openings] })),
      constants: { ...GameState.constants },
      player: {
        hall: GameState.player.currentHall,
        localZ: GameState.player.localZ,
        orientation: GameState.player.orientation, // Passed down to draw orientation indicators
        globalX: this.getLocalZToGlobalX(GameState.player.currentHall, GameState.player.localZ)
      },
      ball: {
        hall: GameState.ball.currentHall,
        localZ: GameState.ball.localZ,
        globalX: this.getLocalZToGlobalX(GameState.ball.currentHall, GameState.ball.localZ),
        isAlive: GameState.ball.isAlive
      }
    };
  }
};
