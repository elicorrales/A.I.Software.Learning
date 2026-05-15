//index.js

//-------------------------------
// constants, globals, file scope
//-------------------------------

// NEW: Timing configuration
const SPEECH_TIMEOUT_MS = 400;   // How long to wait before clearing the screen
const CANVAS_DURATION_MS = 3000; // Time in ms to reach the right edge

const meter = document.getElementById("meter");

const percent = document.getElementById("percent");

const statusText = document.getElementById("status");

const audio = document.getElementById("audio");

const canvas = document.getElementById("wave");

const ctx = canvas.getContext("2d");

const introModal =
    document.getElementById("introModal");

const loadingModal =
    document.getElementById("loadingModal");

const okButton =
    document.getElementById("okButton");

const calBtn =
    document.getElementById("calBtn");

const trainButtons = document.querySelectorAll('.train-btn');

const freezeBtn = document.getElementById("freezeBtn");
const featuresArea = document.getElementById("features");

// Determine dynamic counts for initialization
const speechOutputCount = document.querySelectorAll('.train-btn').length;
const speechInputCount = 134;
const commandOutputCount = 3; //yes, no, other
const commandInputCount = speechInputCount;

let analyser;

let dataArray;

let waveArray;

let quietBaseline = 0;

let calibrated = false;

let xPos = 0;

// NEW: Track exactly when a sentence started
let lastSpeechTime = 0;
let speechStartTime = 0;

let isFrozen = false;
let speechBuffer = [];
let sampleRate = 0;
let isRecording = false;

let pendingPhraseFeatures = null; // Holds "This is a test" features
let topGuessIndex = -1;           // NEW: Remembers what the model predicted
let appState = "LISTENING_PHRASE"; // or "WAITING_FOR_COMMAND"

let latestInputFeatures = null;
let isTraining = false;
let isCommandWaiting = false; // Prevents re-predicting commands until a button is pressed

const INITIAL_PASSES = 400;

let speechModel = createModel("speech");
let commandModel = createModel("commands");

//-------------------------------
// canvas setup
//-------------------------------

canvas.width = 600;
canvas.height = 360;

ctx.fillStyle = "#000000";
ctx.fillRect(0, 0, canvas.width, canvas.height);


//-------------------------------
// function definitions
//-------------------------------



// Refactored: Uses time-based logic to map 3 seconds to canvas width
function drawWaveform() {
    // Allow the loop to run if we are waiting for a command
    if (isTraining || (isFrozen && (appState !== "WAITING_FOR_COMMAND" || isCommandWaiting))) {
        requestAnimationFrame(drawWaveform); // or updateMeter
        return;
    }

    analyser.getByteTimeDomainData(waveArray);
    const rawVolume = getVolume();
    const volume = Math.max(0, rawVolume - quietBaseline);
    const now = performance.now();

    if (volume > 0) {
        if (now - lastSpeechTime >= SPEECH_TIMEOUT_MS) {
            speechStartTime = now;
            speechBuffer = [];
            isRecording = true;

            // UPDATED CODE
            // Always clear the canvas when a new distinct sound starts, 
            // regardless of whether we are in "Freeze/Command" mode or "Live" mode.
            ctx.fillStyle = "#000000";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        lastSpeechTime = now;
    }

    const speechActive = now - lastSpeechTime < SPEECH_TIMEOUT_MS;

    if (speechActive) {
        const midY = canvas.height / 2;
        speechBuffer.push(new Uint8Array(waveArray));

        const elapsed = now - speechStartTime;
        xPos = (elapsed / CANVAS_DURATION_MS) * canvas.width;

        if (xPos < canvas.width) {
            let v = (waveArray[0] - 128) / 128;
            const y = midY + v * midY;

            // NEW: Use Cyan for Commands, Yellow for Phrases
            ctx.fillStyle = isFrozen ? "#00ffff" : "#ffff00"; 
            ctx.fillRect(xPos, y, 2, 2);
        }
    } else {
        if (isRecording) {
            isRecording = false;
            processSpeechBufferUI();
        }
    }

    requestAnimationFrame(drawWaveform);
}


function updateMeter() {
    // Guard: Only stop if training or if frozen and NOT in command mode
    if (isTraining || (isFrozen && (appState !== "WAITING_FOR_COMMAND" || isCommandWaiting))) {
        requestAnimationFrame(drawWaveform); // or updateMeter
        return;
    }

    const rawVolume = getVolume();
    const volume = Math.max(0, rawVolume - quietBaseline);

    meter.style.height = volume + "%";
    percent.textContent = volume + "%";

    if (rawVolume >= 100) {
        meter.classList.add("maxed");
    } else {
        meter.classList.remove("maxed");
    }

    requestAnimationFrame(updateMeter);
}



async function calibrateQuietLevelUI() {

    introModal.style.display = "none";

    loadingModal.querySelector('p').textContent = "Calibrating baseline...";
    loadingModal.style.display = "flex";

    await calibrateQuietLevel();

    loadingModal.style.display = "none";

    updateMeter();

    drawWaveform();
}

function loadOrInitModel(model, inputCount, outputCount) {

    try {

        // 1. ATTEMPT TO LOAD PERSISTED DATA
        // This function will return true if data exists AND matches 134x9 shape.
        const loaded = loadPersistedModel(model, inputCount, outputCount);

        if (loaded) {
            console.log("Persistence: Model restored from storage.");
            statusText.textContent = `Restored model with ${model.samplesHistory.length} samples.`;

            // 2. SYNC THE UI RADIOS
            // Ensure the "Model Mode" radio buttons match the loaded activation (linear/sigmoid/softmax)
            const savedMode = model.activation;
            const radioToSelect = document.querySelector(`input[name="modelMode"][value="${savedMode}"]`);

            if (radioToSelect) {
                radioToSelect.checked = true;
            }

        } else {

            // 3. FALLBACK TO INIT
            // If no save exists (or it's the wrong shape), we start fresh.
            console.log("Persistence: No compatible save found. Initializing fresh.");

            // Note: We don't need resetModel() here because 'model' is
            // empty at page load, so isInitialized is already false.
            initModel(model, inputCount, outputCount, INITIAL_PASSES);

            statusText.textContent = "New model initialized.";
        }

    } catch (err) {

        console.error("Model startup error:", err);

        statusText.textContent =
            `Model Error: ${err.message}`;
    }
}



async function initializeApp() {
    try {
        // Call the clean logic function
        const micData = await startMic();

        // Assign to your global variables
        analyser = micData.analyser;
        sampleRate = micData.sampleRate;
        dataArray = micData.dataArray;
        waveArray = micData.waveArray;
        audio.srcObject = micData.stream;

        // UI Updates
        statusText.textContent = "Microphone connected";

        // Disable Yes/No/Other initially
        setUIState(false);

        // Handle the "Wait for Audio" loop here
        waitForInitialSignal();

    } catch (err) {
        // UI Failure Updates
        statusText.textContent = "Microphone access denied";
        console.error("Mic Error:", err);
    }
}

// Logic to check if the mic is actually sending data before showing the modal
function waitForInitialSignal() {
    const volume = getUncalibratedVolume();

    if (volume > 0) {
        introModal.style.display = "flex";
    } else {
        requestAnimationFrame(waitForInitialSignal);
    }
}

function updateFeatureDisplay(totalLength, quietMoments, intervalResults) {
    // UI Header
    let html = `<div>total length: ${totalLength}s</div>`;
    html += `<div>quiet moments: ${quietMoments}</div>`;

    // Visual Composition: 2x2 layout per interval [cite: 137, 138]
    intervalResults.forEach((r, i) => {
        const n = i + 1;
        html += `
            <div style="grid-column: span 2; margin-top:8px; color:#60a5fa; font-weight:bold;">
                Interval #${n}
            </div>
            <div>max peak: ${r.maxPeak.toFixed(4)}</div>
            <div>>50% peak: ${r.count50}</div>
            <div>>40% peak: ${r.count40}</div>
            <div>>30% peak: ${r.count30}</div>
            <div>>20% peak: ${r.count20}</div>
            <div>>10% peak: ${r.count10}</div>
            <div>>8% peak: ${r.count8}</div>
            <div>>5% peak: ${r.count5}</div>
            <div>>3% peak: ${r.count3}</div>
            <div>>quiet level: ${r.countAboveQuiet}</div>
            <div>zero crossings: ${r.zeroCrossings}</div>
        `;
    });

    featuresArea.innerHTML = html;
    featuresArea.scrollTop = 0;
}

function processSpeechBufferUI() {
    const result = processSpeechBuffer({
        speechBuffer: [...speechBuffer],
        sampleRate,
        quietBaseline,
        speechStartTime,
        speechTimeoutMs: SPEECH_TIMEOUT_MS
    });

    if (!result) return;

    const { features, quietMoments, intervalResults, totalLength } = result;
    latestInputFeatures = features;

    // --- NEW LOGIC FOR COMMAND PREDICTION ---
    if (isFrozen && appState === "WAITING_FOR_COMMAND" && !isTraining && !isCommandWaiting) {
        try {
            isCommandWaiting = true; 
            const cmdResult = predict(commandModel, latestInputFeatures);
            const scores = cmdResult.output;
            const topCmdIndex = scores.indexOf(Math.max(...scores));

            const cmdButtons = document.querySelectorAll('.cmd-btn');
            const phrase = cmdButtons[topCmdIndex].dataset.phrase;

            // NEW: Update the Yes/No/Other shadings
            updatePredictionButtons(cmdButtons, scores);

            speak(phrase);
            statusText.textContent = `Command Guess: ${phrase}`;
        } catch (err) {
            console.error("Command prediction failed:", err);
            isCommandWaiting = false; 
        }
    } else if (!isFrozen) {
        statusText.textContent = "Capture Ready - Hit 'Freeze' to Predict/Train";
    }

    updateFeatureDisplay(totalLength, quietMoments, intervalResults);
}



/**
 * Update button shading based on prediction values (0.0 to 1.0)
 * Works for both .train-btn and .cmd-btn
 */
function updatePredictionButtons(buttons, scores) {
    buttons.forEach((btn, i) => {
        const score = scores[i] || 0;

        // Remove existing intensity classes but keep base classes (like .cmd-yes)
        btn.classList.remove('pred-0', 'pred-1', 'pred-2', 'pred-3', 'pred-4', 'pred-5');

        // Apply class based on score threshold
        if (score <= 0.10) btn.classList.add('pred-0');
        else if (score <= 0.30) btn.classList.add('pred-1');
        else if (score <= 0.50) btn.classList.add('pred-2');
        else if (score <= 0.70) btn.classList.add('pred-3');
        else if (score <= 0.90) btn.classList.add('pred-4');
        else btn.classList.add('pred-5');
    });
}

function unfreezeUI() {
    isFrozen = false;
    freezeBtn.classList.remove("active");
    freezeBtn.textContent = "Freeze";
    console.log("UI Unfrozen: Returning to live listening.");
}

function setUIState(frozen) {
    const speechButtons = document.querySelectorAll('.train-btn');
    const commandButtons = document.querySelectorAll('.cmd-btn');

    if (frozen) {
        // Phrase captured: Disable speech buttons & Cal/Freeze, Enable Yes/No
        speechButtons.forEach(b => b.disabled = true);
        commandButtons.forEach(b => b.disabled = false);
        calBtn.disabled = true;
    } else {
        // Live Mode: Enable speech buttons & Cal/Freeze, Disable Yes/No
        speechButtons.forEach(b => b.disabled = false);
        commandButtons.forEach(b => b.disabled = true);
        calBtn.disabled = false;
        pendingPhraseFeatures = null;
    }
}

function safePredict() {

    if (isTraining || !latestInputFeatures) {
        return null;
    }

    return predict(speechModel, latestInputFeatures);
}
//-------------------------------
// event handlers
//-------------------------------

trainButtons.forEach((button, index) => {
    button.addEventListener('click', async () => {

        const featuresToTrain = pendingPhraseFeatures || latestInputFeatures;
        if (!isFrozen || !featuresToTrain || isTraining) return;

        // NEW: Ensure we aren't mid-prediction before starting training
        // This gives the model a 200ms window to finish any pending 'predict' calls
        isTraining = true;

        // Disable radio buttons so hover effects stop
        document.querySelectorAll('input[name="modelMode"]').forEach(r => r.disabled = true);

        loadingModal.querySelector('p').textContent = "Training Neural Network...";
        loadingModal.style.display = "flex";

        // force paint and wait for any microtasks to clear
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
        // INCREASED: slightly longer delay to ensure the 'Freeze' prediction is 100% finished
        await new Promise(resolve => setTimeout(resolve, 250)); 

        try {
            // 2. Execute training
            speechModel.latestInputFeatures = [...featuresToTrain];
            await trainModel(speechModel, index);
            
            // Give the CPU a tiny moment to breathe after heavy math
            await new Promise(resolve => setTimeout(resolve, 100));

            // 3. Predict AFTER training is confirmed finished
            // MINIMAL FIX: Predict on the features we just trained to show updated UI
            const result = predict(speechModel, featuresToTrain);
            if (result && result.output) {
                updatePredictionButtons(trainButtons, result.output);
            }

            const stats = evaluateAccuracy(speechModel);
            statusText.textContent = `Accuracy: ${stats.accuracy.toFixed(1)}% (${stats.samples} samples)`;

        } catch (err) {
            console.error("Training failed:", err);
            // Specifically handle the "Busy" error by suggesting a retry
            if (err.message.includes("busy")) {
                statusText.textContent = "Model was busy. Please try clicking again.";
            } else {
                statusText.textContent = "Training Error: " + err.message;
            }
        } finally {
            isTraining = false;
            // MINIMAL FIX: Use closeHandshake to reset UI state and clear pending buffers
            closeHandshake();
            loadingModal.style.display = "none";
            // Re-enable radio buttons
            document.querySelectorAll('input[name="modelMode"]').forEach(r => r.disabled = false);
        }
    });
});

// Listeners for Yes / No / Other
document.querySelectorAll('.cmd-btn').forEach((button, index) => {
    button.addEventListener('click', async () => {
        if (!isFrozen || !latestInputFeatures || isTraining) return;

        isTraining = true;
        loadingModal.querySelector('p').textContent = "Learning command...";
        loadingModal.style.display = "flex";

        try {
            // 1. Train the command model (0=Yes, 1=No, 2=Other)
            // Use the sound currently in the buffer (the "Yes" or "No" command)
            commandModel.latestInputFeatures = [...latestInputFeatures];
            await trainModel(commandModel, index);

            // 2. Logic Branching for Speech Model
            if (index === 0 && pendingPhraseFeatures && topGuessIndex !== -1) {
                // User clicked YES: Train the SPEECH model using the PENDING features
                speechModel.latestInputFeatures = [...pendingPhraseFeatures];
                await trainModel(speechModel, topGuessIndex);

                statusText.textContent = "Confirmed! Both models learned.";
                closeHandshake(); 
            } 
            else if (index === 1) {
                // 1. Just learned "No" command (already trained at top of try block)
                statusText.textContent = "Command 'No' learned. Please click the CORRECT speech button below.";
    
                updatePredictionButtons(trainButtons, new Array(speechOutputCount).fill(0));

                // 2. Pivot UI: Allow manual speech training
                const speechButtons = document.querySelectorAll('.train-btn');
                const commandButtons = document.querySelectorAll('.cmd-btn');
    
                speechButtons.forEach(b => b.disabled = false);
                commandButtons.forEach(b => b.disabled = true);
    
                // 3. IMPORTANT: We do NOT close handshake yet. 
                // We stay frozen and keep 'pendingPhraseFeatures' alive.
                return; // Exit here so closeHandshake() isn't called by mistake
            }
            else if (index === 2) {
                // User clicked OTHER: Command "Other" is already trained above
                statusText.textContent = "Learned 'Other'. Please say Yes or No.";
                isCommandWaiting = false; // Stay frozen, but allow another voice command
            }

        } catch (err) {
            console.error("Training failed:", err);
            statusText.textContent = "Error: " + err.message;
        } finally {
            isTraining = false;
            loadingModal.style.display = "none";
        }
    });
});

// Helper to clean up after a successful Handshake or a No
function closeHandshake() {
    isCommandWaiting = false; // Essential for drawWaveform to start again
    isFrozen = false;         // Ensure the global flag is down
    unfreezeUI();             // Cleans up the button text/classes
    setUIState(false);        // Re-enables the correct buttons
    appState = "LISTENING_PHRASE";
    pendingPhraseFeatures = null;
    topGuessIndex = -1;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

okButton.addEventListener(
    "click",
    calibrateQuietLevelUI
);

calBtn.addEventListener(
    "click",
    calibrateQuietLevelUI
);

freezeBtn.addEventListener("click", () => {
    if (isTraining) return;

    isFrozen = !isFrozen;
    freezeBtn.classList.toggle("active", isFrozen);
    freezeBtn.textContent = isFrozen ? "Unfreeze" : "Freeze";

    // Handle Button States and Pivot Logic
    setUIState(isFrozen);

    if (isFrozen) {
        if (latestInputFeatures) {
            pendingPhraseFeatures = [...latestInputFeatures];
            appState = "WAITING_FOR_COMMAND"; // Update the state

            try {
                const result = predict(speechModel, pendingPhraseFeatures);
                const scores = result.output;

                // SAVE the index of the winner
                topGuessIndex = scores.indexOf(Math.max(...scores));

                const phrase = trainButtons[topGuessIndex].dataset.phrase;
                speak(phrase);

                statusText.textContent = `Did you say: ${phrase}? (Click Yes/No)`;
                updatePredictionButtons(trainButtons, scores);

            } catch (err) {
                statusText.textContent = `Prediction Error: ${err.message}`;
            }
        } else {
            closeHandshake(); 
            statusText.textContent = "Live - Listening...";
        }
    } else {
            closeHandshake(); 
            statusText.textContent = "Live - Listening...";
    }
});

// Listeners for Model Mode Radio Buttons
document.querySelectorAll('input[name="modelMode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {

        if (isTraining) {
            console.warn("Cannot change mode during training.");
            return;
        }

        const selectedMode = e.target.value;

        try {

            // Use the public helper from neural.network.model.js
            setModelActivation(speechModel, selectedMode);

            console.log("Model Mode Changed to:", selectedMode);

            statusText.textContent =
                `Model mode changed to: ${selectedMode}`;

        } catch (err) {

            console.error("Activation change error:", err);

            statusText.textContent =
                `Activation Error: ${err.message}`;
        }
    });
});
//-------------------------------
// execute now
//-------------------------------

(async () => {
  await loadOrInitModel(commandModel, commandInputCount, commandOutputCount);
  await loadOrInitModel(speechModel, speechInputCount, speechOutputCount);
  await initializeApp();
})();


