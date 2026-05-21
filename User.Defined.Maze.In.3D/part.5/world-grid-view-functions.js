/**
 * world-grid-view-functions.js
 * Self-contained stateless sub-system for rendering the Bird's Eye Diagnostic Grid.
 */

function drawBirdseyeView(minimapCtx, minimapCanvas, worldGrid, activeHallway, user) {
  const w = minimapCanvas.width;
  const h = minimapCanvas.height;

  minimapCtx.fillStyle = '#111111';
  minimapCtx.fillRect(0, 0, w, h);

  minimapCtx.strokeStyle = '#444444';
  minimapCtx.lineWidth = 2;
  minimapCtx.strokeRect(0, 0, w, h);

  const totalHallways = worldGrid.mainHallways.length;
  if (totalHallways === 0) return;

  const trackSpacingY = h / (totalHallways + 1);

  // --- LAYOUT BOUND METRICS ---
  const maxHallwayWidthUnits = 4.0; // Max length in uniform space (UNIFORM_2D_DOORS ends at 4.0)
  const maxAllowedStaggerUnits = 4.0; // The max value from our random offset generator
  const totalGridWidthUnits = maxHallwayWidthUnits + maxAllowedStaggerUnits; // 8 units total capacity

  const availableRenderWidth = w - 40;
  const UNIFORM_2D_DOORS = [0.0, 1.0, 2.0, 3.0, 4.0];
  const doorNodeIndices = [0, 2, 4, 6, 8];

  // Render starting benchmark 'S' line
  minimapCtx.strokeStyle = '#ff3333';
  minimapCtx.lineWidth = 1;
  minimapCtx.setLineDash([2, 4]);
  minimapCtx.beginPath();
  minimapCtx.moveTo(20, 0);
  minimapCtx.lineTo(20, h);
  minimapCtx.stroke();
  minimapCtx.setLineDash([]);

  minimapCtx.fillStyle = '#666666';
  minimapCtx.font = '9px monospace';
  minimapCtx.fillText('S', 18, 12);
  minimapCtx.fillText(worldGrid.name, 5, h - 6);

  // --- STEP 1: DRAW INTERCONNECTING HALLWAYS ---
  if (worldGrid.interconnectingHallways) {
    worldGrid.interconnectingHallways.forEach(conn => {
      const parentHallway = worldGrid.mainHallways[conn.fromHallwayIndex];
      if (!parentHallway) return;

      // Use the stored explicit destination track row index
      const nextRowIndex = conn.toHallwayIndex !== undefined ? conn.toHallwayIndex : (conn.direction === 3 ? conn.fromHallwayIndex - 1 : conn.fromHallwayIndex + 1);

      const hY1 = trackSpacingY * (conn.fromHallwayIndex + 1);
      const hY2 = trackSpacingY * (nextRowIndex + 1);

      // --- MINIMAL CHANGE HERE ---
      // We calculate the exact X coordinate once using the originating door's position.
      const parentStartX = 20 + (parentHallway.startOffsetFromS / totalGridWidthUnits) * availableRenderWidth;
      const doorX = parentStartX + ((UNIFORM_2D_DOORS[conn.doorIndex] / totalGridWidthUnits) * availableRenderWidth);

      // Draw a perfectly straight line to the destination track row, even if it's completely empty space
      minimapCtx.strokeStyle = '#00ffcc';
      minimapCtx.lineWidth = 3;
      minimapCtx.beginPath();
      minimapCtx.moveTo(doorX, hY1);
      minimapCtx.lineTo(doorX, hY2);
      minimapCtx.stroke();
    });
  }

  // --- STEP 2: DRAW MAIN TRACKS & USER POSITION ---
  worldGrid.mainHallways.forEach((hallway, i) => {
    const hY = trackSpacingY * (i + 1);

    const startX = 20 + (hallway.startOffsetFromS / totalGridWidthUnits) * availableRenderWidth;
    const totalVisualLineLength = (maxHallwayWidthUnits / totalGridWidthUnits) * availableRenderWidth;
    const endX = startX + totalVisualLineLength;

    // Draw structural hallway vector track
    minimapCtx.strokeStyle = hallway.nearWallColor;
    minimapCtx.lineWidth = 4;
    minimapCtx.beginPath();
    minimapCtx.moveTo(startX, hY);
    minimapCtx.lineTo(endX, hY);
    minimapCtx.stroke();

    minimapCtx.fillStyle = hallway.nearWallColor;
    minimapCtx.fillRect(startX - 2, hY - 4, 4, 8);
    minimapCtx.fillStyle = hallway.farWallColor;
    minimapCtx.fillRect(endX - 2, hY - 4, 4, 8);

    minimapCtx.fillStyle = '#ffffff';
    minimapCtx.font = 'bold 8px sans-serif';
    minimapCtx.fillText(hallway.nearWallLabel, startX - 14, hY + 3);
    minimapCtx.fillText(hallway.farWallLabel, endX + 4, hY + 3);

    // Draw doors evenly spaced on the diagnostic grid
    UNIFORM_2D_DOORS.forEach(val => {
      const doorX = startX + ((val / maxHallwayWidthUnits) * totalVisualLineLength);
      minimapCtx.fillStyle = '#00ffcc';
      minimapCtx.fillRect(doorX - 1, hY - 3, 2, 6);
    });

    // Render User Coordinates using uniform discrete step index translation
    if (activeHallway && activeHallway.id === hallway.id) {
      // map the player's true step node coordinate array progress directly onto uniform scale bounds
      const userUniformRatio = user.nodeIndex / 8; // 8 structural intervals total (0 to 8)
      const mappedUserX = startX + (userUniformRatio * totalVisualLineLength);

      // Red Dot
      minimapCtx.fillStyle = '#ff0000';
      minimapCtx.beginPath();
      minimapCtx.arc(mappedUserX, hY, 5, 0, Math.PI * 2);
      minimapCtx.fill();

      // Outer indicator ring
      minimapCtx.strokeStyle = '#ffffff';
      minimapCtx.lineWidth = 1.5;
      minimapCtx.beginPath();
      minimapCtx.arc(mappedUserX, hY, 7, 0, Math.PI * 2);
      minimapCtx.stroke();
    }
  });
}
