//sample.net.sample.storage.js

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const guessBtn = document.getElementById("guessBtn");
const undoBtn = document.getElementById("undoBtn");

const sampleCountEl = document.getElementById("sampleCount");
const sampleMemoryEl = document.getElementById("sampleMemory");

// --------------------
// SAMPLE STORAGE
// --------------------
let samples = [];
let pendingSample = null;

// --------------------
// NETWORK
// --------------------
const INPUTS = 784;
const OUTPUTS = 10;
//const lr = 0.05;
const lr = 0.005;

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

function forward(x) {
  let out = new Array(OUTPUTS).fill(0);

  for (let j = 0; j < OUTPUTS; j++) {
    let sum = B[j];
    for (let i = 0; i < 784; i++) {
      sum += x[i] * W[j][i];
    }
    out[j] = sum;
  }

  return out;
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
  const verify = localStorage.getItem("simple_net_model");
}

// --------------------
// NEW: epoch training over stored samples
// --------------------
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

    // NEW: run full pass over dataset
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
// INIT / SETUP
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

ctx.lineWidth = 8;
ctx.lineCap = "round";
ctx.strokeStyle = "black";

// --------------------
// EVENTS
// --------------------
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

guessBtn.onclick = () => {
  const x = getInputVector();
  pendingSample = x;

  const out = forward(x);

  console.log("[GUESS] stored pendingSample");

  for (let i = 0; i < OUTPUTS; i++) {
    const val = out[i];

    valueLabels[i].innerText = val.toFixed(2);

    let s = val;
    if (s < 0) s = 0;
    if (s > 1) s = 1;

    const shade = Math.floor(255 - (s * 255));

    digitButtons[i].style.background = `rgb(${shade},${shade},${shade})`;
  }
};

undoBtn.onclick = () => {
  clearAll();
};
