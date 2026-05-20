        let camModel = createModel('webcam');

        let activeStream = null;
        let backgroundPixels = null;
        const compareCanvas = document.createElement('canvas');
        const compareCtx = compareCanvas.getContext('2d');
        let liveCompareRunning = false;
        let trainingIntervalId = null;
        const TRAINING_FPS = 4; 
        // --- NEW STATE GLOBALS FOR INFERENCE ---
        let livePredictingActive = false;

        // --- NEW: Define your Neural Network Target Resolution ---
        const NN_TARGET_SIZE = 28; // This means 28x28 pixels = 784 features
        const INITIAL_PASSES = 400; // Foundational training epochs used on fresh setup

        function handleLabelClick(labelName) {
            console.log(`Training Event Logged: Classification labeled as [${labelName}]`);
        }

        function takeSnapshot(which) {
          const canvas = document.getElementById('snapBackground');
          const video = document.getElementById('cam');
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          backgroundPixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
        }

        function clearBackground() {
            const canvas = document.getElementById('snapBackground');
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            if (canvas.width > 0 && canvas.height > 0) {
                backgroundPixels = ctx.createImageData(canvas.width, canvas.height);
            }
        }

        function renderColorDiff(diffCtx, currentPixels, backgroundPixels, width, height, threshold = 40) {
            const out = diffCtx.createImageData(width, height);

            const a = currentPixels.data;
            const b = backgroundPixels.data;
            const d = out.data;

            for (let i = 0; i < a.length; i += 4) {
                const rDiff = Math.abs(a[i] - b[i]);
                const gDiff = Math.abs(a[i + 1] - b[i + 1]);
                const bDiff = Math.abs(a[i + 2] - b[i + 2]);

                const diff = (rDiff + gDiff + bDiff) > threshold;

                if (diff) {
                    d[i] = a[i];
                    d[i + 1] = a[i + 1];
                    d[i + 2] = a[i + 2];
                    d[i + 3] = 255;
                } else {
                    d[i] = 255;
                    d[i + 1] = 255;
                    d[i + 2] = 255;
                    d[i + 3] = 255;
                }
            }

            diffCtx.putImageData(out, 0, 0);
        }

// Helper function to pull the current frame matrix out from your canvas stream
function extractLiveFeatures() {
    const diffCanvas = document.getElementById('bkg2VsSnapped');
    if (!diffCanvas) return null;

    // Create a temporary downsampler matrix matching model dimension definitions
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = NN_TARGET_SIZE;
    sampleCanvas.height = NN_TARGET_SIZE;
    const sampleCtx = sampleCanvas.getContext('2d');

    sampleCtx.drawImage(diffCanvas, 0, 0, NN_TARGET_SIZE, NN_TARGET_SIZE);
    const imgData = sampleCtx.getImageData(0, 0, NN_TARGET_SIZE, NN_TARGET_SIZE).data;

    const features = [];
    for (let i = 0; i < imgData.length; i += 4) {
        const isWhite = (imgData[i] === 255 && imgData[i+1] === 255 && imgData[i+2] === 255);
        features.push(isWhite ? 0.0 : 1.0);
    }
    return features;
}

        function startLiveCompare() {
          if (liveCompareRunning) return;
          liveCompareRunning = true;

          const video = document.getElementById('cam');
          const diff2Canvas = document.getElementById('bkg2VsSnapped');
          const diff2Ctx = diff2Canvas.getContext('2d');

          // Grab the FPS display pill element from the dashboard
          const fpsPill = document.getElementById('fps-pill') 

          // --- NEW: Variables to track time differentials ---
          let lastTime = performance.now(); 
          let frameCount = 0;
          let fps = 0;
          let lastFpsUpdate = performance.now();


          // Grab a reference to your overlay box element
          const overlayBox = document.querySelector('.camera-overlay-box');

          function loop() {
            // 1. Calculate time delta for the current frame
            const now = performance.now();
            frameCount++;

            // Every 500ms, update the displayed average FPS to prevent erratic flickering
            if (now - lastFpsUpdate >= 500) {
              fps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
              if (fpsPill) {
                fpsPill.innerText = `FPS: ${fps}Hz`;
              }
              frameCount = 0;
              lastFpsUpdate = now;
            }

            if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
              if (compareCanvas.width !== video.videoWidth || compareCanvas.height !== video.videoHeight) {
                compareCanvas.width = video.videoWidth;
                compareCanvas.height = video.videoHeight;
              }

              compareCtx.drawImage(video, 0, 0, compareCanvas.width, compareCanvas.height);
              const currentPixels = compareCtx.getImageData(0, 0, compareCanvas.width, compareCanvas.height);

              if (backgroundPixels && backgroundPixels.data.length === currentPixels.data.length) {
                renderColorDiff(
                  diff2Ctx,
                  currentPixels,
                  backgroundPixels,
                  compareCanvas.width,
                  compareCanvas.height,
                  40
                );

// --- NEW: Run Real-time Predictions inside the animation loop ---
// --- Inside startLiveCompare() -> loop() block ---
if (livePredictingActive && camModel && camModel.isInitialized) {
    const currentFrameFeatures = extractLiveFeatures();
    if (currentFrameFeatures) {
        try {
            if (typeof predict === "function") {
                const predictionResult = predict(camModel, currentFrameFeatures);
                
                // FIX 1: Safely extract the scores array from the result object wrapper
                const outputScores = predictionResult.output || predictionResult;
                
                const trainButtons = document.querySelectorAll('.train-btn');
                let maxScore = -1;
                let topIndex = -1;

                // This loop will now execute perfectly over the 7 entries
                for (let s = 0; s < outputScores.length; s++) {
                    if (outputScores[s] > maxScore) {
                        maxScore = outputScores[s];
                        topIndex = s;
                    }
                }

                // Update the background color of every button to mirror confidence
                trainButtons.forEach((btn, idx) => {
                    const score = outputScores[idx] || 0;
                    
                    if (idx === topIndex && maxScore > 0.5) {
                        btn.style.background = `rgba(59, 130, 246, ${Math.max(0.4, score)})`; 
                        btn.style.color = "#ffffff";
                    } else if (score > 0.05) {
                        btn.style.background = `rgba(226, 232, 240, ${score})`;
                        btn.style.color = ""; 
                    } else {
                        btn.style.background = "";
                        btn.style.color = "";
                    }
                });

                // FIX 2: Throttled logging using a modulo operator so it safely runs every 30 frames
                if (topIndex !== -1 && maxScore > 0.5 && frameCount % 30 === 0) {
                    const activeBtn = document.getElementById(`btn${topIndex + 1}`);
                    const phrase = activeBtn ? (activeBtn.getAttribute('data-phrase') || 'unknown') : 'unknown';
                    console.log(`%c👉 Top Visual Match: [${phrase}] (${Math.round(maxScore * 100)}%)`, "color: #10b981; font-weight: bold;");
                }
            } else {
                console.warn("Prediction Engine Core Warning: 'predict' function is not loaded.");
            }
        } catch (err) {
            console.error("Live inference pass encountered an exception:", err);
        }
    }
} else {
    // CLEANUP: If live predictions are toggled OFF, ensure button inline styling is wiped clean
    document.querySelectorAll('.train-btn').forEach(btn => {
        btn.style.background = "";
        btn.style.color = "";
    });
}
// ----------------------------------------------------------------

              }

            }
            requestAnimationFrame(loop);
          }
          requestAnimationFrame(loop);
        }

        async function startDashboardCamera() {
          const video = document.getElementById('cam');
          if (!activeStream) {
            activeStream = await navigator.mediaDevices.getUserMedia({ video: true });
          }
          video.srcObject = activeStream;
          video.onloadedmetadata = () => {
            video.play();
            requestAnimationFrame(() => {
              const w = video.videoWidth;
              const h = video.videoHeight;
              video.width = w;
              video.height = h;

              const snapBg = document.getElementById('snapBackground');
              snapBg.width = w;
              snapBg.height = h;
              
              // --- FIXED: Define diff2Canvas as a variable so the overlay calculations can use it safely ---
              const diff2Canvas = document.getElementById('bkg2VsSnapped');
              diff2Canvas.width = w;
              diff2Canvas.height = h;

              compareCanvas.width = w;
              compareCanvas.height = h;

              const snapCtx = snapBg.getContext('2d');
              backgroundPixels = snapCtx.createImageData(w, h);

              // --- POSITION OVERLAY BOX ONCE ON INIT ---
              const overlayBox = document.querySelector('.camera-overlay-box');
              if (overlayBox) {
                // 1. Get the actual rendered visual height and top offset of the canvas
                const canvasHeight = diff2Canvas.offsetHeight; 
                const canvasTop = diff2Canvas.offsetTop; 

                // 2. Make the box size EXACTLY equal to the full canvas height
                const boxSize = canvasHeight; 

                // 3. Calculate top position (since height match is 1:1, it maps straight to canvasTop)
                const boxTop = canvasTop;

                // 4. Update DOM element style once
                overlayBox.style.height = `${boxSize}px`;
                overlayBox.style.width = `${boxSize}px`; // Forces perfect square based on height
                overlayBox.style.top = `${boxTop}px`;
              }
              // -----------------------------------------

              // --- NEW: Dynamic Pill Updates (Runs Once on camera load) ---
              
              // 1. Activate the Stream Pill accurately
              const streamPill = document.getElementById('stream-pill');
              if (streamPill) {
                streamPill.innerText = "Stream: Active";
                streamPill.classList.add('active'); // Turns it green via existing CSS
              }

              // 2. Calculate and post the total Input Features payload size
              const featuresPill = document.getElementById('features-pill');
              if (featuresPill) {
                // Total feature parameters = width * height (e.g. 28 * 28 = 784)
                const totalFeatures = NN_TARGET_SIZE * NN_TARGET_SIZE;
                featuresPill.innerText = `Input Features: ${totalFeatures} (${NN_TARGET_SIZE}x${NN_TARGET_SIZE})`;
              }
              // -----------------------------------------------------------
            });
          };
        }

        async function checkCameras() {
            const statusLabel = document.getElementById('status-label');
            const mainBtn = document.getElementById('main-btn');

            mainBtn.disabled = true;
            statusLabel.innerHTML = "Requesting camera access...";

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                statusLabel.innerHTML = "<span class='error-text'>Error:</span> Media access not supported.";
                mainBtn.disabled = false;
                return;
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                activeStream = stream;

                statusLabel.innerHTML = "<span class='success-text'>Access Granted:</span> Camera hardware is active and recognized.";

                mainBtn.innerText = "Go To Dashboard";
                mainBtn.onclick = goToDashboard;

            } catch (err) {
                statusLabel.innerHTML = `<span class='error-text'>Error:</span> ${err.message}`;
            } finally {
                mainBtn.disabled = false;
            }
        }

        function goToDashboard() {
          document.getElementById('diagnostic-view').style.display = 'none';
          document.getElementById('dashboard-view').style.display = 'block';
          startDashboardCamera();
          startLiveCompare();

          // inputCount = 784 features, outputCount = 7 classes
          const inputCount = NN_TARGET_SIZE * NN_TARGET_SIZE;
          const outputCount = 7; 
          
          console.log(`System State Stabilized. Initializing camModel with ${inputCount} inputs...`);
          loadOrInitModel(camModel, inputCount, outputCount);

          requestAnimationFrame(() => {
            requestAnimationFrame(resizeCanvases);
          });
        }

        function resizeCanvases() {
          const canvas2 = document.getElementById('snapBackground');
          const canvas4 = document.getElementById('bkg2VsSnapped');

          canvas2.style.background = "#2b2f3a";
          canvas4.style.background = "#2b2f3a";
        }

/**
 * Loads a model from persistent storage or initializes a fresh configuration 
 * if no compatible save state is discovered.
 * * @param {Object} model - The neural network model instance object (created via createModel)
 * @param {number} inputCount - Dimension length of the expected input feature vector
 * @param {number} outputCount - Dimension length of the expected output target classes
 */
function loadOrInitModel(model, inputCount, outputCount) {
    try {
        // 1. ATTEMPT TO LOAD PERSISTED DATA
        // This utility function returns true if data exists AND matches the requested shape.
        const loaded = loadPersistedModel(model, inputCount, outputCount);

        if (loaded) {
            console.log(`Persistence: Model [${model.name || 'anonymous'}] restored from storage.`);
            
const counterEl = document.getElementById('samples-counter-pill');
    if (counterEl && model.samplesHistory) {
        counterEl.innerText = model.samplesHistory.length;
    }

            // 2. SYNC THE UI RADIOS
            // Ensure the "Model Mode" radio buttons match the loaded activation setting (linear/sigmoid/softmax)
            const savedMode = model.activation;
            if (savedMode) {
                const radioToSelect = document.querySelector(`input[name="modelMode"][value="${savedMode}"]`);
                if (radioToSelect) {
                    radioToSelect.checked = true;
                }
            }

        } else {
            // 3. FALLBACK TO INIT
            // If no save exists or configuration shape parameters mismatch, initialize an empty baseline.
            console.log(`Persistence: No compatible save found for [${model.name || 'anonymous'}]. Initializing fresh.`);

            // Initialize the fresh matrices and run standard initial weights generation passes
            initModel(model, inputCount, outputCount, INITIAL_PASSES);


        }

    } catch (err) {
        console.error("Model startup error:", err);

    }
}

        window.addEventListener('DOMContentLoaded', async () => {
            const statusLabel = document.getElementById('status-label');
            const mainBtn = document.getElementById('main-btn');

            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = devices.filter(d => d.kind === 'videoinput');

                if (videoDevices.length === 0) {
                    statusLabel.innerHTML = "No camera hardware detected.";
                } else if (videoDevices.every(d => d.label === "")) {
                    statusLabel.innerHTML = `System ready. ${videoDevices.length} camera(s) detected. Click above to enable access.`;
                    mainBtn.innerText = "Unlock Cameras";
                } else {
                    statusLabel.innerHTML = `${videoDevices.length} camera(s) authorized and ready for use.`;
                }
            } catch (err) {
                statusLabel.innerHTML = "System standby.";
            }

            requestAnimationFrame(() => {
              requestAnimationFrame(resizeCanvases);
            });

            window.addEventListener('resize', resizeCanvases);
        });

// --- NEW: Event Handlers for Model Mode Configuration ---
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('input[name="modelMode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const selectedMode = e.target.value;
            console.log(`Model Activation Mode changed to: [${selectedMode}]`);
            
            // If your webcam neural model variable is named 'model' or 'camModel':
            try {
                if (typeof setModelActivation === "function" && typeof camModel !== "undefined") {
                    setModelActivation(camModel, selectedMode);
                }
            } catch (err) {
                console.error("Failed to alter neural network activation context:", err);
            }
        });
    });

const predictBtn = document.getElementById('predict-toggle-btn');
    if (predictBtn) {
        predictBtn.addEventListener('click', () => {
            livePredictingActive = !livePredictingActive;
            
            if (livePredictingActive) {
                predictBtn.classList.add('active');
                predictBtn.innerText = "Stream Predictions: ON";
            } else {
                predictBtn.classList.remove('active');
                predictBtn.innerText = "Stream Predictions: OFF";
            }
        });
    }
});

// --- Event Handlers for Dynamic Training Labels (Continuous Hold) ---
// --- Event Handlers for Dynamic Training Labels (Continuous Hold) ---
document.addEventListener('DOMContentLoaded', () => {
    let trainingIntervalId = null;

    // A clean global function to reset ALL buttons to standard CSS stylesheets
    function clearAllButtonActiveStates() {
        document.querySelectorAll('.train-btn').forEach(b => {
            b.style.background = ""; 
            b.style.color = "";
            b.style.boxShadow = "";
            b.style.transform = "";
        });
    }

    document.querySelectorAll('.train-btn').forEach((btn, index) => {
        
        // Function to capture features and train safely without locking the canvas thread
        function captureAndTrainPass() {
            const diffCanvas = document.getElementById('bkg2VsSnapped');
            if (!diffCanvas || !camModel || !camModel.isInitialized) return;

            // 1. Mini downsampler canvas to pull 28x28 resolution matrix bounds
            const sampleCanvas = document.createElement('canvas');
            sampleCanvas.width = NN_TARGET_SIZE;
            sampleCanvas.height = NN_TARGET_SIZE;
            const sampleCtx = sampleCanvas.getContext('2d');

            sampleCtx.drawImage(diffCanvas, 0, 0, NN_TARGET_SIZE, NN_TARGET_SIZE);
            const imgData = sampleCtx.getImageData(0, 0, NN_TARGET_SIZE, NN_TARGET_SIZE);
            const pixels = imgData.data;

            // 2. Extract structural binary features (784 dimensions)
            const inputFeatures = [];
            for (let i = 0; i < pixels.length; i += 4) {
                const isWhite = (pixels[i] === 255 && pixels[i+1] === 255 && pixels[i+2] === 255);
                inputFeatures.push(isWhite ? 0.0 : 1.0); 
            }

            const phrase = btn.getAttribute('data-phrase') || 'unknown';
            console.log(`Training Single Frame: Index [${index}] (${phrase}) | Vector: 784 values.`);

            camModel.latestInputFeatures = inputFeatures;

            // 3. Increment counters before mathematical compilation
            if (camModel.samplesHistory) {
                const currentCount = camModel.samplesHistory.length + 1;
                const samplesCounterEl = document.getElementById('samples-counter-pill');
                if (samplesCounterEl) {
                    samplesCounterEl.innerText = currentCount;
                }
            }

            // 4. 🚀 FIX: Offload execution to a microtask thread so canvas rendering never stalls
            if (typeof trainModel === "function") {
                setTimeout(async () => {
                    try {
                        await trainModel(camModel, index);
                        console.log(`Frame optimization complete. Samples in history: ${camModel.samplesHistory.length}`);
                    } catch (err) {
                        console.error("Inline training step error:", err);
                    }
                }, 0);
            }
        }

        // --- WIRE HOLD ACTIONS ---
        
        // Handle trigger start (Mouse Hold down)
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            
            if (trainingIntervalId) {
                clearInterval(trainingIntervalId);
                trainingIntervalId = null;
            }
            
            // Turn off live predictions immediately when holding down a train button
            if (livePredictingActive) {
                livePredictingActive = false;
                const predictBtn = document.getElementById('predict-toggle-btn');
                if (predictBtn) {
                    predictBtn.classList.remove('active');
                    predictBtn.innerText = "Stream Predictions: OFF";
                }
            }

            // Wipes styles from other elements to prevent leaky cross-over rendering
            clearAllButtonActiveStates();

            // Apply intense pressed/held states to the active target element
            btn.style.background = "var(--accent)"; 
            btn.style.color = "#ffffff";
            btn.style.boxShadow = "inset 0 4px 10px rgba(0, 0, 0, 0.4)"; 
            btn.style.transform = "scale(0.98)"; 
            
            // Run snapshot data compilation
            captureAndTrainPass();
            
            // Run loop cleanly at 4 frames per second
            trainingIntervalId = setInterval(captureAndTrainPass, 1000 / TRAINING_FPS);
        });

        // Safe cleanup function to stop training loop resets safely
        function stopTraining() {
            if (trainingIntervalId) {
                clearInterval(trainingIntervalId);
                trainingIntervalId = null;
                console.log("Hold state released. Inline frame training paused.");
            }
            clearAllButtonActiveStates();
        }

        // Interrupt triggers to stop recording loop
        btn.addEventListener('mouseup', stopTraining);
        btn.addEventListener('mouseleave', stopTraining); 
    });
});


