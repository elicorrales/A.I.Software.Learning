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
    historyChain: [],
    ballEventLog:   [],
    _ballSpawnTime: null,
    _ballSeq:       0
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

/**
 * Builds a character-art top-down map of the current maze state.
 * Each hallway is a horizontal row; tunnels are vertical | connectors.
 * P = player, B = ball, * = both, ● = closed door, ○ = open door, ★ = active hallway.
 */
window.My3dMazeDiagnostics.getMazeMapDiagram = function() {
    const wState   = window.My3dMazeAppState;
    const hallways = wState.WorldGrid.mainHallways;
    const tunnels  = wState.WorldGrid.interconnectingHallways;
    const ball     = wState.rollingBall;
    const u        = wState.user;
    const activeH  = wState.activeHallway;

    if (!hallways || hallways.length === 0) return '(no hallways yet)';

    const COL_W = 5;
    const CONN  = '─'.repeat(COL_W - 1);
    let maxGx = 0;
    hallways.forEach(h => { maxGx = Math.max(maxGx, h.startOffsetFromS + 4); });
    tunnels.forEach(t => { if (t.chainGlobalX !== undefined) maxGx = Math.max(maxGx, t.chainGlobalX); });

    function tunnelGx(t) {
        if (t.chainGlobalX !== undefined) return t.chainGlobalX;
        const fh = hallways[t.fromHallwayIndex];
        return fh ? fh.startOffsetFromS + t.doorIndex : t.doorIndex;
    }

    // slotMap: {gx→char}, connMap: {gx→(COL_W-1)-char string after that slot}
    function buildRow(prefix, slotMap, connMap) {
        let row = prefix;
        for (let gx = 0; gx <= maxGx; gx++) {
            row += (slotMap[gx] !== undefined ? slotMap[gx] : ' ');
            if (gx < maxGx) row += (connMap[gx] !== undefined ? connMap[gx] : ' '.repeat(COL_W - 1));
        }
        return row;
    }

    function nearestDoor(offset, hallway) {
        let best = 0, diff = Infinity;
        for (let di = 0; di < 5; di++) {
            const nd = hallway.nodes ? hallway.nodes[di * 2] : di;
            const d  = Math.abs(offset - nd);
            if (d < diff) { diff = d; best = di; }
        }
        return best;
    }

    // Returns the character index within a fully-built hallway row where the
    // player should appear, interpolating forwardOffset between door nodes.
    function playerCharOffset(prefix, h, offset) {
        const nodes = h.nodes;
        for (let di = 0; di < 4; di++) {
            const nd  = nodes ? nodes[di * 2]       : di;
            const nd1 = nodes ? nodes[(di + 1) * 2] : di + 1;
            if (offset >= nd && offset <= nd1) {
                const f  = nd1 > nd ? (offset - nd) / (nd1 - nd) : 0;
                const gx = h.startOffsetFromS + di;
                return prefix.length + gx * COL_W + Math.round(f * COL_W);
            }
        }
        return prefix.length + (h.startOffsetFromS + nearestDoor(offset, h)) * COL_W;
    }

    const playerHallwayId = (activeH && u.movementMode !== 'interconnecting') ? activeH.id : null;
    const playerTunnelIdx = u.movementMode === 'interconnecting' ? u.activeTunnelIndex : -1;

    let ballHallwayId = null, ballDoorIdx = -1, ballTunnelRef = null;
    if (ball) {
        if (ball.movementMode === 'hallway') {
            const bh = hallways.find(h => h.id === ball.hallwayId);
            if (bh) { ballHallwayId = bh.id; ballDoorIdx = nearestDoor(ball.offset, bh); }
        } else if (ball.movementMode === 'tunnel' && ball.tunnelLink) {
            ballTunnelRef = ball.tunnelLink;
        }
    }

    const lines = [];

    // Header
    const hSlots = {}, hConn = {};
    for (let gx = 0; gx <= maxGx; gx++) { hSlots[gx] = String(gx); hConn[gx] = ' '.repeat(COL_W - 1); }
    lines.push(buildRow('  gX: ', hSlots, hConn));
    lines.push('  ' + '─'.repeat(maxGx * COL_W + 5));

    for (let hi = 0; hi < hallways.length; hi++) {
        const h        = hallways[hi];
        const isActive = activeH && h.id === activeH.id;
        const prefix   = '  ' + h.id + ': ';

        // Hallway row — player omitted from slotMap, spliced at exact char offset below
        const slotMap = {}, connMap = {};
        for (let di = 0; di < 5; di++) {
            const gx     = h.startOffsetFromS + di;
            const isOpen = h.doorOpenStatus && h.doorOpenStatus[di] > 0.5;
            const hasB   = ballHallwayId === h.id && ballDoorIdx === di;
            slotMap[gx]  = hasB ? 'B' : (isOpen ? '○' : '●');
            if (di < 4) connMap[gx] = CONN;
        }

        let rowStr = buildRow(prefix, slotMap, connMap)
            + '   ' + h.nearWallLabel + '►' + h.farWallLabel
            + (isActive ? '  ★' : '');

        if (playerHallwayId === h.id) {
            const ci  = playerCharOffset(prefix, h, u.forwardOffset);
            const cur = rowStr[ci];
            rowStr = rowStr.slice(0, ci) + (cur === 'B' ? '*' : 'P') + rowStr.slice(ci + 1);
        }

        // Chained tunnel pass-through: when a tunnel ends at this hallway and
        // continues via forwardChainIndex, the shaft passes through — mark it.
        tunnels.forEach(t => {
            if (t.toHallwayIndex === hi && t.forwardChainIndex !== undefined) {
                const ci = prefix.length + tunnelGx(t) * COL_W;
                if (ci < rowStr.length && rowStr[ci] === ' ') {
                    rowStr = rowStr.slice(0, ci) + '|' + rowStr.slice(ci + 1);
                }
            }
        });

        lines.push(rowStr);

        // Tunnel gap to next hallway
        if (hi < hallways.length - 1) {
            const gapSlots = {};
            tunnels
                .filter(t => {
                    const lo  = Math.min(t.fromHallwayIndex, t.toHallwayIndex);
                    const hi2 = Math.max(t.fromHallwayIndex, t.toHallwayIndex);
                    return lo === hi && hi2 === hi + 1;
                })
                .forEach(t => {
                    const gx   = tunnelGx(t);
                    const tIdx = tunnels.indexOf(t);
                    const hasP = playerTunnelIdx === tIdx;
                    const hasB = ballTunnelRef   === t;
                    const cur  = gapSlots[gx];
                    if (cur === '*') return;
                    if ((cur === 'P' && hasB) || (cur === 'B' && hasP)) { gapSlots[gx] = '*'; return; }
                    if      (hasP && hasB) gapSlots[gx] = '*';
                    else if (hasP)         gapSlots[gx] = 'P';
                    else if (hasB)         gapSlots[gx] = 'B';
                    else if (!cur)         gapSlots[gx] = '|';
                });

            // Chain continuations: a tunnel ending at hi with forwardChainIndex
            // means the shaft continues into this next gap at the same gX.
            tunnels.forEach(t => {
                if (t.toHallwayIndex === hi && t.forwardChainIndex !== undefined) {
                    const gx = tunnelGx(t);
                    if (!gapSlots[gx]) gapSlots[gx] = '|';
                }
            });

            if (Object.keys(gapSlots).length > 0) {
                lines.push(buildRow('      ', gapSlots, {}));
            }
        }
    }

    lines.push('  ' + '─'.repeat(maxGx * COL_W + 5));
    lines.push('');
    lines.push('  ● closed  ○ open  P player  B ball  * both  ★ active  | tunnel');
    return lines.join('\n');
};

// =========================================================================
// BALL TRAVEL HISTORY LOG
// =========================================================================

const BALL_EVENT_MAX = 500;

/**
 * Appends one terse event line to the ball travel log.
 * @param {string} evt    3-char code: SPN BNC STP ENT CHP ARV ABO SEE COI KIL
 * @param {string} loc    location string, e.g. "H1:gx3" or "H1→H2 gx3"
 * @param {string} detail free-form tail: direction, speed, delta, flags
 */
window.My3dMazeDiagnostics.logBallEvent = function(evt, loc, detail) {
    const diags = window.My3dMazeDiagnostics;
    const now   = Date.now();

    if (evt === 'SPN') {
        diags._ballSpawnTime = now;
        diags._ballSeq       = 0;
    }

    const tSec = diags._ballSpawnTime
        ? ((now - diags._ballSpawnTime) / 1000).toFixed(3)
        : '?.???';

    diags._ballSeq++;
    const seq  = String(diags._ballSeq).padStart(3, '0');
    const line = `${seq}  ${String(tSec).padStart(7)}s  ${evt.padEnd(3)}  ${(loc || '').padEnd(18)} ${detail || ''}`.trimEnd();

    diags.ballEventLog.push(line);
    if (diags.ballEventLog.length > BALL_EVENT_MAX) diags.ballEventLog.shift();

    const el = document.getElementById('ballHistoryCounter');
    if (el) el.textContent = `(${diags.ballEventLog.length}/${BALL_EVENT_MAX})`;
};

/**
 * Returns the full formatted ball history string for display or copy.
 */
window.My3dMazeDiagnostics.getBallHistoryText = function() {
    const log = window.My3dMazeDiagnostics.ballEventLog;
    if (!log || log.length === 0) return 'No ball events recorded yet. Spawn the ball to begin.';
    const header = '#    T(s)       EVT  LOC                DETAIL';
    const sep    = '─'.repeat(header.length);
    return [header, sep, ...log].join('\n');
};
