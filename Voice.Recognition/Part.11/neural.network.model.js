/**
 * HOME-GROWN NEURAL NETWORK (Procedural Version)
 * Use: A helper for analyzing input features and learning from user labels.
 */

// 1. The Data Structure
// This object holds everything. It starts empty and gets filled by initModel().
let model = {
    inputCount: 0,
    outputCount: 0,
    epochs: 1,
    learningRate: 0.01,
    weights: [], 
    biases: []   
};

/**
 * 2. Initialize or Reset
 * Sets up the weights and biases to zero. 
 * Use this to start fresh or change the shape of the network.
 */
function initModel(m, inputs, outputs, passes) {
    m.inputCount = inputs;
    m.outputCount = outputs;
    m.epochs = passes;

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
function setModelPasses(m, passes) {
    m.epochs = passes;
}

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
 * 6. Train (Supervised Learning)
 * Adjusts weights based on the user-selected "correct" label.
 * correctLabelIndex is the ID of the output the user clicked.
 */
function train(m, inputFeatures, correctLabelIndex) {
    for (let p = 0; p < m.epochs; p++) {
        // Step A: See what the model thinks right now
        let currentGuesses = predict(m, inputFeatures);

        // Step B: Create the "Target" (1 for the correct choice, 0 for others)
        let targets = new Array(m.outputCount).fill(0);
        targets[correctLabelIndex] = 1;

        // Step C: Calculate error and adjust
        for (let i = 0; i < m.outputCount; i++) {
            // Difference between where we are and where we want to be
            let error = targets[i] - currentGuesses[i];

            // Update every weight connected to this output
            for (let j = 0; j < m.inputCount; j++) {
                // Change = Error * Input * Speed
                m.weights[i][j] += error * inputFeatures[j] * m.learningRate;
            }
            
            // Update the bias for this output
            m.biases[i] += error * m.learningRate;
        }
    }
}
