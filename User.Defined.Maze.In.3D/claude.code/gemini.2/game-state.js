// GEMINI.2: game-state.js

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
  player: new GameEntity(0, 0.5), // Starts in H1 (index 0) near the West entrance
  ball: new GameEntity(0, 4.5),   // Starts in H1 halfway down the corridor

  // Define the 7 Horizontal Main Hallways
  halls: [
    { id: "H1", worldXOffset: 0.0,   openings: [1, 3, 5, 7] }, // Northmost Hall
    { id: "H2", worldXOffset: 1.5,   openings: [1, 3, 5, 7] }, // Shifted Eastward
    { id: "H3", worldXOffset: -0.5,  openings: [1, 3, 5, 7] }, // Shifted Westward
    { id: "H4", worldXOffset: 0.5,   openings: [1, 3, 5, 7] },
    { id: "H5", worldXOffset: -1.0,  openings: [1, 3, 5, 7] },
    { id: "H6", worldXOffset: 2.0,   openings: [1, 3, 5, 7] },
    { id: "H7", worldXOffset: 0.0,   openings: [1, 3, 5, 7] }  // Southmost Hall
  ],



  // Layout configuration matrix
  openings: new Set([1, 3, 5, 7]),

  // Environmental settings
  stoneVar: 20,
  baseWallBright: 56
};
