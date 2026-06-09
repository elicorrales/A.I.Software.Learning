// GEMINI.3 player-movement.js
import { GameInterface } from './interface.js';

export const PlayerMovementSystem = {
  keysPressed: {},

  init() {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      this.keysPressed[key] = true;

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
    const context = GameInterface.getSceneRenderContext();
    const orientation = context.player.orientation;
    
    // Reverse travel vector sign if looking WEST so forward goes toward Z=0
    const directionModifier = (orientation === 'WEST') ? -1 : 1;
    const moveSpeed = 2.5 * deltaTime * directionModifier;

    if (this.keysPressed['w'] || this.keysPressed['arrowup']) {
      GameInterface.attemptEntityMovement('player', moveSpeed);
    }
    if (this.keysPressed['s'] || this.keysPressed['arrowdown']) {
      GameInterface.attemptEntityMovement('player', -moveSpeed);
    }
  }
};
