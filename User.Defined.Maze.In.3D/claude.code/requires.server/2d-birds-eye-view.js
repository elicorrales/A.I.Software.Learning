// GEMINI.3 2d-birds-eye-view.js
import { GameInterface } from './interface.js';

let canvas, ctx;

const MAP_W = 400;
const MAP_H = 400;
const SCALE_X = 24; 
const SCALE_Y = 45; 
const ORIGIN_X = 60; 
const ORIGIN_Y = 50; 

const GLOBAL_COLUMN_TRACKS = [-1.0, 1.0, 3.0, 5.0, 7.0, 9.0, 11.0];

export const BirdsEyeView = {
  init(canvasElement) {
    canvas = canvasElement;
    ctx = canvas.getContext('2d');
    canvas.width = MAP_W;
    canvas.height = MAP_H;
  },

  worldToScreen(globalX, hallIndex) {
    return {
      x: ORIGIN_X + (globalX - (-1.0)) * SCALE_X,
      y: ORIGIN_Y + hallIndex * SCALE_Y
    };
  },

  draw() {
    if (!ctx) return;

    const mapData = GameInterface.getBirdsEyeContext();

    ctx.fillStyle = '#0f0c08'; ctx.fillRect(0, 0, MAP_W, MAP_H);

    // ── 1. RENDER GLOBAL 7-COLUMN GUIDELINES ──────────────────────────────────
    GLOBAL_COLUMN_TRACKS.forEach((colX, index) => {
      const screenX = this.worldToScreen(colX, 0).x;
      const label = `C${index + 1}`;

      ctx.strokeStyle = 'rgba(92, 77, 60, 0.18)'; ctx.lineWidth = 1;
      ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(screenX, 34); ctx.lineTo(screenX, MAP_H - 15); ctx.stroke();
      ctx.setLineDash([]); 

      ctx.fillStyle = '#887a6b'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
      ctx.fillText(label, screenX, 32);
    });
    ctx.textAlign = 'left';

    // ── 2. RENDER PERSISTENT DISCOVERED TUNNELS (ONLY IF THEY EXIST) ──────────
    if (mapData.tunnels) {
      mapData.tunnels.forEach(tunnel => {
        const startPos = this.worldToScreen(tunnel.globalX, tunnel.startHall);
        const endPos = this.worldToScreen(tunnel.globalX, tunnel.endHall);

        // Render discovered pathways in a distinct masonry blueprint color
        ctx.strokeStyle = '#3a2f24'; 
        ctx.lineWidth = 6; 
        ctx.beginPath(); 
        ctx.moveTo(startPos.x, startPos.y); 
        ctx.lineTo(endPos.x, endPos.y); 
        ctx.stroke();
      });
    }

    // ── 3. RENDER HALLWAY PATHWAYS & PORTALS ─────────────────────────────────
    mapData.halls.forEach((hall, hIdx) => {
      const startPos = this.worldToScreen(hall.worldXOffset, hIdx);
      const endPos = this.worldToScreen(hall.worldXOffset + mapData.constants.hallLength, hIdx);

      ctx.strokeStyle = mapData.player.hall === hIdx ? '#4a3b2c' : '#261f17';
      ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(startPos.x, startPos.y); ctx.lineTo(endPos.x, endPos.y); ctx.stroke();

      ctx.fillStyle = mapData.player.hall === hIdx ? '#d4b28a' : '#5c4d3c'; ctx.font = 'bold 11px monospace';
      ctx.fillText(hall.id, 12, startPos.y + 4);

      hall.openings.forEach(opZ => {
        const portalGlobalX = hall.worldXOffset + opZ;
        const ptStart = this.worldToScreen(portalGlobalX, hIdx);
        ctx.fillStyle = '#ffcc44'; ctx.fillRect(ptStart.x, ptStart.y - 4, SCALE_X, 8); 
      });
    });

    // ── 4. DRAW DYNAMIC PLAYER COMPASS POINTER RADAR NODE ─────────────────────
    const pPt = this.worldToScreen(mapData.player.globalX, mapData.player.hall);
    
    ctx.strokeStyle = 'rgba(0, 255, 100, 0.15)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pPt.x, 0); ctx.lineTo(pPt.x, MAP_H); ctx.moveTo(0, pPt.y); ctx.lineTo(MAP_W, pPt.y); ctx.stroke();

    ctx.strokeStyle = '#00ff66'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(pPt.x, pPt.y);
    let arrowDx = 0, arrowDy = 0;
    if (mapData.player.orientation === 'EAST')  arrowDx = 14;
    if (mapData.player.orientation === 'WEST')  arrowDx = -14;
    if (mapData.player.orientation === 'SOUTH') arrowDy = 14;
    if (mapData.player.orientation === 'NORTH') arrowDy = -14;
    ctx.lineTo(pPt.x + arrowDx, pPt.y + arrowDy); ctx.stroke();

    ctx.fillStyle = '#00ff66'; ctx.shadowBlur = 10; ctx.shadowColor = '#00ff66';
    ctx.beginPath(); ctx.arc(pPt.x, pPt.y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; 

    // ── 5. DRAW BALL TRAILING TRACE NODE ─────────────────────────────────────
    if (mapData.ball.isAlive) {
      const bPt = this.worldToScreen(mapData.ball.globalX, mapData.ball.hall);
      ctx.fillStyle = '#ff7700'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
      ctx.shadowBlur = 12; ctx.shadowColor = '#ff5500';
      ctx.beginPath(); ctx.arc(bPt.x, bPt.y, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0; 
    }

    ctx.strokeStyle = '#3e342a'; ctx.lineWidth = 2; ctx.strokeRect(0, 0, MAP_W, MAP_H);
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '9px monospace'; ctx.fillText("2D MAP VISUAL TRUTH", 12, 20);
  }
};
