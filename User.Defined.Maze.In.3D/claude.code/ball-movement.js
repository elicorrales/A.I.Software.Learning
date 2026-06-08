// GEMINI.3 ball-movement.js
import { GameInterface } from './interface.js';

export const BallMovementSystem = {
  direction: 1, // Track travel vector heading inside system memory context

  update(deltaTime) {
    const context = GameInterface.getSceneRenderContext();
    if (!context.ball.isAlive) return;

    const autoSpeed = 1.8 * deltaTime;
    
    // FIX: Turn around right before the absolute physical end-caps of the hallway
    if (context.ball.localZ >= 7.95) this.direction = -1; // Bounces perfectly off the far brick wall
    if (context.ball.localZ <= 0.05) this.direction = 1;  // Bounces perfectly at the near entrance lip

    GameInterface.attemptEntityMovement('ball', autoSpeed * this.direction);
  }
};
