// GEMINI.3 player-movement.js
import { GameInterface } from './interface.js';
import { GameDiagnostics } from './game-diagnostics.js';
import { PlayerSoundSystem } from './player-sounds.js'; 

export const PlayerMovementSystem = {
  keysPressed: {},

  init() {
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      this.keysPressed[key] = true;

      if (key === 'arrowleft') {
        GameInterface.turnPlayer('LEFT');
        
        const hallId = GameInterface.getEntityHallId('player');
        const localZ = GameInterface.getSceneRenderContext().player.localZ;
        GameDiagnostics.logPlayer('ROT', 'TURN_LFT', hallId, localZ);
        GameDiagnostics.captureSnapshot();
      }
      if (key === 'arrowright') {
        GameInterface.turnPlayer('RIGHT');
        
        const hallId = GameInterface.getEntityHallId('player');
        const localZ = GameInterface.getSceneRenderContext().player.localZ;
        GameDiagnostics.logPlayer('ROT', 'TURN_RGT', hallId, localZ);
        GameDiagnostics.captureSnapshot();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysPressed[e.key.toLowerCase()] = false;
    });
  },

  update(deltaTime) {
    const context = GameInterface.getSceneRenderContext();
    const player = context.player;
    const orientation = player.orientation;
    
    const activeVelocity = 2.5; 

    const directionModifier = (orientation === 'WEST') ? -1 : 1;
    const moveSpeed = activeVelocity * deltaTime * directionModifier;

    let didMoveThisFrame = false;
    let tryingToMove = false;

    // Capture movement intentions explicitly
    if (this.keysPressed['arrowup']) {
      tryingToMove = true;
      didMoveThisFrame = GameInterface.attemptEntityMovement('player', moveSpeed);
    } else if (this.keysPressed['arrowdown']) {
      tryingToMove = true;
      didMoveThisFrame = GameInterface.attemptEntityMovement('player', -moveSpeed);
    }

    // Send translation successes and raw interaction intent down to the audio system
    PlayerSoundSystem.update(deltaTime, didMoveThisFrame, tryingToMove);
  }
};
