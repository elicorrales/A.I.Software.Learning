// GEMINI.3 game-state.js

// Shared structural schema for entities (Player and Ball)
class GameEntity {
  constructor(hallIndex, localZ) {
    this.currentHall = hallIndex; // 0 to 6 (H1 to H7)
    this.localX = 0.0;           // -0.5 (Left wall) to 0.5 (Right wall)
    this.localZ = localZ;        // 0.0 (West end) to 9.0 (East end)
    this.orientation = 'EAST';   // Snapped Compass Heading: 'EAST', 'SOUTH', 'WEST', 'NORTH'
    this.speed = 0.0;            // Current travel velocity
    this.isAlive = true;         // State flag
    
    // ── ADDED FOR STEP 2: CONTINUOUS TUNNEL DISPLACEMENT TRACKERS ──
    this.inTunnel = false;        // Binary state controller: true flags active vertical navigation
    this.currentTunnelId = null;  // Unique coordinate string key matching the active tunnel object
  }
}

// Allowed horizontal offsets pool to restrict doors to exactly 7 fixed global tracks
const ALLOWED_EVEN_OFFSETS = [-2.0, 0.0, 2.0, 4.0];

export const GameState = {
  player: new GameEntity(0, 0.0), // Starts in H1 (index 0) at the West entrance facing EAST
  ball: new GameEntity(0, 4.5),   // Starts in H1 halfway down the corridor

  // Define the 7 Horizontal Main Hallways with placeholder offsets
  halls: [
    { id: "H1", worldXOffset: 0.0,   openings: [1, 3, 5, 7] }, // Northmost Hall
    { id: "H2", worldXOffset: 0.0,   openings: [1, 3, 5, 7] }, 
    { id: "H3", worldXOffset: 0.0,   openings: [1, 3, 5, 7] }, 
    { id: "H4", worldXOffset: 0.0,   openings: [1, 3, 5, 7] }, 
    { id: "H5", worldXOffset: 0.0,   openings: [1, 3, 5, 7] }, 
    { id: "H6", worldXOffset: 0.0,   openings: [1, 3, 5, 7] }, 
    { id: "H7", worldXOffset: 0.0,   openings: [1, 3, 5, 7] }  // Southmost Hall
  ],

  // ── ADDED FOR STEP 2: PROCEDURAL PERSISTENT TUNNEL STORAGE MATRIX ──
  tunnels: {}, // Key syntax will look like: "X3.0_H1_H2" to persistently map segments

  constants: {
    hallLength: 9.0,
    maxHalls: 7
  },

  // Procedural generation routine that runs automatically on every boot/page load
  initializeRandomOffsets() {
    this.halls.forEach((hall) => {
      // Pull a random offset index safely from our even-integer constraint matrix
      const randomIndex = Math.floor(Math.random() * ALLOWED_EVEN_OFFSETS.length);
      hall.worldXOffset = ALLOWED_EVEN_OFFSETS[randomIndex];
    });

    // Enforce that the starting position for the player and ball are updated to match H1's random offset
    this.player.localZ = 0.0;
    this.player.orientation = 'EAST';
    this.ball.localZ = 4.5;
    
    // Clear out any stale session tunnel objects upon hot reload resets
    this.tunnels = {};
  }
};

// Execute procedural alignment randomization cleanly on initialization
GameState.initializeRandomOffsets();
