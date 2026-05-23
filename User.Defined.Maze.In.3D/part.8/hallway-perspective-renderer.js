/**
 * hallway-perspective-renderer.js
 * Stateless rendering engine for the 3D first-person perspective projection views.
 */

// =========================================================================
// INTERNAL UTILITY: COORDINATE TRANSLATION ENGINE
// =========================================================================

/**
 * Translates global world compass integers into a local camera orientation
 * context depending on the structural layout of the current movement mode.
 * * Returns: 'forward' | 'backward' | 'sideways'
 */
function getLocalViewOrientation(movementMode, globalDirection) {
    if (movementMode === 'interconnecting') {
        // Tunnels run horizontally (East-West) across the screen layout.
        // Therefore, facing East (1) or West (3) means looking down its long perspective.
        if (globalDirection === 1 || globalDirection === 3) {
            return 'forward';
        } else {
            return 'sideways';
        }
    } else {
        // Main Hallways run vertically (North-South) across the grid.
        // Facing North (0) is forward perspective; South (2) is reverse perspective.
        if (globalDirection === 0) return 'forward';
        if (globalDirection === 2) return 'backward';
        return 'sideways';
    }
}

// =========================================================================
// SECTION 1: MAIN HALLWAY RENDERING COMPONENT
// =========================================================================

function drawMainHallwayPerspective(ctx, canvas, hallwayData, offset, isLookingBackward) {
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    const backWallZ = hallwayData.baseDistances[hallwayData.baseDistances.length - 1] - offset;
    const backWallScale = backWallZ > 0 ? 1 / backWallZ : 0;

    const x1 = cx - (cx * backWallScale);
    const x2 = cx + ((w - cx) * backWallScale);
    const y1 = cy - (cy * backWallScale);
    const y2 = cy + ((h - cy) * backWallScale);

    const wallColor = isLookingBackward ? hallwayData.nearWallColor : hallwayData.farWallColor;
    const wallText = isLookingBackward ? hallwayData.nearWallLabel : hallwayData.farWallLabel;
    const leftDoorColor = isLookingBackward ? hallwayData.rightSideDoorColor : hallwayData.leftSideDoorColor;
    const rightDoorColor = isLookingBackward ? hallwayData.leftSideDoorColor : hallwayData.rightSideDoorColor;

    // Draw Base Floor
    ctx.fillStyle = '#888888';
    ctx.beginPath();
    ctx.moveTo(0, h); ctx.lineTo(x1, y2); ctx.lineTo(x2, y2); ctx.lineTo(w, h);
    ctx.closePath(); ctx.fill();

    // Draw Left Wall Mesh
    ctx.fillStyle = '#e0e0e0';
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(x1, y1); ctx.lineTo(x1, y2); ctx.lineTo(0, h);
    ctx.closePath(); ctx.fill();

    // Draw Right Wall Mesh
    ctx.fillStyle = '#e0e0e0';
    ctx.beginPath();
    ctx.moveTo(w, 0); ctx.lineTo(x2, y1); ctx.lineTo(x2, y2); ctx.lineTo(w, h);
    ctx.closePath(); ctx.fill();

    // Draw Outline Geometry Structural Guideliners
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(x1, y1);
    ctx.moveTo(w, 0); ctx.lineTo(x2, y1);
    ctx.moveTo(0, h); ctx.lineTo(x1, y2);
    ctx.moveTo(w, h); ctx.lineTo(x2, y2);
    ctx.stroke();

    // Draw Back Termination Wall Patch
    if (backWallZ > 0) {
        ctx.fillStyle = wallColor;
        ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${Math.max(1, (y2 - y1) * 0.5)}px sans-serif`;
        ctx.fillText(wallText, cx, cy);
        ctx.restore();
    }

    // Draw Segments & Appended Lateral Openings
    hallwayData.baseDistances.forEach((baseZ, index) => {
        const z = baseZ - offset;
        if (z <= 0) return;

        const scale = 1 / z;
        const segX1 = cx - (cx * scale);
        const segX2 = cx + ((w - cx) * scale);
        const segY1 = cy - (cy * scale);
        const segY2 = cy + ((h - cy) * scale);

        ctx.beginPath();
        ctx.moveTo(segX1, segY1); ctx.lineTo(segX1, segY2);
        ctx.moveTo(segX2, segY1); ctx.lineTo(segX2, segY2);
        ctx.lineTo(segX1, segY2);
        ctx.moveTo(segX1, segY1); ctx.lineTo(segX2, segY1);
        ctx.stroke();

        if (index < hallwayData.baseDistances.length - 1) {
            const nextZ = hallwayData.baseDistances[index + 1] - offset;
            if (nextZ <= 0) return;

            const nextScale = 1 / nextZ;
            const nextSegX1 = cx - (cx * nextScale);
            const nextSegX2 = cx + ((w - cx) * nextScale);
            const nextSegY1 = cy - (cy * nextScale);
            const nextSegY2 = cy + ((h - cy) * nextScale);

            const doorDataIdx = isLookingBackward ? (hallwayData.baseDistances.length - 2 - index) : index;
            const doorOpenValue = hallwayData.doorOpenStatus[doorDataIdx];

            const t = 0.4 * (1 - doorOpenValue);
            const leftDoorWidthX = segX1 + (nextSegX1 - segX1) * t;
            const rightDoorWidthX = segX2 + (nextSegX2 - segX2) * t;

            const wallHeight = segY2 - segY1;
            const doorTopY1 = segY2 - (wallHeight * 0.75);
            const doorTopY2 = nextSegY2 - ((nextSegY2 - nextSegY1) * 0.75);
            const doorBottomY2 = segY2 + (nextSegY2 - segY2) * t;

            if (segX1 < nextSegX1) {
                ctx.fillStyle = leftDoorColor;
                ctx.beginPath();
                ctx.moveTo(segX1, segY2); ctx.lineTo(segX1, doorTopY1);
                ctx.lineTo(leftDoorWidthX, doorTopY2); ctx.lineTo(leftDoorWidthX, doorBottomY2);
                ctx.closePath(); ctx.fill(); ctx.stroke();

                ctx.fillStyle = rightDoorColor;
                ctx.beginPath();
                ctx.moveTo(segX2, segY2); ctx.lineTo(segX2, doorTopY1);
                ctx.lineTo(rightDoorWidthX, doorTopY2); ctx.lineTo(rightDoorWidthX, doorBottomY2);
                ctx.closePath(); ctx.fill(); ctx.stroke();
            }
        }
    });
}

function drawMainHallwaySideView(ctx, canvas, WorldGrid, hallwayData, offset, lookDirection) {
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(0, 0, w, h);

    const floorLineY = h * 0.85;
    const ceilingLineY = h * 0.15;

    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, floorLineY); ctx.lineTo(w, floorLineY);
    ctx.moveTo(0, ceilingLineY); ctx.lineTo(w, ceilingLineY);
    ctx.stroke();

    ctx.fillStyle = '#888888';
    ctx.fillRect(0, floorLineY, w, h - floorLineY);

    const roundedOffset = Math.round(offset * 100) / 100;
    const doorNodes = [0.0, 0.75, 1.95, 3.95, 5.75];
    const nodeIndex = doorNodes.findIndex(v => Math.abs(v - roundedOffset) < 0.05);

    if (nodeIndex !== -1) {
        ctx.fillStyle = (lookDirection === 3) ? hallwayData.leftSideDoorColor : hallwayData.rightSideDoorColor;

        const currentOpenProgress = hallwayData.doorOpenStatus[nodeIndex];
        const frameW = w * 0.4;
        const doorH = floorLineY - ceilingLineY;
        const frameX = (w - frameW) / 2;
        const doorY = ceilingLineY;

        const currentHallwayIdx = WorldGrid.mainHallways.findIndex(h => h.id === hallwayData.id);
        const isWorldBoundaryVoid = (lookDirection === 3 && currentHallwayIdx === 0) || (lookDirection === 1 && currentHallwayIdx === 6);

        const connectionExists = WorldGrid.interconnectingHallways.some(conn =>
            conn.fromHallwayIndex === currentHallwayIdx &&
            conn.doorIndex === nodeIndex &&
            conn.direction === lookDirection
        );

        ctx.fillStyle = '#000000';
        ctx.fillRect(frameX, doorY, frameW, doorH);

        if (currentOpenProgress > 0) {
            if (isWorldBoundaryVoid) {
                ctx.strokeStyle = '#ff0000';
                ctx.lineWidth = 8;
                ctx.beginPath();
                ctx.moveTo(frameX + 20, doorY + 20); ctx.lineTo(frameX + frameW - 20, doorY + doorH - 20);
                ctx.moveTo(frameX + frameW - 20, doorY + 20); ctx.lineTo(frameX + 20, doorY + doorH - 20);
                ctx.stroke();
            } else if (connectionExists) {
                ctx.fillStyle = '#222222';
                ctx.fillRect(frameX, doorY, frameW, doorH);

                ctx.strokeStyle = '#555555';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(frameX, doorY); ctx.lineTo(frameX + frameW * 0.25, doorY + doorH * 0.25);
                ctx.moveTo(frameX + frameW, doorY); ctx.lineTo(frameX + frameW * 0.75, doorY + doorH * 0.25);
                ctx.moveTo(frameX, doorY + doorH); ctx.lineTo(frameX + frameW * 0.25, doorY + doorH * 0.75);
                ctx.moveTo(frameX + frameW, doorY + doorH); ctx.lineTo(frameX + frameW * 0.75, doorY + doorH * 0.75);
                ctx.stroke();

                ctx.fillStyle = '#111111';
                ctx.fillRect(frameX + frameW * 0.25, doorY + doorH * 0.25, frameW * 0.5, doorH * 0.5);
                ctx.strokeRect(frameX + frameW * 0.25, doorY + doorH * 0.25, frameW * 0.5, doorH * 0.5);
            } else {
                ctx.fillStyle = '#000000';
                ctx.fillRect(frameX, doorY, frameW, doorH);
            }
        }

        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 4;
        ctx.strokeRect(frameX, doorY, frameW, doorH);

        ctx.fillStyle = (lookDirection === 3) ? hallwayData.leftSideDoorColor : hallwayData.rightSideDoorColor;
        const doorW = frameW * (1 - currentOpenProgress);
        const doorX = frameX;

        if (doorW > 0) {
            ctx.fillRect(doorX, doorY, doorW, doorH);
            ctx.strokeRect(doorX, doorY, doorW, doorH);
        }
    }
}

// =========================================================================
// SECTION 2: INTERCONNECTING TUNNEL RENDERING COMPONENT
// =========================================================================
function drawInterconnectingPerspective(ctx, canvas, currentUser) {
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    const totalTubeLength = 4.0;

    // 1. Recover the native tunnel link to know which direction is "forward" (towards 4.0)
    const doorNodes = [0, 2, 4, 6, 8];
    const doorDataIdx = doorNodes.indexOf(currentUser.nodeIndex);

    let distanceToFarWall = totalTubeLength - currentUser.interconnectingProgress;
    const lookDirection = currentUser.direction;
    if (lookDirection === 3) {
        distanceToFarWall = currentUser.interconnectingProgress;
    } else {
        distanceToFarWall = totalTubeLength - currentUser.interconnectingProgress;
    }

    // --- MINIMAL ADJUSTMENT FOR AIRTIGHT PROJECTION STOP ---
    const maxWalkableProgress = 3.6; // Core engine stop boundary

    let normalizedProgress = currentUser.interconnectingProgress / maxWalkableProgress;
    if (normalizedProgress > 1) normalizedProgress = 1;
    if (normalizedProgress < 0) normalizedProgress = 0;

    if (lookDirection === 3) {
        normalizedProgress = 1 - normalizedProgress;
    }

    const wallProximityLimit = 0.05; // Visual distance when standing nose-to-door
    const visualDistance = totalTubeLength - (normalizedProgress * (totalTubeLength - wallProximityLimit));
    const scale = 1 / visualDistance;
    // --------------------------------------------------------

    const x1 = cx - (cx * scale);
    const x2 = cx + ((w - cx) * scale);
    const y1 = cy - (cy * scale);
    const y2 = cy + ((h - cy) * scale);

    // Dark industrial floor aesthetic for connection tubes
    ctx.fillStyle = '#444444';
    ctx.beginPath();
    ctx.moveTo(0, h); ctx.lineTo(x1, y2); ctx.lineTo(x2, y2); ctx.lineTo(w, h);
    ctx.closePath(); ctx.fill();

    // Left and Right tube wall segments
    ctx.fillStyle = '#b0b0b0';
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(x1, y1); ctx.lineTo(x1, y2); ctx.lineTo(0, h);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w, 0); ctx.lineTo(x2, y1); ctx.lineTo(x2, y2); ctx.lineTo(w, h);
    ctx.closePath(); ctx.fill();

    // Guidelines
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(x1, y1);
    ctx.moveTo(w, 0); ctx.lineTo(x2, y1);
    ctx.moveTo(0, h); ctx.lineTo(x1, y2);
    ctx.moveTo(w, h); ctx.lineTo(x2, y2);
    ctx.stroke();

    // Far End Wall Background Panel Plate
    ctx.fillStyle = '#111111';
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

    // --- FIXED SLIDING DOOR ATTACHMENT ---
    const wallW = x2 - x1;
    const wallH = y2 - y1;

    // Scale the door size relative to the back wall
    const doorW = wallW * 0.45;
    const doorH = wallH * 0.75;

    // Center it horizontally, align it to the bottom of the wall
    const doorX = x1 + (wallW - doorW) / 2;
    const doorY = y2 - doorH;

    // Draw the structural dark door cavity doorway background
    ctx.fillStyle = '#000000';
    ctx.fillRect(doorX, doorY, doorW, doorH);

    // Read the active tunnel link state cleanly from our interface adapter layer!
    const activeLink = window.MazeInterface.findActiveTunnel();

    // Determine context end context to read from ('exit' if looking forward at length 4, else 'entrance')
    const positionContext = (currentUser.interconnectingProgress >= 1.6) ? 'exit' : 'entrance';
    const openStatus = activeLink ? window.MazeInterface.getOpenStatus(activeLink, positionContext) : 0.0;

    // Slide the physical door canvas graphics panel rightward inside the frame cavity
    const currentSlidWidth = doorW * (1 - openStatus);

    if (currentSlidWidth > 0) {
        // Safe industrial door plate aesthetic color (Distinct from void spaces)
        ctx.fillStyle = '#777777';
        ctx.fillRect(doorX, doorY, currentSlidWidth, doorH);

        // Draw door face panel segmentation lines so player can see it sliding
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = Math.max(1, scale * 1.5);
        ctx.strokeRect(doorX, doorY, currentSlidWidth, doorH);
    }

    // Outer door frame trimming border overlay line
    ctx.strokeStyle = '#555555';
    ctx.lineWidth = Math.max(1, scale * 2);
    ctx.strokeRect(doorX, doorY, doorW, doorH);
}

/*
function drawInterconnectingPerspective(ctx, canvas, currentUser) {
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    const totalTubeLength = 4.0;

    // 1. Recover the native tunnel link to know which direction is "forward" (towards 4.0)
    // We can infer the parent hallway indices based on the active tracking states
    const doorNodes = [0, 2, 4, 6, 8];
    const doorDataIdx = doorNodes.indexOf(currentUser.nodeIndex);

    // Use an inline safety check to find if we are facing the natural destination or the origin
    // (If user.direction matches the link direction, the target wall is at totalTubeLength. If flipped, it's at 0)
    let distanceToFarWall = totalTubeLength - currentUser.interconnectingProgress;

    const lookDirection = currentUser.direction;
    if (lookDirection === 3) {
        distanceToFarWall = currentUser.interconnectingProgress;
    } else {
        distanceToFarWall = totalTubeLength - currentUser.interconnectingProgress;
    }

    // --- MINIMAL ADJUSTMENT FOR AIRTIGHT PROJECTION STOP ---
    // Instead of artificial visual subtraction which squishes the physical lines,
    // we scale the visual projection distance perfectly to hit near-zero (0.05)
    // at the moment your physical engine hits its movement boundary threshold.
    const maxWalkableProgress = 3.6; // Core engine stop boundary (e.g., 4.0 total length minus 0.4 gap)

    let normalizedProgress = currentUser.interconnectingProgress / maxWalkableProgress;
    if (normalizedProgress > 1) normalizedProgress = 1;
    if (normalizedProgress < 0) normalizedProgress = 0;

    if (lookDirection === 3) {
        normalizedProgress = 1 - normalizedProgress;
    }

    const wallProximityLimit = 0.05; // Visual distance when standing nose-to-door
    const visualDistance = totalTubeLength - (normalizedProgress * (totalTubeLength - wallProximityLimit));
    const scale = 1 / visualDistance;
    // --------------------------------------------------------

    const x1 = cx - (cx * scale);
    const x2 = cx + ((w - cx) * scale);
    const y1 = cy - (cy * scale);
    const y2 = cy + ((h - cy) * scale);

    // Dark industrial floor aesthetic for connection tubes
    ctx.fillStyle = '#444444';
    ctx.beginPath();
    ctx.moveTo(0, h); ctx.lineTo(x1, y2); ctx.lineTo(x2, y2); ctx.lineTo(w, h);
    ctx.closePath(); ctx.fill();

    // Left and Right tube wall segments
    ctx.fillStyle = '#b0b0b0';
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(x1, y1); ctx.lineTo(x1, y2); ctx.lineTo(0, h);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w, 0); ctx.lineTo(x2, y1); ctx.lineTo(x2, y2); ctx.lineTo(w, h);
    ctx.closePath(); ctx.fill();

    // Guidelines
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(x1, y1);
    ctx.moveTo(w, 0); ctx.lineTo(x2, y1);
    ctx.moveTo(0, h); ctx.lineTo(x1, y2);
    ctx.moveTo(w, h); ctx.lineTo(x2, y2);
    ctx.stroke();

    // Far End Wall Background Panel Plate
    ctx.fillStyle = '#111111';
    ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

    // --- ADDED DETACHED END DOOR ---
    const wallW = x2 - x1;
    const wallH = y2 - y1;

    // Scale the door size relative to the back wall
    const doorW = wallW * 0.45;
    const doorH = wallH * 0.75;

    // Center it horizontally, align it to the bottom of the wall
    const doorX = x1 + (wallW - doorW) / 2;
    const doorY = y2 - doorH;

    // Draw the door frame cavity
    ctx.fillStyle = '#000000';
    ctx.fillRect(doorX, doorY, doorW, doorH);
    ctx.strokeStyle = '#555555';
    ctx.lineWidth = Math.max(1, scale * 2);
    ctx.strokeRect(doorX, doorY, doorW, doorH);
}
*/

/**
 * Visual slice of a flat side wall within an interconnecting tube
 */
function drawInterconnectingSideView(ctx, canvas) {
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#b0b0b0';
    ctx.fillRect(0, 0, w, h);

    const floorLineY = h * 0.85;
    const ceilingLineY = h * 0.15;

    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, floorLineY); ctx.lineTo(w, floorLineY);
    ctx.moveTo(0, ceilingLineY); ctx.lineTo(w, ceilingLineY);
    ctx.stroke();

    ctx.fillStyle = '#444444';
    ctx.fillRect(0, floorLineY, w, h - floorLineY);
}

// =========================================================================
// SECTION 3: TRANSITION RENDERING COMPONENT
// =========================================================================

function drawTransitionView(ctx, canvas, currentUser) {
    const w = canvas.width;
    const h = canvas.height;

    // 1. Foreground Frame: Calculated exactly as before (continues to expand/zoom)
    let targetDistance = 0.4 - currentUser.transitionProgress;
    if (targetDistance < 0.01) targetDistance = 0.01;
    const zoomFactor = 0.4 / targetDistance;

    const frameW = w * 0.4 * zoomFactor;
    const frameH = (h * 0.85 - h * 0.15) * zoomFactor;
    const frameX = (w - frameW) / 2;
    const frameY = (h * 0.15) - ((h * 0.15) * (zoomFactor - 1));

    // Draw background layers outside the door frame cavity
    ctx.fillStyle = '#aaaaaa';
    ctx.fillRect(0, 0, w, frameY);

    ctx.fillStyle = '#888888';
    ctx.fillRect(0, frameY + frameH, w, h - (frameY + frameH));

    ctx.fillStyle = '#cccccc';
    ctx.fillRect(0, frameY, w, frameH);

    // 2. Parallax Background Tunnel: Computed using a FIXED baseline zoom layout (does not scale)
    const baseZoom = 1.0;
    const backWallW = w * 0.4 * baseZoom * 0.5; // Centers the back wall panel to a smaller scale
    const backWallH = (h * 0.85 - h * 0.15) * baseZoom * 0.5;
    const backWallX = (w - backWallW) / 2;
    const backWallY = (h * 0.5) - (backWallH / 2); // Perfectly centered perspective anchor

    ctx.save();
    ctx.beginPath();
    ctx.rect(frameX, frameY, frameW, frameH);
    ctx.clip(); // Ensure inner lines don't bleed outside the growing threshold frame

    // Draw stationary dark environment cavity
    ctx.fillStyle = '#222222';
    ctx.fillRect(frameX, frameY, frameW, frameH);

    // 3. Stretched Connecting Perspective Lines
    // Links corners from the static background wall directly to the zooming foreground frame
    ctx.strokeStyle = '#555555';
    ctx.lineWidth = 2; // Unscaled, constant line thickness
    ctx.beginPath();
    // Top-Left corner guide line
    ctx.moveTo(frameX, frameY); ctx.lineTo(backWallX, backWallY);
    // Top-Right corner guide line
    ctx.moveTo(frameX + frameW, frameY); ctx.lineTo(backWallX + backWallW, backWallY);
    // Bottom-Left corner guide line
    ctx.moveTo(frameX, frameY + frameH); ctx.lineTo(backWallX, backWallY + backWallH);
    // Bottom-Right corner guide line
    ctx.moveTo(frameX + frameW, frameY + frameH); ctx.lineTo(backWallX + backWallW, backWallY + backWallH);
    ctx.stroke();

    // 4. Fixed Back Termination Wall Patch
    ctx.fillStyle = '#111111';
    ctx.fillRect(backWallX, backWallY, backWallW, backWallH);
    ctx.strokeRect(backWallX, backWallY, backWallW, backWallH);

    ctx.restore();

    // Foreground door threshold outline (grows thicker along with the opening)
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = Math.max(4, 4 * zoomFactor);
    ctx.strokeRect(frameX, frameY, frameW, frameH);
}

// =========================================================================
// SECTION 4: ROUTING STATE CONTROLLERS
// =========================================================================

function drawNormalView(ctx, canvas, WorldGrid, currentHallway, currentUser) {
    const view = getLocalViewOrientation('normal', currentUser.direction);

    if (view === 'forward') {
        drawMainHallwayPerspective(ctx, canvas, currentHallway, currentUser.forwardOffset, false);
    } else if (view === 'backward') {
        const inverseOffset = (currentHallway.baseDistances[currentHallway.baseDistances.length - 2] - 0.5) - currentUser.forwardOffset;
        drawMainHallwayPerspective(ctx, canvas, currentHallway, inverseOffset, true);
    } else {
        drawMainHallwaySideView(ctx, canvas, WorldGrid, currentHallway, currentUser.forwardOffset, currentUser.direction);
    }
}

function drawInterconnectingView(ctx, canvas, currentUser) {
    const view = getLocalViewOrientation('interconnecting', currentUser.direction);

    if (view === 'forward') {
        // Looking straight down the long lane layout of the connection tube
        drawInterconnectingPerspective(ctx, canvas, currentUser);
    } else {
        // Looking flatly at the bounding side walls of the connection tube
        drawInterconnectingSideView(ctx, canvas);
    }
}

function drawPlayerView(ctx, canvas, WorldGrid, currentHallway, currentUser) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!currentHallway) return;

    if (currentUser.movementMode === 'interconnecting') {
        drawInterconnectingView(ctx, canvas, currentUser);
    } else if (currentUser.movementMode === 'transition') {
        drawTransitionView(ctx, canvas, currentUser);
    } else if (currentUser.movementMode === 'normal') {
        drawNormalView(ctx, canvas, WorldGrid, currentHallway, currentUser);
    }
}
