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

export function drawScene(ctx, renderContext, time) {
  const player = renderContext.player;
  const orientation = player.orientation;
  const playerZ = player.localZ;

  const metrics = { NUM_SEGMENTS, Z_NEAR, LEFT, RIGHT, TOP, BOTTOM, VPX, VPY, HALL_WIDTH, HALL_HEIGHT, CX, CY, W, H };

  // Setup situational lateral checking rules (Hall: N/S is side. Tunnel: E/W is side)
  let isLateralView = (!player.inTunnel && (orientation === 'NORTH' || orientation === 'SOUTH')) ||
                      (player.inTunnel && (orientation === 'EAST' || orientation === 'WEST'));

  // ── DYNAMIC THRESHOLD COMPILER FOR THE 3-ZONE ILLUSION PIPELINE ──
  let activeOpenings = [];
  
  if (player.inFakeHall) {
    // FIX: Force ALL views within a fake hall void node to project as lateral wall matrices
    isLateralView = true; 
    if (orientation === 'NORTH' || orientation === 'SOUTH') {
      activeOpenings = [Math.floor(playerZ)]; // Compiles the appearance of a lateral tunnel entry door
    } else {
      activeOpenings = []; // Compiles a solid masonry wall panel with side torches
    }
  } else if (player.inTunnel) {
    if (orientation === 'SOUTH') {
      if (playerZ < 1.5) activeOpenings.push(0); 
      if (playerZ > 7.5) activeOpenings.push(8); 
    } else if (orientation === 'NORTH') {
      if (playerZ > 7.5) activeOpenings.push(0); 
      if (playerZ < 1.5) activeOpenings.push(8); 
    }
  } else {
    activeOpenings = renderContext.activeHallLayout.openings;
  }

  // Pass the compiled layout array directly down to the side view mapper
  if (isLateralView) {
    renderLateralScene(ctx, renderContext, metrics, time, activeOpenings);
    return;
  }

  const dynamicSegs = getSegmentEdges(playerZ, orientation, metrics);

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#1c140a'; ctx.fillRect(0, 0, W, H);

  renderForwardScene(ctx, renderContext, dynamicSegs, metrics, activeOpenings);

  const fxMetrics = { NUM_SEGMENTS, VPX, VPY, CX, CY, W, H };
  renderDepthFog(ctx, dynamicSegs, fxMetrics);
  renderTorchesAndLighting(ctx, dynamicSegs, activeOpenings, time, fxMetrics, orientation);

  // ── TUNNEL VISIBILITY FILTER BUGFIX ──
  // Check if they are together in a main corridor OR sharing the exact same tunnel pipeline
  const shouldRenderBall = 
    (!player.inTunnel && !renderContext.ball.inTunnel && player.currentHall === renderContext.ball.currentHall) ||
    (player.inTunnel && renderContext.ball.inTunnel && player.currentTunnelId === renderContext.ball.currentTunnelId);

  if (shouldRenderBall) {
    const entityMetrics = { Z_NEAR, HALL_WIDTH, CX, BOTTOM, VPY };
    render3DBall(ctx, renderContext, entityMetrics);
  }

  renderPostProcessingOverlays(ctx, fxMetrics);
}
