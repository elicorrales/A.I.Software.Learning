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

const runSamplesBtn = document.getElementById("runSamplesBtn");

canvas.tabIndex = 0;

const LINE_WIDTH= 8;
const INPUTS = 784;
const OUTPUTS = 6;
//const lr = 0.005;
//const lr = 0.001;
const baseLR = 0.001;
const weightDecay = 0;// 0.00001; // Adjust this: higher = harder to learn, lower = easier
let currentLR = baseLR;
const lrDecayRate = 0.95;   // Very slow LR decay per epoch



let samples = [];
let pendingSample = null;
let lastImages = { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null };

let W = [];
let B = [];

let digitButtons = [];
let valueLabels = [];

let drawing = false;

let currentInputType = "line"; // Default to line
let strokeLength = 0;          // Track how much the user actually drew

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
  if (data.lastImages) {
    lastImages = data.lastImages;
    for (let i = 0; i < OUTPUTS; i++) {
      if (lastImages[i]) {
        // Pass the whole object {data, type}
        updateThumbUI(i, lastImages[i]);
      }
    }
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

function getInputVectorFromLineDrawing() {
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

function getInputVectorFromPastedImage() {
  const small = document.createElement("canvas");
  small.width = 28;
  small.height = 28;

  const sctx = small.getContext("2d");
  sctx.drawImage(canvas, 0, 0, 28, 28);

  const img = sctx.getImageData(0, 0, 28, 28).data;

  let input = new Array(784);

  for (let i = 0; i < 784; i++) {

    const r = img[i * 4 + 0];
    const g = img[i * 4 + 1];
    const b = img[i * 4 + 2];

    // standard grayscale conversion (0-255)
    const avg = (r + g + b) / 3;

    // Convert to 0.0 - 1.0 range
    // We invert it (1.0 - value) so that "ink" (darker pixels)
    // results in a higher number for the neural network.
    let v = 1.0 - (avg / 255);

    // Apply your original contrast logic
    v = v * v;
    if (v < 0.1) v = 0;

    input[i] = v;
  }

  return input;
}

function getInputVector() {
  // A "smart" check: If the user just clicked without moving much,
  // and we were in line mode, it might be a mistake.
  // We only treat it as a line drawing if the strokeLength is significant.
  if (currentInputType === "line" && strokeLength < 5) {
    console.log("Input too small, ignoring or defaulting to RGB");
    return getInputVectorFromPastedImage();
  }

  if (currentInputType === "pasted") {
    return getInputVectorFromPastedImage();
  } else {
    return getInputVectorFromLineDrawing();
  }
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
  strokeLength = 0;

  for (let i = 0; i < OUTPUTS; i++) {
    digitButtons[i].style.background = "#f5e6a3";
    digitButtons[i].style.color = "black";
    valueLabels[i].innerText = "";
  }
}

function saveModel() {
  localStorage.setItem("simple_net_model", JSON.stringify({
    model: { W, B },
    samples: samples,
    lastImages: lastImages,
  }));
}

function getEpochs() {
  const el = document.getElementById("epochsInput");
  return Math.max(1, parseInt(el.value) || 1);
}

/*
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
*/

function captureThumbState(label) {
  const snapshotData = canvas.toDataURL();
  const snapshotType = currentInputType;

  // Store the image and type for later restoration
  lastImages[label] = {
    data: snapshotData,
    type: snapshotType
  };

  // Physically update the thumbnail canvas in the UI
  updateThumbUI(label, lastImages[label]);
}

function runTrainingStep(sample) {
  const out = forward(sample.input);
  
  for (let j = 0; j < OUTPUTS; j++) {
    const target = (j === sample.label) ? 1 : 0;
    const error = target - out[j];

    // Update Bias with decaying learning rate
    B[j] += currentLR * error;

    for (let k = 0; k < 784; k++) {
      const inputVal = sample.input[k];

      if (inputVal > 0.1) {
        // ACTIVE ZONE: 
        // Strengthen the connection using the current learning rate
        W[j][k] += currentLR * error * inputVal;
      } else {
        // INACTIVE ZONE: 
        // Slowly evaporate weights that aren't being used by this shape.
        // This is the "Selective Weight Decay"
        W[j][k] *= (1 - weightDecay);
      }
    }
  }
}

function showResultFeedback(winningIndex, actualLabel) {
  const targetThumb = document.getElementById("thumb" + winningIndex);
  if (!targetThumb) return;

  if (winningIndex !== actualLabel) {
    // Model is WRONG - Red highlight
    targetThumb.style.borderColor = "red";
    targetThumb.style.boxShadow = "0 0 15px red";
  } else {
    // Model is RIGHT - Green pulse (using your existing CSS class)
    targetThumb.classList.add("thumb-winner");
  }

  // Cleanup after 1.5 seconds
  setTimeout(() => {
    targetThumb.classList.remove("thumb-winner");
    targetThumb.style.borderColor = "";
    targetThumb.style.boxShadow = "";
  }, 1500);
}

async function animateTrainingProgress(input) {
  drawSampleToCanvas(input);
  updateStatsMeters();
  // Giving the browser a 0ms timeout forces a UI repaint
  await new Promise(resolve => setTimeout(resolve, 0));
}

async function finalizeTraining(actualLabel) {
    saveModel();
    // 1. Force one final stats update after the last weight change
    updateStatsMeters(); 
    
    setUILock(false);

    // 2. Clear canvas and show feedback
    const lastInput = samples[samples.length - 1].input;
    const finalOut = forward(lastInput);
    const winningIndex = finalOut.indexOf(Math.max(...finalOut));
    
    showResultFeedback(winningIndex, actualLabel);
    clearAll(); 
}

async function animatedTrainingLoop() {
  const epochs = getEpochs();

  // Optional: reset to base at start of train session if you want 
  // "fresh" speed every time you click a button.
  currentLR = baseLR;

  for (let i = 0; i < epochs; i++) {
    for (let s = 0; s < samples.length; s++) {
      const sample = samples[s];
      if (s % 10 === 0) {
        await animateTrainingProgress(sample.input);
      }
      runTrainingStep(sample);
    }
    // Decay the learning rate after each epoch
    currentLR *= lrDecayRate;
  }
}

async function train(label) {
  if (pendingSample) {

    const snapshotData = canvas.toDataURL();
    const snapshotType = currentInputType;

    captureThumbState(label);

    // 3. Prepare for training
    setUILock(true);
    samples.push({ input: pendingSample, label });
    pendingSample = null;
    updateSampleStats();

    // Optional: Clear the canvas now so the "montage" starts on a fresh slate
    // or leave it to let the first sample of the montage overwrite it.
    // clearAll();

    const epochs = getEpochs();

    await animatedTrainingLoop();

    // 5. Finalize
    finalizeTraining(label);

  } else {
    console.log("[TRAIN] no pending sample added");
  }
}

function setUILock(isLocked) {
  // 1. List all the buttons and inputs to toggle
  const elements = [
    guessBtn, undoBtn, resetModelBtn, resetSampBtn, runSamplesBtn,
    canvas, ...digitButtons,
    document.getElementById("epochsInput"),
    document.getElementById("grayBtn"),
    document.getElementById("contrastUp"),
    document.getElementById("contrastDn"),
    document.getElementById("brightUp"),
    document.getElementById("brightDn")
  ];

  elements.forEach(el => {
    if (!el) return;
    if (isLocked) {
      el.classList.add("disabled");
      el.disabled = true; // For standard buttons/inputs
    } else {
      el.classList.remove("disabled");
      el.disabled = false;
    }
  });

  // Special handling for canvas drawing
  drawing = false;
}

function updateThumbUI(label, thumbObj) {
  const thumbCanvas = document.getElementById("thumb" + label);
  if (!thumbCanvas || !thumbObj) return;

  const tctx = thumbCanvas.getContext("2d");
  const img = new Image();

  img.onload = () => {
    tctx.clearRect(0, 0, 28, 28);
    tctx.drawImage(img, 0, 0, 28, 28);
  };
  // Access the .data property of our new object
  img.src = thumbObj.data;

  // Click thumbnail to restore 280x280 version to main canvas
  thumbCanvas.onclick = () => {
    const restoreImg = new Image();
    restoreImg.onload = () => {
      clearAll();
      ctx.drawImage(restoreImg, 0, 0);

      // RESTORE THE FLAG
      currentInputType = thumbObj.type;

      // If it was a line, set strokeLength to a high number
      // so getInputVector() doesn't fall back to RGB logic
      strokeLength = (thumbObj.type === "line") ? 100 : 0;

      console.log(`Restored as: ${currentInputType}`);
    };
    restoreImg.src = thumbObj.data;
  };
}

// Helper to apply filters
function applyFilter(filterFn) {
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    filterFn(data, i);
  }

  ctx.putImageData(imgData, 0, 0);
}

function drawSampleToCanvas(inputVector) {
  // 1. Create a tiny 28x28 buffer
  const tempImgData = ctx.createImageData(28, 28);
  for (let i = 0; i < 784; i++) {
    const val = inputVector[i] * 255;
    const idx = i * 4;
    tempImgData.data[idx] = 0;     // R
    tempImgData.data[idx+1] = 0;   // G
    tempImgData.data[idx+2] = 0;   // B
    tempImgData.data[idx+3] = val; // Alpha (makes it look like ink)
  }

  // 2. Draw tiny buffer to a hidden temporary canvas to upscale it
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = 28;
  tempCanvas.height = 28;
  tempCanvas.getContext('2d').putImageData(tempImgData, 0, 0);

  // 3. Paint it big on the main canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false; // Keeps that cool pixelated AI look
  ctx.drawImage(tempCanvas, 0, 0, 280, 280);
}

function updateStatsMeters() {
  if (samples.length === 0) return;

  let correctCount = 0;
  let totalLoss = 0;
  const eps = 1e-7;

  samples.forEach(s => {
    const out = forward(s.input);
    
    // Find model's top guess
    let winIdx = 0;
    let maxVal = -Infinity;
    for (let i = 0; i < out.length; i++) {
      if (out[i] > maxVal) {
        maxVal = out[i];
        winIdx = i;
      }
    }

    if (winIdx === s.label) correctCount++;

    // Categorical Cross-Entropy-ish Loss for the target class
    let pClamped = Math.min(1 - eps, Math.max(eps, out[s.label]));
    totalLoss += -Math.log(pClamped);
  });

  const accuracy = correctCount / samples.length;
  const avgLoss = totalLoss / samples.length;

  // Update DOM
  document.getElementById("statAcc").textContent = (accuracy * 100).toFixed(0) + "%";
  document.getElementById("fillAcc").style.height = (accuracy * 100) + "%";

  document.getElementById("statLoss").textContent = avgLoss.toFixed(2);
  // Scale loss for the bar: 0 loss = 100% full, 2.0 loss = empty
  const lossHeight = Math.max(0, (1 - (avgLoss / 2)) * 100);
  document.getElementById("fillLoss").style.height = lossHeight + "%";
}



// --------------------
// INIT / SETUP (executed code)
// --------------------
for (let j = 0; j < OUTPUTS; j++) {
  B[j] = 0;
  W[j] = new Array(INPUTS).fill(0); // Standard zero initialization
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
ctx.lineWidth = LINE_WIDTH;
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

  // Every time the mouse moves while held down, we increase the length
  strokeLength++;
  currentInputType = "line"; // Drawing resets the mode to line

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y);
});

// --- DRAG AND DROP HANDLERS ---

// Prevent default behavior (preventing the browser from just opening the image file)
canvas.addEventListener("dragover", (e) => {
  e.preventDefault();
  canvas.style.backgroundColor = "#e0e0e0"; // Optional visual cue
});

canvas.addEventListener("dragleave", () => {
  canvas.style.backgroundColor = ""; // Reset visual cue
});

canvas.addEventListener("drop", (e) => {
  e.preventDefault();
  canvas.style.backgroundColor = "";

  const files = e.dataTransfer.files;
  if (files.length > 0) {
    const file = files[0];
    
    // Check if the dropped file is actually an image
    if (file.type.startsWith("image/")) {
      currentInputType = "pasted"; // Use same mode as pasted images
      strokeLength = 0;

      const img = new Image();
      const reader = new FileReader();

      reader.onload = (event) => {
        img.onload = function() {
          clearAll();
          // Draw image scaled to fit the 280x280 canvas
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          console.log("Image dropped and loaded.");
        };
        img.src = event.target.result;
      };

      reader.readAsDataURL(file);
    }
  }
});



window.addEventListener("paste", (e) => {

  if (document.activeElement !== canvas) {
    return;
  }

  const items = e.clipboardData.items;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf("image") !== -1) {
      currentInputType = "pasted"; // Lock the mode to pasted
      strokeLength = 0;            // Reset stroke
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

  for (let i = 0; i < OUTPUTS; i++) {
    const val = out[i];

    valueLabels[i].innerText = val.toFixed(2);

    const shade = Math.floor(255 - (val * 255));

    digitButtons[i].style.background = `rgb(${shade},${shade},${shade})`;

    digitButtons[i].style.color = (shade < 128) ? "white" : "black";
    
    digitButtons[i].style.transition = "background 0.3s ease, color 0.3s ease";
  }
};

undoBtn.onclick = () => {
  clearAll();
};


resetModelBtn.onclick = () => {

    W = [];
    B = [];
    for (let j = 0; j < OUTPUTS; j++) {
        B[j] = 0;
        W[j] = new Array(INPUTS).fill(0);
    }
    clearAll();
    // Reset the UI meters manually
    document.getElementById("statAcc").textContent = "0%";
    document.getElementById("fillAcc").style.height = "0%";
    document.getElementById("statLoss").textContent = "0.00";
    document.getElementById("fillLoss").style.height = "0%";
    saveModel(); 

};

resetSampBtn.onclick = () => {
    console.log("Resetting Samples...");
    samples = []; // Clear the global variable
    updateSampleStats();
    saveModel(); // Overwrite the JSON in storage with the empty array
    console.log("Samples Reset and Saved.");
};

runSamplesBtn.onclick = async () => {
  if (samples.length === 0) {
    console.log("No samples to run.");
    return;
  }

  // Lock UI to prevent interruptions during the batch run
  setUILock(true);

  // Run the existing training loop logic
  await animatedTrainingLoop();

  // Save the state and unlock
  saveModel();
  updateStatsMeters();
  setUILock(false);
  clearAll();
  
  console.log("Finished running all stored samples.");
};

document.getElementById("clearThumbsBtn").onclick = () => {
    console.log("Resetting Thumbnails...");
    // Reset the global object
    lastImages = { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null };
    
    for (let i = 0; i < OUTPUTS; i++) {
        const tCanvas = document.getElementById("thumb" + i);
        if (tCanvas) {
            tCanvas.getContext("2d").clearRect(0, 0, 28, 28);
            tCanvas.onclick = null;
        }
    }
    saveModel();
    console.log("Thumbnails Reset and Saved.");
};

// 1. Grayscale
document.getElementById("grayBtn").onclick = () => {
  applyFilter((data, i) => {
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    data[i] = data[i+1] = data[i+2] = avg;
  });
};

// 2. Contrast (Factor: >1 increases, <1 decreases)
const adjustContrast = (factor) => {
  applyFilter((data, i) => {
    for (let j = 0; j < 3; j++) {
      data[i + j] = factor * (data[i + j] - 128) + 128;
    }
  });
};
document.getElementById("contrastUp").onclick = () => adjustContrast(1.1);
document.getElementById("contrastDn").onclick = () => adjustContrast(0.9);

// 3. Brightness
const adjustBrightness = (offset) => {
  applyFilter((data, i) => {
    data[i] += offset;     // R
    data[i + 1] += offset; // G
    data[i + 2] += offset; // B
  });
};
document.getElementById("brightUp").onclick = () => adjustBrightness(10);
document.getElementById("brightDn").onclick = () => adjustBrightness(-10);
