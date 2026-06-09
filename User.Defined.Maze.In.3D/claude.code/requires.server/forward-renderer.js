// GEMINI.3 forward-renderer.js
import { drawStonePattern, drawWallPanelStones, drawPerspectiveSurface } from './renderer-textures.js';
import { lerp } from './geometry-utils.js';

export function renderForwardScene(ctx, renderContext, dynamicSegs, metrics) {
  const player = renderContext.player;
  const orientation = player.orientation;
  const playerZ = player.localZ;
  const activeOpenings = renderContext.activeHallLayout.openings;
  const { NUM_SEGMENTS } = metrics;

  const isWest = (orientation === 'WEST');
  
  // FIX: Instead of simple negation, subtract from NUM_SEGMENTS to keep the coordinate
  // strictly positive. This prevents modulo/floor tile calculations from collapsing into carpet.
  const textureZ = isWest ? (NUM_SEGMENTS - playerZ) : playerZ;

  renderMainCeiling(ctx, dynamicSegs, textureZ, metrics);
  renderMainFloor(ctx, dynamicSegs, textureZ, metrics);

  for (let loopIdx = 0; loopIdx < NUM_SEGMENTS; loopIdx++) {
    const i = isWest ? loopIdx : (NUM_SEGMENTS - 1 - loopIdx);
    
    const near = isWest ? dynamicSegs[i + 1] : dynamicSegs[i];
    const far  = isWest ? dynamicSegs[i]     : dynamicSegs[i + 1];
    if (!near || !far) continue;
    if (far.depth <= 0) continue;

    const isOpening = activeOpenings.includes(i);
    const clampedNearDepth = Math.max(0, Math.min(1, near.depth));
    const stoneBright = 56 + (1 - clampedNearDepth) * 28;

    if (!isOpening) {
      renderSolidWallPanel(ctx, near, far, true, stoneBright, 20);
      renderSolidWallPanel(ctx, near, far, false, stoneBright, 20);
    } else {
      renderBranchingCorridor(ctx, near, far, true, stoneBright, metrics);
      renderBranchingCorridor(ctx, near, far, false, stoneBright, metrics);
    }
  }

  renderFarEndWall(ctx, dynamicSegs, metrics, orientation);
}

function renderMainCeiling(ctx, segs, playerZ, metrics) {
  const { NUM_SEGMENTS, CX } = metrics;
  const seg0 = segs[0], segN = segs[NUM_SEGMENTS];
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(seg0.lx, seg0.ty); ctx.lineTo(seg0.rx, seg0.ty);
  ctx.lineTo(segN.rx, segN.ty); ctx.lineTo(segN.lx, segN.ty);
  ctx.closePath(); ctx.clip();

  const ceilGrad = ctx.createLinearGradient(CX, seg0.ty, CX, segN.ty);
  ceilGrad.addColorStop(0, '#3c3428'); ceilGrad.addColorStop(1, '#231f15');
  ctx.fillStyle = ceilGrad; ctx.fillRect(seg0.lx, seg0.ty, seg0.rx - seg0.lx, seg0.by - seg0.ty);

  drawPerspectiveSurface(ctx, playerZ, false, 60, 14, 8, metrics);
  ctx.restore();
}

function renderMainFloor(ctx, segs, playerZ, metrics) {
  const { NUM_SEGMENTS, CX, BOTTOM, LEFT, HALL_WIDTH } = metrics;
  const seg0 = segs[0], segN = segs[NUM_SEGMENTS];
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(seg0.lx, seg0.by); ctx.lineTo(seg0.rx, seg0.by);
  ctx.lineTo(segN.rx, segN.by); ctx.lineTo(segN.lx, segN.by);
  ctx.closePath(); ctx.clip();

  const floorGrad = ctx.createLinearGradient(CX, seg0.by, CX, BOTTOM + 50);
  floorGrad.addColorStop(0, '#302c25'); floorGrad.addColorStop(1, '#1f1b17');
  ctx.fillStyle = floorGrad; ctx.fillRect(LEFT - 10, seg0.by, HALL_WIDTH + 20, BOTTOM - seg0.by + 10);

  drawPerspectiveSurface(ctx, playerZ, true, 68, 18, 8, metrics);
  ctx.restore();
}

function renderSolidWallPanel(ctx, near, far, isLeft, stoneBright, stoneVar) {
  const nearX = isLeft ? near.lx : near.rx;
  const farX  = isLeft ? far.lx  : far.rx;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(nearX, near.ty); ctx.lineTo(farX, far.ty);
  ctx.lineTo(farX, far.by);   ctx.lineTo(nearX, near.by);
  ctx.closePath(); ctx.clip();

  const wallG = ctx.createLinearGradient(farX, 0, nearX, 0);
  const b0 = isLeft ? stoneBright - 8 : stoneBright + 10;
  const b1 = isLeft ? stoneBright + 10 : stoneBright - 8;
  wallG.addColorStop(0, `rgb(${b0},${Math.round(b0*0.9)},${Math.round(b0*0.78)})`);
  wallG.addColorStop(1, `rgb(${b1},${Math.round(b1*0.9)},${Math.round(b1*0.78)})`);
  ctx.fillStyle = wallG; ctx.fillRect(Math.min(nearX, farX) - 1, near.ty, Math.abs(nearX - farX) + 2, near.by - near.ty);
  
  drawWallPanelStones(ctx, near, far, isLeft, stoneBright, stoneVar);

  const sw = Math.abs(nearX - farX);
  const shadowG = isLeft ? ctx.createLinearGradient(farX, 0, farX + sw * 0.4, 0) : ctx.createLinearGradient(farX + sw, 0, farX + sw * 0.6, 0);
  shadowG.addColorStop(0, 'rgba(0,0,0,0.45)'); shadowG.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadowG; ctx.fillRect(Math.min(nearX, farX), near.ty, sw, near.by - near.ty);
  ctx.restore();
}

function renderBranchingCorridor(ctx, near, far, isLeft, stoneBright, metrics) {
  const { HALL_WIDTH } = metrics;
  const nearX = isLeft ? near.lx : near.rx;
  const farX  = isLeft ? far.lx  : far.rx;

  ctx.save();
  const sign = isLeft ? -1 : 1;
  const sideWNear = HALL_WIDTH * 0.38 * (1 - Math.max(-1, near.depth));
  const sideWFar  = HALL_WIDTH * 0.38 * (1 - Math.max(-1, far.depth));

  const x0 = nearX; const x1 = farX;
  const x2 = farX + sign * sideWFar; const x3 = nearX + sign * sideWNear;

  ctx.beginPath();
  ctx.moveTo(x2, far.ty); ctx.lineTo(x3, near.ty);
  ctx.lineTo(x3, near.by); ctx.lineTo(x2, far.by);
  ctx.closePath(); ctx.fillStyle = '#0b0907'; ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x0, near.by); ctx.lineTo(x1, far.by);
  ctx.lineTo(x2, far.by);   ctx.lineTo(x3, near.by);
  ctx.closePath();

  const floorBright = 68 * lerp(1.0, 0.38, Math.max(0, Math.min(1, far.t)));
  const cf = Math.max(8, Math.min(220, Math.round(floorBright)));
  const floorGrad = ctx.createLinearGradient(nearX, 0, nearX + sign * sideWNear, 0);
  floorGrad.addColorStop(0, `rgb(${cf},${Math.round(cf*0.93)},${Math.round(cf*0.82)})`);
  floorGrad.addColorStop(0.25, `rgb(${Math.round(cf*0.4)},${Math.round(cf*0.37)},${Math.round(cf*0.33)})`);
  floorGrad.addColorStop(1, '#0b0907');
  ctx.fillStyle = floorGrad; ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = Math.max(0.5, 1.2 * (1 - Math.max(0, Math.min(1, far.t))));
  const numSideTiles = 3;
  for (let k = 1; k < numSideTiles; k++) {
    const ratio = k / numSideTiles;
    ctx.beginPath(); ctx.moveTo(lerp(x0, x3, ratio), near.by); ctx.lineTo(lerp(x1, x2, ratio), far.by); ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(x0, near.ty); ctx.lineTo(x1, far.ty);
  ctx.lineTo(x2, far.ty);   ctx.lineTo(x3, near.ty);
  ctx.closePath();

  const cc = Math.max(8, Math.min(220, Math.round(60 * lerp(1.0, 0.38, Math.max(0, Math.min(1, far.t))))));
  const ceilGrad = ctx.createLinearGradient(nearX, 0, nearX + sign * sideWNear, 0);
  ceilGrad.addColorStop(0, `rgb(${cc},${Math.round(cc*0.93)},${Math.round(cc*0.82)})`);
  ceilGrad.addColorStop(0.25, `rgb(${Math.round(cf*0.4)},${Math.round(cf*0.37)},${Math.round(stoneBright*0.33)})`);
  ceilGrad.addColorStop(1, '#0b0907');
  ctx.fillStyle = ceilGrad; ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x1, far.ty); ctx.lineTo(x2, far.ty);
  ctx.lineTo(x2, far.by);   ctx.lineTo(x1, far.by);
  ctx.closePath();

  const cw = Math.max(8, Math.min(220, Math.round(stoneBright * 0.8)));
  const wallFarGrad = ctx.createLinearGradient(x1, 0, x2, 0);
  wallFarGrad.addColorStop(0, `rgb(${cw},${Math.round(cw*0.93)},${Math.round(cw*0.82)})`);
  wallFarGrad.addColorStop(1, '#0b0907');
  ctx.fillStyle = wallFarGrad; ctx.fill();

  const edgeG = ctx.createLinearGradient(x1, 0, x1 + sign * (sideWFar * 0.3), 0);
  edgeG.addColorStop(0, 'rgba(0,0,0,0.65)'); edgeG.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = edgeG; ctx.fillRect(Math.min(x1, x1 + sign * sideWFar), far.ty, sideWFar, far.by - far.ty);

  ctx.restore();
}

function renderFarEndWall(ctx, segs, metrics, orientation) {
  const { NUM_SEGMENTS } = metrics;
  const targetIdx = (orientation === 'WEST') ? 0 : NUM_SEGMENTS;
  const segN = segs[targetIdx];
  if (!segN) return;
  
  const fw = segN.rx - segN.lx; const fh = segN.by - segN.ty;
  ctx.save();
  ctx.beginPath(); ctx.rect(segN.lx, segN.ty, fw, fh); ctx.clip();
  ctx.fillStyle = '#1e1514'; ctx.fillRect(segN.lx, segN.ty, fw, fh);
  drawStonePattern(ctx, segN.lx, segN.ty, fw, fh, 46, 8, 14, 8);
  const farWallG = ctx.createLinearGradient(0, segN.ty, 0, segN.by);
  farWallG.addColorStop(0, 'rgba(0,0,0,0.5)'); farWallG.addColorStop(0.45, 'rgba(0,0,0,0.08)'); farWallG.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = farWallG; ctx.fillRect(segN.lx, segN.ty, fw, fh);
  ctx.restore();
}
