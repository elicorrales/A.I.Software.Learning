//GEMINI.2 index.js (this is what i dont want to lose , it works)
const canvas = document.getElementById('hall');
const ctx = canvas.getContext('2d');

const W = Math.min(window.innerWidth, 1400);
const H = Math.min(window.innerHeight, 900);
canvas.width = W;
canvas.height = H;

const CX = W / 2;
const CY = H / 2;

// Hall parameters
const HALL_WIDTH = W * 0.72;
const HALL_HEIGHT = H * 0.78;
const LEFT = (W - HALL_WIDTH) / 2;
const RIGHT = LEFT + HALL_WIDTH;
const TOP = (H - HALL_HEIGHT) / 2;
const BOTTOM = TOP + HALL_HEIGHT;

// Vanishing point
const VPX = CX;
const VPY = CY - H * 0.04;

const NUM_SEGMENTS = 9;
const TORCH_POSITIONS = [0.28, 0.72];
const OPENINGS = new Set([1, 3, 5, 7]);

function lerp(a, b, t) { return a + (b - a) * t; }

// ── 1. MATHEMATICAL & GEOMETRY GENERATORS ────────────────────────────────────
function getSegmentEdges() {
  const segments = [];
  for (let i = 0; i <= NUM_SEGMENTS; i++) {
    const t = i / NUM_SEGMENTS;
    const depth = Math.pow(t, 0.65);
    const lx = LEFT + (VPX - LEFT) * depth;
    const rx = RIGHT - (RIGHT - VPX) * depth;
    const ty = TOP + (VPY - TOP) * depth;
    const by = BOTTOM - (BOTTOM - VPY) * depth;
    segments.push({ lx, rx, ty, by, depth, t });
  }
  return segments;
}
const segs = getSegmentEdges();

function stoneNoise(x, y, scale, seed) {
  const nx = Math.floor(x / scale);
  const ny = Math.floor(y / scale);
  const h = Math.sin(nx * 127.1 + ny * 311.7 + seed * 74.3) * 43758.5453;
  return h - Math.floor(h);
}

// ── 2. TEXTURING & SURFACE GRAPHICS ─────────────────────────────────────────
function drawStonePattern(x, y, w, h, baseColor, variation, blockW, blockH, ctx) {
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

function drawWallPanelStones(near, far, isLeft, bright, variation) {
  const numCols = 3;
  const numRows = 4;
  const nearX = isLeft ? near.lx : near.rx;
  const farX  = isLeft ? far.lx  : far.rx;
  for (let c = 0; c < numCols; c++) {
    const tc0 = c / numCols;
    const tc1 = (c + 1) / numCols;
    const x0 = lerp(nearX, farX, tc0);
    const x1 = lerp(nearX, farX, tc1);
    const ty0 = lerp(near.ty, far.ty, tc0);
    const by0 = lerp(near.by, far.by, tc0);
    const ty1 = lerp(near.ty, far.ty, tc1);
    const by1 = lerp(near.by, far.by, tc1);
    const h0 = by0 - ty0;
    const h1 = by1 - ty1;
    for (let r = 0; r < numRows; r++) {
      const rt0 = r / numRows;
      const rt1 = (r + 1) / numRows;
      const n = stoneNoise(c * 7 + r * 13, c * 3 + r * 5, 1, isLeft ? 42 : 55);
      const cv = Math.max(8, Math.min(220, bright + Math.round((n - 0.5) * variation)));
      ctx.fillStyle = `rgb(${cv},${Math.round(cv*0.93)},${Math.round(cv*0.82)})`;
      ctx.beginPath();
      ctx.moveTo(x0, ty0 + rt0 * h0);
      ctx.lineTo(x1, ty1 + rt0 * h1);
      ctx.lineTo(x1, ty1 + rt1 * h1);
      ctx.lineTo(x0, ty0 + rt1 * h0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = Math.max(0.5, 1.2 * (1 - tc1));
      ctx.stroke();
    }
  }
}

function drawPerspectiveSurface(isFloor, baseColor, variation, numCols) {
  for (let i = NUM_SEGMENTS - 1; i >= 0; i--) {
    const tNear = i / NUM_SEGMENTS;
    const tFar  = (i + 1) / NUM_SEGMENTS;
    const dNear = Math.pow(tNear, 0.6);
    const dFar  = Math.pow(tFar,  0.6);

    const nLX = LEFT  + (VPX - LEFT)  * dNear;
    const nRX = RIGHT - (RIGHT - VPX) * dNear;
    const fLX = LEFT  + (VPX - LEFT)  * dFar;
    const fRX = RIGHT - (RIGHT - VPX) * dFar;
    const ny = isFloor ? BOTTOM - (BOTTOM - VPY) * dNear : TOP + (VPY - TOP) * dNear;
    const fy = isFloor ? BOTTOM - (BOTTOM - VPY) * dFar  : TOP + (VPY - TOP) * dFar;

    const brightness = lerp(1.0, 0.38, tFar);
    const mortarW = Math.max(0.4, 1.4 * (1 - tFar));

    for (let j = 0; j < numCols; j++) {
      const t0 = j / numCols;
      const t1 = (j + 1) / numCols;
      const nx0 = lerp(nLX, nRX, t0);
      const nx1 = lerp(nLX, nRX, t1);
      const fx0 = lerp(fLX, fRX, t0);
      const fx1 = lerp(fLX, fRX, t1);

      const isEven = (i + j) % 2 === 0;
      const n = stoneNoise(i * 7 + j * 13, j * 5, 1, isFloor ? 17 : 31);
      const raw = baseColor * brightness + Math.round((n - 0.5) * variation) + (isEven ? 6 : -6);
      const c = Math.max(8, Math.min(220, Math.round(raw)));
      ctx.fillStyle = `rgb(${c},${Math.round(c * 0.93)},${Math.round(c * 0.82)})`;

      ctx.beginPath();
      ctx.moveTo(nx0, ny); ctx.lineTo(nx1, ny);
      ctx.lineTo(fx1, fy); ctx.lineTo(fx0, fy);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = mortarW;
      ctx.stroke();
    }
  }
}

// ── 3. BASE ARCHITECTURAL LAYERS ─────────────────────────────────────────────
function renderMainCeiling() {
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

  drawPerspectiveSurface(false, 60, 14, 8);
  ctx.restore();
}

function renderMainFloor() {
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

  drawPerspectiveSurface(true, 68, 18, 8);
  ctx.restore();
}

// ── 4. WALL SEGMENT ARCHITECTURE (LOOP SEGREGATION) ──────────────────────────
function renderSolidWallPanel(near, far, isLeft, stoneBright, stoneVar) {
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
  drawWallPanelStones(near, far, isLeft, stoneBright, stoneVar);

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

function renderBranchingCorridor(near, far, isLeft, stoneBright) {
  const nearX = isLeft ? near.lx : near.rx;
  const farX  = isLeft ? far.lx  : far.rx;

  ctx.save();
  const sign = isLeft ? -1 : 1;
  const sideWNear = HALL_WIDTH * 0.38 * (1 - near.depth);
  const sideWFar  = HALL_WIDTH * 0.38 * (1 - far.depth);

  const x0 = nearX; const x1 = farX;
  const x2 = farX + sign * sideWFar; const x3 = nearX + sign * sideWNear;

  // 1. Deep cross-corridor background void
  ctx.beginPath();
  ctx.moveTo(x2, far.ty); ctx.lineTo(x3, near.ty);
  ctx.lineTo(x3, near.by); ctx.lineTo(x2, far.by);
  ctx.closePath();
  ctx.fillStyle = '#0b0907';
  ctx.fill();

  // 2. Side Corridor Floor
  ctx.beginPath();
  ctx.moveTo(x0, near.by); ctx.lineTo(x1, far.by);
  ctx.lineTo(x2, far.by);   ctx.lineTo(x3, near.by);
  ctx.closePath();

  const floorBright = 68 * lerp(1.0, 0.38, far.t);
  const cf = Math.max(8, Math.min(220, Math.round(floorBright)));
  const floorGrad = ctx.createLinearGradient(nearX, 0, nearX + sign * sideWNear, 0);
  floorGrad.addColorStop(0, `rgb(${cf},${Math.round(cf*0.93)},${Math.round(cf*0.82)})`);
  floorGrad.addColorStop(0.25, `rgb(${Math.round(cf*0.4)},${Math.round(cf*0.37)},${Math.round(cf*0.33)})`);
  floorGrad.addColorStop(1, '#0b0907');
  ctx.fillStyle = floorGrad; ctx.fill();

  // Floor perspective grid lines
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = Math.max(0.5, 1.2 * (1 - far.t));
  const numSideTiles = 3;
  for (let k = 1; k < numSideTiles; k++) {
    const ratio = k / numSideTiles;
    ctx.beginPath();
    ctx.moveTo(lerp(x0, x3, ratio), near.by);
    ctx.lineTo(lerp(x1, x2, ratio), far.by);
    ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(x0, near.by); ctx.lineTo(x3, near.by); ctx.moveTo(x1, far.by); ctx.lineTo(x2, far.by); ctx.stroke();

  // 3. Side Corridor Ceiling
  ctx.beginPath();
  ctx.moveTo(x0, near.ty); ctx.lineTo(x1, far.ty);
  ctx.lineTo(x2, far.ty);   ctx.lineTo(x3, near.ty);
  ctx.closePath();

  const cc = Math.max(8, Math.min(220, Math.round(60 * lerp(1.0, 0.38, far.t))));
  const ceilGrad = ctx.createLinearGradient(nearX, 0, nearX + sign * sideWNear, 0);
  ceilGrad.addColorStop(0, `rgb(${cc},${Math.round(cc*0.93)},${Math.round(cc*0.82)})`);
  ceilGrad.addColorStop(0.25, `rgb(${Math.round(cc*0.4)},${Math.round(cc*0.37)},${Math.round(cc*0.33)})`);
  ceilGrad.addColorStop(1, '#0b0907');
  ctx.fillStyle = ceilGrad; ctx.fill();

  for (let k = 1; k < numSideTiles; k++) {
    const ratio = k / numSideTiles;
    ctx.beginPath(); ctx.moveTo(lerp(x0, x3, ratio), near.ty); ctx.lineTo(lerp(x1, x2, ratio), far.ty); ctx.stroke();
  }

  // 4. Side corridor internal back wall
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

function renderWallSegments() {
  for (let i = NUM_SEGMENTS - 1; i >= 0; i--) {
    const near = segs[i];
    const far  = segs[i + 1];
    const isOpening = OPENINGS.has(i);
    const stoneBright = 56 + (1 - near.t) * 28;
    const stoneVar = 20;

    if (!isOpening) {
      renderSolidWallPanel(near, far, true, stoneBright, stoneVar);  // Left wall panel
      renderSolidWallPanel(near, far, false, stoneBright, stoneVar); // Right wall panel
    } else {
      renderBranchingCorridor(near, far, true, stoneBright);  // Left open gap
      renderBranchingCorridor(near, far, false, stoneBright); // Right open gap
    }
  }
}

// ── 5. DISTANT END CAP MATRIX ────────────────────────────────────────────────
function renderDepthFog() {
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

function renderFarEndWall() {
  const segN = segs[NUM_SEGMENTS - 1];
  const fw = segN.rx - segN.lx;
  const fh = segN.by - segN.ty;
  ctx.save();
  ctx.beginPath();
  ctx.rect(segN.lx, segN.ty, fw, fh);
  ctx.clip();
  ctx.fillStyle = '#1e1514';
  ctx.fillRect(segN.lx, segN.ty, fw, fh);
  drawStonePattern(segN.lx, segN.ty, fw, fh, 46, 8, 14, 8, ctx);
  const farWallG = ctx.createLinearGradient(0, segN.ty, 0, segN.by);
  farWallG.addColorStop(0, 'rgba(0,0,0,0.5)');
  farWallG.addColorStop(0.45, 'rgba(0,0,0,0.08)');
  farWallG.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = farWallG;
  ctx.fillRect(segN.lx, segN.ty, fw, fh);
  ctx.restore();
}

// ── 6. ATMOSPHERICS & OVERLAY RENDERERS ──────────────────────────────────────
function drawTorch(tx, ty, scale, brightness, time) {
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

  ctx.beginPath();
  ctx.moveTo(0, -s * 0.12);
  ctx.bezierCurveTo(-s * 0.12, -s * 0.4, -s * 0.08, -s * 0.75, 0, -s * (0.85 + flicker2 * 0.1));
  ctx.bezierCurveTo(s * 0.08, -s * 0.75, s * 0.12, -s * 0.4, 0, -s * 0.12);
  const flameG2 = ctx.createLinearGradient(0, -s * 0.12, 0, -s * 0.85);
  flameG2.addColorStop(0, `rgba(255,240,180,${0.98 * brightness})`);
  flameG2.addColorStop(0.5, `rgba(255,200,80,${0.8 * brightness})`);
  flameG2.addColorStop(1, `rgba(255,120,0,0)`);
  ctx.fillStyle = flameG2; ctx.fill();

  ctx.restore();
}

function drawWallLightPool(tx, ty, radius, brightness, time) {
  const flicker = 0.85 + 0.15 * Math.sin(time * 3.7 + tx);
  const r = radius * flicker;
  const grad = ctx.createRadialGradient(tx, ty, 0, tx, ty, r);
  grad.addColorStop(0, `rgba(255,160,60,${0.18 * brightness * flicker})`);
  grad.addColorStop(0.4, `rgba(200,100,20,${0.1 * brightness * flicker})`);
  grad.addColorStop(1, `rgba(0,0,0,0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(tx, ty, r * 1.1, r * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
}

function renderTorchesAndLighting(time) {
  const torchPositions = [];
  for (let i = 0; i < NUM_SEGMENTS; i++) {
    const near = segs[i], far = segs[i + 1];
    const midT = 0.5;
    const tlx = lerp(near.lx, far.lx, midT);
    const trx = lerp(near.rx, far.rx, midT);
    const ty  = lerp(near.ty, far.ty, midT) + (lerp(near.by - near.ty, far.by - far.ty, midT)) * 0.30;
    const scale = lerp(22, 5, segs[i].t);
    const brightness = lerp(1.0, 0.35, segs[i].t);

    if (!OPENINGS.has(i)) {
      torchPositions.push({ x: tlx + scale * 0.5, y: ty, scale, brightness });
      torchPositions.push({ x: trx - scale * 0.5, y: ty, scale, brightness });
    }
  }

  torchPositions.forEach(tp => drawWallLightPool(tp.x, tp.y - tp.scale * 0.5, tp.scale * 5.5, tp.brightness, time));
  torchPositions.slice().reverse().forEach(tp => drawTorch(tp.x, tp.y, tp.scale, tp.brightness, time));
}

function renderPostProcessingOverlays() {
  // Vignette
  const vignette = ctx.createRadialGradient(CX, CY, H * 0.28, CX, CY, H * 0.82);
  vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);

  // Vertical border shading
  const edgeShadowW = HALL_WIDTH * 0.065;
  const leftEdgeG = ctx.createLinearGradient(LEFT, 0, LEFT + edgeShadowW, 0);
  leftEdgeG.addColorStop(0, 'rgba(0,0,0,0.48)'); leftEdgeG.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = leftEdgeG; ctx.fillRect(LEFT, TOP, edgeShadowW, HALL_HEIGHT);

  const rightEdgeG = ctx.createLinearGradient(RIGHT, 0, RIGHT - edgeShadowW, 0);
  rightEdgeG.addColorStop(0, 'rgba(0,0,0,0.48)'); rightEdgeG.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rightEdgeG; ctx.fillRect(RIGHT - edgeShadowW, TOP, edgeShadowW, HALL_HEIGHT);

  // Horizontal border shading
  const ceilShadow = ctx.createLinearGradient(0, TOP, 0, TOP + HALL_HEIGHT * 0.07);
  ceilShadow.addColorStop(0, 'rgba(0,0,0,0.5)'); ceilShadow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ceilShadow; ctx.fillRect(LEFT, TOP, HALL_WIDTH, HALL_HEIGHT * 0.07);

  const floorShadow = ctx.createLinearGradient(0, BOTTOM, 0, BOTTOM - HALL_HEIGHT * 0.07);
  floorShadow.addColorStop(0, 'rgba(0,0,0,0.5)'); floorShadow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = floorShadow; ctx.fillRect(LEFT, BOTTOM - HALL_HEIGHT * 0.07, HALL_WIDTH, HALL_HEIGHT * 0.07);
}


// ── 7. CENTRAL PIPELINE CONTROLLER ───────────────────────────────────────────
function drawHall(time) {
  ctx.clearRect(0, 0, W, H);

  // Layer 1: Structural environment canvas frame
  ctx.fillStyle = '#1c140a';
  ctx.fillRect(0, 0, W, H);

  // Layer 2: Main floor and ceiling structures (Drawn first to sit cleanly behind walls)
  renderMainCeiling();
  renderMainFloor();

  // Layer 3: Interactive walls and corridor spacing (Calculated back-to-front)
  renderWallSegments();

  // Layer 4: Distant depth mask and backdrop matrix closure
  renderDepthFog();
  renderFarEndWall();

  // Layer 5: Dynamic glowing objects and ambient post-processing maps
  renderTorchesAndLighting(time);
  renderPostProcessingOverlays();
}

// Animation loop
function animate(timestamp) {
  drawHall(timestamp / 1000);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
