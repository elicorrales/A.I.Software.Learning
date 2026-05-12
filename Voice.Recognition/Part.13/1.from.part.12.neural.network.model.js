/**
 * HOME-GROWN NEURAL NETWORK (Procedural Version)
 * Use: A standalone helper for analyzing input features and learning from user labels.
 */

// 1. The Data Structure
// This object holds everything. It starts empty and gets filled by initModel().
let model = {
    inputCount: 0,
    outputCount: 0,
    epochs: 1,
    learningRate: 0.001, // This is your baseLR
    decayRate: 0.95,     // How much to slow down each epoch
    weights: [],
    biases: [],
    latestInputFeatures: null,
    samplesHistory: []
};

/**
 * 2. Initialize or Reset
 * Sets up the weights and biases to zero.
 * Use this to start fresh or change the shape of the network.
 */
function initModel(m, inputs, outputs, passes, lr = 0.001, decay = 0.95) {
    m.inputCount = inputs;
    m.outputCount = outputs;
    m.epochs = passes;
    m.learningRate = lr;
    m.decayRate = decay;
    m.samplesHistory = [];

    // Initialize biases to zero (one for every output)
    m.biases = new Array(outputs).fill(0);

    // Initialize weights to zero
    // This creates a grid: rows = outputs, columns = inputs
    m.weights = [];
    for (let i = 0; i < outputs; i++) {
        m.weights[i] = new Array(inputs).fill(0);
    }
    console.log("Model Initialized: " + inputs + " inputs, " + outputs + " outputs.");
}

/**
 * 3. Change Training Passes
 * Allows the user to change the number of epochs without losing learned data.
 */
function setModelPasses(m, passes) { m.epochs = passes; }

/**
 * 4. Reset Weights
 * Keeps the structure (inputs/outputs) but clears the "memory" back to zero.
 */
function resetWeights(m) {
    for (let i = 0; i < m.outputCount; i++) {
        m.weights[i].fill(0);
    }
    m.biases.fill(0);
}

/**
 * 5. Predict (Forward Pass)
 * Calculates raw output values based on current weights.
 * Formula: (Input * Weight) + Bias
 */
function predict(m, inputFeatures) {
    if (inputFeatures.length !== m.inputCount) {
        throw new Error(`Input feature length (${inputFeatures.length}) does not match model inputCount (${m.inputCount})`);
    }
    m.latestInputFeatures = inputFeatures;

    let results = new Array(m.outputCount).fill(0);

    for (let i = 0; i < m.outputCount; i++) {
        let sum = 0;
        for (let j = 0; j < m.inputCount; j++) {
            // Multiply input by weight and add to total
            sum += inputFeatures[j] * m.weights[i][j];
        }
        // Add the bias at the end
        results[i] = sum + m.biases[i];
    }
    return results;
}

/**
 * 6. The Engine: Update Model (Mathematical Step)
 * Performs a single weight adjustment for ONE sample.
 * THIS IS NOT CALLED BY THE CALLER (private).
 * ONLY CALLED BY trainModel
 */
function updateModel(m, inputFeatures, correctLabelIndex, currentLR) {
    let guesses = predict(m, inputFeatures);

    let targets = new Array(m.outputCount).fill(0);
    targets[correctLabelIndex] = 1;

    // A tiny decay rate to keep weights from "over-growing"
    const weightDecay = 0.0001; 

    for (let i = 0; i < m.outputCount; i++) {
        let error = targets[i] - guesses[i];

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
 * 7. The Orchestrator: Train Model
 * @param {Object} m - The model object
 * @param {number} correctLabelIndex - The index of the correct button/class
 */
async function trainModel(m, correctLabelIndex, options = {}) {
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
}
