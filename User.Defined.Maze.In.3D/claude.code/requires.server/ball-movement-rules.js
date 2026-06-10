// GEMINI.3 ball-movement-rules.js
import { GameInterface } from './interface.js';
import { BallMemorySystem } from './ball-memory.js';
import { GameDiagnostics } from './game-diagnostics.js';

export const BallMovementRules = {
  evaluateNextMove(ball) {
    const currentHallIdx = ball.currentHall;
    const currentHallId = GameInterface.getEntityHallId('ball');
    const localZ = ball.localZ;
    
    const birdsEyeContext = GameInterface.getBirdsEyeContext();
    const { maxHalls, hallLength } = birdsEyeContext.constants;

    const baseGlobalX = ball.inTunnel || ball.inFakeHall 
      ? ball.tunnelGlobalX 
      : GameInterface.getLocalZToGlobalX(currentHallIdx, localZ, 'ball');

    const directions = ['EAST', 'WEST', 'NORTH', 'SOUTH'];
    const validOptions = [];
    let evalTrace = "";

    directions.forEach(dir => {
      if (dir === 'NORTH' && currentHallIdx === 0 && !ball.inTunnel && !ball.inFakeHall) return;
      if (dir === 'SOUTH' && currentHallIdx === maxHalls - 1 && !ball.inTunnel && !ball.inFakeHall) return;

      let isValid = false;
      let evaluationX = baseGlobalX;

      if (ball.inFakeHall) {
        if (dir === 'NORTH' || dir === 'SOUTH') {
          isValid = this.checkTunnelAvailability(currentHallIdx, evaluationX, dir, birdsEyeContext.tunnels);
        }
      } else if (ball.inTunnel) {
        if (dir === 'NORTH' || dir === 'SOUTH') {
          isValid = true;
        }
      } else {
        if (dir === 'EAST') {
          isValid = (localZ < hallLength);
        } else if (dir === 'WEST') {
          isValid = (localZ > 0.0);
        } else if (dir === 'NORTH' || dir === 'SOUTH') {
          const matchesOpening = GameInterface.isOpeningAt(currentHallIdx, localZ);
          if (matchesOpening) {
            const alignedZ = Math.floor(localZ) + 0.5;
            evaluationX = GameInterface.getLocalZToGlobalX(currentHallIdx, alignedZ, 'ball');
            isValid = this.checkTunnelAvailability(currentHallIdx, evaluationX, dir, birdsEyeContext.tunnels);
          }
        }
      }

      if (isValid) {
        const key = BallMemorySystem.generateKey(currentHallId, evaluationX, dir);
        const weight = BallMemorySystem.getWeight(key);
        validOptions.push({ direction: dir, key, weight });
        evalTrace += `${dir[0]}:${weight} `;
      }
    });

    if (evalTrace.length > 0) {
      GameDiagnostics.logBall('EVAL', evalTrace.trim(), currentHallId, localZ);
    }

    if (validOptions.length === 0) return null;

    // No-backward rule: don't reverse direction unless it's the only option.
    // Applies at hallway junctions AND inside tunnels — the ball just came from somewhere
    // and should not treat "where it came from" as the lowest-tries path to prefer.
    const OPPOSITE = { EAST: 'WEST', WEST: 'EAST', NORTH: 'SOUTH', SOUTH: 'NORTH' };
    const atJunction = !ball.inTunnel && !ball.inFakeHall && GameInterface.isOpeningAt(currentHallIdx, localZ);
    let selectFrom = validOptions;
    if (atJunction || ball.inTunnel) {
      const forwardOptions = validOptions.filter(opt => opt.direction !== OPPOSITE[ball.orientation]);
      if (forwardOptions.length > 0) selectFrom = forwardOptions;
    }

    let minWeight = Infinity;
    selectFrom.forEach(opt => {
      if (opt.weight < minWeight) minWeight = opt.weight;
    });

    const bestChoices = selectFrom.filter(opt => opt.weight === minWeight);
    const selected = bestChoices[Math.floor(Math.random() * bestChoices.length)];

    // Decouple increment behavior from pure evaluation processing
    return { direction: selected.direction, key: selected.key };
  },

  checkTunnelAvailability(hallIdx, globalX, direction, activeTunnels) {
    const targetTunnelId = (direction === 'SOUTH')
      ? `X${globalX.toFixed(1)}_H${hallIdx + 1}_H${hallIdx + 2}`
      : `X${globalX.toFixed(1)}_H${hallIdx}_H${hallIdx + 1}`;
    
    return activeTunnels.some(t => t.id === targetTunnelId);
  }
};
