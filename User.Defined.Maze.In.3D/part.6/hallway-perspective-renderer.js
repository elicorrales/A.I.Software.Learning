/**
 * hallway-perspective-renderer.js
 * Stateless rendering engine for the 3D first-person perspective projection views.
 */

function drawPerspectiveTunnel(ctx, canvas, hallwayData, offset, isLookingBackward) {
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

function drawPerpendicularWall(ctx, canvas, WorldGrid, hallwayData, offset, lookDirection) {
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

function drawHallwayView(ctx, canvas, WorldGrid, currentHallway, currentUser) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!currentHallway) return;

    // =========================================================================
    // SUB-SYSTEM LAYER 1: INTERCONNECTING PROGRESS VIEW
    // =========================================================================
    if (currentUser.movementMode === 'interconnecting') {
        const w = canvas.width;
        const h = canvas.height;
        const cx = w / 2;
        const cy = h / 2;

        // Draw a completely unique continuous perspective corridor loop
        const totalTubeLength = 4.0;
        const distanceToFarWall = totalTubeLength - currentUser.interconnectingProgress;
        const scale = distanceToFarWall > 0.05 ? 1 / distanceToFarWall : 20;

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
        return;
    }

    // =========================================================================
    // SUB-SYSTEM LAYER 2: TRANSITION SPACE DOORFRAME SCALE
    // =========================================================================
    if (currentUser.movementMode === 'transition') {
        const w = canvas.width;
        const h = canvas.height;

        // Draw the base flat wall view first so the door frame scales *on top* of it
        drawPerpendicularWall(ctx, canvas, WorldGrid, currentHallway, currentUser.forwardOffset, currentUser.direction);

        // Calculate magnification factor as player inches closer to the threshold
        let targetDistance = 0.4 - currentUser.transitionProgress;
        if (targetDistance < 0.01) targetDistance = 0.01;
        const zoomFactor = 0.4 / targetDistance;

        // Compute expanding parameters for the open cavity box
        const frameW = w * 0.4 * zoomFactor;
        const frameH = (h * 0.85 - h * 0.15) * zoomFactor;
        const frameX = (w - frameW) / 2;
        const frameY = (h * 0.15) - ((h * 0.15) * (zoomFactor - 1));

        // Draw the widening dark void doorway
        ctx.fillStyle = '#000000';
        ctx.fillRect(frameX, frameY, frameW, frameH);

        ctx.strokeStyle = '#333333';
        ctx.lineWidth = Math.max(4, 4 * zoomFactor);
        ctx.strokeRect(frameX, frameY, frameW, frameH);
        return;
    }

    // =========================================================================
    // STANDARD CORRIDOR RENDERING (Original Logic Unmodified)
    // =========================================================================
    if (currentUser.direction === 0) {
        drawPerspectiveTunnel(ctx, canvas, currentHallway, currentUser.forwardOffset, false);
    } else if (currentUser.direction === 2) {
        const inverseOffset = (currentHallway.baseDistances[currentHallway.baseDistances.length - 2] - 0.5) - currentUser.forwardOffset;
        drawPerspectiveTunnel(ctx, canvas, currentHallway, inverseOffset, true);
    } else {
        drawPerpendicularWall(ctx, canvas, WorldGrid, currentHallway, currentUser.forwardOffset, currentUser.direction);
    }
}
