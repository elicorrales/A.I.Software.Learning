/**
 * hallway-perspective-renderer.js
 * Stateless rendering engine for the 3D first-person perspective projection views.
 */

// =========================================================================
// SECTION 1: MAIN HALLWAY RENDERING COMPONENT
// =========================================================================

function drawMainHallwayLeftAndRightWalls(ctx, x1, y1, x2, y2, w, h) {
    // Left wall — fades darker toward vanishing point
    const leftGrad = ctx.createLinearGradient(0, 0, x1, 0);
    leftGrad.addColorStop(0, '#e8e8e8');
    leftGrad.addColorStop(1, '#b0b0b0');
    ctx.fillStyle = leftGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(x1, y1); ctx.lineTo(x1, y2); ctx.lineTo(0, h);
    ctx.closePath(); ctx.fill();

    // Right wall — mirror gradient
    const rightGrad = ctx.createLinearGradient(w, 0, x2, 0);
    rightGrad.addColorStop(0, '#e8e8e8');
    rightGrad.addColorStop(1, '#b0b0b0');
    ctx.fillStyle = rightGrad;
    ctx.beginPath();
    ctx.moveTo(w, 0); ctx.lineTo(x2, y1); ctx.lineTo(x2, y2); ctx.lineTo(w, h);
    ctx.closePath(); ctx.fill();

    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(x1, y1);
    ctx.moveTo(w, 0); ctx.lineTo(x2, y1);
    ctx.moveTo(0, h); ctx.lineTo(x1, y2);
    ctx.moveTo(w, h); ctx.lineTo(x2, y2);
    ctx.stroke();
}

function drawRecedingPerspectiveDoorPair(ctx, segX1, segY1, segX2, segY2, nextSegX1, nextSegY1, nextSegX2, nextSegY2, doorOpenValue, leftDoorColor, rightDoorColor) {
    const t = 0.4 * (1 - doorOpenValue);
    const leftDoorWidthX = segX1 + (nextSegX1 - segX1) * t;
    const rightDoorWidthX = segX2 + (nextSegX2 - segX2) * t;

    const wallHeight = segY2 - segY1;
    const doorTopY1 = segY2 - (wallHeight * 0.75);
    const doorTopY2 = nextSegY2 - ((nextSegY2 - nextSegY1) * 0.75);
    const doorBottomY2 = segY2 + (nextSegY2 - segY2) * t;

    if (segX1 < nextSegX1) {
        // Left door: fill → shade overlay clipped to panel → finish stroke
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(segX1, segY2); ctx.lineTo(segX1, doorTopY1);
        ctx.lineTo(leftDoorWidthX, doorTopY2); ctx.lineTo(leftDoorWidthX, doorBottomY2);
        ctx.closePath();
        ctx.fillStyle = leftDoorColor;
        ctx.fill();
        ctx.clip();
        const leftShade = ctx.createLinearGradient(0, doorTopY1, 0, segY2);
        leftShade.addColorStop(0, 'rgba(255, 255, 255, 0.30)');
        leftShade.addColorStop(0.35, 'rgba(255, 255, 255, 0)');
        leftShade.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
        ctx.fillStyle = leftShade;
        ctx.fillRect(Math.min(segX1, leftDoorWidthX), doorTopY1, Math.abs(leftDoorWidthX - segX1) + 1, segY2 - doorTopY1 + 1);
        ctx.restore();
        ctx.beginPath();
        ctx.moveTo(segX1, segY2); ctx.lineTo(segX1, doorTopY1);
        ctx.lineTo(leftDoorWidthX, doorTopY2); ctx.lineTo(leftDoorWidthX, doorBottomY2);
        ctx.closePath(); ctx.stroke();

        // Right door: fill → shade overlay clipped to panel → finish stroke
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(segX2, segY2); ctx.lineTo(segX2, doorTopY1);
        ctx.lineTo(rightDoorWidthX, doorTopY2); ctx.lineTo(rightDoorWidthX, doorBottomY2);
        ctx.closePath();
        ctx.fillStyle = rightDoorColor;
        ctx.fill();
        ctx.clip();
        const rightShade = ctx.createLinearGradient(0, doorTopY1, 0, segY2);
        rightShade.addColorStop(0, 'rgba(255, 255, 255, 0.30)');
        rightShade.addColorStop(0.35, 'rgba(255, 255, 255, 0)');
        rightShade.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
        ctx.fillStyle = rightShade;
        ctx.fillRect(Math.min(segX2, rightDoorWidthX), doorTopY1, Math.abs(rightDoorWidthX - segX2) + 1, segY2 - doorTopY1 + 1);
        ctx.restore();
        ctx.beginPath();
        ctx.moveTo(segX2, segY2); ctx.lineTo(segX2, doorTopY1);
        ctx.lineTo(rightDoorWidthX, doorTopY2); ctx.lineTo(rightDoorWidthX, doorBottomY2);
        ctx.closePath(); ctx.stroke();
    }
}

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

    // Draw Floor with depth gradient — lighter near player, darker at far end
    const floorGrad = ctx.createLinearGradient(0, h, 0, y2);
    floorGrad.addColorStop(0, '#aaaaaa');
    floorGrad.addColorStop(1, '#555555');
    ctx.fillStyle = floorGrad;
    ctx.beginPath();
    ctx.moveTo(0, h); ctx.lineTo(x1, y2); ctx.lineTo(x2, y2); ctx.lineTo(w, h);
    ctx.closePath(); ctx.fill();

    // Draw Ceiling with depth gradient
    const ceilGrad = ctx.createLinearGradient(0, 0, 0, y1);
    ceilGrad.addColorStop(0, '#d0d0d0');
    ceilGrad.addColorStop(1, '#b8b8b8');
    ctx.fillStyle = ceilGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y1); ctx.lineTo(w, 0);
    ctx.closePath(); ctx.fill();

    drawMainHallwayLeftAndRightWalls(ctx, x1, y1, x2, y2, w, h);

    // Fluorescent ceiling light fixture
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(x1, y1); ctx.lineTo(x2, y1); ctx.lineTo(w, 0);
    ctx.closePath();
    ctx.clip();
    // Soft bloom glow radiating from center of ceiling
    const bloomGrad = ctx.createLinearGradient(cx - w * 0.38, 0, cx + w * 0.38, 0);
    bloomGrad.addColorStop(0,    'rgba(255, 255, 235, 0)');
    bloomGrad.addColorStop(0.38, 'rgba(255, 255, 235, 0)');
    bloomGrad.addColorStop(0.5,  'rgba(255, 255, 235, 0.38)');
    bloomGrad.addColorStop(0.62, 'rgba(255, 255, 235, 0)');
    bloomGrad.addColorStop(1,    'rgba(255, 255, 235, 0)');
    ctx.fillStyle = bloomGrad;
    ctx.fillRect(0, 0, w, y1 + 1);
    // Perspective-correct fixture strip (same proportional width near and far)
    const fRatio = 0.065;
    ctx.fillStyle = '#fffff0';
    ctx.beginPath();
    ctx.moveTo(cx - fRatio * w,           0);
    ctx.lineTo(cx + fRatio * w,           0);
    ctx.lineTo(cx + fRatio * (x2 - x1),   y1);
    ctx.lineTo(cx - fRatio * (x2 - x1),   y1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Draw Back Termination Wall Patch
    if (backWallZ > 0) {
        ctx.fillStyle = wallColor;
        ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
        // Radial shading: lighter center, darker edges
        const wallShade = ctx.createRadialGradient(cx, cy, 0, cx, cy, (x2 - x1) * 0.7);
        wallShade.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
        wallShade.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
        ctx.fillStyle = wallShade;
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

        // Floor and ceiling horizon lines only — no full-height verticals
        ctx.beginPath();
        ctx.moveTo(segX1, segY2); ctx.lineTo(segX2, segY2);
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

            // Short jamb lines: floor to door-top only (no line floating above the door)
            const doorTopAtSeg = segY2 - (segY2 - segY1) * 0.75;
            ctx.beginPath();
            ctx.moveTo(segX1, segY2); ctx.lineTo(segX1, doorTopAtSeg);
            ctx.moveTo(segX2, segY2); ctx.lineTo(segX2, doorTopAtSeg);
            ctx.stroke();

            drawRecedingPerspectiveDoorPair(ctx, segX1, segY1, segX2, segY2, nextSegX1, nextSegY1, nextSegX2, nextSegY2, doorOpenValue, leftDoorColor, rightDoorColor);
        }
    });

    if (!isLookingBackward) {
        drawRollingBallInPerspective(ctx, canvas, offset);
    }
}

function drawSideViewOpenDoorWayStatus(ctx, isWorldBoundaryVoid, connectionExists, frameX, doorY, frameW, doorH) {
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

function drawMainHallwaySideView(ctx, canvas, hallwayData, offset) {
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
        const view = window.MazeInterface.getRelativeViewOrientation();
        ctx.fillStyle = (view === 'left') ? hallwayData.leftSideDoorColor : hallwayData.rightSideDoorColor;

        const currentOpenProgress = hallwayData.doorOpenStatus[nodeIndex];
        const frameW = w * 0.4;
        const doorH = floorLineY - ceilingLineY;
        const frameX = (w - frameW) / 2;
        const doorY = ceilingLineY;

        // Abstracted architecture validation checks via facade
        const isWorldBoundaryVoid = window.MazeInterface.isSideViewFacingVoid();
        const connectionExists = window.MazeInterface.isSideViewFacingTunnel(nodeIndex);

        ctx.fillStyle = '#000000';
        ctx.fillRect(frameX, doorY, frameW, doorH);

        if (currentOpenProgress > 0) {
            drawSideViewOpenDoorWayStatus(ctx, isWorldBoundaryVoid, connectionExists, frameX, doorY, frameW, doorH);
        }

        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 4;
        ctx.strokeRect(frameX, doorY, frameW, doorH);

        ctx.fillStyle = (view === 'left') ? hallwayData.leftSideDoorColor : hallwayData.rightSideDoorColor;
        const doorW = frameW * (1 - currentOpenProgress);
        const doorX = frameX;

        if (doorW > 0) {
            ctx.fillRect(doorX, doorY, doorW, doorH);
            ctx.strokeRect(doorX, doorY, doorW, doorH);
        }
    }
}

function drawRollingBallInPerspective(ctx, canvas, offset) {
    const ball = window.MazeInterface.getRollingBall();
    if (!ball) return;
    const activeHallway = window.MazeInterface.getTrueActiveHallway();
    if (!activeHallway || ball.hallwayId !== activeHallway.id) return;
    const ballZ = ball.offset - offset;
    if (ballZ <= 0.2) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    const scale = 1 / ballZ;
    const floorY = cy + (h - cy) * scale;
    const ceilY  = cy - cy * scale;
    const screenRadius = Math.max(4, (floorY - ceilY) * 0.45);
    const ballX = cx;
    const ballY = floorY - screenRadius;

    // Ground shadow ellipse
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(ballX, floorY, screenRadius * 0.85, screenRadius * 0.14, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.45, 0.6 / ballZ)})`;
    ctx.fill();
    ctx.restore();

    // Clip interior to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(ballX, ballY, screenRadius, 0, Math.PI * 2);
    ctx.clip();

    // Sphere radial gradient: bright upper-left highlight, dark lower-right rim
    const glX = ballX - screenRadius * 0.28;
    const glY = ballY - screenRadius * 0.32;
    const sphereGrad = ctx.createRadialGradient(glX, glY, screenRadius * 0.05, ballX, ballY, screenRadius);
    sphereGrad.addColorStop(0.0,  '#ffffff');
    sphereGrad.addColorStop(0.28, '#e0e0e0');
    sphereGrad.addColorStop(0.6,  '#808080');
    sphereGrad.addColorStop(1.0,  '#181818');
    ctx.fillStyle = sphereGrad;
    ctx.fillRect(ballX - screenRadius, ballY - screenRadius, screenRadius * 2, screenRadius * 2);

    // Horizontal rolling stripes scrolling upward as ball approaches
    const stripeSpacing = (screenRadius * 2) / 7;
    const scrollAmt = ((ball.rotation % stripeSpacing) + stripeSpacing) % stripeSpacing;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.lineWidth = Math.max(1, stripeSpacing * 0.38);
    for (let sy = ballY - screenRadius - stripeSpacing + scrollAmt; sy <= ballY + screenRadius + stripeSpacing; sy += stripeSpacing) {
        ctx.beginPath();
        ctx.moveTo(ballX - screenRadius, sy);
        ctx.lineTo(ballX + screenRadius, sy);
        ctx.stroke();
    }

    ctx.restore();

    // Outline ring
    ctx.beginPath();
    ctx.arc(ballX, ballY, screenRadius, 0, Math.PI * 2);
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = Math.max(1, screenRadius * 0.035);
    ctx.stroke();
}

// =========================================================================
// SECTION 2: INTERCONNECTING TUNNEL RENDERING COMPONENT
// =========================================================================

function drawFakeCrossHallwayCavityFacade(ctx, doorX, doorY, doorW, doorH, scale) {
    // 1. Fake Hall Wall Background Color (Light gray hallway wall)
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(doorX, doorY, doorW, doorH);

    // 2. Fake Horizontal Floor and Ceiling guidelines running sideways
    const fakeFloorY = doorY + (doorH * 0.85);
    const fakeCeilingY = doorY + (doorH * 0.15);

    ctx.strokeStyle = '#333333';
    ctx.lineWidth = Math.max(1, scale * 0.75);
    ctx.beginPath();
    ctx.moveTo(doorX, fakeFloorY); ctx.lineTo(doorX + doorW, fakeFloorY);
    ctx.moveTo(doorX, fakeCeilingY); ctx.lineTo(doorX + doorW, fakeCeilingY);
    ctx.stroke();

    // Dark grey floor surface fill
    ctx.fillStyle = '#888888';
    ctx.fillRect(doorX, fakeFloorY, doorW, doorY + doorH - fakeFloorY);

    // 3. Fake Closed Door on the opposite wall (Centered inside the frame context)
    const fakeDoorW = doorW * 0.4;
    const fakeDoorH = fakeFloorY - fakeCeilingY;
    const fakeDoorX = doorX + (doorW - fakeDoorW) / 2;
    const fakeDoorY = fakeCeilingY;

    // Dark background door slit
    ctx.fillStyle = '#000000';
    ctx.fillRect(fakeDoorX, fakeDoorY, fakeDoorW, fakeDoorH);

    // Solid contrasting color for the opposite closed panel
    ctx.fillStyle = '#999999'; 
    ctx.fillRect(fakeDoorX, fakeDoorY, fakeDoorW, fakeDoorH);
    ctx.strokeRect(fakeDoorX, fakeDoorY, fakeDoorW, fakeDoorH);
}

function drawInterconnectingPerspective(ctx, canvas, currentUser) {
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    const totalTubeLength = 4.0;

    // Ask the facade if we are looking backward down the tunnel link tube
    const view = window.MazeInterface.getRelativeViewOrientation();
    const isLookingBackward = (view === 'backward');

    // --- MINIMAL ADJUSTMENT FOR AIRTIGHT PROJECTION STOP ---
    const maxWalkableProgress = 3.6; // Core engine stop boundary

    let normalizedProgress = currentUser.interconnectingProgress / maxWalkableProgress;
    if (normalizedProgress > 1) normalizedProgress = 1;
    if (normalizedProgress < 0) normalizedProgress = 0;

    if (isLookingBackward) {
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

    // Read the active tunnel link state cleanly from our interface adapter layer!
    const activeLink = window.MazeInterface.findActiveTunnel();
    const doorFrameContext = isLookingBackward ? 'entrance' : 'exit';
    
    // Pass the absolute structure and the unified semantic text label straight to the facade
    const openStatus = activeLink ? window.MazeInterface.getOpenStatus(activeLink, doorFrameContext) : 0.0;
    
    // Draw the structural doorway background (Fake Perpendicular Main Hallway)
    ctx.save();
    ctx.beginPath();
    ctx.rect(doorX, doorY, doorW, doorH);
    ctx.clip(); // Ensure fake hall lines do not bleed outside the door frame cavity

    // Query facade layout environment without processing numerical arrays local context
    if (activeLink && window.MazeInterface.doesAnyStructureExistAtTunnelTerminal(activeLink, view)) {
        drawFakeCrossHallwayCavityFacade(ctx, doorX, doorY, doorW, doorH, scale);
    } else {
        // Just fill the canvas door cavity with the far wall background color if no hallway exists
        ctx.fillStyle = '#111111';
        ctx.fillRect(doorX, doorY, doorW, doorH);

        // Draw universe boundary red X when tunnel terminal faces the edge of the known world
        if (activeLink && window.MazeInterface.isTunnelTerminalVoid(activeLink, view)) {
            const inset = doorW * 0.12;
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = Math.max(2, scale * 8);
            ctx.beginPath();
            ctx.moveTo(doorX + inset, doorY + inset);
            ctx.lineTo(doorX + doorW - inset, doorY + doorH - inset);
            ctx.moveTo(doorX + doorW - inset, doorY + inset);
            ctx.lineTo(doorX + inset, doorY + doorH - inset);
            ctx.stroke();
        }

        // --- RENDER DYNAMIC SMOKE PARTICLES IF DOOR OPEN ---
        if (openStatus > 0 && window.MazeInterface.getSmokeParticles()) {
            window.MazeInterface.getSmokeParticles().forEach(p => {
                // Map normalized 0-1 properties back to absolute pixel values
                const px = doorX + (p.x * doorW);
                const py = doorY + (p.y * doorH);
                
                let gradient = ctx.createRadialGradient(px, py, 0, px, py, p.radius * scale);
                gradient.addColorStop(0, `rgba(140, 140, 140, ${p.opacity * openStatus})`); // Center dense gray
                gradient.addColorStop(1, 'rgba(17, 17, 17, 0)'); // Edge transparent fade

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(px, py, p.radius * scale, 0, Math.PI * 2);
                ctx.fill();
            });
        }
    }

    ctx.restore();

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
    // Call the facade directly to get 'forward' | 'backward' | 'left' | 'right'
    const view = window.MazeInterface.getRelativeViewOrientation();

    if (view === 'forward') {
        drawMainHallwayPerspective(ctx, canvas, currentHallway, currentUser.forwardOffset, false);
    } else if (view === 'backward') {
        const inverseOffset = (currentHallway.baseDistances[currentHallway.baseDistances.length - 2] - 0.5) - currentUser.forwardOffset;
        drawMainHallwayPerspective(ctx, canvas, currentHallway, inverseOffset, true);
    } else {
        // Clean stateless call: WorldGrid and direction metrics are no longer leaked downstream
        drawMainHallwaySideView(ctx, canvas, currentHallway, currentUser.forwardOffset);
    }
}

function drawInterconnectingView(ctx, canvas, currentUser) {
    // Call the facade directly to get 'forward' | 'backward' | 'left' | 'right'
    const view = window.MazeInterface.getRelativeViewOrientation();

    if (view === 'forward' || view === 'backward') {
        // Looking straight down the tube infrastructure vector
        drawInterconnectingPerspective(ctx, canvas, currentUser);
    } else {
        // Looking flatly at the structural side walls of the tube link
        drawInterconnectingSideView(ctx, canvas);
    }

    // Chain-hop flash: alpha-blend the transition view briefly when crossing segment boundaries
    if (currentUser.chainHopOriginProgress > 0) {
        ctx.save();
        ctx.globalAlpha = currentUser.chainHopOriginProgress / 18;
        drawTransitionView(ctx, canvas, { transitionProgress: 0.20 });
        ctx.restore();
    }
}

function drawPlayerView(ctx, canvas, WorldGrid, currentHallway, currentUser) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!currentHallway) return;

    // Use explicit movement modes to branch rendering contexts cleanly
    if (currentUser.movementMode === 'interconnecting') {
        drawInterconnectingView(ctx, canvas, currentUser);
    } else if (currentUser.movementMode === 'transition') {
        drawTransitionView(ctx, canvas, currentUser);
    } else if (currentUser.movementMode === 'normal') {
        drawNormalView(ctx, canvas, WorldGrid, currentHallway, currentUser);
    }
}
