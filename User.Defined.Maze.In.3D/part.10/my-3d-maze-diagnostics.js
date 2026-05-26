// =========================================================================
// STATE SNAPSHOT FACADE (Round-Robin Debugging Engine)
// =========================================================================

/**
 * Global tracking repository for our two state holding pens.
 * Initialized with empty content and contrasting historical timestamps.
 */
window.My3dMazeDiagnostics = {
    bucketA: {
        timestamp: 0,
        label: "Bucket A",
        snapshot: null
    },
    bucketB: {
        timestamp: 0,
        label: "Bucket B",
        snapshot: null
    }
};

/**
 * Primary Facade Entry Point.
 * Evaluates the older holding pen, captures a deep copy snapshot of the 
 * current window app state, and overwrites the older pen.
 * * @param {string} keyTriggered - The name of the arrow key pressed (e.g., 'ArrowUp')
 */
window.captureDiagnosticSnapshot = function(keyTriggered) {
    // 1. Safeguard: Ensure the app state exists before trying to clone it
    if (!window.My3dMazeAppState) {
        console.warn("Snapshot aborted: window.My3dMazeAppState is not initialized.");
        return;
    }

    const diags = window.My3dMazeDiagnostics;
    const currentTimestamp = Date.now();

    // 2. Deep-copy the structural app state to decouple it from ongoing mutations
    let stateCopy = null;
    try {
        stateCopy = JSON.parse(JSON.stringify(window.My3dMazeAppState));
    } catch (error) {
        console.error("Failed to snapshot state due to circular references:", error);
        return;
    }

    // 3. Round-Robin Selector: Locate the older bucket to overwrite
    let targetBucket;
    let alternateBucket;

    if (diags.bucketA.timestamp <= diags.bucketB.timestamp) {
        targetBucket = diags.bucketA;
        alternateBucket = diags.bucketB;
    } else {
        targetBucket = diags.bucketB;
        alternateBucket = diags.bucketA;
    }

    // 4. Overwrite the older bucket, making it the newest "Current State"
    targetBucket.timestamp = currentTimestamp;
    targetBucket.snapshot = stateCopy;
    targetBucket.meta = {
        timeString: new Date(currentTimestamp).toLocaleTimeString(),
        triggerEvent: `User Pressed [${keyTriggered}]`
    };

    // 5. Explicitly flag their roles for the presentation viewer renderer
    targetBucket.role = "CURRENT_STATE (After Event)";
    alternateBucket.role = "PREVIOUS_STATE (Before Event)";
};


