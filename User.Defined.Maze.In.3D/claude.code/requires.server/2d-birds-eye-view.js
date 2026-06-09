// GEMINI.3 2d-birds-eye-view.js
import { GameInterface } from './interface.js';

let canvas, ctx;

// Display dimension constraints for the tactical map radar frame
const MAP_W = 400;
const MAP_H = 400;

// Grid drawing offsets tailored to fit the map boundaries
const SCALE_X = 24; // Pixels per world spatial unit horizontally
const SCALE_Y = 45; // Row distance allocation between adjacent hallways
const ORIGIN_X = 60; // Left padding offset to clear negative world alignment bounds
const ORIGIN_Y = 50; // Top margin padding layout boundary offset

export const BirdsEyeView = {
  init(canvasElement) {
    canvas = canvasElement;
    ctx = canvas.getContext('2d');
    canvas.width = MAP_W;
    canvas.height = MAP_H;
  },

  // Coordinate translator mapping abstract world vectors directly to pixel matrices
  worldToScreen(globalX, hallIndex) {
    return {
      x: ORIGIN_X + (globalX - (-1.0)) * SCALE_X,
      y: ORIGIN_Y + hallIndex * SCALE_Y
    };
  },

  draw() {
    if (!ctx) return;

    // RULE 1: Extract tracking parameters via interface façade constraints
    const mapData = GameInterface.getBirdsEyeContext();

    // Reset viewport frames
    ctx.fillStyle = '#0f0c08';
    ctx.fillRect(0, 0, MAP_W, MAP_H);

    // ── 1. RENDER STRUCTURAL CORRIDOR GRID TRUTH ────────────────────────────
    mapData.halls.forEach((hall, hIdx) => {
      // Determine the exact physical span of the current lane line
      const startPos = this.worldToScreen(hall.worldXOffset, hIdx);
      const endPos = this.worldToScreen(hall.worldXOffset + mapData.constants.hallLength, hIdx);

      // Draw the primary corridor track bar
      ctx.strokeStyle = mapData.player.hall === hIdx ? '#4a3b2c' : '#261f17';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(startPos.x, startPos.y);
      ctx.lineTo(endPos.x, endPos.y);
      ctx.stroke();

      // Label the Corridor Row Name
      ctx.fillStyle = mapData.player.hall === hIdx ? '#d4b28a' : '#5c4d3c';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(hall.id, 12, startPos.y + 4);

      // FIX: Render Intersecting Opening Portal Volumes (1-Unit Wide Cross-Tunnel Zones)
      hall.openings.forEach(opZ => {
        const portalGlobalX = hall.worldXOffset + opZ;
        const ptStart = this.worldToScreen(portalGlobalX, hIdx);

        // Render opening as a 1-unit-wide bounding box segment (SCALE_X wide) instead of a dot
        ctx.fillStyle = '#ffcc44';
        ctx.fillRect(ptStart.x, ptStart.y - 4, SCALE_X, 8); // Slightly taller than corridor line to pop out
      });
    });

    // ── 2. DRAW PLAYER SPACE POSITION ───────────────────────────────────────
    const pPt = this.worldToScreen(mapData.player.globalX, mapData.player.hall);
    
    // Draw crosshair tracking indicators
    ctx.strokeStyle = 'rgba(0, 255, 100, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pPt.x, 0); ctx.lineTo(pPt.x, MAP_H);
    ctx.moveTo(0, pPt.y); ctx.lineTo(MAP_W, pPt.y);
    ctx.stroke();

    // Draw player visual icon pointer node
    ctx.fillStyle = '#00ff66';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ff66';
    ctx.beginPath();
    ctx.arc(pPt.x, pPt.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0; // Clear blur constraints to prevent state leaks

    // ── 3. DRAW MOVING ENTITY BALL POSITION ─────────────────────────────────
    if (mapData.ball.isAlive) {
      const bPt = this.worldToScreen(mapData.ball.globalX, mapData.ball.hall);

      ctx.fillStyle = '#ff7700';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#ff5500';
      
      ctx.beginPath();
      ctx.arc(bPt.x, bPt.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      ctx.shadowBlur = 0; // Reset canvas pipeline overrides
    }

    // ── 4. FRAME ACCENTS ──────────────────────────────────────────────────
    ctx.strokeStyle = '#3e342a';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, MAP_W, MAP_H);

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '9px monospace';
    ctx.fillText("2D MAP VISUAL TRUTH", 12, 20);
  }
};
