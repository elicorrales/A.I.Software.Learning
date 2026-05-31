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
                if (window.My3dMazeDiagnostics && typeof window.My3dMazeDiagnostics.logHistoryEvent === 'function') {
                    window.My3dMazeDiagnostics.logHistoryEvent('💥');
                }
                if (window.MazeAudioController) {
                  window.MazeAudioController.handleMovementAudioCadence('ugh');
                }

                user.flashFrames = 5;
                if (e && typeof e.preventDefault === 'function') e.preventDefault();
                return;
            }

            const activeLink = window.MazeInterface.findActiveTunnel();
            const multiplier = (activeLink && user.direction !== activeLink.direction) ? -1 : 1;
            const speedModifier = user.isShiftPressed ? user.speed * 3 : user.speed;
            const nextProgress = user.interconnectingProgress + speedModifier * multiplier;

            const isMovingTowardsExit = nextProgress > user.interconnectingProgress;
            if (isMovingTowardsExit) {
                if (activeLink && activeLink.exitDoorOpenStatus <= 0.95 && nextProgress >= 3.20) {
                    // [Specialized Check] Reaching a tunnel exit door that is currently locked/closed
                    if (window.My3dMazeDiagnostics && typeof window.My3dMazeDiagnostics.logHistoryEvent === 'function') {
                        window.My3dMazeDiagnostics.logHistoryEvent('🚧');
                    }
                    if (window.MazeAudioController) {
                      window.MazeAudioController.handleMovementAudioCadence('ugh');
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
                      window.MazeAudioController.handleMovementAudioCadence('ugh');
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
                          window.MazeAudioController.handleMovementAudioCadence('ugh');
                        }

                        user.flashFrames = 5;
                        if (e && typeof e.preventDefault === 'function') e.preventDefault();
                        return;
                    }
                }
            }

            window.MazeAudioController.handleMovementAudioCadence(user.isShiftPressed ? 'run' : 'walk');
            user.interconnectingProgress = nextProgress;

            if (user.interconnectingProgress <= 0.0 || user.interconnectingProgress >= 3.20) {
                window.MazeInterface.exitTunnelToCorridor();
            }
            return;
        }

        // Situation B: Inside the wall transition lip space
        if (user.movementMode === 'transition') {
            const speedModifier = user.isShiftPressed ? user.speed * 3 : user.speed;
            user.transitionProgress += speedModifier;
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
                    // Close both the hallway door and tunnel exit door (to-side entry)
                    const fh = WorldGrid.mainHallways[activeLink.fromHallwayIndex];
                    const th = WorldGrid.mainHallways[activeLink.toHallwayIndex];
                    if (fh && th && state.activeHallway) {
                        const gX = (activeLink.chainGlobalX !== undefined)
                            ? activeLink.chainGlobalX
                            : fh.startOffsetFromS + activeLink.doorIndex;
                        const localIdx = gX - th.startOffsetFromS;
                        if (localIdx >= 0 && localIdx <= 4) {
                            window.MazeInterface.setDoorStateImmediate(state.activeHallway, localIdx, 0);
                        }
                    }
                    window.MazeInterface.setDoorStateImmediate(activeLink, 'exit', 0);
                } else {
                    user.interconnectingProgress = 0.0;
                    if (activeLink) {
                        // Close both the hallway door and tunnel entrance door (from-side entry)
                        window.MazeInterface.setDoorStateImmediate(state.activeHallway, activeLink.doorIndex, 0);
                        window.MazeInterface.setDoorStateImmediate(activeLink, 'entrance', 0);
                    }
                }
                window.MazeAudioController.handleMovementAudioCadence(user.isShiftPressed ? 'run' : 'walk');
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
                      window.MazeAudioController.handleMovementAudioCadence('ugh');
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
                      window.MazeAudioController.handleMovementAudioCadence('ugh');
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
                      window.MazeAudioController.handleMovementAudioCadence('ugh');
                    }

                    user.flashFrames = 5;
                    if (e && typeof e.preventDefault === 'function') e.preventDefault();
                    return;
                }

                // Log when the player successfully steps off the normal hallway track into the door lip
                if (window.My3dMazeDiagnostics && typeof window.My3dMazeDiagnostics.logHistoryEvent === 'function') {
                    window.My3dMazeDiagnostics.logHistoryEvent('⏩[T]');
                }

                window.MazeAudioController.handleMovementAudioCadence(user.isShiftPressed ? 'run' : 'walk');
                user.movementMode = 'transition';
                user.transitionProgress = user.speed;
                return;
            }
        }

        // Situation D: Standard forward movement down main corridor
        if (user.movementMode === 'normal' && state.activeHallway) {
            if (e && typeof e.preventDefault === 'function') e.preventDefault();
            const speedModifier = user.isShiftPressed ? user.speed * 3 : user.speed;
            const prevOffset = user.forwardOffset;

            if (user.direction === 0) user.forwardOffset += speedModifier;
            if (user.direction === 2) user.forwardOffset -= speedModifier;

            user.forwardOffset = Math.max(
                state.activeHallway.nodes[0],
                Math.min(state.activeHallway.nodes[state.activeHallway.nodes.length - 1], user.forwardOffset)
            );

            if (user.forwardOffset === prevOffset) {
                window.MazeAudioController.handleMovementAudioCadence('ugh');
                user.flashFrames = 5;
            } else {
                window.MazeAudioController.handleMovementAudioCadence(user.isShiftPressed ? 'run' : 'walk');
            }
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
                  window.MazeAudioController.handleMovementAudioCadence('ugh');
                }

                user.flashFrames = 5;
                if (e && typeof e.preventDefault === 'function') e.preventDefault();
                return;
            }

            const activeLink = window.MazeInterface.findActiveTunnel();
            const multiplier = (activeLink && user.direction !== activeLink.direction) ? -1 : 1;
            const speedModifier = user.isShiftPressed ? user.speed * 3 : user.speed;
            const nextProgress = user.interconnectingProgress - speedModifier * multiplier;

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
                          window.MazeAudioController.handleMovementAudioCadence('ugh');
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
                          window.MazeAudioController.handleMovementAudioCadence('ugh');
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
                          window.MazeAudioController.handleMovementAudioCadence('ugh');
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
                          window.MazeAudioController.handleMovementAudioCadence('ugh');
                        }
                        user.flashFrames = 5;
                        if (e && typeof e.preventDefault === 'function') e.preventDefault();
                        return;
                    }
                }
            }

            window.MazeAudioController.handleMovementAudioCadence(user.isShiftPressed ? 'run' : 'walk');
            user.interconnectingProgress = nextProgress;

            if (user.interconnectingProgress <= 0.0 || user.interconnectingProgress >= 3.20) {
                window.MazeInterface.exitTunnelToCorridor();
            }
            return;
        }

        // Situation B: Retreating out of the doorway lip back to center line
        if (user.movementMode === 'transition') {
            const speedModifier = user.isShiftPressed ? user.speed * 3 : user.speed;
            user.transitionProgress -= speedModifier;
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
            const prevOffset = user.forwardOffset;

            if (user.direction === 0) user.forwardOffset -= speedModifier;
            if (user.direction === 2) user.forwardOffset += speedModifier;

            user.forwardOffset = Math.max(
                state.activeHallway.nodes[0],
                Math.min(state.activeHallway.nodes[state.activeHallway.nodes.length - 1], user.forwardOffset)
            );

            if (user.forwardOffset === prevOffset) {
                window.MazeAudioController.handleMovementAudioCadence('ugh');
                user.flashFrames = 5;
            } else {
                window.MazeAudioController.handleMovementAudioCadence(user.isShiftPressed ? 'run' : 'walk');
            }
        }
    };

    window.playerRotateLeftMovement = function(e) {
        if (user.movementMode === 'transition') return;
        window.MazeInterface.resetAllDoors();

        if (user.movementMode === 'normal' && state.activeHallway) {
            user.nodeIndex = window.MazeInterface.snapToNearestNodeIndex(user.forwardOffset, state.activeHallway);
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
            user.nodeIndex = window.MazeInterface.snapToNearestNodeIndex(user.forwardOffset, state.activeHallway);
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

})();
