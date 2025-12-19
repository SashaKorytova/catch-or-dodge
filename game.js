// game.js
(() => {
  const C = window.GAME_CONFIG;
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const toast = document.getElementById("toast");
  const modal = document.getElementById("modal");
  const modalTitle = document.getElementById("modalTitle");
  const modalText = document.getElementById("modalText");

  const hudScore = document.getElementById("hudScore");
  const hudLives = document.getElementById("hudLives");
  const hudCombo = document.getElementById("hudCombo");
  const hudTime = document.getElementById("hudTime");

  const btnStart = document.getElementById("btnStart");
  const btnRestart = document.getElementById("btnRestart");
  const btnClose = document.getElementById("btnClose");
  const desktopGate = document.getElementById("desktopGate");

  canvas.width = C.canvas.width;
  canvas.height = C.canvas.height;

  const state = {
    running: false,
    paused: false,
    debug: false,
    startedAt: 0,
    lastFrame: 0,
    score: 0,
    lives: C.rules.lives,
    combo: 1,
    streak: 0,
    spawnTimer: 0,
    items: [],
    keys: { left: false, right: false }
  };

  // Optional assets
  const assets = new Map();
  function loadImage(key, src){
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { assets.set(key, img); resolve(true); };
      img.onerror = () => resolve(false);
      img.src = src;
    });
  }

  const manifest = [
    ["bg", C.backgroundImage],
    ["player-idle", C.playerImages.idle],
    ["player-happy", C.playerImages.happy],
    ["player-angry", C.playerImages.angry],
    ...C.goodItems.map(it => [it.id, it.image]),
    ...C.badItems.map(it => [it.id, it.image]),
  ];

  function showToast(text){
    toast.textContent = text;
    toast.classList.remove("hidden");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.add("hidden"), 1200);
  }

  function formatTime(ms){
    const s = Math.floor(ms/1000);
    const mm = String(Math.floor(s/60)).padStart(2,"0");
    const ss = String(s%60).padStart(2,"0");
    return `${mm}:${ss}`;
  }

  function gateDesktop(){
    desktopGate.classList.toggle("hidden", window.innerWidth >= 900);
  }
  window.addEventListener("resize", gateDesktop);
  gateDesktop();

  const player = {
    x: canvas.width/2,
    y: canvas.height - C.player.floorPadding - C.player.height/2,
    w: C.player.width,
    h: C.player.height,
    mood: "idle", // idle | happy | angry
    moodUntil: 0
  };

  function reset(){
    state.running = false;
    state.paused = false;
    state.startedAt = 0;
    state.lastFrame = 0;
    state.score = 0;
    state.lives = C.rules.lives;
    state.combo = 1;
    state.streak = 0;
    state.spawnTimer = 0;
    state.items = [];
    player.x = canvas.width/2;
    player.y = canvas.height - C.player.floorPadding - player.h/2;
    player.mood = "idle";
    player.moodUntil = 0;
    updateHUD();
  }

  function updateHUD(){
    hudScore.textContent = String(state.score);
    hudLives.textContent = String(state.lives);
    hudCombo.textContent = "x" + String(state.combo);
    hudTime.textContent = state.running ? formatTime(performance.now() - state.startedAt) : "00:00";
  }

  function openModal(title, text){
    modalTitle.textContent = title;
    modalText.textContent = text;
    modal.classList.remove("hidden");
  }
  function closeModal(){ modal.classList.add("hidden"); }

  function rand(a,b){ return a + Math.random()*(b-a); }
  function choice(arr){ return arr[(Math.random()*arr.length)|0]; }

  function difficulty(){
    const t = state.running ? (performance.now() - state.startedAt) / 1000 : 0;
    const step = Math.floor(t / 10);
    const gravity = C.physics.gravityBase + step * C.physics.gravityRamp;
    const spawn = Math.max(C.physics.spawnMin, C.physics.spawnBase - step * C.physics.spawnRamp);
    return { gravity, spawn };
  }

  function spawnItem(){
    const isGood = Math.random() < 0.62;
    const def = isGood ? choice(C.goodItems) : choice(C.badItems);
    const size = rand(C.items.sizeMin, C.items.sizeMax);
    state.items.push({
      kind: isGood ? "good" : "bad",
      id: def.id,
      x: rand(size/2, canvas.width - size/2),
      y: -size,
      vx: rand(-30, 30),
      vy: 0,
      size,
      rot: rand(0, Math.PI*2),
      spin: (C.items.spin ? rand(-2.2, 2.2) : 0),
      alive: true,
    });
  }

  function rectsOverlap(ax,ay,aw,ah, bx,by,bw,bh){
    return Math.abs(ax-bx) * 2 < (aw + bw) && Math.abs(ay-by) * 2 < (ah + bh);
  }

  function applyHit(kind){
    const moodMs = C.playerMoodMs ?? 260;
    if (kind === "good"){
      state.streak += 1;
      const every = C.rules.comboEvery;
      if (every > 0 && state.streak % every === 0){
        state.combo = Math.min(C.rules.comboMax, state.combo + 1);
        showToast("Комбо ↑ x" + state.combo);
      }
      state.score += C.rules.goodScore * state.combo;
      player.mood = "happy";
      player.moodUntil = performance.now() + moodMs;
    } else {
      state.streak = 0;
      state.combo = 1;
      state.score += C.rules.badScore;
      showToast("-1 😵");
      player.mood = "angry";
      player.moodUntil = performance.now() + moodMs;
      if (C.rules.badTakesLife){
        state.lives -= 1;
        showToast("Минус жизнь!");
      }
    }
    updateHUD();
  }

  function endGame(){
    state.running = false;
    const t = formatTime(performance.now() - state.startedAt);
    openModal("Игра окончена", `Время: ${t} • Счёт: ${state.score}. Нажми «Рестарт».`);
  }

  // Controls
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") state.keys.left = true;
    if (e.key === "ArrowRight") state.keys.right = true;
    if (e.key === " ") {
      if (!state.running) return;
      state.paused = !state.paused;
      showToast(state.paused ? "Пауза" : "Поехали");
    }
    if (e.key.toLowerCase() === "d"){
      state.debug = !state.debug;
      showToast(state.debug ? "DEBUG on" : "DEBUG off");
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft") state.keys.left = false;
    if (e.key === "ArrowRight") state.keys.right = false;
  });

  // Buttons
  btnStart.addEventListener("click", () => {
    closeModal();
    if (!state.running){
      state.running = true;
      state.paused = false;
      state.startedAt = performance.now();
      state.lastFrame = performance.now();
      showToast("Лови хорошие, избегай плохих!");
      requestAnimationFrame(loop);
    }
  });
  btnRestart.addEventListener("click", () => {
    closeModal();
    reset();
    state.running = true;
    state.startedAt = performance.now();
    state.lastFrame = performance.now();
    showToast("Рестарт!");
    requestAnimationFrame(loop);
  });
  btnClose.addEventListener("click", closeModal);

  // Drawing
  function drawBackground(){
    const bg = assets.get("bg");
    if (bg){
      const cw = canvas.width, ch = canvas.height;
      const ir = bg.width / bg.height;
      const cr = cw / ch;
      let dw, dh, dx, dy;
      if (ir > cr){
        dh = ch; dw = dh * ir; dx = (cw - dw)/2; dy = 0;
      } else {
        dw = cw; dh = dw / ir; dx = 0; dy = (ch - dh)/2;
      }
      ctx.drawImage(bg, dx, dy, dw, dh);
      ctx.fillStyle = "rgba(11,13,18,.28)";
      ctx.fillRect(0,0,cw,ch);
      return;
    }
    const g = ctx.createLinearGradient(0,0,0,canvas.height);
    g.addColorStop(0, "rgba(141,240,255,.12)");
    g.addColorStop(1, "rgba(255,179,255,.10)");
    ctx.fillStyle = g;
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = "rgba(11,13,18,.70)";
    ctx.fillRect(0,0,canvas.width,canvas.height);
  }

  function drawFloor(){
    const y = canvas.height - C.player.floorPadding;
    ctx.fillStyle = "rgba(255,255,255,.10)";
    ctx.fillRect(0, y, canvas.width, 2);
    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.fillRect(0, y+2, canvas.width, 10);
  }

  function drawSprite(key, x, y, w, h, rot){
    const img = assets.get(key);
    if (!img) return false;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.drawImage(img, -w/2, -h/2, w, h);
    ctx.restore();
    return true;
  }

  function drawFallbackPlayer(){
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.fillStyle = "rgba(255,255,255,.86)";
    ctx.strokeStyle = "rgba(141,240,255,.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-player.w/2, -player.h/2, player.w, player.h, 18);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.beginPath();
    ctx.arc(-player.w*0.18, -player.h*0.10, 6, 0, Math.PI*2);
    ctx.arc(+player.w*0.18, -player.h*0.10, 6, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  function drawPlayer(){
    // auto-return to idle after emotion timeout
    if (player.mood !== "idle" && performance.now() > player.moodUntil){
      player.mood = "idle";
    }

    const key =
      player.mood === "happy" ? "player-happy" :
      player.mood === "angry" ? "player-angry" :
      "player-idle";

    if (!drawSprite(key, player.x, player.y, player.w, player.h, 0)){
      // Fallback: same body, different mouth depending on mood
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.fillStyle = "rgba(255,255,255,.86)";
      ctx.strokeStyle = "rgba(141,240,255,.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-player.w/2, -player.h/2, player.w, player.h, 18);
      ctx.fill();
      ctx.stroke();

      // eyes
      ctx.fillStyle = "rgba(0,0,0,.18)";
      ctx.beginPath();
      ctx.arc(-player.w*0.18, -player.h*0.10, 6, 0, Math.PI*2);
      ctx.arc(+player.w*0.18, -player.h*0.10, 6, 0, Math.PI*2);
      ctx.fill();

      // mouth
      ctx.strokeStyle = "rgba(0,0,0,.22)";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      if (player.mood === "happy"){
        ctx.arc(0, player.h*0.06, player.w*0.18, 0.1*Math.PI, 0.9*Math.PI, false);
      } else if (player.mood === "angry"){
        ctx.arc(0, player.h*0.18, player.w*0.18, 1.1*Math.PI, 1.9*Math.PI, false);
      } else {
        ctx.moveTo(-player.w*0.16, player.h*0.14);
        ctx.lineTo(+player.w*0.16, player.h*0.14);
      }
      ctx.stroke();
      ctx.restore();
    }

    if (state.debug){
      const s = C.player.hitboxScale;
      ctx.strokeStyle = "rgba(255,255,255,.7)";
      ctx.lineWidth = 2;
      ctx.strokeRect(player.x - (player.w*s)/2, player.y - (player.h*s)/2, player.w*s, player.h*s);
    }
  }


  function drawFallbackItem(it){
    ctx.save();
    ctx.translate(it.x, it.y);
    ctx.rotate(it.rot);
    ctx.fillStyle = it.kind === "good" ? "rgba(141,240,255,.85)" : "rgba(255,179,255,.80)";
    ctx.strokeStyle = "rgba(255,255,255,.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-it.size/2, -it.size/2, it.size, it.size, 14);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawItem(it){
    if (!drawSprite(it.id, it.x, it.y, it.size, it.size, it.rot)){
      drawFallbackItem(it);
    }
    if (state.debug){
      ctx.strokeStyle = it.kind === "good" ? "rgba(141,240,255,.6)" : "rgba(255,179,255,.6)";
      ctx.lineWidth = 2;
      ctx.strokeRect(it.x - it.size/2, it.y - it.size/2, it.size, it.size);
    }
  }

  function loop(now){
    if (!state.running) return;
    const dt = Math.min(0.033, (now - state.lastFrame) / 1000);
    state.lastFrame = now;

    if (!state.paused){
      const dir = (state.keys.right ? 1 : 0) - (state.keys.left ? 1 : 0);
      player.x += dir * C.player.speed * dt;
      const halfW = player.w/2;
      player.x = Math.max(halfW, Math.min(canvas.width - halfW, player.x));

      const { gravity, spawn } = difficulty();
      state.spawnTimer += dt;
      if (state.spawnTimer >= spawn){
        state.spawnTimer = 0;
        spawnItem();
      }

      for (const it of state.items){
        if (!it.alive) continue;
        it.vy += gravity * dt;
        it.x += it.vx * dt;
        it.y += it.vy * dt;
        it.rot += it.spin * dt;

        if (it.x < it.size/2 || it.x > canvas.width - it.size/2){
          it.vx *= -1;
          it.x = Math.max(it.size/2, Math.min(canvas.width - it.size/2, it.x));
        }

        const s = C.player.hitboxScale;
        const hit = rectsOverlap(it.x, it.y, it.size, it.size, player.x, player.y, player.w*s, player.h*s);
        if (hit){
          it.alive = false;
          applyHit(it.kind);
          if (state.lives <= 0) endGame();
        }

        if (it.y - it.size/2 > canvas.height + 30){
          it.alive = false;
          if (it.kind === "good"){
            state.streak = 0;
            state.combo = 1;
            updateHUD();
          }
        }
      }
      state.items = state.items.filter(it => it.alive);
      hudTime.textContent = formatTime(now - state.startedAt);
    }

    ctx.clearRect(0,0,canvas.width,canvas.height);
    drawBackground();
    drawFloor();
    for (const it of state.items) drawItem(it);
    drawPlayer();

    if (state.paused){
      ctx.fillStyle = "rgba(0,0,0,.35)";
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = "rgba(255,255,255,.92)";
      ctx.font = "700 44px ui-sans-serif, system-ui, -apple-system";
      ctx.textAlign = "center";
      ctx.fillText("Пауза", canvas.width/2, canvas.height/2 - 10);
      ctx.font = "500 18px ui-sans-serif, system-ui, -apple-system";
      ctx.fillStyle = "rgba(255,255,255,.70)";
      ctx.fillText("Space — продолжить", canvas.width/2, canvas.height/2 + 22);
    }

    requestAnimationFrame(loop);
  }

  async function boot(){
    reset();
    const results = await Promise.all(manifest.map(([k, src]) => loadImage(k, src)));
    const okCount = results.filter(Boolean).length;
    openModal("Готово!", `Загружено спрайтов: ${okCount}/${manifest.length}. Нажми «Старт».`);
  }

  boot();
})();
