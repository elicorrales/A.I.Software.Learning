// GEMINI.3 lateral-renderer.js

export function renderLateralScene(ctx, renderContext, metrics) {
  const player = renderContext.player;
  const orientation = player.orientation;
  const playerZ = player.localZ;
  const activeOpenings = renderContext.activeHallLayout.openings;
  const { W, H, CX, CY } = metrics;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#1c140a'; 
  ctx.fillRect(0, 0, W, H);

  const hasOpening = activeOpenings.includes(Math.floor(playerZ));

  if (hasOpening) {
    ctx.fillStyle = '#050403';
    const boxW = W * 0.28; const boxH = H * 0.52;
    ctx.fillRect(CX - boxW / 2, CY - boxH / 2, boxW, boxH);

    ctx.fillStyle = '#ffaa44'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
    ctx.fillText(`[CROSS TUNNEL PORTAL - FACING ${orientation}]`, CX, CY + boxH / 2 + 32);
  } else {
    ctx.fillStyle = '#5c4d3c'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
    ctx.fillText(`[SOLID COMPACT BRICK WALL PANEL - FACING ${orientation}]`, CX, CY);
  }
  ctx.textAlign = 'left';
}
