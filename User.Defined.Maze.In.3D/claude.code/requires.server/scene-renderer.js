// GEMINI.3 scene-renderer.js
import { getSegmentEdges } from './geometry-utils.js';
import { render3DBall } from './entity-renderer.js';
import { renderTorchesAndLighting, renderDepthFog, renderPostProcessingOverlays } from './lighting-renderer.js';
import { renderForwardScene } from './forward-renderer.js';
import { renderLateralScene } from './lateral-renderer.js';

let W, H, CX, CY, LEFT, RIGHT, TOP, BOTTOM, VPX, VPY, HALL_WIDTH, HALL_HEIGHT;
const NUM_SEGMENTS = 9;
const Z_NEAR = 1.0; 

export function initRenderer(canvasElement) {
  const verticalOverhead = 106;
  const horizontalOverhead = 40;

  W = window.innerWidth - horizontalOverhead;
  H = window.innerHeight - verticalOverhead;
  canvasElement.width = W;
  canvasElement.height = H;

  CX = W / 2;
  CY = H / 2;
  HALL_WIDTH = W * 0.72;
  HALL_HEIGHT = H * 0.78;
  LEFT = (W - HALL_WIDTH) / 2;
  RIGHT = LEFT + HALL_WIDTH;
  TOP = (H - HALL_HEIGHT) / 2;
  BOTTOM = TOP + HALL_HEIGHT;
  VPX = CX;
  VPY = CY - H * 0.04;
}

// ── MAIN DRAW INTERFACE CONTROL CONTEXT ───────────────────────────────────────
export function drawScene(ctx, renderContext, time) {
  const player = renderContext.player;
  const orientation = player.orientation;
  const playerZ = player.localZ;
  const activeOpenings = renderContext.activeHallLayout.openings;

  const metrics = { NUM_SEGMENTS, Z_NEAR, LEFT, RIGHT, TOP, BOTTOM, VPX, VPY, HALL_WIDTH, HALL_HEIGHT, CX, CY, W, H };

  // ── ROUTER DIRECTION CONTROLLER ──
  if (orientation === 'NORTH' || orientation === 'SOUTH') {
    renderLateralScene(ctx, renderContext, metrics);
    return;
  }

  // ── FORWARD PERSPECTIVE PIPELINE (EAST / WEST) ──
  const dynamicSegs = getSegmentEdges(playerZ, orientation, metrics);

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#1c140a'; ctx.fillRect(0, 0, W, H);

  // Structural wall mapping
  renderForwardScene(ctx, renderContext, dynamicSegs, metrics);

  // Environmental atmospherics & layers
  const fxMetrics = { NUM_SEGMENTS, VPX, VPY, CX, CY, W, H };
  renderDepthFog(ctx, dynamicSegs, fxMetrics);
  renderTorchesAndLighting(ctx, dynamicSegs, activeOpenings, time, fxMetrics, orientation);

  const isSameHall = renderContext.ball.currentHall === player.currentHall;
  if (isSameHall) {
    const entityMetrics = { Z_NEAR, HALL_WIDTH, CX, BOTTOM, VPY };
    render3DBall(ctx, renderContext, entityMetrics);
  }

  renderPostProcessingOverlays(ctx, fxMetrics);
}
