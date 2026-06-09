// geometry-utils.js

export function lerp(a, b, t) { 
  return a + (b - a) * t; 
}

export function stoneNoise(x, y, scale, seed) {
  const nx = Math.floor(x / scale);
  const ny = Math.floor(y / scale);
  const h = Math.sin(nx * 127.1 + ny * 311.7 + seed * 74.3) * 43758.5453;
  return h - Math.floor(h);
}

export function getSegmentEdges(playerZ, orientation, metrics) {
  const segments = [];
  const isWest = (orientation === 'WEST');
  const { NUM_SEGMENTS, Z_NEAR, LEFT, RIGHT, TOP, BOTTOM, VPX, VPY } = metrics;

  // Render 2 extra segments past the horizon limit to handle clipping cleanly
  for (let i = 0; i <= NUM_SEGMENTS + 2; i++) {
    const worldZ = isWest ? (playerZ - i) : (i - playerZ);
    const distance = worldZ + Z_NEAR;
    
    let depth;
    if (distance <= 0.05) {
      depth = -3.0; 
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
