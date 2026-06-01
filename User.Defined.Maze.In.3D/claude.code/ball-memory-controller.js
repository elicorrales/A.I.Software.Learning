// ball-memory-controller.js
// =========================================================================
// BALL SESSION MEMORY — public facade for the BALL AI layer.
// Storage lives in My3dMazeAppState.ballMemory (TRUTH layer).
// All reads and writes go through window.MazeInterface (INTERFACE layer).
// This file never touches app state directly.
// =========================================================================

(function() {

  function recordEntry(hallwayId, gx, toHallwayId) {
    window.MazeInterface.recordBallEntry(hallwayId, gx, toHallwayId);
  }

  function recordBlock(hallwayId, gx, toHallwayId) {
    window.MazeInterface.recordBallBlock(hallwayId, gx, toHallwayId);
  }

  function getEntryCount(hallwayId, gx, toHallwayId) {
    return window.MazeInterface.getBallEntryCount(hallwayId, gx, toHallwayId);
  }

  function getBlockCount(hallwayId, gx, toHallwayId) {
    return window.MazeInterface.getBallBlockCount(hallwayId, gx, toHallwayId);
  }

  function getSnapshot() {
    return window.MazeInterface.getBallMemorySnapshot();
  }

  function getSummaryText() {
    return window.MazeInterface.getBallMemorySummaryText();
  }

  window.BallMemory = {
    recordEntry,
    recordBlock,
    getEntryCount,
    getBlockCount,
    getSnapshot,
    getSummaryText
  };

})();
