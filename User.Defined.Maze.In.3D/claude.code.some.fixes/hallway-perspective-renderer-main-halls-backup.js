// hallway-perspective-renderer-main-halls-backup.js
// Original versions of the three main-hall rendering functions before visual enhancement pass.
// To revert: copy each function body back into hallway-perspective-renderer.js

function drawMainHallwayLeftAndRightWalls(ctx, x1, y1, x2, y2, w, h) {
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

    drawMainHallwayLeftAndRightWalls(ctx, x1, y1, x2, y2, w, h);

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

            drawRecedingPerspectiveDoorPair(ctx, segX1, segY1, segX2, segY2, nextSegX1, nextSegY1, nextSegX2, nextSegY2, doorOpenValue, leftDoorColor, rightDoorColor);
        }
    });

    if (!isLookingBackward) {
        drawRollingBallInPerspective(ctx, canvas, offset);
    }
}
