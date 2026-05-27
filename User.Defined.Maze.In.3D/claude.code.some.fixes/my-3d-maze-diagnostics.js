// =========================================================================
// STATE SNAPSHOT FACADE (Round-Robin Debugging Engine)
// =========================================================================

const HISTORY_CHAIN_LENGTH = 200;
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
    },
    historyChain: []
};

window.My3dMazeAppState.user.relativeFacingIndex = 0; // Always starts at 0 (UP / ▲)


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

/**
 * Assembles and returns the raw serialized data string from the current buckets.
 * Pure data mapping function; zero DOM or UI side-effects.
 * @returns {string} Combined raw serialized JSON strings.
 */
window.My3dMazeDiagnostics.getSerializedStateData = function() {
    const diags = window.My3dMazeDiagnostics;

    // Evaluate timestamps to sort out chronological roles
    let currentBucket, previousBucket;
    if (diags.bucketA.timestamp >= diags.bucketB.timestamp) {
        currentBucket = diags.bucketA;
        previousBucket = diags.bucketB;
    } else {
        currentBucket = diags.bucketB;
        previousBucket = diags.bucketA;
    }

    // Strictly serialized, unformatted JSON text strings
    const currentJsonStr = JSON.stringify(currentBucket);
    const previousJsonStr = JSON.stringify(previousBucket);

    return "CURRENT:" + currentJsonStr + " PREVIOUS:" + previousJsonStr;
};

/**
 * Appends a shorthand tracking symbol to the immutable history string buffer.
 * Automatically appends the true relative direction symbol based on initial game position.
 * Automatically clamps the array size to protect memory overhead.
 * @param {string} symbol - The shorthand notation character (e.g., '↺', '↑', '💥')
 */
window.My3dMazeDiagnostics.logHistoryEvent = function(symbol) {
    const chain = window.My3dMazeDiagnostics.historyChain;
    const state = window.My3dMazeAppState;
    
    let dirArrow = '▲'; 
    if (state && state.user && typeof state.user.relativeFacingIndex === 'number') {
        const historyArrows = ['▲', '▶', '▼', '◀']; // 0=Up, 1=Right, 2=Down, 3=Left
        dirArrow = historyArrows[state.user.relativeFacingIndex];
    }

    chain.push(symbol + dirArrow);
    
    if (chain.length > HISTORY_CHAIN_LENGTH) {
        chain.shift();
    }

    // =========================================================================
    // LIVE UI PANEL COUNTER UPDATE HOOK
    // =========================================================================
    const counterEl = document.getElementById('historyCounter');
    if (counterEl) {
        counterEl.textContent = `(${chain.length}/${HISTORY_CHAIN_LENGTH})`;
    }
};
