// GEMINI.3 lighting-renderer.js
import { lerp } from './geometry-utils.js';

const TORCH_MAX_SIZE = 55; 
const TORCH_MIN_SIZE = 12;  

export function drawTorch(ctx, tx, ty, scale, brightness, time) {
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

export function drawWallLightPool(ctx, tx, ty, radius, brightness, time) {
  const flicker = 0.85 + 0.15 * Math.sin(time * 3.7 + tx);
  const r = radius * flicker;
  const grad = ctx.createRadialGradient(tx, ty, 0, tx, ty, r);
  grad.addColorStop(0, `rgba(255,160,60,${0.18 * brightness * flicker})`);
  grad.addColorStop(0.4, `rgba(200,100,20,${0.1 * brightness * flicker})`);
  grad.addColorStop(1, `rgba(0,0,0,0)`);
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.ellipse(tx, ty, r * 1.1, r * 0.9, 0, 0, Math.PI * 2); ctx.fill();
}

export function renderTorchesAndLighting(ctx, segs, openings, time, metrics, orientation) {
  const torchPositions = [];
  const { NUM_SEGMENTS } = metrics;
  
  // FIX: Support inverted look segment indexes for BOTH West and North orientations
  const isInvertedLook = (orientation === 'WEST' || orientation === 'NORTH');
  const startIdx = isInvertedLook ? -1 : 0;
  const endIdx = isInvertedLook ? NUM_SEGMENTS - 1 : NUM_SEGMENTS;

  for (let i = startIdx; i <= endIdx; i++) {
    const near = segs[i], far = segs[i + 1];
    if (!near || !far) continue;
    if (far.depth <= 0) continue;

    const tlx = lerp(near.lx, far.lx, 0.5); const trx = lerp(near.rx, far.rx, 0.5);
    const ty  = lerp(near.ty, far.ty, 0.5) + (lerp(near.by - near.ty, far.by - far.ty, 0.5)) * 0.30;
    
    const currentDepth = Math.max(0, Math.min(1, near.depth));
    const scale = lerp(TORCH_MAX_SIZE, TORCH_MIN_SIZE, currentDepth);
    const brightness = lerp(1.0, 0.35, currentDepth);

    if (!openings.includes(i)) {
      torchPositions.push({ x: tlx + scale * 0.5, y: ty, scale, brightness, depth: currentDepth });
      torchPositions.push({ x: trx - scale * 0.5, y: ty, scale, brightness, depth: currentDepth });
    }
  }

  torchPositions.sort((a, b) => b.depth - a.depth);

  torchPositions.forEach(tp => drawWallLightPool(ctx, tp.x, tp.y - tp.scale * 0.5, tp.scale * 5.5, tp.brightness, time));
  torchPositions.forEach(tp => drawTorch(ctx, tp.x, tp.y, tp.scale, tp.brightness, time));
}

export function renderDepthFog(ctx, segs, metrics) {
  const s0 = segs[0];
  const { VPX, VPY, W, H } = metrics;
  
  ctx.save();
  ctx.beginPath(); ctx.moveTo(s0.lx, s0.ty); ctx.lineTo(s0.rx, s0.ty); ctx.lineTo(s0.rx, s0.by); ctx.lineTo(s0.lx, s0.by);
  ctx.closePath(); ctx.clip();
  const fogR = ctx.createRadialGradient(VPX, VPY, 0, VPX, VPY, Math.max(W, H) * 0.55);
  fogR.addColorStop(0, 'rgba(0,0,0,0.58)'); fogR.addColorStop(0.18,'rgba(0,0,0,0.30)'); fogR.addColorStop(0.4, 'rgba(0,0,0,0.07)'); fogR.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = fogR; ctx.fillRect(s0.lx, s0.ty, s0.rx - s0.lx, s0.by - s0.ty);
  ctx.restore();
}

export function renderPostProcessingOverlays(ctx, metrics) {
  const { CX, CY, W, H } = metrics;
  
  const vignette = ctx.createRadialGradient(CX, CY, H * 0.28, CX, CY, H * 0.82);
  vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
}
