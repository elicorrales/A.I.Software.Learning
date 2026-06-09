// GEMINI.3 game-state.js

// Shared structural schema for entities (Player and Ball)
class GameEntity {
  constructor(hallIndex, localZ) {
    this.currentHall = hallIndex; // 0 to 6 (H1 to H7)
    this.localX = 0.0;           // -0.5 (Left wall) to 0.5 (Right wall)
    this.localZ = localZ;        // 0.0 (West end) to 9.0 (East end)
    this.orientation = 0.0;      // Angle in radians
    this.speed = 0.0;            // Current travel velocity
    this.isAlive = true;         // State flag
  }
}

export const GameState = {
  player: new GameEntity(0, 0.0), // Starts in H1 (index 0) at the West entrance
  ball: new GameEntity(0, 4.5),   // Starts in H1 halfway down the corridor

  // Define the 7 Horizontal Main Hallways Snapped to a Unified Even-Integer Grid
  halls: [
    { id: "H1", worldXOffset: 0.0,   openings: [1, 3, 5, 7] }, // Global X: 1, 3, 5, 7
    { id: "H2", worldXOffset: 2.0,   openings: [1, 3, 5, 7] }, // Global X: 3, 5, 7, 9
    { id: "H3", worldXOffset: 0.0,   openings: [1, 3, 5, 7] }, // Aligned with H1
    { id: "H4", worldXOffset: -2.0,  openings: [1, 3, 5, 7] }, // Global X: -1, 1, 3, 5
    { id: "H5", worldXOffset: 0.0,   openings: [1, 3, 5, 7] }, // Aligned with H1
    { id: "H6", worldXOffset: 2.0,   openings: [1, 3, 5, 7] }, // Global X: 3, 5, 7, 9
    { id: "H7", worldXOffset: 0.0,   openings: [1, 3, 5, 7] }  // Global X: 1, 3, 5, 7
  ],

  constants: {
    hallLength: 9.0,
    maxHalls: 7
  }
};
