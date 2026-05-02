// 1. DATASET PERSISTENCE
let trainingData = JSON.parse(localStorage.getItem("digit_dataset")) || [];
console.log(`[STORAGE] Loaded ${trainingData.length} samples.`);

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const guessBtn = document.getElementById("guessBtn");

const layersInput = document.getElementById("layers");
const perceptronsInput = document.getElementById("perceptrons");
const iterationsInput = document.getElementById("iterations");

// --------------------
// STATIC UI REFERENCES
// --------------------
let digitButtons = [];
let valueLabels = [];

for (let i = 0; i < 10; i++) {
  digitButtons[i] = document.getElementById("d" + i);
  valueLabels[i] = document.getElementById("v" + i);

  digitButtons[i].onclick = () => train(i);
}

// --------------------
// DRAWING
// --------------------
let drawing = false;

ctx.lineWidth = 8; //20;
ctx.lineCap = "round";
ctx.strokeStyle = "black";

canvas.addEventListener("mousedown", () => drawing = true);
canvas.addEventListener("mouseup", () => {
  drawing = false;
  ctx.beginPath();
});
canvas.addEventListener("mouseleave", () => {
  drawing = false;
  ctx.beginPath();
});

canvas.addEventListener("mousemove", (e) => {
  if (!drawing) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y);
});

// --------------------
// IMAGE PROCESSING
// --------------------
function getInputVector() {
  const small = document.createElement("canvas");
  small.width = 28;
  small.height = 28;

  const sctx = small.getContext("2d");

  // Ensure the small canvas is totally transparent/empty first
  sctx.clearRect(0, 0, 28, 28);
  
  // Draw the large canvas onto the small one
  sctx.drawImage(canvas, 0, 0, 28, 28);

  const img = sctx.getImageData(0, 0, 28, 28).data;

  const input = new Array(784);

  for (let i = 0; i < 784; i++) {
    // capturing the alpha channel (0 to 255)
    const alpha = img[i * 4 + 3]; 

    // Normalize: 0 is empty, 1 is full ink
    let v = alpha / 255;
    
    v = v * v; // contrast
    if (v < 0.1) v = 0; // noise floor
    input[i] = v;
  }

  console.log("[INPUT] sum:", input.reduce((a, b) => a + b, 0));
  return input;
}


// --------------------
// NETWORK
// --------------------
let net = null;

function buildNetwork() {
  const hiddenCount = parseInt(layersInput.value || "2");
  const perLayer = parseInt(perceptronsInput.value || "32");
  const hidden = new Array(hiddenCount).fill(perLayer);

  net = new brain.NeuralNetwork({ hiddenLayers: hidden });

  // Prime with 10 slots
  net.train([{ input: new Array(784).fill(0), output: new Array(10).fill(0) }], { iterations: 1 });
  
  // If we already have data, do a quick initial training pass
  if (trainingData.length > 0) {
    console.log("[INIT] Pre-training on saved data...");
    net.train(trainingData, { iterations: 20 });
  }
}

// initialize once
buildNetwork();

// rebuild network if user changes architecture
layersInput.onchange = () => {
  console.log("[CONFIG] layers changed:", layersInput.value);
  buildNetwork();
};

perceptronsInput.onchange = () => {
  console.log("[CONFIG] perceptrons changed:", perceptronsInput.value);
  buildNetwork();
};

// --------------------
// GUESS
// --------------------
guessBtn.onclick = () => {
  if (!net) return;

  const input = getInputVector();
  const output = net.run(input);

  // Convert to array - handling both Object and Array return types from brain.js
  let vals = [];
  for (let i = 0; i < 10; i++) {
    vals[i] = (output[i] !== undefined) ? output[i] : (output[i.toString()] || 0);
  }
console.log("[RAW OUTPUT]", output);
console.log("[OUTPUT ARRAY]", vals);

  // Softmax
  const max = Math.max(...vals);
  const exp = vals.map(v => Math.exp(v - max));
  const sum = exp.reduce((a, b) => a + b, 0);
  const probs = exp.map(v => v / sum);

  // Update UI
  for (let i = 0; i < 10; i++) {
    valueLabels[i].innerText = probs[i].toFixed(3);

    const c = Math.floor(probs[i] * 255);
    digitButtons[i].style.background = `rgb(${255 - c}, ${255 - c}, ${255 - c})`;
  }
};

// --------------------
// TRAIN (single-sample only)
// --------------------
function train(label) {
  if (!net) buildNetwork();

  const input = getInputVector();

  // FIX: Create an array of 10 zeros instead of an object {}
  const target = new Array(10).fill(0);
  
  // Set ONLY the correct label index to 1
  target[label] = 1;

  // 1. Add new sample to the local array
  trainingData.push({ input, output: target });

  // 2. Save the entire updated array to localStorage
  // We use JSON.stringify because localStorage only stores strings
  localStorage.setItem("digit_dataset", JSON.stringify(trainingData));

  // GET THE VALUE FROM THE UI ELEMENT
  const iters = parseInt(iterationsInput.value) || 5; 

  console.log(`[TRAIN] Total Samples: ${trainingData.length}. Training for ${iters} iterations.`);

  net.train(trainingData, {
    iterations: iters,      // Use the number, not the HTML object
    learningRate: 0.1,
    errorThresh: 0.005
  });

  console.log("[TRAIN] Success");
  clearAll();
}

// --------------------
// RESET UI ONLY
// --------------------
function clearAll() {
  // This resets the alpha to 0 for the whole canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 2. Reset the UI elements
  for (let i = 0; i < 10; i++) {
    digitButtons[i].style.background = "#f5e6a3";
    valueLabels[i].innerText = "";
  }
}
