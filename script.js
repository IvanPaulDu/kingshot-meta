const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const highscoreEl = document.getElementById("highscore");
const overlay = document.getElementById("overlay");
const overlayText = document.getElementById("overlay-text");

const GRID_SIZE = 20;
const CELL = canvas.width / GRID_SIZE;
const STEP_MS = 120;

let snake, direction, nextDirection, food, score, highscore, running, gameOver, timer;

function loadHighscore() {
  return Number(localStorage.getItem("snake-highscore") || 0);
}

function saveHighscore(value) {
  localStorage.setItem("snake-highscore", String(value));
}

function randomCell() {
  return {
    x: Math.floor(Math.random() * GRID_SIZE),
    y: Math.floor(Math.random() * GRID_SIZE),
  };
}

function placeFood() {
  let cell;
  do {
    cell = randomCell();
  } while (snake.some((s) => s.x === cell.x && s.y === cell.y));
  return cell;
}

function resetGame() {
  snake = [
    { x: 9, y: 10 },
    { x: 8, y: 10 },
    { x: 7, y: 10 },
  ];
  direction = { x: 1, y: 0 };
  nextDirection = direction;
  food = placeFood();
  score = 0;
  highscore = loadHighscore();
  running = false;
  gameOver = false;
  scoreEl.textContent = score;
  highscoreEl.textContent = highscore;
  overlay.classList.remove("hidden");
  overlayText.textContent = "Pulsa una flecha para empezar";
  draw();
}

function startGame() {
  if (gameOver) resetGame();
  if (running) return;
  running = true;
  overlay.classList.add("hidden");
  timer = setInterval(tick, STEP_MS);
}

function pauseGame() {
  running = false;
  clearInterval(timer);
  overlay.classList.remove("hidden");
  overlayText.textContent = "Pausa - pulsa Espacio para continuar";
}

function endGame() {
  running = false;
  gameOver = true;
  clearInterval(timer);
  if (score > highscore) {
    highscore = score;
    saveHighscore(highscore);
    highscoreEl.textContent = highscore;
  }
  overlay.classList.remove("hidden");
  overlayText.textContent = `Game over - puntos: ${score}. Pulsa Espacio para reiniciar`;
}

function tick() {
  direction = nextDirection;
  const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

  const hitsWall =
    head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE;
  const hitsSelf = snake.some((s) => s.x === head.x && s.y === head.y);

  if (hitsWall || hitsSelf) {
    endGame();
    draw();
    return;
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score += 10;
    scoreEl.textContent = score;
    food = placeFood();
  } else {
    snake.pop();
  }

  draw();
}

function draw() {
  ctx.fillStyle = "#0f1215";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#e74c3c";
  ctx.fillRect(food.x * CELL, food.y * CELL, CELL, CELL);

  snake.forEach((segment, i) => {
    ctx.fillStyle = i === 0 ? "#7ed957" : "#4caf50";
    ctx.fillRect(segment.x * CELL + 1, segment.y * CELL + 1, CELL - 2, CELL - 2);
  });
}

const KEY_DIRECTIONS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
};

document.addEventListener("keydown", (e) => {
  if (e.key === " ") {
    e.preventDefault();
    if (gameOver) {
      resetGame();
      startGame();
    } else if (running) {
      pauseGame();
    } else {
      startGame();
    }
    return;
  }

  const newDir = KEY_DIRECTIONS[e.key];
  if (!newDir) return;
  e.preventDefault();

  const isOpposite =
    newDir.x === -direction.x && newDir.y === -direction.y;
  if (!isOpposite) {
    nextDirection = newDir;
  }

  if (!running && !gameOver) {
    startGame();
  }
});

function applyDirection(newDir) {
  const isOpposite = newDir.x === -direction.x && newDir.y === -direction.y;
  if (!isOpposite) {
    nextDirection = newDir;
  }
  if (!running && !gameOver) {
    startGame();
  } else if (gameOver) {
    resetGame();
    startGame();
  }
}

document.querySelectorAll(".dpad-btn").forEach((btn) => {
  btn.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      applyDirection(KEY_DIRECTIONS[{ up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" }[btn.dataset.dir]]);
    },
    { passive: false }
  );
  btn.addEventListener("click", () => {
    applyDirection(KEY_DIRECTIONS[{ up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" }[btn.dataset.dir]]);
  });
});

let touchStart = null;
const boardWrap = document.querySelector(".board-wrap");

boardWrap.addEventListener(
  "touchstart",
  (e) => {
    const t = e.changedTouches[0];
    touchStart = { x: t.clientX, y: t.clientY, time: Date.now() };
  },
  { passive: true }
);

boardWrap.addEventListener(
  "touchend",
  (e) => {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    const dt = Date.now() - touchStart.time;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const SWIPE_THRESHOLD = 24;

    if (absX < SWIPE_THRESHOLD && absY < SWIPE_THRESHOLD) {
      if (gameOver) {
        resetGame();
        startGame();
      } else if (running) {
        if (dt > 400) pauseGame();
      } else {
        startGame();
      }
    } else if (absX > absY) {
      applyDirection(dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 });
    } else {
      applyDirection(dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 });
    }

    touchStart = null;
  },
  { passive: true }
);

const tiltBtn = document.getElementById("tilt-btn");
const calibrateBtn = document.getElementById("calibrate-btn");
const tiltStatus = document.getElementById("tilt-status");

const TILT_THRESHOLD = 12; // grados desde el centro para disparar un giro
let tiltEnabled = false;
let tiltBaseline = null;

function handleTilt(event) {
  if (event.beta === null || event.gamma === null) return;

  if (!tiltBaseline) {
    tiltBaseline = { beta: event.beta, gamma: event.gamma };
    return;
  }

  const dBeta = event.beta - tiltBaseline.beta; // adelante/atrás
  const dGamma = event.gamma - tiltBaseline.gamma; // izquierda/derecha
  const absBeta = Math.abs(dBeta);
  const absGamma = Math.abs(dGamma);

  if (Math.max(absBeta, absGamma) < TILT_THRESHOLD) return;

  const newDir =
    absGamma > absBeta
      ? dGamma > 0
        ? { x: 1, y: 0 }
        : { x: -1, y: 0 }
      : dBeta > 0
      ? { x: 0, y: 1 }
      : { x: 0, y: -1 };

  applyDirection(newDir);
}

function enableTilt() {
  tiltEnabled = true;
  tiltBaseline = null;
  window.addEventListener("deviceorientation", handleTilt);
  tiltBtn.textContent = "📱 Desactivar control por inclinación";
  tiltBtn.classList.add("active");
  calibrateBtn.classList.remove("hidden");
  tiltStatus.textContent = "Sostén el celular cómodo y pulsa \"Recalibrar centro\"";
}

function disableTilt() {
  tiltEnabled = false;
  tiltBaseline = null;
  window.removeEventListener("deviceorientation", handleTilt);
  tiltBtn.textContent = "📱 Activar control por inclinación";
  tiltBtn.classList.remove("active");
  calibrateBtn.classList.add("hidden");
  tiltStatus.textContent = "";
}

tiltBtn.addEventListener("click", () => {
  if (tiltEnabled) {
    disableTilt();
    return;
  }

  if (typeof DeviceOrientationEvent === "undefined") {
    tiltStatus.textContent = "Tu dispositivo no soporta el sensor de inclinación";
    return;
  }

  if (typeof DeviceOrientationEvent.requestPermission === "function") {
    DeviceOrientationEvent.requestPermission()
      .then((state) => {
        if (state === "granted") {
          enableTilt();
        } else {
          tiltStatus.textContent = "Permiso de sensores denegado";
        }
      })
      .catch(() => {
        tiltStatus.textContent = "No se pudo acceder al sensor de inclinación";
      });
  } else {
    enableTilt();
  }
});

calibrateBtn.addEventListener("click", () => {
  tiltBaseline = null;
  tiltStatus.textContent = "Centrado. ¡Inclina para moverte!";
});

resetGame();
