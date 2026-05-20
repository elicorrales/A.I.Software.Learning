/**
 * HOME-GROWN NEURAL NETWORK (Procedural Version)
 * Use: A standalone helper for analyzing input features and learning from user labels.
 */

const STORAGE_KEY_SUFFIX = "_neural_network_model";

const LINEAR_LR = 0.0001;
const SIGMOD_LR = 0.02;
const SOFTMX_LR = 0.01;

const baseLRs = {
    linear: LINEAR_LR,  // Much smaller to prevent "runaway"
    sigmoid: SIGMOD_LR,   // Larger to push through the "flat" plateaus
    softmax: SOFTMX_LR
};
// Add this near the other constants at the top
const validModes = { linear: true, sigmoid: true, softmax: true };
let currentLR = baseLRs["linear"]; // Initial default

function createModel(modelName = "default") {
    return {
        storageKey: `${modelName}_${STORAGE_KEY_SUFFIX}`,
        currentLR: baseLRs["linear"], //initial default
        inputCount: 0,
        outputCount: 0,
        epochs: 1,
        learningRate: LINEAR_LR,
        decayRate: 0.95,
        activation: 'linear',
        weights: [],
        biases: [],
        latestInputFeatures: null,
        samplesHistory: [],
        isInitialized: false,
        isBusy: false,
        lastPrediction: null,
        liveCorrectPredictions: 0,
        liveTotalPredictions: 0
    };
}


/**
 * Switch Activation Mode
 * Updates the model's internal setting so the next predict() or updateModel()
 * call uses the new logic (linear, sigmoid, or softmax).
 */
function setModelActivation(m, mode) {
    if (m.isBusy) throw new Error("Model is busy, try again");
    m.isBusy = true;
    if (validModes.hasOwnProperty(mode)) {
        m.activation = mode;

        // Update the model's learning rate to the specific base rate for this mode
        m.learningRate = baseLRs[mode];

        console.log(`Model activation switched to: ${mode}`);
        console.log(`Learning rate adjusted to: ${m.learningRate}`);
    } else {
        console.error(`Invalid activation mode: ${mode}. Use: ${Object.keys(validModes).join(', ')}`);
    }
    m.isBusy = false;
}

/**
 * Current Stats
 * Returns a deep look at the model's health and training data distribution.
 */
function currentStats(m) {
    if (m.isBusy) throw new Error("Model is busy, try again");
    m.isBusy = true;

    const totalSamples = m.samplesHistory.length;

    // Initialize the results object
    const stats = {
        accuracy: 0,
        liveAccuracy: m.liveTotalPredictions > 0 ? (m.liveCorrectPredictions / m.liveTotalPredictions) * 100 : 0,
        liveTotalPredictions: m.liveTotalPredictions,
        totalSamples: totalSamples,
        activationMode: m.activation,
        // This will store counts like { "0": 5, "1": 12 }
        samplesPerOutput: {},
        isBalanced: false,
        // Measures the average internal spread/variance per acoustic cluster
        clusterVariancePerOutput: {}
    };

    // FIX 1: Pre-initialize ALL possible output categories to 0 based on outputCount
    for (let i = 0; i < m.outputCount; i++) {
        stats.samplesPerOutput[i] = 0;
    }

    if (totalSamples === 0) {
        m.isBusy = false;
        return stats;
    }

    let correctCount = 0;
    let classFeaturesSum = {};

    // Loop once through history to gather all data
    m.samplesHistory.forEach(sample => {
        // 1. Calculate accuracy (Internal prediction)
        const { output } = _predict(m, sample.input);
        const winningIndex = output.indexOf(Math.max(...output));
        if (winningIndex === sample.label) {
            correctCount++;
        }

        // 2. Count samples per label
        if (!classFeaturesSum[sample.label]) {
            classFeaturesSum[sample.label] = new Array(m.inputCount).fill(0);
        }
        stats.samplesPerOutput[sample.label]++;

        // Accumulate features for centroid calculations
        for (let j = 0; j < m.inputCount; j++) {
            classFeaturesSum[sample.label][j] += sample.input[j];
        }
    });

    stats.accuracy = (correctCount / totalSamples) * 100;

    // 3. Check balance across ALL indices explicitly now that missing slots are filled with 0
    const counts = Object.values(stats.samplesPerOutput); // Returns [4, 0, 0] instead of [4]
    const max = Math.max(...counts);
    const min = Math.min(...counts);
    stats.isBalanced = (max - min) < (totalSamples * 0.2); // Balanced if difference is < 20%

    // FIX 2: Declare classCenters HERE before any loops use it!
    let classCenters = {};

    // Calculate cluster centers (centroids)
    Object.keys(stats.samplesPerOutput).forEach(label => {
        const count = stats.samplesPerOutput[label];
        // Only compute profiles for classes that actually have historical data
        if (count > 0 && classFeaturesSum[label]) {
            classCenters[label] = classFeaturesSum[label].map(sum => sum / count);
            stats.clusterVariancePerOutput[label] = 0;
        }
    });

    // Calculate mean internal distance (variance) for each labeled cluster
    m.samplesHistory.forEach(sample => {
        const center = classCenters[sample.label];
        if (!center) return; // Ignore categories with zero entries

        let sumOfSquares = 0;
        for (let j = 0; j < m.inputCount; j++) {
            let diff = sample.input[j] - center[j];
            sumOfSquares += diff * diff;
        }
        stats.clusterVariancePerOutput[sample.label] += Math.sqrt(sumOfSquares);
    });

    // Average the distance accumulation by total class sample size
    Object.keys(stats.clusterVariancePerOutput).forEach(label => {
        if (stats.samplesPerOutput[label] > 0) {
            stats.clusterVariancePerOutput[label] /= stats.samplesPerOutput[label];
        }
    });

    m.isBusy = false;
    return stats;
}

/**
 * 2. Initialize or Reset
 * Sets up the weights and biases to zero.
 * Use this to start fresh or change the shape of the network.
 */
function initModel(m, inputs, outputs, passes, lr = null, decay = 0.95, activation = 'linear') {
    if (m.isInitialized) {
        throw new Error("Model is already initialized. You must call resetModel() before initializing a new one.");
    }
    if (m.isBusy) throw new Error("Model is busy, try again");
    m.isBusy = true;

    m.inputCount = inputs;
    m.outputCount = outputs;
    m.epochs = passes;
    m.learningRate = lr;
    m.decayRate = decay;
    m.activation = activation;
    m.samplesHistory = [];

    // 1. Validate and set Activation
    const allowedModes = Object.keys(baseLRs); // ['linear', 'sigmoid', 'softmax']
    m.activation = allowedModes.includes(activation) ? activation : 'linear';

    // 2. Set Learning Rate
    // If user provided a specific number, use it.
    // Otherwise, use the map. If the map fails, use the linear constant.
    if (lr !== null) {
        m.learningRate = lr;
    } else {
        m.learningRate = baseLRs[m.activation] || LINEAR_LR;
    }



    // Initialize biases to zero (one for every output)
    m.biases = new Array(outputs).fill(0);

    // Initialize weights to zero
    // This creates a grid: rows = outputs, columns = inputs
    m.weights = [];
    for (let i = 0; i < outputs; i++) {
        m.weights[i] = new Array(inputs).fill(0);
    }

    m.isInitialized = true;
    m.isBusy = false;

    console.log("Model Initialized: " + inputs + " inputs, " + outputs + " outputs, mode: " + activation);
}

/**
 * 3. Activation Function Dispatcher
 * The central engine for squashing output values based on model settings.
 */
function applyActivation(logits, mode = 'linear') {
    if (mode === 'sigmoid') {
        return logits.map(x => {
            // Stability: if x is very negative, return 0 instead of crashing
            if (x < -709) return 0;
            // Stability: if x is very positive, return 1
            if (x > 709) return 1;
            return 1 / (1 + Math.exp(-x));
        });
    }
    if (mode === 'softmax') {
        const maxLogit = Math.max(...logits);
        // Your existing "maxLogit" subtraction prevents overflow
        const exps = logits.map(x => Math.exp(x - maxLogit));
        const sumExps = exps.reduce((a, b) => a + b, 0);

        // Safety: check for zero division
        if (sumExps === 0) return new Array(logits.length).fill(1 / logits.length);

        return exps.map(x => x / sumExps);
    }
    return logits; // Default linear
}

/**
 * 4. Change Training Passes
 * Allows the user to change the number of epochs without losing learned data.
 */
function setModelPasses(m, passes) {
    if (m.isBusy) throw new Error("Model is busy, try again");
    m.isBusy = true;
    m.epochs = passes;
    m.isBusy = false;
}

/**
 * 5. Reset Weights
 * Keeps the structure (inputs/outputs) but clears the "memory" back to zero.
 */
function resetWeights(m) {
    if (m.isBusy) throw new Error("Model is busy, try again");
    m.isBusy = true;

    for (let i = 0; i < m.outputCount; i++) {
        m.weights[i].fill(0);
    }
    m.biases.fill(0);
    m.isBusy = false;
}



/**
 * 6. Predict (Forward Pass)
 * Calculates raw output values based on current weights.
 * Formula: (Input * Weight) + Bias
 */
function _predict(m, inputFeatures) {
    // 1. Ensure model is actually loaded/inited
    if (!m.isInitialized) {
        throw new Error("Model not ready: Call loadPersistedModel or initModel first.");
    }

    // 2. Validate input length against the trained weight matrix
    if (inputFeatures.length !== m.inputCount) {
        throw new Error(`Input Mismatch: Model expects ${m.inputCount} features, but received ${inputFeatures.length}.`);
    }

    if (inputFeatures.length !== m.inputCount) {
        throw new Error(`Input feature length (${inputFeatures.length}) does not match model inputCount (${m.inputCount})`);
    }


    m.latestInputFeatures = inputFeatures;

    let logits = new Array(m.outputCount).fill(0);

    for (let i = 0; i < m.outputCount; i++) {
        let sum = 0;
        for (let j = 0; j < m.inputCount; j++) {
            // Multiply input by weight and add to total
            sum += inputFeatures[j] * m.weights[i][j];
        }
        logits[i] = sum + m.biases[i];
    }

    // Return an object instead of just the activated array
    return {
        logits: logits,
        output: applyActivation(logits, m.activation)
    };
}

/**
 * Public Predict
 * The version used by the UI that respects the "Busy" lock.
 */
function predict(m, inputFeatures) {
    if (m.isBusy) throw new Error("Model is busy, try again");
    m.isBusy = true;

    try {
        const prediction = _predict(m, inputFeatures);

        const winningIndex = prediction.output.indexOf(Math.max(...prediction.output));

        m.lastPrediction = {
            predictedLabel: winningIndex,
        };

        // Calculate raw real-time acoustic distances across existing target clusters
        const distances = {};
        for (let i = 0; i < m.outputCount; i++) {
            distances[i] = getAcousticDistance(m, inputFeatures, i);
        }

        prediction.acousticDistances = distances;
        return prediction;
    } finally {
        m.isBusy = false; // Ensures the lock is released even if _predict fails
    }
}

/**
 * 7. The Engine: Update Model (Mathematical Step)
 * Performs a single weight adjustment for ONE sample.
 * THIS IS NOT CALLED BY THE CALLER (private).
 * ONLY CALLED BY trainModel
 */
function updateModel(m, inputFeatures, correctLabelIndex, currentLR) {
    // Access the .output property from the new predict object
    let { output } = _predict(m, inputFeatures);

    let targets = new Array(m.outputCount).fill(0);
    targets[correctLabelIndex] = 1;

    // A tiny decay rate to keep weights from "over-growing"
    const weightDecay = 0.0001;

    for (let i = 0; i < m.outputCount; i++) {
        let error = targets[i] - output[i]; // Use output here

        for (let j = 0; j < m.inputCount; j++) {
            const inputVal = inputFeatures[j];

            // If the feature is present/active, strengthen the connection
            if (Math.abs(inputVal) > 0.01) {
                m.weights[i][j] += error * inputVal * currentLR;
            } else {
                // Selective Weight Decay:
                // If the feature is silent, let the weight "evaporate" slightly.
                // This keeps unused parts of the network clean.
                m.weights[i][j] *= (1 - weightDecay);
            }
        }
        m.biases[i] += error * currentLR;
    }
}

/**
 * 8. The Orchestrator: Train Model
 * @param {Object} m - The model object
 * @param {number} correctLabelIndex - The index of the correct button/class
 */
async function trainModel(m, correctLabelIndex, options = {}) {
    if (!m.isInitialized) {
        throw new Error("Model not ready: Cannot train an uninitialized model.");
    }

    // 1. Validate the button index against the model's output layer
    if (correctLabelIndex < 0 || correctLabelIndex >= m.outputCount) {
        throw new Error(`Output Mismatch: Training index ${correctLabelIndex} is out of bounds for a model with ${m.outputCount} outputs.`);
    }

    if (m.latestInputFeatures === null) {
        throw new Error("Training failed: No recent input features.");
        return;
    }

    // 2. Double-check feature length before adding to history
    if (m.latestInputFeatures.length !== m.inputCount) {
        throw new Error("Feature Mismatch: The captured input features do not match the model's input count.");
    }

    // 1. Safety check: Do we have a recent sound to label?
    if (m.latestInputFeatures === null) {
        throw new Error("Training failed: No recent input features to label. Speak first!");
    }

    if (m.isBusy) throw new Error("Model is busy, try again");
    m.isBusy = true;

    // --- NEW: LOG LIVE ACCURACY METRICS BEFORE WEIGHT ADJUSTMENTS ---
    if (m.lastPrediction) {
        m.liveTotalPredictions++;

        if (m.lastPrediction.predictedLabel === correctLabelIndex) {
            m.liveCorrectPredictions++;
        }

        // CRITICAL CAVEAT FIX: Clear it out immediately!
        // This ensures this specific prediction is never accidentally counted twice
        // if trainModel() is programmatically called again for the same cycle.
        m.lastPrediction = null;
    }
    // ----------------------------------------------------------------

    // 2. Add the "Truth" to our history
    // We pair the most recent features with the label the user just provided
    m.samplesHistory.push({
        input: [...m.latestInputFeatures],
        label: correctLabelIndex
    });

    const { onStep = null, onEpoch = null } = options;
    let currentLR = m.learningRate;

    // 3. The Learning Loop (All samples, including the one we just added)
    for (let p = 0; p < m.epochs; p++) {
        for (let s = 0; s < m.samplesHistory.length; s++) {
            const sample = m.samplesHistory[s];

            // Update weights/biases based on this sample
            updateModel(m, sample.input, sample.label, currentLR);

            if (onStep && s % 10 === 0) await onStep(sample.input);
        }

        // Apply decay
        currentLR *= m.decayRate;
        if (onEpoch) onEpoch(p + 1);
    }

    console.log(`Training complete. History size: ${m.samplesHistory.length} samples.`);

    // Persist after training finishes
    const savePacket = {
        weights: m.weights,
        biases: m.biases,
        samples: m.samplesHistory,
        activation: m.activation
    };
    localStorage.setItem(m.storageKey, JSON.stringify(savePacket));
    m.isBusy = false;
    console.log("Model and samples saved to localStorage.");
}

/**
 * Persistence: Load
 * Attempts to restore model state from localStorage.
 * Validates that the saved shape matches the expected inputs/outputs.
 */
function loadPersistedModel(m, expectedInputs, expectedOutputs) {
    if (m.isInitialized) {
        throw new Error("Model is already initialized. Cannot load persistence over an active model.");
    }

    if (m.isBusy) throw new Error("Model is busy, try again");
    m.isBusy = true;

    const saved = localStorage.getItem(m.storageKey);
    if (!saved) { m.isBusy = false; return false; }

    try {
        const data = JSON.parse(saved);

        // PROTECTION: Check if the saved model "shape" matches current UI
        // If the number of inputs or buttons changed, the old weights are invalid.
        if (data.weights.length !== expectedOutputs ||
            data.weights[0].length !== expectedInputs) {
            console.warn("Persisted model shape mismatch. Ignoring saved data.");
            m.isBusy = false;
            return false;
        }

        // Restore the data
        m.inputCount = expectedInputs;
        m.outputCount = expectedOutputs;
        m.weights = data.weights;
        m.biases = data.biases;
        m.samplesHistory = data.samples || [];
        m.activation = data.activation || 'linear';
        m.isInitialized = true;

        console.log(`Model Restored: ${m.samplesHistory.length} samples loaded.`);
        m.isBusy = false;
        return true;
    } catch (e) {
        console.error("Failed to parse persisted model:", e);
        m.isBusy = false;
        return false;
    }
}

function resetModel(m) {
    if (m.isBusy) throw new Error("Model is busy, try again");
    m.isBusy = true;

    m.inputCount = 0;
    m.outputCount = 0;
    m.epochs = 1;
    m.learningRate = LINEAR_LR;
    m.activation = 'linear';
    m.weights = [];
    m.biases = [];
    m.latestInputFeatures = null;
    m.samplesHistory = [];
    m.lastPrediction = null;
    m.liveCorrectPredictions = 0;
    m.liveTotalPredictions = 0;

    m.isInitialized = false; // UNLOCK THE MODEL

    localStorage.removeItem(m.storageKey);
    console.log("Model fully reset and localStorage cleared.");
    m.isBusy = false;
}

/**
 * Acoustic Distance Utility
 * Measures the Euclidean distance between a live input vector and the average
 * (centroid) profile of a targeted historical class label.
 */
function getAcousticDistance(m, liveInput, targetLabel) {
    const classSamples = m.samplesHistory.filter(s => s.label === targetLabel);
    if (classSamples.length === 0) return 0;

    let classCentroid = new Array(m.inputCount).fill(0);
    for (let j = 0; j < m.inputCount; j++) {
        let featureSum = 0;
        classSamples.forEach(sample => featureSum += sample.input[j]);
        classCentroid[j] = featureSum / classSamples.length;
    }

    let sumOfSquares = 0;
    for (let j = 0; j < m.inputCount; j++) {
        let diff = liveInput[j] - classCentroid[j];
        sumOfSquares += diff * diff;
    }
    return Math.sqrt(sumOfSquares);
}
