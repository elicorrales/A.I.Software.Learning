/**
 * world-grid-view-functions.js
 * Self-contained stateless sub-system for rendering the Bird's Eye Diagnostic Grid.
 */

function drawBirdseyeView(minimapCtx, minimapCanvas, worldGrid, activeHallway, user) {
    const w = minimapCanvas.width;
    const h = minimapCanvas.height;

    // Clear frame and draw background grid context container
    minimapCtx.fillStyle = '#111111';
    minimapCtx.fillRect(0, 0, w, h);

    // Draw a subtle border outline around the map edge
    minimapCtx.strokeStyle = '#444444';
    minimapCtx.lineWidth = 2;
    minimapCtx.strokeRect(0, 0, w, h);

    const totalHallways = worldGrid.mainHallways.length;
    if (totalHallways === 0) return;

    const trackSpacingY = h / (totalHallways + 1);

    // Maximum coordinate domain in world units: 1 length + 2 lengths offset limit = 3 lengths max
    const hallwayLengthUnit = 6.0;
    const totalWorldWidthUnits = hallwayLengthUnit * 3;
    
    // Render the starting line margin 'S' 
    minimapCtx.strokeStyle = '#ff3333';
    minimapCtx.lineWidth = 1;
    minimapCtx.setLineDash([2, 4]);
    minimapCtx.beginPath();
    minimapCtx.moveTo(20, 0);
    minimapCtx.lineTo(20, h);
    minimapCtx.stroke();
    minimapCtx.setLineDash([]); // Reset line dash

    // Draw Diagnostic view identity tag text bounds
    minimapCtx.fillStyle = '#666666';
    minimapCtx.font = '9px monospace';
    minimapCtx.fillText('S', 18, 12);
    minimapCtx.fillText(worldGrid.name, 5, h - 6);

    const availableRenderWidth = w - 40; // Horizontal margins boundary containment padding

    worldGrid.mainHallways.forEach((hallway, i) => {
        const hY = trackSpacingY * (i + 1);
        
        // Project unit coordinates directly to viewport pixel coordinates
        const startX = 20 + (hallway.startOffsetFromS / totalWorldWidthUnits) * availableRenderWidth;
        const endX = startX + (hallwayLengthUnit / totalWorldWidthUnits) * availableRenderWidth;
        const totalLineLength = endX - startX;

        // Draw solid baseline hallway pipeline track using its unique near color
        minimapCtx.strokeStyle = hallway.nearWallColor;
        minimapCtx.lineWidth = 4;
        minimapCtx.beginPath();
        minimapCtx.moveTo(startX, hY);
        minimapCtx.lineTo(endX, hY);
        minimapCtx.stroke();

        // Draw terminal wall end block markers
        minimapCtx.fillStyle = hallway.nearWallColor;
        minimapCtx.fillRect(startX - 2, hY - 4, 4, 8);
        minimapCtx.fillStyle = hallway.farWallColor;
        minimapCtx.fillRect(endX - 2, hY - 4, 4, 8);

        // Draw explicit text labels on terminal walls
        minimapCtx.fillStyle = '#ffffff';
        minimapCtx.font = 'bold 8px sans-serif';
        minimapCtx.fillText(hallway.nearWallLabel, startX - 14, hY + 3);
        minimapCtx.fillText(hallway.farWallLabel, endX + 4, hY + 3);

        // Map exact uniform positions for the 5 door columns across the layout row span
        // Formulates 5 slices dividing space seamlessly into 6 structural segments
        const totalDoorsCount = 5;
        for (let doorIndex = 1; doorIndex <= totalDoorsCount; doorIndex++) {
            const uniformRatio = doorIndex / (totalDoorsCount + 1); 
            const doorX = startX + (uniformRatio * totalLineLength);

            minimapCtx.fillStyle = '#00ffcc';
            minimapCtx.fillRect(doorX - 1, hY - 3, 2, 6);
        }

        // Render Simulated Live User Coordinates (Red Tracker Marker Dot) if matched to active context
        if (activeHallway && activeHallway.id === hallway.id) {
            // Find which physical node position the player is closest to
            let matchedNodeIndex = 0;
            let minDifference = Math.abs(user.forwardOffset - hallway.nodes[0]);

            // Track across the discrete structural coordinates
            for (let k = 1; k < hallway.nodes.length; k++) {
                let diff = Math.abs(user.forwardOffset - hallway.nodes[k]);
                if (diff < minDifference) {
                    minDifference = diff;
                    matchedNodeIndex = k;
                }
            }

            // Map the physical non-linear position into a clean linear grid point balance
            // Index map translates to: [Start, Door1, Turn1, Door2, Turn2, Door3, Turn3, Door4, Door5]
            // We scale the rendering ratio proportionally along 8 linear node intervals
            const totalAvailableNodeIntervals = hallway.nodes.length - 1; 
            const gridNormalizedRatio = matchedNodeIndex / totalAvailableNodeIntervals;
            const mappedUserX = startX + (gridNormalizedRatio * totalLineLength);

            minimapCtx.fillStyle = '#ff0000';
            minimapCtx.beginPath();
            minimapCtx.arc(mappedUserX, hY, 5, 0, Math.PI * 2);
            minimapCtx.fill();

            // Overlay outer pulsing indicator layer wrapper around active coordinate center 
            minimapCtx.strokeStyle = '#ffffff';
            minimapCtx.lineWidth = 1.5;
            minimapCtx.beginPath();
            minimapCtx.arc(mappedUserX, hY, 7, 0, Math.PI * 2);
            minimapCtx.stroke();
        }
    });
}
