let target;
let attempts;
let gameOver;
let lastGuessMade;

const input = document.getElementById("guessInput");
const guessBtn = document.getElementById("guessBtn");
const newGameBtn = document.getElementById("newGameBtn");
const message = document.getElementById("message");
const attemptCount = document.getElementById("attemptCount");

function startGame() {
  target = Math.floor(Math.random() * 100) + 1;
  attempts = 0;
  gameOver = false;
  lastGuessMade = false;

  const lastScore = localStorage.getItem("lastScore");

  if (lastScore) {
    showMessage(`Last game: ${lastScore} attempts`, "success");
  } else {
    message.textContent = "";
    message.className = "message";
  }

  attemptCount.textContent = "0";
  input.value = "";
  input.disabled = false;
  guessBtn.disabled = false;
  input.focus();
}

function showMessage(text, type) {
  message.textContent = text;
  message.className = "message " + type;
}

function validateInput(value) {
  if (value.length === 0) return "Enter a number.";
  if (!/^\d+$/.test(value)) return "Numbers only.";
  if (value.length > 3) return "Too many digits.";

  const num = Number(value);
  if (num < 1 || num > 100) return "Enter 1 - 100.";

  return null;
}

function handleGuess() {
  if (gameOver) return;

  const value = input.value.trim();
  const error = validateInput(value);

  if (error) {
    showMessage(error, "error");
    lastGuessMade = true;
    return;
  }

  const guess = Number(value);
  attempts++;
  attemptCount.textContent = attempts;

  if (guess < target) {
    showMessage("Too low!", "low");
  } else if (guess > target) {
    showMessage("Too high!", "high");
  } else {
    showMessage("Correct! 🎉", "success");
    localStorage.setItem("lastScore", attempts);
    guessBtn.disabled = true;
    input.disabled = true;
    gameOver = true;
  }

  lastGuessMade = true;
  input.blur();
  setTimeout(() => input.focus(), 0);
}

input.addEventListener("keypress", function(e) {
  if (e.key === "Enter") handleGuess();
});

input.addEventListener("focus", function() {
  if (lastGuessMade) {
    input.select();
    lastGuessMade = false;
  }
});

guessBtn.addEventListener("click", handleGuess);
newGameBtn.addEventListener("click", startGame);

startGame();
