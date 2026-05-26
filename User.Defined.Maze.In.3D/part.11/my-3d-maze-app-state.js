// my-3d-maze-app-state.js
window.My3dMazeAppState = {
  // Constants
  ENGINE_3D_NODES: [0.0, 0.35, 0.75, 1.25, 1.95, 2.7, 3.95, 5.0, 5.75],
  UNIFORM_2D_DOORS: [0.0, 1.0, 2.0, 3.0, 4.0],
  BASE_SPEED: 0.04,

  // Live Core Models
  user: {
    forwardOffset: 0,
    nodeIndex: 0,
    direction: 0,
    directionString: "East",
    isMovingForward: false,
    isMovingBackward: false,
    isShiftPressed: false,
    speed: 0.04, // Set to match BASE_SPEED initially
    flashFrames: 0,
    movementMode: 'normal',
    transitionProgress: 0.0,
    interconnectingProgress: 0.0,
  },

  WorldGrid: {
    mainHallways: [],
    interconnectingHallways: [],
    name: "DiagnosticWorldGridMonitor"
  },

  // Active Context Container
  activeHallway: null,

  smokeParticles: [],

  // UI Metrics
  UI_SCALE: {
    currentGridScale: 1.0,
    SCALE_STEP: 0.1,
    MIN_SCALE: 0.5,
    MAX_SCALE: 3.0
  },

  UNIQUE_HALLWAY_COLORS: [
    { near: '#556b2f', far: '#a0522d' },
    { near: '#4682b4', far: '#d2691e' },
    { near: '#8b0000', far: '#483d8b' },
    { near: '#2e8b57', far: '#8b008b' },
    { near: '#b8860b', far: '#008b8b' },
    { near: '#5c3a21', far: '#708090' },
    { near: '#4a0e4e', far: '#2f4f4f' }
  ],

};

