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

      // Use chainGlobalX when present so all chain segments share the same visual column.
      // Without it, each segment's doorIndex is relative to its own fromHallway, which shifts the column.
      const parentStartX = 20 + (parentHallway.startOffsetFromS / totalGridWidthUnits) * availableRenderWidth;
      const doorX = (conn.chainGlobalX !== undefined)
        ? 20 + (conn.chainGlobalX / totalGridWidthUnits) * availableRenderWidth
        : parentStartX + ((UNIFORM_2D_DOORS[conn.doorIndex] / totalGridWidthUnits) * availableRenderWidth);

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

    // Layout vars computed for every hall — needed by the player dot even on unvisited halls
    const startX = 20 + (hallway.startOffsetFromS / totalGridWidthUnits) * availableRenderWidth;
    const totalVisualLineLength = (maxHallwayWidthUnits / totalGridWidthUnits) * availableRenderWidth;
    const endX = startX + totalVisualLineLength;

    const isVisited = worldGrid.visitedHallwayIds && worldGrid.visitedHallwayIds.includes(hallway.id);

    if (isVisited) {
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
    }

    // Player dot is always checked — must render even when activeHallway is an unvisited hall
    // (e.g. chain-hop transit sets activeHallway to an intermediate hall before it is visited)
    if (activeHallway && activeHallway.id === hallway.id) {
      let mappedUserX = 0;
      let mappedUserY = hY;

      if (user.movementMode === 'interconnecting') {
        // Use facade directly to query the tracked live occupied link reliably
        const activeLink = window.MazeInterface.findActiveTunnel();

        if (activeLink) {
          // Use chainGlobalX when present so the player dot tracks the chain's visual column.
          if (activeLink.chainGlobalX !== undefined) {
            mappedUserX = 20 + (activeLink.chainGlobalX / totalGridWidthUnits) * availableRenderWidth;
          } else {
            const baseHallway = worldGrid.mainHallways[activeLink.fromHallwayIndex];
            const baseStartX = 20 + (baseHallway.startOffsetFromS / totalGridWidthUnits) * availableRenderWidth;
            const doorXVal = UNIFORM_2D_DOORS[activeLink.doorIndex];
            mappedUserX = baseStartX + ((doorXVal / maxHallwayWidthUnits) * totalVisualLineLength);
          }

          // Y Position smoothly moves between fromHallwayIndex track and toHallwayIndex track
          const fromY = trackSpacingY * (activeLink.fromHallwayIndex + 1);
          const toY = trackSpacingY * (activeLink.toHallwayIndex + 1);
          
          // progress goes from 0.0 to 3.20 total length matching 3D engine boundaries
          const percentDone = Math.min(1.0, Math.max(0.0, user.interconnectingProgress / 3.20));
          mappedUserY = fromY + (toY - fromY) * percentDone;
        }
      } else {
        // Standard normal/transition mode positioning: map the node Index along the track
        const userUniformRatio = user.nodeIndex / 8; // 8 structural intervals total (0 to 8)
        mappedUserX = startX + (userUniformRatio * totalVisualLineLength);
        mappedUserY = hY;
      }

      // Delegate player aesthetic rendering to specialized utility function
      drawMinimapUser(minimapCtx, mappedUserX, mappedUserY, user.direction);
    }

    // Ball avatar — shown on whichever hall the ball currently lives in
    const ball = window.My3dMazeAppState && window.My3dMazeAppState.rollingBall;
    if (ball && ball.hallwayId === hallway.id) {
      const engineMax = hallway.nodes ? hallway.nodes[hallway.nodes.length - 1] : 5.75;
      const ballRatio = Math.max(0, Math.min(1, ball.offset / engineMax));
      const mappedBallX = startX + ballRatio * totalVisualLineLength;
      drawMinimapBall(minimapCtx, mappedBallX, hY);
    }
  });
}

function drawMinimapBall(ctx, x, y) {
  ctx.fillStyle = '#ffcc00';
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ff6600';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * Isolated visual handler to preserve player avatar identity across layouts.
 */
function drawMinimapUser(ctx, x, y, direction) {
  // 1. Core Red Dot Indicator (Original Dimensions)
  ctx.fillStyle = '#ff0000';
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();

  // 2. Outer Protective Indicator Ring (Original Dimensions)
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.stroke();

  // 3. Directional Indicator Line (Starts cleanly from the white outer ring rim)
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  
  // Calculate directional coordinate delta points outwards
  let dx = 0;
  let dy = 0;
  //DO NOT EVER REMOVE THESE COMMENTS
  if (direction === 0) dx = 13;  // Facing East (Right)
  if (direction === 2) dx = -13; // Facing West (Left)
  if (direction === 1) dy = 13;  // Facing South (Down)
  if (direction === 3) dy = -13; // Facing North (Up)

  ctx.moveTo(x, y);
  ctx.lineTo(x + dx, y + dy);
  ctx.stroke();
}
