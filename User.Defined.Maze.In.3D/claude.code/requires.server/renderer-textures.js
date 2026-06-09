// GEMINI.3 renderer-textures.js

// Local utility to keep the texture engine self-contained and free of circular imports
function lerp(a, b, t) { return a + (b - a) * t; }

export function stoneNoise(x, y, scale, seed) {
  const nx = Math.floor(x / scale);
  const ny = Math.floor(y / scale);
  const h = Math.sin(nx * 127.1 + ny * 311.7 + seed * 74.3) * 43758.5453;
  return h - Math.floor(h);
}

export function drawStonePattern(ctx, x, y, w, h, baseColor, variation, blockW, blockH) {
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

export function drawWallPanelStones(ctx, near, far, isLeft, bright, variation) {
  const numCols = 3; 
  const numRows = 4;
  const nearX = isLeft ? near.lx : near.rx;
  const farX  = isLeft ? far.lx  : far.rx;

  ctx.beginPath();
  ctx.strokeStyle = 'rgba(0,0,0,0.32)';
  ctx.lineWidth = Math.max(0.5, 1.2 * (1 - far.t));

  // Vertical mortar paths
  for (let c = 0; c <= numCols; c++) {
    const tc = c / numCols;
    const x = lerp(nearX, farX, tc);
    const ty = lerp(near.ty, far.ty, tc);
    const by = lerp(near.by, far.by, tc);
    ctx.moveTo(x, ty);
    ctx.lineTo(x, by);
  }

  // Horizontal brick rows
  for (let r = 1; r < numRows; r++) {
    const tr = r / numRows;
    const yNear = near.ty + tr * (near.by - near.ty);
    const yFar  = far.ty + tr * (far.by - far.ty);
    ctx.moveTo(nearX, yNear);
    ctx.lineTo(farX, yFar);
  }
  ctx.stroke();
}

export function drawPerspectiveSurface(ctx, playerZ, isFloor, baseColor, variation, numCols, metrics) {
  // Destructure the global viewport vectors passed dynamically from the scene-renderer
  const { NUM_SEGMENTS, Z_NEAR, LEFT, RIGHT, TOP, BOTTOM, VPX, VPY } = metrics;

  // Pass 1: Paint horizontal floor/ceiling rows in bulk
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

  // Pass 2: Draw complete floorboard structural gridlines in a single batched stroke
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1.2;

  // Horizontal row separators
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

  // Longitudinal perspective lines traveling to vanishing point
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
