// --- 1. SETUP ---
// We have 2 inputs: [Is it Sweet?, Is it Crunchy?] (1 for yes, 0 for no)
// We have 2 outputs: [Fruit, Vegetable]
// We will run 10 training passes (epochs) per click
initModel(model, 2, 2, 10);

console.log("--- INITIAL PREDICTION (Before Training) ---");
// Let's test a Apple: Sweet (1) and Crunchy (1)
let appleFeatures = [1, 1]; 
let initialGuess = predict(model, appleFeatures);

console.log("Input: Sweet & Crunchy");
console.log("Model Guess (Fruit vs Veg):", initialGuess);
console.log("Note: Since weights are 0, the model has no idea yet!");

// --- 2. TRAINING ---
console.log("\n--- TRAINING THE MODEL ---");

// Teaching it: "Sweet (1) and Not Crunchy (0) is a Fruit (Index 0)"
console.log("Teaching the model that Sweet/Soft is a Fruit...");
train(model, [1, 0], 0); 

// Teaching it: "Not Sweet (0) and Crunchy (1) is a Vegetable (Index 1)"
console.log("Teaching the model that Savory/Crunchy is a Vegetable...");
train(model, [0, 1], 1);

// --- 3. RESULTS ---
console.log("\n--- FINAL PREDICTION (After Training) ---");

// Test the Apple again: Sweet (1) and Crunchy (1)
let finalGuess = predict(model, appleFeatures);

console.log("Input: Sweet & Crunchy");
console.log("Model Score for Fruit:", finalGuess[0].toFixed(4));
console.log("Model Score for Vegetable:", finalGuess[1].toFixed(4));

if (finalGuess[0] > finalGuess[1]) {
    console.log("RESULT: The model thinks this is a FRUIT!");
} else {
    console.log("RESULT: The model thinks this is a VEGETABLE!");
}

console.log("\n--- CHECK THE BRAIN ---");
console.log("Look at 'model.weights' to see how the connections changed!");
console.log(model.weights);
