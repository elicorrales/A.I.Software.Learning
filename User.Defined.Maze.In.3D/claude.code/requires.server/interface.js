// GEMINI.3 interface.js
import { GameState } from './game-state.js';

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

  // --- Entity Movement Processing ---
  attemptEntityMovement(entityId, deltaZ) {
    const entity = entityId === 'player' ? GameState.player : GameState.ball;
    if (!entity) return;

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
  // RULE 1: Allows diagnostics to get readable string labels (e.g. "H1") via index
  getEntityHallId(entityId) {
    const entity = entityId === 'player' ? GameState.player : GameState.ball;
    if (!entity) return '??';
    const hall = GameState.halls[entity.currentHall];
    return hall ? hall.id : '??';
  },

  // ── ARCHITECTURAL EXTENSION ───────────────────────────────────────────────
  // RULE 1/1b: The 2D map module queries state STRICTLY through this façade door
  getBirdsEyeContext() {
    return {
      // Maps a deep primitive copy to prevent downstream reference leak mutations
      halls: GameState.halls.map(h => ({ id: h.id, worldXOffset: h.worldXOffset, openings: [...h.openings] })),
      constants: { ...GameState.constants },
      player: {
        hall: GameState.player.currentHall,
        localZ: GameState.player.localZ,
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
