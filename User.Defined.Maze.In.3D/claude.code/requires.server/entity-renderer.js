// GEMINI.3 entity-renderer.js
import { lerp } from './geometry-utils.js';

const BALL_BASE_RADIUS = 256;

export function render3DBall(ctx, renderContext, metrics) {
  const ball = renderContext.ball;
  const player = renderContext.player;
  const isWest = (player.orientation === 'WEST');

  const { Z_NEAR, HALL_WIDTH, CX, BOTTOM, VPY } = metrics;

  const worldZBall = isWest ? (player.localZ - ball.localZ) : (ball.localZ - player.localZ);
  const distBall = worldZBall + Z_NEAR;
  if (distBall <= 0.05) return; 

  const scale = Z_NEAR / distBall;
  const depth = 1.0 - scale;
  const widthAtDepth = lerp(HALL_WIDTH, 0, depth);
  const ballX = CX + ball.localX * widthAtDepth;
  const ballFloorY = BOTTOM - (BOTTOM - VPY) * depth;
  const radius = Math.max(2, BALL_BASE_RADIUS * (1 - depth));
  const ballCenterY = ballFloorY - radius;

  // 1. Drop Shadow Vector
  ctx.save();
  const shadowGrad = ctx.createRadialGradient(ballX, ballFloorY, 0, ballX, ballFloorY, radius * 1.6);
  shadowGrad.addColorStop(0, 'rgba(0,0,0,0.65)'); shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadowGrad; ctx.beginPath(); ctx.ellipse(ballX, ballFloorY, radius * 1.6, radius * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // 2. 3D Core Core Sphere
  ctx.save();
  const ballGrad = ctx.createRadialGradient(ballX - radius * 0.3, ballCenterY - radius * 0.3, radius * 0.05, ballX, ballCenterY, radius);
  ballGrad.addColorStop(0, '#fff2cc'); ballGrad.addColorStop(0.2, '#ffaa44'); ballGrad.addColorStop(0.7, '#994400'); ballGrad.addColorStop(1, '#260a00');
  ctx.fillStyle = ballGrad; ctx.beginPath(); ctx.arc(ballX, ballCenterY, radius, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = Math.max(0.5, 1.5 * (1 - depth)); ctx.stroke();
  ctx.restore();
}
