// GEMINI.3 player-movement.js
import { GameInterface } from './interface.js';

export const PlayerMovementSystem = {
  keysPressed: {},

  init() {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      this.keysPressed[key] = true;

      // FIXED ONE-SHOT CAPTURES: Triggers a clean, discrete 90-degree snap turn instantly
      if (key === 'a' || key === 'arrowleft') {
        GameInterface.turnPlayer('LEFT');
      }
      if (key === 'd' || key === 'arrowright') {
        GameInterface.turnPlayer('RIGHT');
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysPressed[e.key.toLowerCase()] = false;
    });
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
