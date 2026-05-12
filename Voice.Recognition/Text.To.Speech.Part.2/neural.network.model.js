/**
 * HOME-GROWN NEURAL NETWORK (Procedural Version)
 * Use: A standalone helper for analyzing input features and learning from user labels.
 */

const STORAGE_KEY = "voice_recognition";

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

// 1. The Data Structure
// This object holds everything. It starts empty and gets filled by initModel().
let model = {
    inputCount: 0,
    outputCount: 0,
    epochs: 1,
    learningRate: LINEAR_LR, // This is your baseLR
    decayRate: 0.95,     // How much to slow down each epoch
    activation: 'linear', // Added: 'linear', 'sigmoid', or 'softmax'
    weights: [],
    biases: [],
    latestInputFeatures: null,
    samplesHistory: [],
    isInitialized: false // NEW: The source of truth for the model state
};

/**
 * Switch Activation Mode
 * Updates the model's internal setting so the next predict() or updateModel()
 * call uses the new logic (linear, sigmoid, or softmax).
 */
function setModelActivation(m, mode) {

    if (validModes.hasOwnProperty(mode)) {
        m.activation = mode;

        // Update the model's learning rate to the specific base rate for this mode
        m.learningRate = baseLRs[mode];

        console.log(`Model activation switched to: ${mode}`);
        console.log(`Learning rate adjusted to: ${m.learningRate}`);
    } else {
        console.error(`Invalid activation mode: ${mode}. Use: ${Object.keys(validModes).join(', ')}`);
    }
}

/**
 * Evaluate Accuracy
 * Checks all samples in history and returns the percentage of correct guesses.
 */
function evaluateAccuracy(m) {
    if (m.samplesHistory.length === 0) return 0;

    let correctCount = 0;

    m.samplesHistory.forEach(sample => {
        const { output } = predict(m, sample.input);

        // Find the index of the highest value (the "Winner")
        let winningIndex = output.indexOf(Math.max(...output));

        if (winningIndex === sample.label) {
            correctCount++;
        }
    });

    return (correctCount / m.samplesHistory.length) * 100;
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
function setModelPasses(m, passes) { m.epochs = passes; }

/**
 * 5. Reset Weights
 * Keeps the structure (inputs/outputs) but clears the "memory" back to zero.
 */
function resetWeights(m) {
    for (let i = 0; i < m.outputCount; i++) {
        m.weights[i].fill(0);
    }
    m.biases.fill(0);
}

/**
 * 6. Predict (Forward Pass)
 * Calculates raw output values based on current weights.
 * Formula: (Input * Weight) + Bias
 */
function predict(m, inputFeatures) {
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
 * 7. The Engine: Update Model (Mathematical Step)
 * Performs a single weight adjustment for ONE sample.
 * THIS IS NOT CALLED BY THE CALLER (private).
 * ONLY CALLED BY trainModel
 */
function updateModel(m, inputFeatures, correctLabelIndex, currentLR) {
    // Access the .output property from the new predict object
    let { output } = predict(m, inputFeatures);

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
        console.error("Training failed: No recent input features.");
        return;
    }

    // 2. Double-check feature length before adding to history
    if (m.latestInputFeatures.length !== m.inputCount) {
        throw new Error("Feature Mismatch: The captured input features do not match the model's input count.");
    }

    // 1. Safety check: Do we have a recent sound to label?
    if (m.latestInputFeatures === null) {
        console.error("Training failed: No recent input features to label. Speak first!");
        return;
    }

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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savePacket));
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
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return false;

    try {
        const data = JSON.parse(saved);

        // PROTECTION: Check if the saved model "shape" matches current UI
        // If the number of inputs or buttons changed, the old weights are invalid.
        if (data.weights.length !== expectedOutputs ||
            data.weights[0].length !== expectedInputs) {
            console.warn("Persisted model shape mismatch. Ignoring saved data.");
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
        return true;
    } catch (e) {
        console.error("Failed to parse persisted model:", e);
        return false;
    }
}

function resetModel(m) {
    m.inputCount = 0;
    m.outputCount = 0;
    m.epochs = 1;
    m.learningRate = LINEAR_LR;
    m.activation = 'linear';
    m.weights = [];
    m.biases = [];
    m.latestInputFeatures = null;
    m.samplesHistory = [];

    m.isInitialized = false; // UNLOCK THE MODEL

    localStorage.removeItem(STORAGE_KEY);
    console.log("Model fully reset and localStorage cleared.");
}
