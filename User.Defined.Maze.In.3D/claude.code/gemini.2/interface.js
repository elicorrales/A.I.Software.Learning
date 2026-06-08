// GEMINI.2 interface.js
import { GameState } from './game-state.js';

export const GameInterface = {
  // --- Movement Commands ---
  moveForward(amount) {
    GameState.playerZ = Math.min(GameState.numSegments, GameState.playerZ + amount);
  },

  moveBackward(amount) {
    GameState.playerZ = Math.max(0, GameState.playerZ - amount);
  },

  // --- Semantic Queries for Upper Layers ---
  getPlayerPosition() {
    return GameState.playerZ;
  },

  isPlayerAtOpening() {
    const currentSegment = Math.floor(GameState.playerZ);
    return GameState.openings.has(currentSegment);
  },

  // Translates raw state variables into a clean snapshot data package for the renderer
  getRenderContext() {
    return {
      playerZ: GameState.playerZ,
      numSegments: GameState.numSegments,
      openings: GameState.openings,
      stoneBright: GameState.baseWallBright,
      stoneVar: GameState.stoneVar
    };
  }
};
