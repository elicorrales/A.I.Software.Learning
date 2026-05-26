// =========================================================================
// PLAYER NAVIGATION & KINEMATICS CONTROLLER
// =========================================================================

(function() {
    // Local shorthand bindings for cleaner mathematical expressions
    const state = window.My3dMazeAppState;
    const user = state.user;
    const WorldGrid = state.WorldGrid;

    window.playerForwardMovement = function(e) {
        // Situation A: Inside the continuous interconnecting tube
        if (user.movementMode === 'interconnecting') {
            if (user.direction === 0 || user.direction === 2) {
                user.flashFrames = 5;
                if (e && typeof e.preventDefault === 'function') e.preventDefault();
                return;
            }

            const activeLink = window.MazeInterface.findActiveTunnel();
            const multiplier = (activeLink && user.direction !== activeLink.direction) ? -1 : 1;
            const nextProgress = user.interconnectingProgress + user.speed * multiplier;

            const isMovingTowardsExit = nextProgress > user.interconnectingProgress;
            if (isMovingTowardsExit) {
                if (activeLink && activeLink.exitDoorOpenStatus <= 0.95 && nextProgress >= 3.20) {
                    user.flashFrames = 5;
                    if (e && typeof e.preventDefault === 'function') e.preventDefault();
                    return;
                }
            } else {
                if (activeLink && activeLink.entranceDoorOpenStatus <= 0.95 && nextProgress <= 0.0) {
                    user.flashFrames = 5;
                    if (e && typeof e.preventDefault === 'function') e.preventDefault();
                    return;
                }
            }

            if (nextProgress >= 3.20) {
                if (activeLink) {
                    const exitDoorOpenAmt = window.MazeInterface.getOpenStatus(activeLink, 'exit');
                    if (exitDoorOpenAmt <= 0.95) {
                        user.interconnectingProgress = 3.16;
                        user.flashFrames = 5;
                        if (e && typeof e.preventDefault === 'function') e.preventDefault();
                        return;
                    }
                }
            }

            user.interconnectingProgress = nextProgress;

            if (user.interconnectingProgress <= 0.0 || user.interconnectingProgress >= 3.20) {
                window.MazeInterface.exitTunnelToCorridor();
            }
            return;
        }

        // Situation B: Inside the wall transition lip space
        if (user.movementMode === 'transition') {
            user.transitionProgress += user.speed;
            if (user.transitionProgress >= 0.4) {
                user.movementMode = 'interconnecting';
                const activeLink = window.MazeInterface.findActiveTunnel();
                const currentHallwayIdx = WorldGrid.mainHallways.findIndex(h => h.id === state.activeHallway.id);
                
                if (activeLink && currentHallwayIdx === activeLink.toHallwayIndex) {
                    user.interconnectingProgress = 3.20;
                } else {
                    user.interconnectingProgress = 0.0;
                }
            }
            return;
        }

        // Situation C: Normal navigation, facing a door node, and trying to step into it
        if (user.movementMode === 'normal' && (user.direction === 1 || user.direction === 3)) {
            const nodeIndex = window.MazeInterface.getCurrentNodeIndex();

            if (nodeIndex !== -1) {
                if (window.MazeInterface.getOpenStatus(state.activeHallway, nodeIndex) <= 0.95) {
                    user.flashFrames = 5;
                    if (e && typeof e.preventDefault === 'function') e.preventDefault();
                    return;
                }

                const currentHallwayIdx = WorldGrid.mainHallways.findIndex(h => h.id === state.activeHallway.id);
                const isWorldBoundaryVoid = (user.direction === 3 && currentHallwayIdx === 0) || (user.direction === 1 && currentHallwayIdx === 6);

                if (isWorldBoundaryVoid) {
                    user.flashFrames = 5;
                    if (e && typeof e.preventDefault === 'function') e.preventDefault();
                    return;
                }

                if (!window.MazeInterface.hasTunnelAtCurrentNode()) {
                    user.flashFrames = 5;
                    if (e && typeof e.preventDefault === 'function') e.preventDefault();
                    return;
                }

                user.movementMode = 'transition';
                user.transitionProgress = user.speed;
                return;
            }
        }

        // Situation D: Standard forward movement down main corridor
        if (user.movementMode === 'normal' && state.activeHallway) {
            if (e && typeof e.preventDefault === 'function') e.preventDefault();
            const speedModifier = user.isShiftPressed ? user.speed * 3 : user.speed;

            if (user.direction === 0) user.forwardOffset += speedModifier;
            if (user.direction === 2) user.forwardOffset -= speedModifier;

            user.forwardOffset = Math.max(
                state.activeHallway.nodes[0],
                Math.min(state.activeHallway.nodes[state.activeHallway.nodes.length - 1], user.forwardOffset)
            );
        }
    };

    window.playerBackwardMovement = function(e) {
        // Situation A: Retreating backward down the connector tube
        if (user.movementMode === 'interconnecting') {
            if (user.direction === 0 || user.direction === 2) {
                user.flashFrames = 5;
                if (e && typeof e.preventDefault === 'function') e.preventDefault();
                return;
            }

            const activeLink = window.MazeInterface.findActiveTunnel();
            const multiplier = (activeLink && user.direction !== activeLink.direction) ? -1 : 1;
            const nextProgress = user.interconnectingProgress - user.speed * multiplier;

            if (nextProgress >= 3.20 && activeLink) {
                const exitDoorStatus = window.MazeInterface.getOpenStatus(activeLink, 'exit');
                if (exitDoorStatus <= 0.95) {
                    user.interconnectingProgress = 3.16;
                    user.flashFrames = 5;
                    if (e && typeof e.preventDefault === 'function') e.preventDefault();
                    return;
                }
            }

            user.interconnectingProgress = nextProgress;

            if (user.interconnectingProgress <= 0.0 || user.interconnectingProgress >= 3.20) {
                window.MazeInterface.exitTunnelToCorridor();
            }
            return;
        }

        // Situation B: Retreating out of the doorway lip back to center line
        if (user.movementMode === 'transition') {
            user.transitionProgress -= user.speed;
            if (user.transitionProgress <= 0.0) {
                user.movementMode = 'normal';
                user.transitionProgress = 0.0;
            }
            return;
        }

        // Situation C: Standard backward movement down main corridor
        if (user.movementMode === 'normal' && state.activeHallway) {
            if (e && typeof e.preventDefault === 'function') e.preventDefault();
            const speedModifier = user.isShiftPressed ? user.speed * 3 : user.speed;

            if (user.direction === 0) user.forwardOffset -= speedModifier;
            if (user.direction === 2) user.forwardOffset += speedModifier;

            user.forwardOffset = Math.max(
                state.activeHallway.nodes[0],
                Math.min(state.activeHallway.nodes[state.activeHallway.nodes.length - 1], user.forwardOffset)
            );
        }
    };

    window.playerRotateLeftMovement = function(e) {
        if (user.movementMode === 'transition') return;
        if (user.movementMode === 'normal' && state.activeHallway) {
            user.nodeIndex = snapToNearestNodeIndex(user.forwardOffset, state.activeHallway);
            user.forwardOffset = state.activeHallway.nodes[user.nodeIndex];
            window.MazeInterface.resetAllDoors(state.activeHallway);
        }
        user.direction = (user.direction + 3) % 4;
    };

    window.playerRotateRightMovement = function(e) {
        if (user.movementMode === 'transition') return;
        if (user.movementMode === 'normal' && state.activeHallway) {
            user.nodeIndex = snapToNearestNodeIndex(user.forwardOffset, state.activeHallway);
            user.forwardOffset = state.activeHallway.nodes[user.nodeIndex];
            window.MazeInterface.resetAllDoors(state.activeHallway);
        }
        user.direction = (user.direction + 1) % 4;
    };

    // Kept helper shared locally inside this scope
    function snapToNearestNodeIndex(offset, hallwayModel) {
        let closestIdx = 0;
        let minDiff = Math.abs(offset - hallwayModel.nodes[0]);
        for (let i = 1; i < hallwayModel.nodes.length; i++) {
            let diff = Math.abs(offset - hallwayModel.nodes[i]);
            if (diff < minDiff) {
                minDiff = diff;
                closestIdx = i;
            }
        }
        return closestIdx;
    }
})();
