// GEMINI.3 scene-renderer.js
let W, H, CX, CY, LEFT, RIGHT, TOP, BOTTOM, VPX, VPY, HALL_WIDTH, HALL_HEIGHT;
const NUM_SEGMENTS = 9;
const BALL_BASE_RADIUS = 256;
const TORCH_MAX_SIZE = 55; 
const TORCH_MIN_SIZE = 12;  

// Uniform 3D focal near-plane depth distance constant allocation
const Z_NEAR = 1.0; 

function lerp(a, b, t) { return a + (b - a) * t; }

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

// ── 1. MATHEMATICAL & GEOMETRY GENERATORS ────────────────────────────────────
function getSegmentEdges(playerZ) {
  const segments = [];
  for (let i = 0; i <= NUM_SEGMENTS + 2; i++) {
    const worldZ = i - playerZ;
    const distance = worldZ + Z_NEAR;
    
    let depth;
    if (distance <= 0.05) {
      depth = -3.0; // Pushed safely off-screen completely
    } else {
      const scale = Z_NEAR / distance;
      depth = 1.0 - scale;
    }
    
    const lx = LEFT + (VPX - LEFT) * depth;
    const rx = RIGHT - (RIGHT - VPX) * depth;
    const ty = TOP + (VPY - TOP) * depth;
    const by = BOTTOM - (BOTTOM - VPY) * depth;
    
    const t = worldZ / NUM_SEGMENTS; 
    segments.push({ lx, rx, ty, by, depth, t });
  }
  return segments;
}

function stoneNoise(x, y, scale, seed) {
  const nx = Math.floor(x / scale);
  const ny = Math.floor(y / scale);
  const h = Math.sin(nx * 127.1 + ny * 311.7 + seed * 74.3) * 43758.5453;
  return h - Math.floor(h);
}

// ── 2. SURFACE TEXTURING LOGIC ────────────────────────────────────────────────
function drawStonePattern(ctx, x, y, w, h, baseColor, variation, blockW, blockH) {
  const cols = Math.ceil(w / blockW) + 1;
  const rows = Math.ceil(h / blockH) + 1;
  for (let row = 0; row < rows; row++) {
    const offset = (row % 2 === 0) ? 0 : blockW * 0.5;
    for (let col = 0; col < cols; col++) {
      const bx = x + col * blockW - offset;
      const by = y + row * blockH;
      const bw = blockW - 2;
      const bh = blockH - 2;
      const n = stoneNoise(bx + x, by + y, 1, 42);
      const c = baseColor + Math.round((n - 0.5) * variation);
      ctx.fillStyle = `rgb(${c},${Math.round(c*0.93)},${Math.round(c*0.82)})`;
      ctx.fillRect(bx, by, bw, bh);
      
      ctx.fillStyle = `rgba(0,0,0,0.32)`;
      ctx.fillRect(bx + bw, by, 2, bh + 2);
      ctx.fillRect(bx, by + bh, bw + 2, 2);
    }
  }
}

function drawWallPanelStones(ctx, near, far, isLeft, bright, variation) {
  const numCols = 3; 
  const numRows = 4;
  const nearX = isLeft ? near.lx : near.rx;
  const farX  = isLeft ? far.lx  : far.rx;

  ctx.beginPath();
  ctx.strokeStyle = 'rgba(0,0,0,0.32)';
  ctx.lineWidth = Math.max(0.5, 1.2 * (1 - far.t));

  // 1. Vertical columns
  for (let c = 0; c <= numCols; c++) {
    const tc = c / numCols;
    const x = lerp(nearX, farX, tc);
    const ty = lerp(near.ty, far.ty, tc);
    const by = lerp(near.by, far.by, tc);
    ctx.moveTo(x, ty);
    ctx.lineTo(x, by);
  }

  // 2. Horizontal brick rows
  for (let r = 1; r < numRows; r++) {
    const tr = r / numRows;
    const yNear = near.ty + tr * (near.by - near.ty);
    const yFar  = far.ty + tr * (far.by - far.ty);
    ctx.moveTo(nearX, yNear);
    ctx.lineTo(farX, yFar);
  }
  ctx.stroke();
}

function drawPerspectiveSurface(ctx, playerZ, isFloor, baseColor, variation, numCols) {
  for (let i = NUM_SEGMENTS + 1; i >= 0; i--) {
    const worldZNear = i - playerZ;
    const worldZFar  = (i + 1) - playerZ;

    const distNear = worldZNear + Z_NEAR;
    const distFar  = worldZFar + Z_NEAR;

    let dNear = distNear <= 0.05 ? -3.0 : 1.0 - (Z_NEAR / distNear);
    let dFar  = distFar  <= 0.05 ? -3.0 : 1.0 - (Z_NEAR / distFar);

    const nLX = LEFT  + (VPX - LEFT) * dNear;
    const nRX = RIGHT - (RIGHT - VPX) * dNear;
    const fLX = LEFT  + (VPX - LEFT) * dFar;
    const fRX = RIGHT - (RIGHT - VPX) * dFar;
    const ny = isFloor ? BOTTOM - (BOTTOM - VPY) * dNear : TOP + (VPY - TOP) * dNear;
    const fy = isFloor ? BOTTOM - (BOTTOM - VPY) * dFar  : TOP + (VPY - TOP) * dFar;

    const clampT = Math.max(0, Math.min(1, worldZFar / NUM_SEGMENTS));
    const brightness = lerp(1.0, 0.38, clampT);

    const c = Math.max(8, Math.min(220, Math.round(baseColor * brightness)));
    ctx.fillStyle = `rgb(${c},${Math.round(c * 0.93)},${Math.round(c * 0.82)})`;

    ctx.beginPath();
    ctx.moveTo(nLX, ny); ctx.lineTo(nRX, ny);
    ctx.lineTo(fRX, fy); ctx.lineTo(fLX, fy);
    ctx.closePath();
    ctx.fill();
  }

  // Pass 2: Draw complete floorboard structural lines in a single batched stroke
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1.2;

  // Horizontal row markers
  for (let i = 0; i <= NUM_SEGMENTS + 1; i++) {
    const worldZ = i - playerZ;
    const distance = worldZ + Z_NEAR;
    if (distance <= 0.05) continue;
    const depth = 1.0 - (Z_NEAR / distance);
    const lx = LEFT + (VPX - LEFT) * depth;
    const rx = RIGHT - (RIGHT - VPX) * depth;
    const y = isFloor ? BOTTOM - (BOTTOM - VPY) * depth : TOP + (VPY - TOP) * depth;
    ctx.moveTo(lx, y);
    ctx.lineTo(rx, y);
  }

  // Longitudinal lines to vanishing point
  for (let j = 0; j <= numCols; j++) {
    const ratio = j / numCols;
    const worldZNear = 0 - playerZ;
    const worldZFar  = (NUM_SEGMENTS + 1) - playerZ;
    
    const distNear = worldZNear + Z_NEAR;
    const distFar  = worldZFar + Z_NEAR;
    
    let dNear = distNear <= 0.05 ? -3.0 : 1.0 - (Z_NEAR / distNear);
    let dFar  = distFar  <= 0.05 ? -3.0 : 1.0 - (Z_NEAR / distFar);

    const nX = lerp(LEFT  + (VPX - LEFT) * dNear, RIGHT - (RIGHT - VPX) * dNear, ratio);
    const nY = isFloor ? BOTTOM - (BOTTOM - VPY) * dNear : TOP + (VPY - TOP) * dNear;
    
    const fX = lerp(LEFT  + (VPX - LEFT) * dFar, RIGHT - (RIGHT - VPX) * dFar, ratio);
    const fY = isFloor ? BOTTOM - (BOTTOM - VPY) * dFar : TOP + (VPY - TOP) * dFar;

    ctx.moveTo(nX, nY);
    ctx.lineTo(fX, fY);
  }
  ctx.stroke();
}

// ── 3. BASE ARCHITECTURAL LAYERS ─────────────────────────────────────────────
function renderMainCeiling(ctx, segs, playerZ) {
  const seg0 = segs[0], segN = segs[NUM_SEGMENTS];
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(seg0.lx, seg0.ty); ctx.lineTo(seg0.rx, seg0.ty);
  ctx.lineTo(segN.rx, segN.ty); ctx.lineTo(segN.lx, segN.ty);
  ctx.closePath();
  ctx.clip();

  const ceilGrad = ctx.createLinearGradient(CX, seg0.ty, CX, segN.ty);
  ceilGrad.addColorStop(0, '#3c3428');
  ceilGrad.addColorStop(1, '#231f15');
  ctx.fillStyle = ceilGrad;
  ctx.fillRect(seg0.lx, seg0.ty, seg0.rx - seg0.lx, seg0.by - seg0.ty);

  drawPerspectiveSurface(ctx, playerZ, false, 60, 14, 8);
  ctx.restore();
}

function renderMainFloor(ctx, segs, playerZ) {
  const seg0 = segs[0], segN = segs[NUM_SEGMENTS];
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(seg0.lx, seg0.by); ctx.lineTo(seg0.rx, seg0.by);
  ctx.lineTo(segN.rx, segN.by); ctx.lineTo(segN.lx, segN.by);
  ctx.closePath();
  ctx.clip();

  const floorGrad = ctx.createLinearGradient(CX, seg0.by, CX, BOTTOM + 50);
  floorGrad.addColorStop(0, '#302c25');
  floorGrad.addColorStop(1, '#1f1b17');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(LEFT - 10, seg0.by, HALL_WIDTH + 20, BOTTOM - seg0.by + 10);

  drawPerspectiveSurface(ctx, playerZ, true, 68, 18, 8);
  ctx.restore();
}

// ── 4. WALL PANEL SEGMENTS ───────────────────────────────────────────────────
function renderSolidWallPanel(ctx, near, far, isLeft, stoneBright, stoneVar) {
  const nearX = isLeft ? near.lx : near.rx;
  const farX  = isLeft ? far.lx  : far.rx;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(nearX, near.ty); ctx.lineTo(farX, far.ty);
  ctx.lineTo(farX, far.by);   ctx.lineTo(nearX, near.by);
  ctx.closePath();
  ctx.clip();

  const wallG = ctx.createLinearGradient(farX, 0, nearX, 0);
  const b0 = isLeft ? stoneBright - 8 : stoneBright + 10;
  const b1 = isLeft ? stoneBright + 10 : stoneBright - 8;
  wallG.addColorStop(0, `rgb(${b0},${Math.round(b0*0.9)},${Math.round(b0*0.78)})`);
  wallG.addColorStop(1, `rgb(${b1},${Math.round(b1*0.9)},${Math.round(b1*0.78)})`);
  ctx.fillStyle = wallG;
  ctx.fillRect(Math.min(nearX, farX) - 1, near.ty, Math.abs(nearX - farX) + 2, near.by - near.ty);
  drawWallPanelStones(ctx, near, far, isLeft, stoneBright, stoneVar);

  const sw = Math.abs(nearX - farX);
  const shadowG = isLeft
    ? ctx.createLinearGradient(farX, 0, farX + sw * 0.4, 0)
    : ctx.createLinearGradient(farX + sw, 0, farX + sw * 0.6, 0);
  shadowG.addColorStop(0, 'rgba(0,0,0,0.45)');
  shadowG.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadowG;
  ctx.fillRect(Math.min(nearX, farX), near.ty, sw, near.by - near.ty);
  ctx.restore();
}

function renderBranchingCorridor(ctx, near, far, isLeft, stoneBright) {
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
  ctx.closePath();
  ctx.fillStyle = '#0b0907';
  ctx.fill();

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
  ceilGrad.addColorStop(0.25, `rgb(${Math.round(cc*0.4)},${Math.round(cc*0.37)},${Math.round(cc*0.33)})`);
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

// ── 5. 3D ENTITY RENDERERS (PERSPECTIVE PROJECTION) ──────────────────────────
function render3DBall(ctx, renderContext) {
  const ball = renderContext.ball;
  const player = renderContext.player;

  const worldZBall = ball.localZ - player.localZ;
  const distBall = worldZBall + Z_NEAR;
  
  if (distBall <= 0.05) return; 

  const scale = Z_NEAR / distBall;
  const depth = 1.0 - scale;

  const widthAtDepth = lerp(HALL_WIDTH, 0, depth);
  const ballX = CX + ball.localX * widthAtDepth;
  const ballFloorY = BOTTOM - (BOTTOM - VPY) * depth;

  const baseRadius = BALL_BASE_RADIUS;
  const radius = Math.max(2, baseRadius * (1 - depth));
  const ballCenterY = ballFloorY - radius;

  // Floor Drop Shadow
  ctx.save();
  const shadowGrad = ctx.createRadialGradient(ballX, ballFloorY, 0, ballX, ballFloorY, radius * 1.6);
  shadowGrad.addColorStop(0, 'rgba(0,0,0,0.65)');
  shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.ellipse(ballX, ballFloorY, radius * 1.6, radius * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 3D Specular Sphere
  ctx.save();
  const ballGrad = ctx.createRadialGradient(
    ballX - radius * 0.3, ballCenterY - radius * 0.3, radius * 0.05,
    ballX, ballCenterY, radius
  );
  ballGrad.addColorStop(0, '#fff2cc'); 
  ballGrad.addColorStop(0.2, '#ffaa44');
  ballGrad.addColorStop(0.7, '#994400');
  ballGrad.addColorStop(1, '#260a00');

  ctx.fillStyle = ballGrad;
  ctx.beginPath();
  ctx.arc(ballX, ballCenterY, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = Math.max(0.5, 1.5 * (1 - depth));
  ctx.stroke();
  ctx.restore();
}

// ── 6. DISTANT CAP & FOG OVERLAYS ────────────────────────────────────────────
function renderDepthFog(ctx, segs) {
  const s0 = segs[0];
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(s0.lx, s0.ty); ctx.lineTo(s0.rx, s0.ty);
  ctx.lineTo(s0.rx, s0.by); ctx.lineTo(s0.lx, s0.by);
  ctx.closePath(); ctx.clip();
  const fogR = ctx.createRadialGradient(VPX, VPY, 0, VPX, VPY, Math.max(W, H) * 0.55);
  fogR.addColorStop(0,   'rgba(0,0,0,0.58)');
  fogR.addColorStop(0.18,'rgba(0,0,0,0.30)');
  fogR.addColorStop(0.4, 'rgba(0,0,0,0.07)');
  fogR.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = fogR;
  ctx.fillRect(s0.lx, s0.ty, s0.rx - s0.lx, s0.by - s0.ty);
  ctx.restore();
}

function renderFarEndWall(ctx, segs) {
  const segN = segs[NUM_SEGMENTS];
  if (!segN) return;
  const fw = segN.rx - segN.lx;
  const fh = segN.by - segN.ty;
  ctx.save();
  ctx.beginPath();
  ctx.rect(segN.lx, segN.ty, fw, fh);
  ctx.clip();
  ctx.fillStyle = '#1e1514';
  ctx.fillRect(segN.lx, segN.ty, fw, fh);
  drawStonePattern(ctx, segN.lx, segN.ty, fw, fh, 46, 8, 14, 8);
  const farWallG = ctx.createLinearGradient(0, segN.ty, 0, segN.by);
  farWallG.addColorStop(0, 'rgba(0,0,0,0.5)');
  farWallG.addColorStop(0.45, 'rgba(0,0,0,0.08)');
  farWallG.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = farWallG;
  ctx.fillRect(segN.lx, segN.ty, fw, fh);
  ctx.restore();
}

// ── 7. ATMOSPHERICS & FLOATING TORCHES ────────────────────────────────────────
function drawTorch(ctx, tx, ty, scale, brightness, time) {
  const s = scale;
  ctx.save();
  ctx.translate(tx, ty);

  ctx.fillStyle = `rgb(55,42,28)`;
  ctx.beginPath(); ctx.rect(-s*0.7, -s*0.2, s*1.4, s*0.25); ctx.fill();

  const grad = ctx.createLinearGradient(-s*0.15, -s*0.1, s*0.15, s*0.5);
  grad.addColorStop(0, '#8B6914'); grad.addColorStop(1, '#4a3008');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.rect(-s*0.15, -s*0.1, s*0.3, s*0.65); ctx.fill();

  ctx.fillStyle = '#6b5020';
  ctx.beginPath(); ctx.ellipse(0, -s*0.12, s*0.28, s*0.13, 0, 0, Math.PI * 2); ctx.fill();

  const flickerA = 0.5 + 0.5 * Math.sin(time * 3.1 + tx);
  const glowR = s * (3.5 + flickerA * 1.2);
  const glowGrad = ctx.createRadialGradient(0, -s * 0.5, 0, 0, -s * 0.5, glowR);
  glowGrad.addColorStop(0, `rgba(255,180,60,${0.22 * brightness})`);
  glowGrad.addColorStop(0.4, `rgba(255,120,20,${0.12 * brightness})`);
  glowGrad.addColorStop(1, `rgba(255,80,0,0)`);
  ctx.fillStyle = glowGrad;
  ctx.beginPath(); ctx.ellipse(0, -s * 0.5, glowR, glowR * 1.15, 0, 0, Math.PI * 2); ctx.fill();

  const flicker1 = Math.sin(time * 5.3 + tx * 0.1) * 0.18;
  const flicker2 = Math.cos(time * 7.1 + ty * 0.1) * 0.12;

  ctx.beginPath();
  ctx.moveTo(0, -s * 0.12);
  ctx.bezierCurveTo(-s * (0.28 + flicker1), -s * 0.45, -s * (0.18 + flicker2), -s * 0.9, 0, -s * (1.1 + flickerA * 0.2));
  ctx.bezierCurveTo(s * (0.18 - flicker2), -s * 0.9, s * (0.28 - flicker1), -s * 0.45, 0, -s * 0.12);
  const flameG1 = ctx.createLinearGradient(0, -s * 0.12, 0, -s * 1.1);
  flameG1.addColorStop(0, `rgba(255,160,0,${0.95 * brightness})`);
  flameG1.addColorStop(0.4, `rgba(255,100,0,${0.85 * brightness})`);
  flameG1.addColorStop(0.75, `rgba(255,60,0,${0.6 * brightness})`);
  flameG1.addColorStop(1, `rgba(200,30,0,0)`);
  ctx.fillStyle = flameG1; ctx.fill();

  ctx.restore();
}

function drawWallLightPool(ctx, tx, ty, radius, brightness, time) {
  const flicker = 0.85 + 0.15 * Math.sin(time * 3.7 + tx);
  const r = radius * flicker;
  const grad = ctx.createRadialGradient(tx, ty, 0, tx, ty, r);
  grad.addColorStop(0, `rgba(255,160,60,${0.18 * brightness * flicker})`);
  grad.addColorStop(0.4, `rgba(200,100,20,${0.1 * brightness * flicker})`);
  grad.addColorStop(1, `rgba(0,0,0,0)`);
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.ellipse(tx, ty, r * 1.1, r * 0.9, 0, 0, Math.PI * 2); ctx.fill();
}

function renderTorchesAndLighting(ctx, segs, openings, time) {
  const torchPositions = [];
  for (let i = 0; i <= NUM_SEGMENTS; i++) {
    const near = segs[i], far = segs[i + 1];
    if (!near || !far) continue;
    const tlx = lerp(near.lx, far.lx, 0.5);
    const trx = lerp(near.rx, far.rx, 0.5);
    const ty  = lerp(near.ty, far.ty, 0.5) + (lerp(near.by - near.ty, far.by - far.ty, 0.5)) * 0.30;
    const scale = lerp(TORCH_MAX_SIZE, TORCH_MIN_SIZE, Math.max(0, Math.min(1, near.t)));
    
    const brightness = lerp(1.0, 0.35, Math.max(0, Math.min(1, near.t)));

    if (!openings.includes(i)) {
      torchPositions.push({ x: tlx + scale * 0.5, y: ty, scale, brightness });
      torchPositions.push({ x: trx - scale * 0.5, y: ty, scale, brightness });
    }
  }

  torchPositions.forEach(tp => drawWallLightPool(ctx, tp.x, tp.y - tp.scale * 0.5, tp.scale * 5.5, tp.brightness, time));
  torchPositions.slice().reverse().forEach(tp => drawTorch(ctx, tp.x, tp.y, tp.scale, tp.brightness, time));
}

function renderPostProcessingOverlays(ctx) {
  const vignette = ctx.createRadialGradient(CX, CY, H * 0.28, CX, CY, H * 0.82);
  vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
}

// ── 8. MAIN DRAW ENTRYPOINT ──────────────────────────────────────────────────
export function drawScene(ctx, renderContext, time) {
  const playerZ = renderContext.player.localZ;
  const activeOpenings = renderContext.activeHallLayout.openings;

  const dynamicSegs = getSegmentEdges(playerZ);

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#1c140a';
  ctx.fillRect(0, 0, W, H);

  renderMainCeiling(ctx, dynamicSegs, playerZ);
  renderMainFloor(ctx, dynamicSegs, playerZ);

  const isSameHall = renderContext.ball.currentHall === renderContext.player.currentHall;

  for (let i = NUM_SEGMENTS - 1; i >= 0; i--) {
    const near = dynamicSegs[i];
    const far  = dynamicSegs[i + 1];
    if (!near || !far) continue;

    const isOpening = activeOpenings.includes(i);
    
    const clampedNearT = Math.max(0, Math.min(1, near.t));
    const stoneBright = 56 + (1 - clampedNearT) * 28;

    if (!isOpening) {
      renderSolidWallPanel(ctx, near, far, true, stoneBright, 20);
      renderSolidWallPanel(ctx, near, far, false, stoneBright, 20);
    } else {
      renderBranchingCorridor(ctx, near, far, true, stoneBright);
      renderBranchingCorridor(ctx, near, far, false, stoneBright);
    }
  }

  renderDepthFog(ctx, dynamicSegs);
  renderFarEndWall(ctx, dynamicSegs);
  renderTorchesAndLighting(ctx, dynamicSegs, activeOpenings, time);

  if (isSameHall) {
    render3DBall(ctx, renderContext);
  }

  renderPostProcessingOverlays(ctx);
}
