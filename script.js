// ===== Canvas & Setup =====
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
resizeCanvas();

window.addEventListener("resize", () => {
  resizeCanvas();
  if (!isPaused && !isGameOver && gameStarted) animate();
});

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

// ===== Assets =====
const playerImage = new Image(); playerImage.src = "assets/player.png";
const enemyImage = new Image(); enemyImage.src = "assets/enemy.png";
const heartImage = new Image(); heartImage.src = "assets/heart.png";
const shieldImage = new Image(); shieldImage.src = "assets/shield.png";

// ===== Audio =====
const audioIntro = new Audio("assets/audio/intro.mp3");
const audioGameOver = new Audio("assets/audio/gameover.mp3");
audioIntro.loop = true;
audioGameOver.loop = false;

const sfxStart = new Audio("assets/audio/start.wav");
const sfxHit = new Audio("assets/audio/hit.wav");
const sfxHeart = new Audio("assets/audio/heal.wav");
const sfxPoint = new Audio("assets/audio/point.wav");
const sfxShield = new Audio("assets/audio/shield.wav");
const sfxShieldBreak = new Audio("assets/audio/shieldbreak.wav");

// ===== Game State =====
let player = { x: 0, y: 0, size: 96 };
let mouse = { x: 0, y: 0 };
let startTime = 0;
let pausedAt = 0;
let totalPausedDuration = 0;
let gameSpeed = 1;
let isGameOver = false;
let isPaused = false;
let gameStarted = false;

let lives = 3;
let wave = 1;
let nextWaveTime = 20000;
let shieldActive = false;
let shieldExpiresAt = 0;

let currentScore = 0;
let totalScore = 0;

let enemies = [];
let airItems = [];
let heartItems = [];
let shieldItems = [];
let floatingScores = [];

let nextHeartSpawn = 0;
let nextShieldSpawn = 0;
let nextEnemySpawn = 0;
let nextAirWhite = 0;
let nextAirGold = 0;
let nextAirEmerald = 0;

let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;

document.addEventListener("mousemove", (e) => {
  if (document.pointerLockElement === canvas && gameStarted && !isPaused && !isGameOver) {
    mouseX += e.movementX;
    mouseY += e.movementY;

    // Clamp posisi mouse agar tidak keluar dari canvas
    mouseX = Math.max(0, Math.min(canvas.width, mouseX));
    mouseY = Math.max(0, Math.min(canvas.height, mouseY));

    mouse.x = mouseX;
    mouse.y = mouseY;
  }
});

// ===== Utilities =====
function getRandomHeartDelay() {
  return 8000 + Math.random() * 7000;
}
function getEnemySpawnDelay() {
  const t = (Date.now() - startTime - totalPausedDuration) / 1000;
  if (t > 90) return 500;
  if (t > 60) return 800;
  if (t > 40) return 1100;
  if (t > 20) return 1400;
  return 1800;
}

// ===== Player =====
function updatePlayer() {
  const dx = mouse.x - (player.x + player.size / 2);
  const dy = mouse.y - (player.y + player.size / 2);
  player.x += dx * 0.08;
  player.y += dy * 0.08;
  player.x = Math.max(0, Math.min(canvas.width - player.size, player.x));
  player.y = Math.max(0, Math.min(canvas.height - player.size, player.y));
}
function drawPlayer() {
  ctx.drawImage(playerImage, player.x, player.y, player.size, player.size);
}

// ===== Enemies =====
function spawnEnemy() {
  const timeSurvived = (Date.now() - startTime - totalPausedDuration) / 1000;
  const baseSpeed = 1.5 + timeSurvived / 30;
  const size = 96;
  const edge = Math.floor(Math.random() * 4);
  let x, y;
  if (edge === 0) x = -100, y = Math.random() * canvas.height;
  else if (edge === 1) x = canvas.width + 100, y = Math.random() * canvas.height;
  else if (edge === 2) x = Math.random() * canvas.width, y = -100;
  else x = Math.random() * canvas.width, y = canvas.height + 100;

  const angle = Math.atan2(player.y - y, player.x - x);
  let dx = Math.cos(angle) * baseSpeed;
  let dy = Math.sin(angle) * baseSpeed;

  let type = "normal";
  if (wave >= 3 && Math.random() < 0.3) type = "fast";
  if (wave >= 5 && Math.random() < 0.25) type = "tank";
  if (wave >= 7 && Math.random() < 0.2) type = "zigzag";
  if (wave >= 10 && Math.random() < 0.2) type = "seeker";

  let hp = 1, finalSize = size, extra = {};
  if (type === "fast") { finalSize = 70; dx *= 2; dy *= 2; }
  else if (type === "tank") { finalSize = 130; dx *= 0.5; dy *= 0.5; hp = 2; }
  else if (type === "zigzag") {
    extra.baseY = y;
    extra.offset = Math.random() * 100;
    extra.amplitude = 50 + Math.random() * 30;
    extra.freq = 0.05 + Math.random() * 0.03;
  }

  enemies.push({ x, y, dx, dy, size: finalSize, type, hp, extra });
}

function updateEnemies() {
  const now = Date.now();
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.type === "zigzag") {
      e.x += e.dx;
      e.y = e.extra.baseY + Math.sin(now * e.extra.freq + e.extra.offset) * e.extra.amplitude;
    } else if (e.type === "seeker") {
      const angle = Math.atan2(player.y - e.y, player.x - e.x);
      const speed = 2.5 + gameSpeed / 2;
      e.x += Math.cos(angle) * speed;
      e.y += Math.sin(angle) * speed;
    } else {
      e.x += e.dx;
      e.y += e.dy;
    }

    if (e.x < -200 || e.x > canvas.width + 200 || e.y < -200 || e.y > canvas.height + 200) {
      enemies.splice(i, 1);
      continue;
    }

    const dx = e.x + e.size / 2 - (player.x + player.size / 2);
    const dy = e.y + e.size / 2 - (player.y + player.size / 2);
    const dist = Math.hypot(dx, dy);

    if (dist < e.size / 2 + player.size / 2) {
      if (shieldActive) {
        shieldActive = false;
        sfxShieldBreak.play();
        enemies.splice(i, 1);
      } else {
        if (e.hp > 1) e.hp--;
        else {
          if (e.type === "tank") {
            totalScore += 3;
            addFloatingScore(player.x, player.y - 10, 3);
          }
          enemies.splice(i, 1);
        }
        lives--;
        updateLives();
        sfxHit.currentTime = 0;
        sfxHit.play();
        if (lives <= 0) endGame();
      }
    }
  }
}

function drawEnemies() {
  enemies.forEach(e => ctx.drawImage(enemyImage, e.x, e.y, e.size, e.size));
}

// ===== Heart =====
function spawnHeart() {
  const size = 30;
  heartItems.push({ size, x: Math.random() * (canvas.width - size), y: Math.random() * (canvas.height - size), createdAt: Date.now() });
}
function updateHearts() {
  const now = Date.now();
  for (let i = heartItems.length - 1; i >= 0; i--) {
    const h = heartItems[i];
    if (now - h.createdAt > 5000) {
      heartItems.splice(i, 1);
      continue;
    }

    const dx = h.x + h.size / 2 - (player.x + player.size / 2);
    const dy = h.y + h.size / 2 - (player.y + player.size / 2);
    const dist = Math.hypot(dx, dy);

    if (dist < h.size / 2 + player.size / 2) {
      if (lives < 3) {
        lives++;
        updateLives();
      }
      sfxHeart.play();  // ← SELALU mainkan, walau nyawa tidak bertambah
      heartItems.splice(i, 1);
    }
  }
}

function drawHearts() {
  heartItems.forEach(h => ctx.drawImage(heartImage, h.x, h.y, h.size, h.size));
}

// ===== Shield =====
function spawnShield() {
  const size = 36;
  shieldItems.push({ size, x: Math.random() * (canvas.width - size), y: Math.random() * (canvas.height - size), createdAt: Date.now() });
}
function updateShields() {
  const now = Date.now();
  for (let i = shieldItems.length - 1; i >= 0; i--) {
    const s = shieldItems[i];
    if (now - s.createdAt > 10000) {
      shieldItems.splice(i, 1);
      continue;
    }
    const dx = s.x + s.size / 2 - (player.x + player.size / 2);
    const dy = s.y + s.size / 2 - (player.y + player.size / 2);
    const dist = Math.hypot(dx, dy);
    if (dist < s.size / 2 + player.size / 2) {
      shieldActive = true;
      shieldExpiresAt = now + 10000;
      sfxShield.currentTime = 0;
      sfxShield.play();
      shieldItems.splice(i, 1);
    }
  }
  if (shieldActive && Date.now() > shieldExpiresAt) shieldActive = false;
}
function drawShields() {
  shieldItems.forEach(s => ctx.drawImage(shieldImage, s.x, s.y, s.size, s.size));
}

// ===== $AIR Items =====
function spawnAir(type) {
  const size = 40;
  let x = Math.random() * (canvas.width - size);
  let y = Math.random() * (canvas.height - size);
  airItems.push({ x, y, size, type, createdAt: Date.now() });
}
function updateAirItems() {
  const now = Date.now();
  for (let i = airItems.length - 1; i >= 0; i--) {
    const a = airItems[i];
    if (now - a.createdAt > 5000) {
      airItems.splice(i, 1);
      continue;
    }
    const dx = a.x + a.size / 2 - (player.x + player.size / 2);
    const dy = a.y + a.size / 2 - (player.y + player.size / 2);
    const dist = Math.hypot(dx, dy);
    if (dist < a.size / 2 + player.size / 2) {
      let bonus = 1;
      if (a.type === "gold") bonus = 5;
      if (a.type === "platinum") bonus = 10;
      totalScore += bonus;
      sfxPoint.currentTime = 0;
      sfxPoint.play();
      addFloatingScore(player.x, player.y - 10, bonus);
      airItems.splice(i, 1);
    }
  }
}
function drawAirItems() {
  airItems.forEach(a => {
    ctx.font = "bold 16px 'Press Start 2P'";
    ctx.textAlign = "center";
    ctx.fillStyle = a.type === "platinum" ? "#50c878" : a.type === "gold" ? "gold" : "white";
    ctx.fillText("$AIR", a.x + a.size / 2, a.y + a.size);
  });
}

// ===== Floating Scores =====
function addFloatingScore(x, y, value) {
  floatingScores.push({ x, y, value, createdAt: Date.now() });
}
function drawFloatingScores() {
  const now = Date.now();
  for (let i = floatingScores.length - 1; i >= 0; i--) {
    const fs = floatingScores[i];
    const elapsed = (now - fs.createdAt) / 1000;
    if (elapsed > 1) {
      floatingScores.splice(i, 1);
      continue;
    }
    ctx.globalAlpha = 1 - elapsed;
    ctx.fillStyle = "white";
    ctx.font = "14px 'Press Start 2P'";
    ctx.fillText(`+${fs.value}`, fs.x, fs.y - elapsed * 30);
    ctx.globalAlpha = 1;
  }
}

// ===== HUD =====
function updateLives() {
  const hearts = document.getElementById("hearts");
  hearts.innerHTML = "";
  for (let i = 0; i < 3; i++) {
    const heart = document.createElement("img");
    heart.src = "assets/heart.png";
    heart.className = "life";
    if (i >= lives) heart.style.filter = "grayscale(100%)";
    hearts.appendChild(heart);
  }
}
function drawScore() {
  currentScore = Math.floor((Date.now() - startTime - totalPausedDuration) / 1000);
  ctx.fillStyle = "white";
  ctx.font = "16px 'Press Start 2P'";
  ctx.textAlign = "left";
  ctx.fillText(`TIME: ${currentScore}s`, 40, 40);
}
function drawTotalScore() {
  ctx.fillStyle = "#00ffcc";
  ctx.font = "14px 'Press Start 2P'";
  ctx.fillText(`SCORE: ${totalScore}`, 40, 70);
}
function drawWaveNotification() {
  ctx.fillStyle = "yellow";
  ctx.font = "20px 'Press Start 2P'";
  ctx.textAlign = "center";
  ctx.fillText(`WAVE ${wave}`, canvas.width / 2, 60);
}
function drawShieldEffect() {
  if (!shieldActive) return;
  ctx.strokeStyle = "cyan";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(player.x + player.size / 2, player.y + player.size / 2, player.size / 2 + 6, 0, Math.PI * 2);
  ctx.stroke();
}

// ===== Game End =====
function endGame() {
  isGameOver = true;
  canvas.classList.remove("hide-cursor");
  document.getElementById("game-over").style.display = "flex";
  const finalTime = Math.floor((Date.now() - startTime - totalPausedDuration) / 1000);
  document.getElementById("final-score").textContent = `Final Score: ${totalScore}`;
  document.getElementById("final-time").textContent = `Time Survived: ${finalTime}s`;

  if (document.pointerLockElement === canvas) {
    document.exitPointerLock();
  }

  // Tambahan: pastikan cursor muncul
  canvas.style.cursor = "default";
  canvas.classList.remove("hide-cursor");
  document.body.style.cursor = "default"; 

  if (audioIntro) audioIntro.pause();
  if (audioGameOver) {
    audioGameOver.currentTime = 0;
    audioGameOver.play().catch(() => {});
  }
  if (sfxHit) {
    sfxHit.currentTime = 0;
    sfxHit.play().catch(() => {});
  }

  let bestTime = localStorage.getItem("bestTime") || 0;
  if (finalTime > bestTime) {
    bestTime = finalTime;
    localStorage.setItem("bestTime", bestTime);
  }
  document.getElementById("best-time").textContent = `Best Time: ${bestTime}s`;

  let bestScore = localStorage.getItem("bestScore") || 0;
  if (totalScore > bestScore) {
    bestScore = totalScore;
    localStorage.setItem("bestScore", bestScore);
  }
  document.getElementById("best-score").textContent = `Best Score: ${bestScore}`;
}

// ===== Game Loop =====
function updateSpeed() {
  const t = (Date.now() - startTime - totalPausedDuration) / 1000;
  gameSpeed = 1 + t / 20;
}

function animate() {
  if (!gameStarted || isGameOver || isPaused) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  updatePlayer();
  updateEnemies();
  updateHearts();
  updateShields();
  updateAirItems();
  updateSpeed();

  drawAirItems();
  drawHearts();
  drawShields();
  drawEnemies();
  drawPlayer();
  drawShieldEffect();
  drawScore();
  drawTotalScore();
  drawWaveNotification();
  drawFloatingScores();

  const now = Date.now();
  if (now > nextHeartSpawn) {
    spawnHeart();
    nextHeartSpawn = now + getRandomHeartDelay();
  }
  if (now > nextShieldSpawn) {
    spawnShield();
    nextShieldSpawn = now + 25000 + Math.random() * 15000;
  }
  if (now > nextEnemySpawn) {
    spawnEnemy();
    nextEnemySpawn = now + getEnemySpawnDelay();
  }
  if (now - startTime - totalPausedDuration > nextWaveTime) {
    wave++;
    nextWaveTime += 20000;
  }
  if (now > nextAirWhite) {
    spawnAir("white");
    nextAirWhite = now + 1000 + Math.random() * 2000;
  }
  if (wave >= 3 && now > nextAirGold) {
    spawnAir("gold");
    nextAirGold = now + 6000 + Math.random() * 4000;
  }
  if (wave >= 7 && now > nextAirEmerald) {
    spawnAir("platinum");
    nextAirEmerald = now + 10000 + Math.random() * 10000;
  }

  requestAnimationFrame(animate);
}

// ===== Mouse Control =====
canvas.addEventListener("mousemove", e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

// ===== Auto-pause saat tab blur =====
window.addEventListener("blur", () => {
  if (gameStarted && !isGameOver && !isPaused) {
    isPaused = true;
    pausedAt = Date.now();
    document.getElementById("pause-menu").style.display = "flex";
    canvas.classList.remove("hide-cursor");
  }
});

// ===== ESC to Pause/Resume =====
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && gameStarted && !isGameOver) {
    isPaused = !isPaused;

    if (isPaused) {
      pausedAt = Date.now();
      document.getElementById("pause-menu").style.display = "flex";
      canvas.classList.remove("hide-cursor");
    } else {
      totalPausedDuration += Date.now() - pausedAt;
      pausedAt = 0;
      document.getElementById("pause-menu").style.display = "none";
      canvas.classList.add("hide-cursor");
      animate();
    }
  }
});

// ===== Pause Button =====
document.getElementById("pause-btn").addEventListener("click", () => {
  if (!gameStarted || isGameOver) return;
  if (!isPaused) {
    isPaused = true;
    pausedAt = Date.now();
    document.getElementById("pause-menu").style.display = "flex";
    canvas.classList.remove("hide-cursor");
  }
});

// ===== Resume Button =====
document.getElementById("resume").addEventListener("click", () => {
  if (isPaused) {
    isPaused = false;
    totalPausedDuration += Date.now() - pausedAt;
    pausedAt = 0;
    document.getElementById("pause-menu").style.display = "none";
    canvas.classList.add("hide-cursor");
    animate();
  }
});

// ===== Start Button =====
document.getElementById("start-btn").addEventListener("click", () => {
  canvas.requestPointerLock();
  audioIntro.play();
  if (sfxStart) {
    sfxStart.currentTime = 0;
    sfxStart.play().catch(() => {});
  }
  if (audioIntro) {
    audioIntro.pause();
    audioIntro.currentTime = 0;
  }

  document.getElementById("start-screen").style.display = "none";
  document.getElementById("background-start").style.display = "none"; 
  document.getElementById("lives").style.display = "flex";

  gameStarted = true;
  startTime = Date.now();
  totalScore = 0;
  pausedAt = 0;
  totalPausedDuration = 0;
  lives = 3;
  enemies = [];
  airItems = [];
  heartItems = [];
  shieldItems = [];
  floatingScores = [];
  wave = 1;
  nextWaveTime = 20000;

  updateLives();
  canvas.classList.add("hide-cursor");
  animate();
});

// ===== Restart Button =====
document.getElementById("restart").addEventListener("click", () => {
  window.location.reload();
});

// ===== Exit Buttons =====
document.getElementById("exit").addEventListener("click", () => {
  window.location.reload();
});
document.getElementById("exit-gameover").addEventListener("click", () => {
  window.location.reload();
});

// ===== Responsive Canvas =====
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", () => {
  resizeCanvas();
  if (gameStarted && !isPaused && !isGameOver) animate();
});

// ===== On Load =====
window.onload = () => {
  document.getElementById("game-over").style.display = "none";
  document.getElementById("pause-menu").style.display = "none";
  document.getElementById("start-screen").style.display = "flex";
  canvas.classList.remove("hide-cursor");

  // Autoplay intro music only if allowed by user gesture
  if (audioIntro) {
    audioIntro.volume = 0.5;
    audioIntro.play().catch(() => {
      // Autoplay blocked, wait for user gesture
    });
  }
};

window.addEventListener("click", () => {
  if (!gameStarted && audioIntro.paused) {
    audioIntro.play().catch(e => console.warn("Intro blocked:", e));
  }
}, { once: true });

// ===== Verifikasi Audio Loaded =====
const sfxFiles = [sfxStart, sfxHit, sfxHeart, sfxPoint, sfxShield];
sfxFiles.forEach(sfx => {
  sfx.load();
  sfx.volume = 0.8;
});