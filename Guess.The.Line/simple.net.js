const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const guessBtn = document.getElementById("guessBtn");
const undoBtn = document.getElementById("undoBtn");

// --------------------
// NETWORK
// --------------------
const INPUTS = 784;
const OUTPUTS = 4;
const lr = 0.05; 

let W = [];
let B = [];

for (let j = 0; j < OUTPUTS; j++) {
  B[j] = 0;
  W[j] = new Array(INPUTS).fill(0).map(() => (Math.random() - 0.5) * 0.01);
}

console.log("INIT B:", B);
console.log("INIT W sample (first neuron, first 10 weights):", W[0].slice(0,10));

// --------------------
// LOAD MODEL (localStorage)
// --------------------
function loadModel() {
  const saved = localStorage.getItem("simple_net_model");
  if (!saved) return;

  const model = JSON.parse(saved);
  W = model.W;
  B = model.B;

  console.log("MODEL LOADED");
}

loadModel();

// --------------------
// STATIC BUTTONS + LABELS
// --------------------
let digitButtons = [];
let valueLabels = [];

for (let i = 0; i < OUTPUTS; i++) {
  const btn = document.getElementById("d" + i);
  const val = document.getElementById("v" + i);

  btn.onclick = () => train(i);

  digitButtons.push(btn);
  valueLabels.push(val);
}

// --------------------
// DRAWING
// --------------------
let drawing = false;

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

// --------------------
// IMAGE PROCESSING
// --------------------
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
    v = v * v; // contrast
    if (v < 0.1) v = 0; // noise floor
    input[i] = v;
  }

  console.log("INPUT sample:", input.slice(0, 20));
  return input;
}

// --------------------
// FORWARD PASS
// --------------------
function forward(x) {
  let out = new Array(OUTPUTS).fill(0);

  for (let j = 0; j < OUTPUTS; j++) {
    let sum = B[j];
    for (let i = 0; i < 784; i++) {
      sum += x[i] * W[j][i];
    }
    out[j] = sum;
  }
  console.log("FORWARD out:", out);
  return out;
}

// sigmoid for display only (optional now)
function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

// --------------------
// GUESS
// --------------------
guessBtn.onclick = () => {
  const x = getInputVector();
  const out = forward(x);

  console.log("GUESS raw:", out);

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

// --------------------
// UNDO (visual only)
// --------------------
undoBtn.onclick = () => {
  clearAll();
};

// --------------------
// SAVE MODEL (localStorage)
// --------------------
function saveModel() {
  localStorage.setItem("simple_net_model", JSON.stringify({ W, B }));
}

// --------------------
// TRAIN
// --------------------
function train(label) {
  console.log("---- TRAIN START ----");
  console.log("LABEL:", label);

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
// RESET
// --------------------
function clearAll() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < OUTPUTS; i++) {
    digitButtons[i].style.background = "#f5e6a3";
    valueLabels[i].innerText = "";
  }
}
