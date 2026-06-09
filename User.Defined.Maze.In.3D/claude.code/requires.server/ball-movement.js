// GEMINI.3 ball-movement.js
import { GameInterface } from './interface.js';

export const BallMovementSystem = {
  direction: 1, // Track travel vector heading inside system memory context

  update(deltaTime) {
    const context = GameInterface.getSceneRenderContext();
    if (!context.ball.isAlive) return;

    const speed = 1.8;
    let deltaZ = speed * deltaTime * this.direction;
    let targetZ = context.ball.localZ + deltaZ;

    // PREVENT OVERSHOOT FREEZE: Handle boundaries dynamically before requesting state mutation
    if (targetZ <= 0.05) {
      this.direction = 1;   // Snap direction outward
      targetZ = 0.05;        // Clamp safely onto near entrance lip
    } else if (targetZ >= 8.95) {
      this.direction = -1;  // Snap direction backward
      targetZ = 8.95;        // Clamp cleanly against back brick wall
    }

    // Submit the precise normalized delta step to the interface façade door
    const correctedDelta = targetZ - context.ball.localZ;
    GameInterface.attemptEntityMovement('ball', correctedDelta);
  }
};
