// GEMINI.3 ball-movement.js
import { GameInterface } from './interface.js';
import { BallMovementRules } from './ball-movement-rules.js';
import { GameDiagnostics } from './game-diagnostics.js';
import { BallMemorySystem } from './ball-memory.js';

let currentSpeed = 1.8; 
let isAtJunction = true; 
let lastJunctionTile = -1; // Tracks the last portal tile stopped at to prevent loops
let activeDecisionKey = null; // Temporarily stashes key to increment ONLY upon boundary cross

export const BallMovementSystem = {
  direction: 1, 

  update(deltaTime) {
    const context = GameInterface.getSceneRenderContext();
    const ball = context.ball;
    if (!ball.isAlive) return;

    const currentHallId = GameInterface.getEntityHallId('ball');
    const { hallLength } = GameInterface.getBirdsEyeContext().constants;
    
    // CRITICAL BUGFIX: Safely clear the sticky exit flag once ball rolls out of the exit door tile
    if (!ball.inTunnel && !ball.inFakeHall && Math.floor(ball.localZ) !== lastJunctionTile) {
      ball.justExitedTunnel = false;
    }

    // ── STEP 1: JUNCTION DETECTION & FORCED HALT (ONLY IN MAIN HALLWAYS) ──
    if (!ball.inTunnel && !ball.inFakeHall) {
      const currentTile = Math.floor(ball.localZ);
      
      if (currentTile !== lastJunctionTile) {
        if (GameInterface.isOpeningAt(ball.currentHall, ball.localZ)) {
          // Snap directly to center and drop speed to a dead stop
          ball.localZ = currentTile + 0.5;
          isAtJunction = true;
          lastJunctionTile = currentTile; // Latch this tile index

          // Count the horizontal traversal that brought the ball here so E/W weights
          // grow alongside tunnel (N/S) weights and the routing stays balanced.
          if (activeDecisionKey) {
            BallMemorySystem.incrementWeight(activeDecisionKey);
            activeDecisionKey = null;
          }

          GameDiagnostics.logBall('STP', 'JCT_HALT', currentHallId, ball.localZ);
        }
      }
    }

    // ── STEP 2: EVALUATE CHOICES FROM A JUNCTION HALT ──
    if (isAtJunction) {
      // If a key from the previous decision is still unresolved (no junction or structural
      // boundary was crossed since it was set, e.g. ball hit a wall between two openings),
      // count it now before overwriting — otherwise that traversal is lost.
      if (activeDecisionKey) {
        BallMemorySystem.incrementWeight(activeDecisionKey);
        activeDecisionKey = null;
      }

      const moveDecision = BallMovementRules.evaluateNextMove(ball);

      if (moveDecision) {
        const chosenDirection = moveDecision.direction;
        activeDecisionKey = moveDecision.key; // Stash key for Step 4 processing
        
        ball.orientation = chosenDirection;
        this.direction = (chosenDirection === 'WEST' || chosenDirection === 'NORTH') ? -1 : 1;
        isAtJunction = false;

        // On vertical tunnel transitions, snap physical state directly to tile centerline
        if ((chosenDirection === 'NORTH' || chosenDirection === 'SOUTH') && !ball.inTunnel && !ball.inFakeHall) {
          ball.localZ = Math.floor(ball.localZ) + 0.5;
          lastJunctionTile = -1; // Reset horizontal hallway tile tracking latch
        }

        GameDiagnostics.logBall('CHSE', `DIR_${chosenDirection[0]}`, currentHallId, ball.localZ);
      } else {
        this.direction *= -1;
        ball.orientation = (this.direction === 1) ? 'EAST' : 'WEST';
        isAtJunction = false;
        lastJunctionTile = -1;
        activeDecisionKey = null;
        
        GameDiagnostics.logBall('TURN', 'DEAD_END', currentHallId, ball.localZ);
        return;
      }
    }

    // ── STEP 3: RESUME MOVEMENT STEP DISPLACEMENT WITH SIGN RIGOR ──
    let magnitude = currentSpeed * deltaTime; 
    let deltaZ = magnitude;

    if (!ball.inTunnel && !ball.inFakeHall) {
      // Horizontal Corridor Movement uses signed deltas
      const moveDir = (ball.orientation === 'WEST') ? -1 : 1;
      let targetZ = ball.localZ + magnitude * moveDir;
      
      // Prevent hallway overshoot boundaries
      if (targetZ <= 0.05) {
        targetZ = 0.05;
        isAtJunction = true;
        lastJunctionTile = -1;
      } else if (targetZ >= hallLength - 0.05) {
        targetZ = hallLength - 0.05;
        isAtJunction = true;
        lastJunctionTile = -1;
      }
      deltaZ = targetZ - ball.localZ;

      // Ball is pinned against the wall — going this direction leads nowhere.
      // Increment its weight now so the opposite direction becomes competitive.
      if (deltaZ === 0 && activeDecisionKey) {
        BallMemorySystem.incrementWeight(activeDecisionKey);
        activeDecisionKey = null;
      }
    } else {
      // Inside active tunnel pipelines or Fake Hall void nodes, expect positive magnitudes
      deltaZ = magnitude;
    }

    // ── STEP 4: DISPATCH DISPLACEMENT TO FACADE & LATCH STATE SHIFTS ──
    const initialHall = ball.currentHall;
    const initialInTunnel = ball.inTunnel;
    const initialInFakeHall = ball.inFakeHall;
    const initialZ = ball.localZ;

    GameInterface.attemptEntityMovement('ball', deltaZ);

    // Enforce mandatory junction stop re-evaluation when crossing any structural space boundary
    if (
      (initialInTunnel !== ball.inTunnel) || 
      (initialInFakeHall !== ball.inFakeHall) || 
      (initialHall !== ball.currentHall) ||
      (ball.localZ === initialZ && deltaZ !== 0)
    ) {
      isAtJunction = true;

      // CRITICAL THRESHOLD MEMORY RULE: Only increment weights upon a genuine structural space mutation!
      if (activeDecisionKey) {
        BallMemorySystem.incrementWeight(activeDecisionKey);
        activeDecisionKey = null; // Clear out choice latch securely
      }
    }
  }
};
