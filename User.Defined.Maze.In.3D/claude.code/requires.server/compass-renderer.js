// GEMINI.3 compass-renderer.js
import { GameInterface } from './interface.js';

let canvas, ctx;
let currentAngle = 0; // Tracks historical angle for fluid kinetic lag transitions

const DIRECTION_ANGLES = {
  'NORTH': 0,
  'EAST': Math.PI / 2,     // 90 degrees clockwise (Points Right)
  'SOUTH': Math.PI,         // 180 degrees clockwise (Points Down)
  'WEST': Math.PI * 1.5     // 270 degrees clockwise (Points Left)
};

export const CompassRenderer = {
  init(canvasElement) {
    canvas = canvasElement;
    ctx = canvas.getContext('2d');
    canvas.width = 300;
    canvas.height = 300;
  },

  draw() {
    if (!ctx) return;

    const renderContext = GameInterface.getSceneRenderContext();
    const orientation = renderContext.player.orientation;
    const targetAngle = DIRECTION_ANGLES[orientation] ?? 0;

    // Smooth angular interpolation with directional wrap-around security
    let angleDiff = targetAngle - currentAngle;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    currentAngle += angleDiff * 0.15; // Smooth rotational dampening factor

    const W = canvas.width;
    const H = canvas.height;
    const CX = W / 2;
    const CY = H / 2;
    const radius = Math.min(W, H) * 0.42;

    ctx.clearRect(0, 0, W, H);

    // ── 1. BACKGROUND CORE DIAL & ANCIENT BRASS BEZEL ──
    ctx.fillStyle = '#0f0c08';
    ctx.fillRect(0, 0, W, H);

    // Dynamic metallic radial gradient housing ring
    const rimGrad = ctx.createRadialGradient(CX, CY, radius * 0.94, CX, CY, radius * 1.06);
    rimGrad.addColorStop(0, '#5c4d3c');
    rimGrad.addColorStop(0.4, '#8B6914');
    rimGrad.addColorStop(0.7, '#ffaa44');
    rimGrad.addColorStop(1, '#2d251e');
    
    ctx.strokeStyle = rimGrad;
    ctx.lineWidth = radius * 0.08;
    ctx.beginPath();
    ctx.arc(CX, CY, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Dark parchment style interior dial face plate
    ctx.fillStyle = '#14100c';
    ctx.beginPath();
    ctx.arc(CX, CY, radius * 0.95, 0, Math.PI * 2);
    ctx.fill();

    // Decorative inner alignment ring track
    ctx.strokeStyle = 'rgba(136, 122, 107, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(CX, CY, radius * 0.86, 0, Math.PI * 2);
    ctx.stroke();

    // ── 2. STATIC VINTAGE CARDINAL COMPASS LUG TICK MARKS ──
    for (let i = 0; i < 16; i++) {
      const tickAngle = (i / 16) * Math.PI * 2;
      const isCardinal = i % 4 === 0;
      const startLen = radius * (isCardinal ? 0.78 : 0.82);
      const endLen = radius * 0.86;

      ctx.strokeStyle = isCardinal ? '#ffaa44' : '#4a3b2c';
      ctx.lineWidth = isCardinal ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(CX + Math.cos(tickAngle) * startLen, CY + Math.sin(tickAngle) * startLen);
      ctx.lineTo(CX + Math.cos(tickAngle) * endLen, CY + Math.sin(tickAngle) * endLen);
      ctx.stroke();
    }

    // Typography Text Labels Configuration Rules
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textDist = radius * 0.66;

    // Core Cardinal Elements
    ctx.fillStyle = '#ffaa44';
    ctx.font = 'bold 16px serif';
    ctx.fillText('N', CX, CY - textDist);
    ctx.fillText('S', CX, CY + textDist);
    ctx.fillText('E', CX + textDist, CY);
    ctx.fillText('W', CX - textDist, CY);

    // Sub-cardinal Elements
    ctx.fillStyle = '#6e5a47';
    ctx.font = '9px monospace';
    ctx.fillText('NE', CX + textDist * 0.68, CY - textDist * 0.68);
    ctx.fillText('NW', CX - textDist * 0.68, CY - textDist * 0.68);
    ctx.fillText('SE', CX + textDist * 0.68, CY + textDist * 0.68);
    ctx.fillText('SW', CX - textDist * 0.68, CY + textDist * 0.68);

    // ── 3. DYNAMIC ROTATING MULTI-TONE MAGNETIC NEEDLE ──
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(currentAngle);

    const nLen = radius * 0.76;
    const nWidth = radius * 0.11;

    // NORTH BLADE TIP - Primary Amber Swell Accent
    ctx.beginPath(); ctx.moveTo(0, -nLen); ctx.lineTo(nWidth, 0); ctx.lineTo(0, -radius * 0.1); ctx.closePath();
    const gradNorthLight = ctx.createLinearGradient(0, -nLen, nWidth, 0);
    gradNorthLight.addColorStop(0, '#ffcc66'); gradNorthLight.addColorStop(1, '#ffaa44');
    ctx.fillStyle = gradNorthLight; ctx.fill();

    // NORTH BLADE TIP - Shadow Face
    ctx.beginPath(); ctx.moveTo(0, -nLen); ctx.lineTo(-nWidth, 0); ctx.lineTo(0, -radius * 0.1); ctx.closePath();
    const gradNorthDark = ctx.createLinearGradient(0, -nLen, -nWidth, 0);
    gradNorthDark.addColorStop(0, '#ffaa44'); gradNorthDark.addColorStop(1, '#994400');
    ctx.fillStyle = gradNorthDark; ctx.fill();

    // SOUTH BLADE TIP - Light Face Charcoal Slate
    ctx.beginPath(); ctx.moveTo(0, nLen); ctx.lineTo(nWidth, 0); ctx.lineTo(0, radius * 0.1); ctx.closePath();
    ctx.fillStyle = '#44372a'; ctx.fill();

    // SOUTH BLADE TIP - Dark Face Iron
    ctx.beginPath(); ctx.moveTo(0, nLen); ctx.lineTo(-nWidth, 0); ctx.lineTo(0, radius * 0.1); ctx.closePath();
    ctx.fillStyle = '#261f17'; ctx.fill();

    // Heavy Central Pivot Pin Shield Cap
    const capGrad = ctx.createRadialGradient(-2, -2, 0, 0, 0, radius * 0.12);
    capGrad.addColorStop(0, '#ffd899');
    capGrad.addColorStop(0.5, '#8B6914');
    capGrad.addColorStop(1, '#3a2712');
    ctx.fillStyle = capGrad;
    ctx.beginPath(); ctx.arc(0, 0, radius * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#14100c'; ctx.lineWidth = 1; ctx.stroke();

    ctx.restore();
  }
};
