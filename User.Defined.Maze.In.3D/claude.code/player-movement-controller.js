// =========================================================================
// PLAYER NAVIGATION & KINEMATICS CONTROLLER
// =========================================================================

(function() {
    // Local shorthand bindings for cleaner mathematical expressions
    const state = window.My3dMazeAppState;
    const user = state.user;
    const WorldGrid = state.WorldGrid;
    let lastStepTimestamp = 0;

/**
 * Handles the smart timing gate and routes commands to the dumb audio controller.
 * @param {boolean} isShiftPressed - True if sprinting/running, false if walking.
 */
function handleMovementAudioCadence(isShiftPressed) {
  // If the audio controller isn't loaded yet, bail safely
  if (!window.MazeAudioController) return;

  const now = performance.now();
  
  // Set human stride pacing: ~330ms for running, ~530ms for walking
  const stepCooldownInterval = isShiftPressed ? 330 : 530;

  // Gate Check: If the required time hasn't passed since the last step, ignore this event frame
  if (now - lastStepTimestamp < stepCooldownInterval) {
    return;
  }

  // Update timestamp immediately so subsequent held frames are locked out
  lastStepTimestamp = now;

  // Execute the exact plain English call requested
  if (isShiftPressed) {
    window.MazeAudioController.doRunningStep();
  } else {
    window.MazeAudioController.doWalkingStep();
  }
}

    window.playerForwardMovement = function(e) {
        // Situation A: Inside the continuous interconnecting tube
        if (user.movementMode === 'interconnecting') {
            if (user.direction === 0 || user.direction === 2) {
                if (window.My3dMazeDiagnostics && typeof window.My3dMazeDiagnostics.logHistoryEvent === 'function') {
                    window.My3dMazeDiagnostics.logHistoryEvent('💥');
                }
                if (window.MazeAudioController) {
                  window.MazeAudioController.doPlayerGotHit();
                }

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
                    // [Specialized Check] Reaching a tunnel exit door that is currently locked/closed
                    if (window.My3dMazeDiagnostics && typeof window.My3dMazeDiagnostics.logHistoryEvent === 'function') {
                        window.My3dMazeDiagnostics.logHistoryEvent('🚧');
                    }
                    if (window.MazeAudioController) {
                      window.MazeAudioController.doPlayerGotHit();
                    }

                    user.flashFrames = 5;
                    if (e && typeof e.preventDefault === 'function') e.preventDefault();
                    return;
                }
            } else {
                if (activeLink && activeLink.entranceDoorOpenStatus <= 0.95 && nextProgress <= 0.0) {
                    // [Specialized Check] Moving backwards into a closed tunnel entrance door
                    if (window.My3dMazeDiagnostics && typeof window.My3dMazeDiagnostics.logHistoryEvent === 'function') {
                        window.My3dMazeDiagnostics.logHistoryEvent('🚧');
                    }
                    if (window.MazeAudioController) {
                      window.MazeAudioController.doPlayerGotHit();
                    }

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
                        if (window.My3dMazeDiagnostics && typeof window.My3dMazeDiagnostics.logHistoryEvent === 'function') {
                            window.My3dMazeDiagnostics.logHistoryEvent('🚧');
                        }
                        if (window.MazeAudioController) {
                          window.MazeAudioController.doPlayerGotHit();
                        }

                        user.flashFrames = 5;
                        if (e && typeof e.preventDefault === 'function') e.preventDefault();
                        return;
                    }
                }
            }

            handleMovementAudioCadence(user.isShiftPressed);
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
                // Log when the player leaves the lip space and enters the deep tunnel track
                if (window.My3dMazeDiagnostics && typeof window.My3dMazeDiagnostics.logHistoryEvent === 'function') {
                    window.My3dMazeDiagnostics.logHistoryEvent('⏩[I]');
                }
                // Resolve the tunnel BEFORE changing mode so the direction guard still applies.
                // This prevents inline tunnels (same global X column) from being confused.
                const activeLink = window.MazeInterface.findActiveTunnel();
                const tunnelIdx = activeLink ? state.WorldGrid.interconnectingHallways.indexOf(activeLink) : -1;

                user.movementMode = 'interconnecting';
                user.activeTunnelIndex = tunnelIdx;

                const currentHallwayIdx = WorldGrid.mainHallways.findIndex(h => h.id === state.activeHallway.id);
                if (activeLink && currentHallwayIdx === activeLink.toHallwayIndex) {
                    user.interconnectingProgress = 3.20;
                } else {
                    user.interconnectingProgress = 0.0;
                }
                handleMovementAudioCadence(user.isShiftPressed);
            }
            return;
        }

        // Situation C: Normal navigation, facing a door node, and trying to step into it
        if (user.movementMode === 'normal' && (user.direction === 1 || user.direction === 3)) {
            const nodeIndex = window.MazeInterface.getCurrentNodeIndex();

            if (nodeIndex !== -1) {
                // Check 1: Is the physical door closed?
                if (window.MazeInterface.getOpenStatus(state.activeHallway, nodeIndex) <= 0.95) {
                    if (window.My3dMazeDiagnostics && typeof window.My3dMazeDiagnostics.logHistoryEvent === 'function') {
                        window.My3dMazeDiagnostics.logHistoryEvent('🚧'); // Door Closed
                    }
                    if (window.MazeAudioController) {
                      window.MazeAudioController.doPlayerGotHit();
                    }

                    user.flashFrames = 5;
                    if (e && typeof e.preventDefault === 'function') e.preventDefault();
                    return;
                }

                // Check 2: Are we trying to exit past the hard edge of the universe grid?
                const currentHallwayIdx = WorldGrid.mainHallways.findIndex(h => h.id === state.activeHallway.id);
                const isWorldBoundaryVoid = (user.direction === 3 && currentHallwayIdx === 0) || (user.direction === 1 && currentHallwayIdx === 6);

                if (isWorldBoundaryVoid) {
                    if (window.My3dMazeDiagnostics && typeof window.My3dMazeDiagnostics.logHistoryEvent === 'function') {
                        window.My3dMazeDiagnostics.logHistoryEvent('⛔'); // Door opened but NOT allowed (Edge of Universe)
                    }
                    if (window.MazeAudioController) {
                      window.MazeAudioController.doPlayerGotHit();
                    }

                    user.flashFrames = 5;
                    if (e && typeof e.preventDefault === 'function') e.preventDefault();
                    return;
                }

                // Check 3: Is the door open, but no floating tunnel infrastructure links it?
                if (!window.MazeInterface.hasTunnelAtCurrentNode()) {
                    if (window.My3dMazeDiagnostics && typeof window.My3dMazeDiagnostics.logHistoryEvent === 'function') {
                        window.My3dMazeDiagnostics.logHistoryEvent('🕳️'); // Door opened but NO tunnel structure
                    }
                    if (window.MazeAudioController) {
                      window.MazeAudioController.doPlayerGotHit();
                    }

                    user.flashFrames = 5;
                    if (e && typeof e.preventDefault === 'function') e.preventDefault();
                    return;
                }

                // Log when the player successfully steps off the normal hallway track into the door lip
                if (window.My3dMazeDiagnostics && typeof window.My3dMazeDiagnostics.logHistoryEvent === 'function') {
                    window.My3dMazeDiagnostics.logHistoryEvent('⏩[T]');
                }

                handleMovementAudioCadence(user.isShiftPressed);
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

            handleMovementAudioCadence(user.isShiftPressed);

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
                if (window.My3dMazeDiagnostics && typeof window.My3dMazeDiagnostics.logHistoryEvent === 'function') {
                    window.My3dMazeDiagnostics.logHistoryEvent('💥');
                }
                if (window.MazeAudioController) {
                  window.MazeAudioController.doPlayerGotHit();
                }

                user.flashFrames = 5;
                if (e && typeof e.preventDefault === 'function') e.preventDefault();
                return;
            }

            const activeLink = window.MazeInterface.findActiveTunnel();
            const multiplier = (activeLink && user.direction !== activeLink.direction) ? -1 : 1;
            const nextProgress = user.interconnectingProgress - user.speed * multiplier;

            // TRACK INTENDED MOVEMENT DIRECTION BACKWARDS
            const isBackingTowardsExit = nextProgress > user.interconnectingProgress;

            if (isBackingTowardsExit) {
                // We are actively backing up towards the exit threshold (3.20)
                if (activeLink && nextProgress >= 3.20) {
                    const exitDoorStatus = window.MazeInterface.getOpenStatus(activeLink, 'exit');
                    if (exitDoorStatus <= 0.95) {
                        user.interconnectingProgress = 3.16;
                        if (window.My3dMazeDiagnostics && typeof window.My3dMazeDiagnostics.logHistoryEvent === 'function') {
                            window.My3dMazeDiagnostics.logHistoryEvent('🛑🚧');
                        }
                        if (window.MazeAudioController) {
                          window.MazeAudioController.doPlayerGotHit();
                        }

                        user.flashFrames = 5;
                        if (e && typeof e.preventDefault === 'function') e.preventDefault();
                        return;
                    }

                    // --- NEW RULE: BACKING OUT OF OPEN EXIT INTO EMPTY SPACE VOID ---
                    if (!window.MazeInterface.doesAnyStructureExistAtTunnelTerminal(activeLink, 'forward')) {
                        user.interconnectingProgress = 3.16; // Pin position safely inside
                        if (window.My3dMazeDiagnostics && typeof window.My3dMazeDiagnostics.logHistoryEvent === 'function') {
                            window.My3dMazeDiagnostics.logHistoryEvent('🛑🕳️'); // Void Blocked
                        }
                        if (window.MazeAudioController) {
                          window.MazeAudioController.doPlayerGotHit();
                        }

                        user.flashFrames = 5;
                        if (e && typeof e.preventDefault === 'function') e.preventDefault();
                        return;
                    }
                }
            } else {
                // We are actively backing up towards the entrance threshold (0.0)
                if (activeLink && nextProgress <= 0.0) {
                    const entranceDoorStatus = window.MazeInterface.getOpenStatus(activeLink, 'entrance');
                    if (entranceDoorStatus <= 0.95) {
                        user.interconnectingProgress = 0.04;
                        if (window.My3dMazeDiagnostics && typeof window.My3dMazeDiagnostics.logHistoryEvent === 'function') {
                            window.My3dMazeDiagnostics.logHistoryEvent('🛑🚧');
                        }
                        if (window.MazeAudioController) {
                          window.MazeAudioController.doPlayerGotHit();
                        }

                        user.flashFrames = 5;
                        if (e && typeof e.preventDefault === 'function') e.preventDefault();
                        return;
                    }

                    // --- NEW RULE: BACKING OUT OF OPEN ENTRANCE INTO EMPTY SPACE VOID ---
                    if (!window.MazeInterface.doesAnyStructureExistAtTunnelTerminal(activeLink, 'backward')) {
                        user.interconnectingProgress = 0.04; // Pin position safely inside
                        if (window.My3dMazeDiagnostics && typeof window.My3dMazeDiagnostics.logHistoryEvent === 'function') {
                            window.My3dMazeDiagnostics.logHistoryEvent('🛑🕳️'); // Void Blocked
                        }
                        if (window.MazeAudioController) {
                          window.MazeAudioController.doPlayerGotHit();
                        }
                        user.flashFrames = 5;
                        if (e && typeof e.preventDefault === 'function') e.preventDefault();
                        return;
                    }
                }
            }

            handleMovementAudioCadence(user.isShiftPressed);
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

            handleMovementAudioCadence(user.isShiftPressed);
            user.forwardOffset = Math.max(
                state.activeHallway.nodes[0],
                Math.min(state.activeHallway.nodes[state.activeHallway.nodes.length - 1], user.forwardOffset)
            );
        }
    };

    window.playerRotateLeftMovement = function(e) {
        if (user.movementMode === 'transition') return;
        window.MazeInterface.resetAllDoors();

        if (user.movementMode === 'normal' && state.activeHallway) {
            user.nodeIndex = snapToNearestNodeIndex(user.forwardOffset, state.activeHallway);
            user.forwardOffset = state.activeHallway.nodes[user.nodeIndex];
            //window.MazeInterface.resetAllDoors(state.activeHallway);
        }

        // 1. Mutate the relative tracking index first
        if (user && typeof user.relativeFacingIndex === 'number') {
            user.relativeFacingIndex = (user.relativeFacingIndex + 3) % 4;
        }

        // 2. Call the diagnostic logger directly right here
        if (window.My3dMazeDiagnostics && typeof window.My3dMazeDiagnostics.logHistoryEvent === 'function') {
            window.My3dMazeDiagnostics.logHistoryEvent('↺');
        }

        // 3. Update the 2D cardinal layout state silently via interface
        const targetDirection = (user.direction + 3) % 4;
        window.MazeInterface.updateUserDirection(targetDirection); 
    };

    window.playerRotateRightMovement = function(e) {
        if (user.movementMode === 'transition') return;
        window.MazeInterface.resetAllDoors();

        if (user.movementMode === 'normal' && state.activeHallway) {
            user.nodeIndex = snapToNearestNodeIndex(user.forwardOffset, state.activeHallway);
            user.forwardOffset = state.activeHallway.nodes[user.nodeIndex];
            //window.MazeInterface.resetAllDoors(state.activeHallway);
        }

        // 1. Mutate the relative tracking index first
        if (user && typeof user.relativeFacingIndex === 'number') {
            user.relativeFacingIndex = (user.relativeFacingIndex + 1) % 4;
        }

        // 2. Call the diagnostic logger directly right here
        if (window.My3dMazeDiagnostics && typeof window.My3dMazeDiagnostics.logHistoryEvent === 'function') {
            window.My3dMazeDiagnostics.logHistoryEvent('↻');
        }

        // 3. Update the 2D cardinal layout state silently via interface
        const targetDirection = (user.direction + 1) % 4;
        window.MazeInterface.updateUserDirection(targetDirection); 
    };

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
