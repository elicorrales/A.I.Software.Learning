// GEMINI.3 player-movement.js
import { GameInterface } from './interface.js';

export const PlayerMovementSystem = {
  keysPressed: {},

  init() {
    window.addEventListener('keydown', (e) => this.keysPressed[e.key.toLowerCase()] = true);
    window.addEventListener('keyup', (e) => this.keysPressed[e.key.toLowerCase()] = false);
  },

  update(deltaTime) {
    const moveSpeed = 2.5 * deltaTime; // World units per second

    if (this.keysPressed['w'] || this.keysPressed['arrowup']) {
      GameInterface.attemptEntityMovement('player', moveSpeed);
    }
    if (this.keysPressed['s'] || this.keysPressed['arrowdown']) {
      GameInterface.attemptEntityMovement('player', -moveSpeed);
    }
  }
};
