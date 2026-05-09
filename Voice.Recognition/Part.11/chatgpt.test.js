// test.js

console.clear();

console.log("=== SIMPLE NEURAL NETWORK TEST ===");

// ----------------------------------
// 1. Initialize
// ----------------------------------

initModel(model, 3, 2, 10);

// 3 inputs
// 2 outputs
// 10 training passes per train()

console.log("Initial model:");
console.log(model);

// ----------------------------------
// 2. Training Data
// ----------------------------------

// Example idea:
//
// input: [sweet, crunchy, yellow]
//
// output 0 = apple
// output 1 = banana

const apple = [0.6, 1.0, 0.1];
const banana = [1.0, 0.1, 1.0];

// ----------------------------------
// 3. Before Training
// ----------------------------------

console.log("Before training:");

console.log("Apple guess:");
console.log(predict(model, apple));

console.log("Banana guess:");
console.log(predict(model, banana));

// ----------------------------------
// 4. Train
// ----------------------------------

// Train apple examples
for (let i = 0; i < 100; i++) {
    train(model, apple, 0);
}

// Train banana examples
for (let i = 0; i < 100; i++) {
    train(model, banana, 1);
}

// ----------------------------------
// 5. After Training
// ----------------------------------

console.log("After training:");

console.log("Apple guess:");
console.log(predict(model, apple));

console.log("Banana guess:");
console.log(predict(model, banana));

// ----------------------------------
// 6. Unknown Example
// ----------------------------------

const unknown = [0.9, 0.2, 0.8];

console.log("Unknown fruit:");
console.log(unknown);

console.log("Prediction:");
console.log(predict(model, unknown));

// ----------------------------------
// 7. Show Learned Weights
// ----------------------------------

console.log("Weights:");
console.log(model.weights);

console.log("Biases:");
console.log(model.biases);
