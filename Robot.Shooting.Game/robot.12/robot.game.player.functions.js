//robot.game.player.functions.js

function drawPlayer(gameState) {

  if (gameState.player.isColliding) {
    gameState.player.flashTimer++;
    if (gameState.player.flashTimer % 10 === 0) {
      gameState.player.flashState = !gameState.player.flashState;
    }
  } else {
    gameState.player.flashState = false;
    gameState.player.flashTimer = 0;
  }

  gameState.ui.ctx.beginPath();
  gameState.ui.ctx.arc(gameState.player.x, gameState.player.y, gameState.player.radius, 0, Math.PI * 2);

  gameState.ui.ctx.fillStyle = (gameState.player.isColliding && gameState.player.flashState) ? "red" : "#ddd";

  gameState.ui.ctx.fill();
  gameState.ui.ctx.strokeStyle = "black";
  gameState.ui.ctx.stroke();

  const endX = gameState.player.x + Math.cos(gameState.player.angle) * (gameState.player.radius + 5);
  const endY = gameState.player.y + Math.sin(gameState.player.angle) * (gameState.player.radius + 5);

  gameState.ui.ctx.beginPath();
  gameState.ui.ctx.moveTo(gameState.player.x, gameState.player.y);
  gameState.ui.ctx.lineTo(endX, endY);
  gameState.ui.ctx.strokeStyle = "black";
  gameState.ui.ctx.lineWidth = 2;
  gameState.ui.ctx.stroke();
}



function updatePlayerManualMovementMode(gameState) {
    let nextX = gameState.player.x;
    let nextY = gameState.player.y;

    if (gameState.player.rotatingCCW) gameState.player.angle -= gameState.player.rotationSpeed;
    if (gameState.player.rotatingCW) gameState.player.angle += gameState.player.rotationSpeed;

    if (gameState.player.movingForward) {
      nextX += Math.cos(gameState.player.angle) * gameState.player.moveSpeed;
      nextY += Math.sin(gameState.player.angle) * gameState.player.moveSpeed;
    }

    if (gameState.player.movingBackward) {
      nextX -= Math.cos(gameState.player.angle) * gameState.player.moveSpeed;
      nextY -= Math.sin(gameState.player.angle) * gameState.player.moveSpeed;
    }

    if (!checkCollisions(gameState, nextX, nextY)) {
      gameState.player.x = nextX;
      gameState.player.y = nextY;
      gameState.player.isColliding = false;
    } else {
      gameState.player.isColliding = true;
    }
}

function playerRayDistance(angle) {

  const step = 4;
  let dist = 0;

  let x = gameState.player.x;
  let y = gameState.player.y;

  while (true) {
    x += Math.cos(angle) * step;
    y += Math.sin(angle) * step;
    dist += step;

    if (
      x < 0 || x > gameState.ui.canvas.width ||
      y < 0 || y > gameState.ui.canvas.height
    ) {
      return {
        distance: dist,
        hitRobot: false,
        robotId: null
      };
    }

    for (let o of gameState.obstacles) {
      if (x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h) {
        return {
          distance: dist,
          hitRobot: false,
          robotId: null
        };
      }
    }

    for (let i = 0; i < gameState.robots.length; i++) {
      const rb = gameState.robots[i];
      if (!rb) continue;

      const dx = x - rb.x;
      const dy = y - rb.y;
      const d2 = dx * dx + dy * dy;

      if (d2 < rb.radius * rb.radius) {
        return {
          distance: dist,
          hitRobot: true,
          robotId: i
        };
      }
    }
  }
}

function updatePlayerRandomMovementMode(gameState) {

    const forward = playerRayDistance(gameState.player.angle);
    const left = playerRayDistance(gameState.player.angle - Math.PI / 6);
    const right = playerRayDistance(gameState.player.angle + Math.PI / 6);

    const rays = [
      { dir: 0, data: forward },
      { dir: -Math.PI / 6, data: left },
      { dir:  Math.PI / 6, data: right }
    ];

    let best = null;

    for (const r of rays) {
      if (r.data.hitRobot) {
        if (!best || r.data.distance < best.data.distance) {
          best = r;
        }
      }
    }

    if (best) {

      const targetAngle = gameState.player.angle + best.dir;

      gameState.player.angle += (targetAngle - gameState.player.angle) * 0.2;

      // skip normal random movement this frame
      return;
    }

    let targetAngle = gameState.player.angle;

    if (left > forward && left > right) {
      targetAngle = gameState.player.angle - Math.PI / 6;
    } else if (right > forward && right > left) {
      targetAngle = gameState.player.angle + Math.PI / 6;
    }

    let bias = 0;

    if (left < right) {
      bias = +0.08;
    } else if (right < left) {
      bias = -0.08;
    }

    gameState.player.angle += (targetAngle - gameState.player.angle) * 0.2 + bias;

    let nextX = gameState.player.x + Math.cos(gameState.player.angle) * gameState.player.moveSpeed;
    let nextY = gameState.player.y + Math.sin(gameState.player.angle) * gameState.player.moveSpeed;

    if (checkCollisions(gameState, nextX, nextY)) {
      gameState.player.isColliding = true;

      const leftTry = gameState.player.angle - 0.4;
      const rightTry = gameState.player.angle + 0.4;

      const lx = gameState.player.x + Math.cos(leftTry) * gameState.player.moveSpeed;
      const ly = gameState.player.y + Math.sin(leftTry) * gameState.player.moveSpeed;

      const rx = gameState.player.x + Math.cos(rightTry) * gameState.player.moveSpeed;
      const ry = gameState.player.y + Math.sin(rightTry) * gameState.player.moveSpeed;

      if (!checkCollisions(gameState, lx, ly)) {
        gameState.player.angle = leftTry;
      } else if (!checkCollisions(gameState, rx, ry)) {
        gameState.player.angle = rightTry;
      } else {
        gameState.player.angle += (Math.random() - 0.5) * 1.2;
      }

    } else {
      gameState.player.isColliding = false;
      gameState.player.x = nextX;
      gameState.player.y = nextY;
    }


    if (gameState.player.isColliding) {
      gameState.stuckTimer++;

      if (gameState.stuckTimer > 60 && !gameState.stuckActive) { // ~1 second at 60fps
        gameState.stuckActive = true;

        triggerAutoRelocate(gameState);

        setTimeout(() => {
          gameState.stuckActive = false;
          gameState.stuckTimer = 0;
        }, 2500);
      }

    } else {
      gameState.stuckTimer = 0;
    }
}


function updatePlayer(gameState) {

  if (gameState.player.movementMode === "manual") {

    updatePlayerManualMovementMode(gameState);

  } else { //random movement mode

    updatePlayerRandomMovementMode(gameState);

  }
}

function relocatePlayerAvoiding(oldX, oldY) {

  let tries = 0;

  while (tries < 200) {
    const pos = randomPosition(gameState, gameState.player.radius);
    if (!pos) break;

    const dx = pos.x - oldX;
    const dy = pos.y - oldY;

    if (Math.sqrt(dx*dx + dy*dy) > gameState.player.radius * 4) {

      // placement
      gameState.player.x = pos.x;
      gameState.player.y = pos.y;

      // mimic canvas click behavior
      gameState.player.visible = true;
      gameState.placingPlayer = false;
      gameState.ui.appearBtn.classList.remove("active");

      return;
    }

    tries++;
  }
}


function triggerAutoRelocate(gameState) {

  const oldX = gameState.player.x;
  const oldY = gameState.player.y;

  gameState.ui.cloakBtn.click();

  setTimeout(() => {

    gameState.ui.appearBtn.click();

    setTimeout(() => {

      relocatePlayerAvoiding(oldX, oldY);

    }, 1000);

  }, 1000);
}

function firePlayerProjectile(gameState) {

  if (gameState.player.ammo <= 0) return;

  const startX = gameState.player.x + Math.cos(gameState.player.angle) * (gameState.player.radius + 6);
  const startY = gameState.player.y + Math.sin(gameState.player.angle) * (gameState.player.radius + 6);

  gameState.player.projectiles.push({
    x: startX,
    y: startY,
    angle: gameState.player.angle,
    speed: 5,
    radius: 3
  });

  gameState.player.ammo--;
}
