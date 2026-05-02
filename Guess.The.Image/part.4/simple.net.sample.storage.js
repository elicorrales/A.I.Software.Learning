//sample.net.sample.storage.js

// --------------------
// CONSTANTS / GLOBALS / STATE
// --------------------
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const guessBtn = document.getElementById("guessBtn");
const undoBtn = document.getElementById("undoBtn");

const sampleCountEl = document.getElementById("sampleCount");
const sampleMemoryEl = document.getElementById("sampleMemory");

const resetModelBtn = document.getElementById("resetModelBtn");
const resetSampBtn = document.getElementById("resetSampBtn");

const INPUTS = 784;
const OUTPUTS = 4;
//const lr = 0.05;
const lr = 0.005;

let samples = [];
let pendingSample = null;

let W = [];
let B = [];

let digitButtons = [];
let valueLabels = [];

let drawing = false;

// --------------------
// FUNCTIONS
// --------------------
function debugState(tag) {
  console.log(`\n[STATE:${tag}]`);
  console.log("samples:", samples.length);
  console.log("W:", W?.length, "B:", B?.length);
  console.log("localStorage bytes:", localStorage.getItem("simple_net_model")?.length || 0);
}

function loadModel() {
  const saved = localStorage.getItem("simple_net_model");
  if (!saved) return;
  const data = JSON.parse(saved);

  if (data.model) {
    W = data.model.W;
    B = data.model.B;
  }

  if (data.samples) {
    samples = data.samples;
  } else {
    console.log("[LOAD] NO SAMPLES FOUND");
  }
  updateSampleStats();
}

function roughSizeOfObject(obj) {
  const str = JSON.stringify(obj);
  return str ? str.length * 2 : 0;
}

function updateSampleStats() {
  if (!sampleCountEl || !sampleMemoryEl) return;
  sampleCountEl.innerText = samples.length;
  const bytes = roughSizeOfObject(samples);
  const kb = (bytes / 1024).toFixed(2);
  sampleMemoryEl.innerText = kb + " KB";
}

function getInputVector() {
  const small = document.createElement("canvas");
  small.width = 28;
  small.height = 28;

  const sctx = small.getContext("2d");
  sctx.drawImage(canvas, 0, 0, 28, 28);

  const img = sctx.getImageData(0, 0, 28, 28).data;

  let input = new Array(784);

  for (let i = 0; i < 784; i++) {
    const alpha = img[i * 4 + 3];
    let v = alpha / 255;
    v = v * v;
    if (v < 0.1) v = 0;
    input[i] = v;
  }

  return input;
}

function getActivation(logits) {
  const mode = document.querySelector('input[name="mode"]:checked').value;

  if (mode === "linear") {
    return logits; // Returns raw sums as-is
  }

  if (mode === "sigmoid") {
    // Squashes each output independently between 0 and 1
    return logits.map(x => 1 / (1 + Math.exp(-x)));
  }

  if (mode === "softmax") {
    // Normalizes all outputs so they sum to 1.0 (100%)
    const maxLogit = Math.max(...logits);
    const exps = logits.map(x => Math.exp(x - maxLogit));
    const sumExps = exps.reduce((a, b) => a + b);
    return exps.map(x => x / sumExps);
  }
}

function forward(x) {
  let logits = new Array(OUTPUTS).fill(0);

  // 1. Calculate the raw linear sums (logits)
  for (let j = 0; j < OUTPUTS; j++) {
    let sum = B[j];
    for (let i = 0; i < 784; i++) {
      sum += x[i] * W[j][i];
    }
    logits[j] = sum;
  }

  // 2. Return the activated results based on your radio button selection
  return getActivation(logits);
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function clearAll() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < OUTPUTS; i++) {
    digitButtons[i].style.background = "#f5e6a3";
    valueLabels[i].innerText = "";
  }
}

function saveModel() {
  localStorage.setItem("simple_net_model", JSON.stringify({
    model: { W, B },
    samples: samples
  }));
}

function trainOnSamplesOnce() {
  console.log("[EPOCH] training on samples:", samples.length);

  for (let s = 0; s < samples.length; s++) {
    const sample = samples[s];

    const x = sample.input;
    const label = sample.label;

    const out = forward(x);

    for (let j = 0; j < OUTPUTS; j++) {
      const target = (j === label) ? 1 : 0;
      const error = target - out[j];

      B[j] += lr * error;

      for (let i = 0; i < 784; i++) {
        W[j][i] += lr * error * x[i];
      }
    }
  }

  console.log("[EPOCH] done");
}

function train(label) {
  console.log("---- TRAIN START ----");

  console.log("[TRAIN] label:", label);
  console.log("[TRAIN] pendingSample exists:", !!pendingSample);

  if (pendingSample) {
    samples.push({ input: pendingSample, label });

    console.log("[TRAIN] sample added. total samples:", samples.length);

    pendingSample = null;

    updateSampleStats();

    debugState("after-sample-add");

    trainOnSamplesOnce();

  } else {
    console.log("[TRAIN] no pending sample added");
  }

  const x = getInputVector();
  const out = forward(x);

  for (let j = 0; j < OUTPUTS; j++) {
    const target = (j === label) ? 1 : 0;
    const error = target - out[j];

    B[j] += lr * error;

    for (let i = 0; i < 784; i++) {
      W[j][i] += lr * error * x[i];
    }
  }

  console.log("---- TRAIN END ----");

  saveModel();
  clearAll();
}

// --------------------
// INIT / SETUP (executed code)
// --------------------
for (let j = 0; j < OUTPUTS; j++) {
  B[j] = 0;
  W[j] = new Array(INPUTS).fill(0).map(() => (Math.random() - 0.5) * 0.01);
}

console.log("INIT B:", B);
console.log("INIT W sample (first neuron, first 10 weights):", W[0].slice(0,10));

loadModel();
debugState("after-load");

for (let i = 0; i < OUTPUTS; i++) {
  const btn = document.getElementById("d" + i);
  const val = document.getElementById("v" + i);

  btn.onclick = () => train(i);

  digitButtons.push(btn);
  valueLabels.push(val);
}

// --------------------
// EVENTS
// --------------------
ctx.lineWidth = 8;
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

window.addEventListener("paste", (e) => {
  const items = e.clipboardData.items;

  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf("image") !== -1) {
      const blob = items[i].getAsFile();
      const img = new Image();

      img.onload = function() {
        // Clear current canvas before drawing the pasted image
        clearAll();

        // Draw image scaled to fit the 280x280 canvas
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };

      img.src = URL.createObjectURL(blob);
    }
  }
});

guessBtn.onclick = () => {
  const x = getInputVector();
  pendingSample = x;

  const out = forward(x);

  console.log("[GUESS] stored pendingSample");

  for (let i = 0; i < OUTPUTS; i++) {
    const val = out[i];

    valueLabels[i].innerText = val.toFixed(2);

    let s = val;

    const shade = Math.floor(255 - (s * 255));

    digitButtons[i].style.background = `rgb(${shade},${shade},${shade})`;
  }
};

undoBtn.onclick = () => {
  clearAll();
};


resetModelBtn.onclick = () => {
  // 1. Re-initialize Weights (W) and Biases (B)
  for (let j = 0; j < OUTPUTS; j++) {
    B[j] = 0;
    // Fill W with small random values again
    W[j] = new Array(INPUTS).fill(0).map(() => (Math.random() - 0.5) * 0.01);
  }

  // 2. Clear the drawing area and labels
  clearAll();

  // 3. Update LocalStorage (preserving the 'samples' array)
  saveModel();

  console.log("Model weights reset. Samples preserved:", samples.length);
};

resetSampBtn.onclick = () => {
  // 1. Clear the samples array
  samples = [];

  // 2. Update the UI labels (Samples: 0, Memory: 0 KB)
  updateSampleStats();

  // 3. Save the now-empty samples list to LocalStorage (preserves W and B)
  saveModel();

  console.log("All training samples cleared. Model weights preserved.");
};
