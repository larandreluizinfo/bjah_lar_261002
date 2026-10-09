(function () {
  "use strict";

  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
  var W = canvas.width, H = canvas.height;

  var elPhase = document.getElementById("phaseValue");
  var elBar = document.getElementById("barValue");
  var elHeight = document.getElementById("heightValue");
  var elWind = document.getElementById("windValue");
  var elBest = document.getElementById("bestValue");
  var elScore = document.getElementById("scoreValue");
  var elPower = document.getElementById("powerFill");
  var elOverlay = document.getElementById("overlay");
  var elResult = document.getElementById("result");
  var elTitle = document.getElementById("resultTitle");
  var elText = document.getElementById("resultText");

  // ---- unidades reais: metros e m/s ----
  var PX_PER_M = 26;
  var GROUND_Y = H - 84;
  var G = 9.81;

  var RUN_START = -14;
  var PLANT_X = 0;          // caixa de planting
  var MAT_X = 1.1;          // colchão de queda
  var MAT_W = 4.4;

  var MAX_RUN = 9.4;        // m/s ~ 34 km/h
  var POLE_LEN = 5.0;       // metros de vara
  var ATHLETE = 1.82;       // altura do atleta

  var PHASES = [
    "Corrida de aproximação",
    "Batida na caixa",
    "Impulso (a vara curva)",
    "Subida / passagem",
    "Queda no colchão"
  ];

  var p, barH, wind, score, best, running, over, phase;
  var speedBar, camX, planted, poleAngle, poleEnergy, poleState;
  var pendingBar, mats, trail, dust, last;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function fmt(v) { return v.toFixed(2).replace(".", ",") + " m"; }
  function wx(x) { return x * PX_PER_M - camX; }

  function loadBest() {
    try { return parseFloat(localStorage.getItem("varaBest") || "0") || 0; }
    catch (e) { return 0; }
  }
  function saveBest(v) {
    try { localStorage.setItem("varaBest", String(v)); } catch (e) { void e; }
  }

  function reset() {
    wind = rnd(-3.5, 2.0);         // vento a favor é raro; contra é mais comum
    score = 0;
    running = true;
    over = false;
    planted = false;
    poleState = "run";
    poleAngle = 0;
    poleEnergy = 0;
    mats = [];
    trail = [];
    dust = [];
    phase = 0;

    p = {
      x: RUN_START,
      y: 0,
      vx: 2.4,
      vy: 0,
      swing: 0,
      lean: 0.25,
      tucked: 0,
      rotate: 0,
      handPos: 0
    };

    elResult.hidden = true;
    elOverlay.hidden = true;
    elBest.textContent = fmt(best);
    sync();
  }

  // ================= física =================
  function plant() {
    if (!running || over) return;
    if (planted) return;
    planted = true;
    poleState = "plant";
    phase = 1;

    // velocidade na chegada vira energia da vara
    var v = Math.max(2, p.vx);
    poleEnergy = Math.min(1, v / MAX_RUN);
    p.vx *= 0.9;
    burst(12);
    score += 40;
    sync();
  }

  function finish(h, cleared) {
    over = true;
    var m = barH;
    if (h > best) { best = h; saveBest(best); elBest.textContent = fmt(best); }

    if (cleared) {
      score += 300 + Math.round((h - m) * 60);
      elTitle.textContent = "🏆 Passou! " + fmt(h);
      elText.textContent =
        "Superou a barra de " + fmt(m) + " com " + fmt(h) +
        ". Subiu mais " + fmt(h - m) + " e ganhou " + score + " pontos. Total: " + fmt(best) + ".";
    } else {
      score += 80;
      elTitle.textContent = "🟥 Caiu da barra";
      elText.textContent =
        "Chegou a " + fmt(h) + " e a barra estava em " + fmt(m) +
        ". Faltaram " + fmt(Math.max(0, m - h)) + ". Tente plantar mais perto da caixa ou com mais velocidade.";
    }
    elResult.hidden = false;
  }

  function update(dt) {
    if (!running || over) return;

    if (poleState === "run") {
      p.vx += Math.min(1, MAX_RUN / Math.max(1, p.vx)) * 3.0 * dt;
      p.vx -= p.vx * 0.02 * dt;
      p.vx = Math.min(MAX_RUN, p.vx);
      p.swing += dt * p.vx * 1.15;
      p.x += p.vx * dt;

      if (p.x > PLANT_X) {
        // passou da caixa: perde tempo e força
        p.vx *= 0.5;
        poleState = "missed";
      }
    } else if (poleState === "plant" || poleState === "swing" || poleState === "rise" || poleState === "fall") {
      swingPhysics(dt);
    }

    // barra sobe de altura a cada acerto
    if (poleState === "rise" && !over) {
      var top = p.y + ATHLETE;
      elHeight.textContent = fmt(Math.max(0, top));
      if (top > barH && p.x > MAT_X - 0.2 && p.x < MAT_X + MAT_W) {
        barH = Math.round((top + 0.05) * 20) / 20;
        score += 200;
        poleState = "fall";
        cleared = true;
      }
    }

    // ventania empurra levemente
    p.vy -= wind * 0.06 * dt * (poleState === "rise" ? 1 : 0.4);

    for (var i = dust.length - 1; i >= 0; i--) {
      var d = dust[i];
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy -= 4 * dt;
      d.life -= dt * 0.7;
      if (d.life <= 0) dust.splice(i, 1);
    }

    trail.push({ x: p.x, y: p.y });
    if (trail.length > 200) trail.shift();

    var target = p.x * PX_PER_M - W * 0.35;
    camX += (target - camX) * Math.min(1, dt * 5);
  }

  var cleared = false;

  function swingPhysics(dt) {
    // fases: plant -> swing (a vara empurra) -> rise (sobe) -> fall
    var k = 0.35 + poleEnergy * 0.65;

    if (poleState === "plant") {
      poleAngle = Math.min(0.85, poleAngle + dt * 1.6);
      p.vx *= 0.97;
      p.vy -= 2 * dt;
      if (poleAngle >= 0.85) { poleState = "swing"; phase = 2; }
    }

    if (poleState === "swing") {
      // a vara endireita e lança o atleta pra cima
      poleAngle = Math.max(0, poleAngle - dt * 2.2);
      p.vx += 1.6 * k * dt;
      p.vx *= 0.995;
      p.vy += 26 * k * dt;      // impulso vertical
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.lean = 1.1;
      if (p.vy > 1.5 && p.y > 0.15) { poleState = "rise"; phase = 3; }
      if (p.y < 0) { p.y = 0; failGround(); }
    }

    if (poleState === "rise") {
      p.vy -= G * dt;
      p.y += p.vy * dt;
      p.x += p.vx * dt;
      p.tucked = Math.min(1, p.tucked + dt * 2.2);
      p.rotate += dt * 1.6;
      poleAngle = Math.max(0, poleAngle - dt * 1.4);

      // colisão com a barra
      var top = p.y + ATHLETE;
      if (p.x > PLANT_X - 0.2 && p.x < MAT_X + MAT_W && !cleared) {
        if (top < barH && p.y < barH) {
          failBar(top);
          return;
        }
      }
      if (p.vy < 0 && p.y < 0.1) { failGround(); return; }
      if (p.vy < -1 && top < barH - 0.3) { failBar(top); return; }
    }

    if (poleState === "fall") {
      p.vy -= G * dt;
      p.y += p.vy * dt;
      p.x += p.vx * dt;
      p.tucked = Math.max(0, p.tucked - dt * 1.2);
      if (p.y <= 0) {
        p.y = 0;
        burst(16);
        mats.push({ x: p.x });
        finish(Math.min(barH + (cleared ? 0.01 : 0), barH), cleared);
      }
    }
  }

  function failBar(top) {
    poleState = "fall";
    cleared = false;
    p.vy = Math.min(p.vy, -1);
    burst(6);
    void top;
  }

  function failGround() {
    p.y = 0;
    poleState = "fall";
    cleared = false;
    burst(10);
    finish(Math.max(0, p.y + ATHLETE * 0.2), false);
  }

  function burst(n) {
    for (var i = 0; i < n; i++) {
      dust.push({
        x: p.x + rnd(-0.3, 0.3),
        y: rnd(0, 0.2),
        r: rnd(0.03, 0.09),
        vx: rnd(-2, 1),
        vy: rnd(0.3, 2),
        life: 1
      });
    }
  }

  // ================= HUD =================
  function sync() {
    elPhase.textContent = PHASES[Math.min(phase, 4)];
    elBar.textContent = fmt(barH);
    elHeight.textContent = fmt(Math.max(0, p.y + (planted ? ATHLETE : 0)));
    elWind.textContent = (wind > 0 ? "→ " : wind < 0 ? "← " : "· ") + Math.abs(wind).toFixed(1) + " m/s";
    elWind.className = Math.abs(wind) > 2 ? "strong" : "";
    elScore.textContent = score;
    var pct = Math.min(100, (p.vx / MAX_RUN) * 100);
    elPower.style.width = pct + "%";
  }

  // ================= desenho =================
  function drawSky() {
    var g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    g.addColorStop(0, "#2c6bb2");
    g.addColorStop(0.6, "#6fb0e4");
    g.addColorStop(1, "#c5e2f5");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    var sx = 140, sy = 70;
    var sg = ctx.createRadialGradient(sx, sy, 8, sx, sy, 80);
    sg.addColorStop(0, "rgba(255,250,220,0.85)");
    sg.addColorStop(1, "rgba(255,250,220,0)");
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(sx, sy, 80, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fffdf0";
    ctx.beginPath(); ctx.arc(sx, sy, 24, 0, Math.PI * 2); ctx.fill();

    for (var i = -1; i < 4; i++) cloud(wx(24 + i * 34) - 60, 60 + (i % 2) * 34, 1);
  }

  function cloud(x, y, s) {
    if (x < -240 || x > W + 240) return;
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.beginPath();
    ctx.ellipse(x, y, 50 * s, 23 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 38 * s, y + 7 * s, 36 * s, 18 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 34 * s, y + 9 * s, 32 * s, 16 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawStands() {
    ctx.fillStyle = "#20364b";
    ctx.fillRect(0, 40, W, GROUND_Y - 40);
    for (var r = 0; r < 6; r++) {
      var y = 46 + r * 22;
      ctx.fillStyle = r % 2 ? "#294156" : "#2e4a62";
      ctx.fillRect(0, y, W, 20);
      for (var i = 0; i < 100; i++) {
        var seed = (i * 2654435761 + r * 40503) % 997;
        var x = i * 10 - (camX * 0.1) % 10;
        ctx.fillStyle = "hsl(" + (seed % 360) + ",45%," + (44 + (seed % 16)) + "%)";
        ctx.beginPath();
        ctx.arc(x + ((seed % 7) - 3), y + 11, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = "#16283a";
    ctx.fillRect(0, 20, W, 20);
  }

  function drawGround() {
    var y = GROUND_Y;
    ctx.fillStyle = "#bb4436";
    ctx.fillRect(0, y, W, 54);
    ctx.fillStyle = "#9d3930";
    ctx.fillRect(0, y, W, 10);
    ctx.fillStyle = "#2f6f39";
    ctx.fillRect(0, y + 54, W, H - y - 54);

    // caixa de planting
    var bx = wx(PLANT_X);
    ctx.fillStyle = "#c0392b";
    ctx.fillRect(bx - 16, y, 32, 20);
    ctx.fillStyle = "#8e2b20";
    ctx.fillRect(bx - 16, y + 14, 32, 6);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "10px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("PLANTAÇÃO", bx, y - 6);

    // colchão de queda
    var mx = wx(MAT_X), mw = MAT_W * PX_PER_M;
    var top = GROUND_Y;
    var hpx = Math.max(0, barH * PX_PER_M * 0);
    ctx.fillStyle = "#1f6f8b";
    ctx.fillRect(mx, top - 46, mw, 46 + 54);
    ctx.fillStyle = "#2a89a8";
    ctx.fillRect(mx, top - 46, mw, 20);
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    for (var i = 0; i < 4; i++) ctx.fillRect(mx + 8 + i * (mw / 4), top - 26, 3, 80);
    ctx.fillStyle = "#8fd3e6";
    ctx.fillRect(mx, top - 50, mw, 6);
    void hpx;

    // marcas de profundidade na areia do fosso
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(mx, top, mw, 54);

    // sulcos de queda
    for (var k = 0; k < mats.length; k++) {
      var fx = wx(mats[k].x);
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.beginPath();
      ctx.ellipse(fx, top + 12, 22, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBar() {
    var y = GROUND_Y - barH * PX_PER_M;
    var mx = wx(MAT_X), mw = MAT_W * PX_PER_M;

    // poste
    ctx.fillStyle = "#8b93a3";
    ctx.fillRect(mx + mw + 8, GROUND_Y - (barH + 0.9) * PX_PER_M, 5, (barH + 0.9) * PX_PER_M);
    ctx.fillRect(mx - 16, GROUND_Y - (barH + 0.9) * PX_PER_M, 5, (barH + 0.9) * PX_PER_M);

    // barra
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(mx - 16, y);
    ctx.lineTo(mx + mw + 8, y);
    ctx.stroke();

    // faixas
    for (var i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? "#ffffff" : "#ef4444";
      ctx.fillRect(mx - 16 + i * ((mw + 24) / 8), y - 2, (mw + 24) / 8, 4);
    }

    // altura numérica
    ctx.fillStyle = "#111827";
    ctx.fillRect(mx + mw + 16, y - 9, 46, 18);
    ctx.fillStyle = "#facc15";
    ctx.font = "bold 12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(barH.toFixed(2), mx + mw + 39, y + 4);

    // marca de altura do atleta
    if (planted) {
      var ay = GROUND_Y - (p.y + ATHLETE) * PX_PER_M;
      ctx.strokeStyle = "rgba(52,211,153,0.85)";
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mx - 30, ay);
      ctx.lineTo(mx + mw + 20, ay);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(52,211,153,0.9)";
      ctx.font = "11px system-ui";
      ctx.textAlign = "left";
      ctx.fillText("topo", mx - 28, ay - 4);
    }
  }

  function drawPole() {
    if (!planted && poleState === "run") return;
    var bx = wx(PLANT_X);
    var by = GROUND_Y;
    var a = -0.5 - poleAngle * 1.1;
    var len = POLE_LEN * PX_PER_M;
    var ex = bx + Math.cos(a) * len;
    var ey = by + Math.sin(a) * len;

    ctx.strokeStyle = "#c9a227";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    // curva da vara (flexão)
    var mx = bx + Math.cos(a) * len * 0.55;
    var my = by + Math.sin(a) * len * 0.55 - poleAngle * 22;
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(mx, my, ex, ey);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ponteira
    ctx.fillStyle = "#9ca3af";
    ctx.beginPath();
    ctx.arc(ex, ey, 3, 0, Math.PI * 2);
    ctx.fill();

    // mãos do atleta na vara
    var hx = bx + Math.cos(a) * len * 0.34;
    var hy = by + Math.sin(a) * len * 0.34 - poleAngle * 8;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.arc(hx, hy, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawAthlete() {
    var x = wx(p.x);
    var y = GROUND_Y - p.y * PX_PER_M;
    var air = p.y > 0.02;
    var sc = Math.sin(p.swing);

    // sombra
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(x, GROUND_Y + 4, 20 - Math.min(10, p.y * 8), 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(x, y);

    var scale = 26 / 30; // altura do canvas
    var H1 = ATHLETE * PX_PER_M * scale; // ~47px

    if (air && p.tucked > 0) {
      // posição de barra: corpo arqueado
      ctx.rotate(-0.6 * p.rotate);
      drawBody(0, -H1, 1, -6, -1, -10, "#f0645a", "#24528f");
    } else {
      var front = air ? 14 : 10 + sc * 12;
      var back = air ? -12 : -10 + sc * 12;
      drawBody(0, -H1, 1, front, -1, back, "#f0645a", "#24528f");
    }
    ctx.restore();
  }

  function drawBody(ox, oy, d1, f1, d2k, f2, legColor, shirtColor) {
    var hipY = oy + 22;
    var leg = legColor;
    // pernas
    ctx.strokeStyle = leg;
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, hipY); ctx.lineTo(6, hipY + 10); ctx.lineTo(f1, hipY + 24); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, hipY); ctx.lineTo(-5, hipY + 10); ctx.lineTo(f2, hipY + 22); ctx.stroke();

    // tronco
    ctx.fillStyle = shirtColor;
    ctx.beginPath();
    ctx.moveTo(-7, oy + 4);
    ctx.lineTo(8, oy + 2);
    ctx.lineTo(8, hipY + 2);
    ctx.lineTo(-7, hipY + 4);
    ctx.closePath();
    ctx.fill();

    // braços esticados para cima (segurando a vara)
    ctx.strokeStyle = "#eec39a";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(3, oy + 6);
    ctx.lineTo(6, oy - 16);
    ctx.stroke();

    // cabeça
    ctx.fillStyle = "#eec39a";
    ctx.beginPath();
    ctx.arc(5, oy - 4, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2c2119";
    ctx.beginPath();
    ctx.arc(5, oy - 6, 8.5, Math.PI * 0.95, Math.PI * 2.05);
    ctx.fill();
    void d1; void d2k;
  }

  function drawDust() {
    for (var i = 0; i < dust.length; i++) {
      var d = dust[i];
      var x = wx(d.x), y = GROUND_Y - d.y * PX_PER_M;
      if (x < -10 || x > W + 10) continue;
      ctx.globalAlpha = d.life * 0.7;
      ctx.fillStyle = "#d9c49a";
      ctx.beginPath();
      ctx.arc(x, y, d.r * PX_PER_M, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawTrail() {
    if (trail.length < 4 || !planted) return;
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    var started = false;
    for (var i = 0; i < trail.length; i += 2) {
      var t = trail[i];
      var sx = wx(t.x), sy = GROUND_Y - t.y * PX_PER_M;
      if (sx < -20 || sx > W + 20) continue;
      if (!started) { ctx.moveTo(sx, sy); started = true; } else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
  }

  function drawFlag() {
    var x = 110, y = 86;
    ctx.strokeStyle = "#93a3b8";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 50); ctx.stroke();
    var dir = wind >= 0 ? 1 : -1;
    var len = 20 + Math.min(1, Math.abs(wind) / 3.5) * 32;
    ctx.fillStyle = wind >= 0 ? "#38bdf8" : "#f97316";
    ctx.beginPath();
    ctx.moveTo(x, y + 2);
    ctx.quadraticCurveTo(x + dir * len * 0.5, y + 6 + Math.sin(Date.now() / 150) * 4, x + dir * len, y + 10);
    ctx.lineTo(x + dir * len, y + 18);
    ctx.quadraticCurveTo(x + dir * len * 0.5, y + 16 + Math.sin(Date.now() / 150) * 4, x, y + 20);
    ctx.closePath();
    ctx.fill();
  }

  function drawHint() {
    if (over || !running) return;
    var text = "";
    if (!planted && poleState === "run") {
      text = p.x > PLANT_X - 2.5 ? "ESPAÇO AGORA — plantar a vara!" : "Corra e bata na caixa vermelha";
    } else if (poleState === "swing" || poleState === "rise") {
      text = "Vai subir!";
    }
    if (!text) return;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(W / 2 - 160, H - 50, 320, 34);
    ctx.fillStyle = "#eaf1ff";
    ctx.font = "16px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(text, W / 2, H - 27);
  }

  function draw() {
    drawSky();
    drawStands();
    drawGround();
    drawBar();
    drawTrail();
    drawDust();
    drawPole();
    drawAthlete();
    drawFlag();
    drawHint();
  }

  // ================= loop =================
  function tick(ts) {
    requestAnimationFrame(tick);
    var dt = Math.min(0.04, (ts - last) / 1000 || 0);
    last = ts;
    update(dt);
    sync();
    draw();
  }

  function start() {
    barH = 2.0;
    pendingBar = 0;
    cleared = false;
    planted = false;
    best = loadBest();
    reset();
    last = performance.now();
  }

  window.addEventListener("keydown", function (ev) {
    var k = ev.key.toLowerCase();
    if (k === " " || k === "spacebar") { ev.preventDefault(); plant(); }
    else if (k === "r") start();
  });

  document.getElementById("startBtn").addEventListener("click", start);
  document.getElementById("againBtn").addEventListener("click", start);
  document.getElementById("restartBtn").addEventListener("click", start);
  document.getElementById("jumpBtn").addEventListener("click", plant);
  canvas.addEventListener("pointerdown", function (ev) { ev.preventDefault(); plant(); });

  best = loadBest();
  barH = 2.0;
  pendingBar = 0;
  cleared = false;
  planted = false;
  p = {
    x: RUN_START, y: 0, vx: 2.4, vy: 0, swing: 0, lean: 0.25, tucked: 0, rotate: 0, handPos: 0
  };
  phase = 0;
  score = 0;
  wind = 0;
  running = false;
  over = false;
  poleState = "run";
  poleAngle = 0;
  poleEnergy = 0;
  camX = 0;
  mats = [];
  trail = [];
  dust = [];
  requestAnimationFrame(tick);
})();