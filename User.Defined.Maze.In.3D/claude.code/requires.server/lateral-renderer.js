// GEMINI.3 lateral-renderer.js
import { drawStonePattern } from './renderer-textures.js';
import { lerp } from './geometry-utils.js';
import { drawTorch, drawWallLightPool } from './lighting-renderer.js';

export function renderLateralScene(ctx, renderContext, metrics, time) {
  const player = renderContext.player;
  const playerZ = player.localZ;
  const activeOpenings = renderContext.activeHallLayout.openings;
  const { W, H, CX, CY, LEFT, RIGHT, TOP, BOTTOM, HALL_WIDTH, HALL_HEIGHT, VPX, VPY } = metrics;

  // 1. Clear Viewport and Paint Base Ambient Voids
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#1c140a'; 
  ctx.fillRect(0, 0, W, H);

  // Paint Outer Floor / Ceiling Border Wrappers
  ctx.fillStyle = '#16130f';
  ctx.fillRect(0, 0, W, TOP);
  ctx.fillStyle = '#110f0c';
  ctx.fillRect(0, BOTTOM, W, H - BOTTOM);

  // Determine if player is currently aligned with a cross-tunnel portal gap
  const hasOpening = activeOpenings.includes(Math.floor(playerZ));

  if (!hasOpening) {
    // ── CASE A: SOLID COMPACT SIDE WALL PANEL ──
    ctx.save();
    ctx.beginPath();
    ctx.rect(LEFT, TOP, HALL_WIDTH, HALL_HEIGHT);
    ctx.clip();

    ctx.fillStyle = '#2d251e';
    ctx.fillRect(LEFT, TOP, HALL_WIDTH, HALL_HEIGHT);
    drawStonePattern(ctx, LEFT, TOP, HALL_WIDTH, HALL_HEIGHT, 54, 8, 32, 16);

    const wallG = ctx.createLinearGradient(LEFT, TOP, LEFT, BOTTOM);
    wallG.addColorStop(0, 'rgba(0,0,0,0.4)');
    wallG.addColorStop(0.3, 'rgba(0,0,0,0.0)');
    wallG.addColorStop(0.7, 'rgba(0,0,0,0.0)');
    wallG.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = wallG;
    ctx.fillRect(LEFT, TOP, HALL_WIDTH, HALL_HEIGHT);

    const edgeG = ctx.createLinearGradient(LEFT, 0, RIGHT, 0);
    edgeG.addColorStop(0, 'rgba(0,0,0,0.3)');
    edgeG.addColorStop(0.2, 'rgba(0,0,0,0.0)');
    edgeG.addColorStop(0.8, 'rgba(0,0,0,0.0)');
    edgeG.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = edgeG;
    ctx.fillRect(LEFT, TOP, HALL_WIDTH, HALL_HEIGHT);

    const torchX = CX;
    const torchY = TOP + HALL_HEIGHT * 0.32; 
    const torchScale = 46;                  
    const torchBrightness = 1.0;

    drawWallLightPool(ctx, torchX, torchY - torchScale * 0.5, torchScale * 5.5, torchBrightness, time);
    drawTorch(ctx, torchX, torchY, torchScale, torchBrightness, time);

    ctx.restore();
  } else {
    // ── CASE B: 3D CROSS-TUNNEL PORTAL SIDE ENTRY (THICK THRESHOLD) ──
    const portalW = HALL_WIDTH * 0.44;
    const portalLeft = CX - portalW / 2;
    const portalRight = CX + portalW / 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(portalLeft, TOP, portalW, HALL_HEIGHT);
    ctx.clip();

    // Base background behind the threshold sleeve
    ctx.fillStyle = '#000000';
    ctx.fillRect(portalLeft, TOP, portalW, HALL_HEIGHT);

    // Define the depth parameters for the thick entranceway divider
    const thresholdDepthSteps = 4;
    const maxThresholdScale = 0.45; // How far the thick divider frame extends inward

    // Track coordinates from front-to-back to slice individual stone segments
    let lastLX = portalLeft, lastRX = portalRight;
    let lastTY = TOP,        lastBY = BOTTOM;

    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    
    for (let i = 1; i <= thresholdDepthSteps; i++) {
      const ratio = i / thresholdDepthSteps;
      const dScale = Math.pow(ratio, 0.75) * maxThresholdScale;

      // Project the inner boundary corners of this segment slice
      const nextTY = TOP + (VPY - TOP) * dScale;
      const nextBY = BOTTOM - (BOTTOM - VPY) * dScale;
      const nextLX = portalLeft + (CX - portalLeft) * dScale;
      const nextRX = portalRight - (portalRight - CX) * dScale;

      // Calculate deep shading decay factor (gets darker as it enters the frame)
      const lightDecay = lerp(1.0, 0.28, ratio);
      const wBright = Math.round(44 * lightDecay);
      const fBright = Math.round(52 * lightDecay);
      const cBright = Math.round(40 * lightDecay);

      // Alternating shade variance noise simulation for blocks
      const altShade = (i % 2 === 0) ? 4 : -4;

      // 1. Render Left Inner Receding Wall Segment
      ctx.fillStyle = `rgb(${wBright + altShade}, ${Math.round((wBright + altShade) * 0.9)}, ${Math.round((wBright + altShade) * 0.78)})`;
      ctx.beginPath();
      ctx.moveTo(lastLX, lastTY); ctx.lineTo(nextLX, nextTY);
      ctx.lineTo(nextLX, nextBY); ctx.lineTo(lastLX, lastBY);
      ctx.closePath(); ctx.fill(); ctx.stroke();

      // 2. Render Right Inner Receding Wall Segment
      ctx.fillStyle = `rgb(${wBright - altShade}, ${Math.round((wBright - altShade) * 0.9)}, ${Math.round((wBright - altShade) * 0.78)})`;
      ctx.beginPath();
      ctx.moveTo(lastRX, lastTY); ctx.lineTo(nextRX, nextTY);
      ctx.lineTo(nextRX, nextBY); ctx.lineTo(lastRX, lastBY);
      ctx.closePath(); ctx.fill(); ctx.stroke();

      // 3. Render Floor Slabs Inside Portal Frame
      ctx.fillStyle = `rgb(${fBright}, ${Math.round(fBright * 0.93)}, ${Math.round(fBright * 0.82)})`;
      ctx.beginPath();
      ctx.moveTo(lastLX, lastBY); ctx.lineTo(lastRX, lastBY);
      ctx.lineTo(nextRX, nextBY); ctx.lineTo(nextLX, nextBY);
      ctx.closePath(); ctx.fill(); ctx.stroke();

      // 4. Render Ceiling Slabs Inside Portal Frame
      ctx.fillStyle = `rgb(${cBright}, ${Math.round(cBright * 0.93)}, ${Math.round(cBright * 0.82)})`;
      ctx.beginPath();
      ctx.moveTo(lastLX, lastTY); ctx.lineTo(lastRX, lastTY);
      ctx.lineTo(nextRX, nextTY); ctx.lineTo(nextLX, nextTY);
      ctx.closePath(); ctx.fill(); ctx.stroke();

      // Store steps for the next connecting wall loop
      lastLX = nextLX; lastRX = nextRX;
      lastTY = nextTY; lastBY = nextBY;
    }

    // Draw some simple perspective floor grid dividers on the threshold floor slabs
    const floorLines = 3;
    for (let k = 1; k < floorLines; k++) {
      const r = k / floorLines;
      ctx.beginPath();
      ctx.moveTo(lerp(portalLeft, portalRight, r), BOTTOM);
      ctx.lineTo(lerp(lastLX, lastRX, r), lastBY);
      ctx.stroke();
    }

    // ── THE OBSCURE ABYSS FOG OVERLAY ──
    // Apply a radial shroud over the far back rectangle opening cap to cleanly blend into fog
    const fogGrad = ctx.createRadialGradient(CX, VPY, 0, CX, VPY, portalW * 0.65);
    fogGrad.addColorStop(0, 'rgba(5, 4, 3, 1.0)');       // Pitch black obscure center core
    fogGrad.addColorStop(0.35, 'rgba(10, 8, 6, 0.95)');   // Heavy rolling darkness shroud
    fogGrad.addColorStop(0.75, 'rgba(28, 20, 14, 0.4)');  // Subtle dusty ambient dissipation
    fogGrad.addColorStop(1, 'rgba(0,0,0,0)');             // Clear visibility at the very front lips
    
    ctx.fillStyle = fogGrad;
    ctx.fillRect(portalLeft, TOP, portalW, HALL_HEIGHT);

    ctx.restore();

    // 2. Render Left and Right Solid Framing Wall Pillars (The Main Corridor Corner Cuts)
    const pillarW = (HALL_WIDTH - portalW) / 2;

    // Left Framing Pillar
    ctx.save();
    ctx.beginPath();
    ctx.rect(LEFT, TOP, pillarW + 1, HALL_HEIGHT);
    ctx.clip();
    ctx.fillStyle = '#2d251e'; ctx.fillRect(LEFT, TOP, pillarW + 1, HALL_HEIGHT);
    drawStonePattern(ctx, LEFT, TOP, pillarW + 1, HALL_HEIGHT, 54, 8, 32, 16);
    
    const leftShadow = ctx.createLinearGradient(LEFT, 0, portalLeft, 0);
    leftShadow.addColorStop(0, 'rgba(0,0,0,0.3)'); leftShadow.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = leftShadow; ctx.fillRect(LEFT, TOP, pillarW + 1, HALL_HEIGHT);
    ctx.restore();

    // Right Framing Pillar
    ctx.save();
    ctx.beginPath();
    ctx.rect(portalRight - 1, TOP, pillarW + 2, HALL_HEIGHT);
    ctx.clip();
    ctx.fillStyle = '#2d251e'; ctx.fillRect(portalRight - 1, TOP, pillarW + 2, HALL_HEIGHT);
    drawStonePattern(ctx, portalRight - 1, TOP, pillarW + 2, HALL_HEIGHT, 54, 8, 32, 16);
    
    const rightShadow = ctx.createLinearGradient(RIGHT, 0, portalRight, 0);
    rightShadow.addColorStop(0, 'rgba(0,0,0,0.3)'); rightShadow.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = rightShadow; ctx.fillRect(portalRight - 1, TOP, pillarW + 2, HALL_HEIGHT);
    ctx.restore();
  }
}
