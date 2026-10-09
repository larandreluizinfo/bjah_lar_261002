(function () {
  "use strict";

  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
  var W = canvas.width, H = canvas.height;

  var elDist = document.getElementById("distValue");
  var elPhase = document.getElementById("phaseValue");
  var elWind = document.getElementById("windValue");
  var elBest = document.getElementById("bestValue");
  var elScore = document.getElementById("scoreValue");
  var elPower = document.getElementById("powerFill");
  var elOverlay = document.getElementById("overlay");
  var elResult = document.getElementById("result");
  var elTitle = document.getElementById("resultTitle");
  var elText = document.getElementById("resultText");

  var PX_PER_M = 34;
  var GROUND_Y = H - 90;
  var TAKEOFF_X = 4.2;
  var SAND_START = TAKEOFF_X;
  var SAND_END = TAKEOFF_X + 22;
  var GRAVITY = 26;

  var PHASES = [
    { name: "1º salto — o grande", color: "#facc15" },
    { name: "Passo do salto", color: "#38bdf8" },
    { name: "3º salto", color: "#34d399" }
  ];

  var player, phase, wind, jumpsDone, score, best, running, over;
  var power, powerDir, camX, takeoff, trail, dust, landmarks, resultInfo;
  var last = 0;

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function fmt(v) { return v.toFixed(2).replace(".", ",") + " m"; }

  function loadBest() {
    try { return parseFloat(localStorage.getItem("saltoBest") || "0") || 0; }
    catch (e) { return 0; }
  }

  function saveBest(v) {
    try { localStorage.setItem("saltoBest", String(v)); } catch (e) { void e; }
  }

  function reset() {
    wind = rnd(-3.2, 3.2);
    jumpsDone = 0;
    score = 0;
    running = true;
    over = false;
    takeoff = null;
    resultInfo = null;
    trail = [];
    dust = [];
    landmarks = [];
    camX = 0;
    phase = 0;

    player = {
      x: 0.6,
      y: 0,
      vx: 9.5,
      vy: 0,
      onGround: true,
      alive: true,
      runCycle: 0
    };

    elResult.hidden = true;
    elOverlay.hidden = true;
    elBest.textContent = fmt(best);
    sync();
  }

  function currentPower() {
    return 0.55 + (power - 0.55) * 0.9;
  }

  function jump(strength) {
    var p = player;
    var v = 7.6 * strength;
    v *= 1 + Math.max(0, wind) * 0.06;
    p.vy = v;
    p.onGround = false;
    p.y = 0.02;
    if (takeoff === null) takeoff = p.x;
    jumpsDone++;
    for (var i = 0; i < 14; i++) {
      dust.push({ x: p.x + rnd(-0.4, 0.4), y: 0, r: rnd(0.08, 0.22), life: 1, vx: rnd(-1.2, 1.2) });
    }
    if (jumpsDone <= 3) {
      var perfect = power > 0.68 && power < 0.86;
      score += perfect ? 150 : 60;
    }
  }

  function land() {
    var p = player;
    if (jumpsDone >= 3) {
      finish();
      return;
    }
    if (jumpsDone === 0) {
      // caiu sem saltar: perde força e precisa reentrar na corrida
      p.vx *= 0.4;
      return;
    }
    // aterrissagem: permite o próximo salto
    p.vy = 0;
    p.y = 0;
    p.onGround = true;
    p.vx *= 0.97;
  }

  function finish() {
    over = true;
    var p = player;
    var dist = p.x - takeoff;
    var inSand = p.x >= SAND_START && p.x <= SAND_END;
    var tooLong = p.x > SAND_END;

    if (dist > best) { best = dist; saveBest(best); elBest.textContent = fmt(best); }

    if (tooLong) {
      score = Math.max(0, Math.round(score * 0.5));
      elTitle.textContent = "😵 Passou da areia!";
      elText.textContent = "Distância de " + fmt(dist) + ", mas a queda foi fora da caixa de areia. Metade dos pontos.";
    } else if (!inSand) {
      score = 0;
      elTitle.textContent = "🟥 Salto inválido";
      elText.textContent = "Caiu antes da areia. Precisa cair dentro da caixa de areia para valer.";
    } else if (dist > 14) {
      score += 300;
      elTitle.textContent = "🏆 Recorde da escola!";
      elText.textContent = "Saiu a " + fmt(dist) + " com " + score + " pontos. Que salto!";
    } else if (dist > 11) {
      score += 200;
      elTitle.textContent = "🎉 Muito bom!";
      elText.textContent = "Saiu a " + fmt(dist) + " com " + score + " pontos.";
    } else {
      score += 100;
      elTitle.textContent = "👍 Deu pro gasto";
      elText.textContent = "Saiu a " + fmt(dist) + " com " + score + " pontos. Dá pra melhorar!";
    }
    elResult.hidden = false;
  }

  function tryJump() {
    if (!running || over) return;
    if (phase >= 3) return;

    if (player.onGround) {
      jump(currentPower());
      if (phase < 3) phase++;
    }
    sync();
  }

  function update(dt) {
    if (!running || over) return;

    var p = player;
    p.runCycle += dt * p.vx * 1.4;

    if (p.onGround) {
      p.vx = Math.min(11.4, p.vx + dt * 2.1);
      p.y = 0;
    } else {
      p.vy -= GRAVITY * dt;
      p.y += p.vy * dt;
      if (p.y <= 0) {
        p.y = 0;
        land();
      }
    }

    var windAcc = wind * 0.55;
    p.vx += windAcc * dt * 0.35;
    p.vx = Math.max(0, p.vx);

    p.x += p.vx * dt;

    if (jumpsDone > 0) {
      var dist = p.x - takeoff;
      elDist.textContent = fmt(Math.max(0, dist));
    }

    // medidores de distância no chão
    if (jumpsDone > 0 && landmarks.length < 40) {
      var lastM = landmarks.length ? landmarks[landmarks.length - 1] : 0;
      if (dist - lastM >= 1) landmarks.push(Math.round(dist));
    }

    for (var i = dust.length - 1; i >= 0; i--) {
      var d = dust[i];
      d.x += d.vx * dt;
      d.vy = (d.vy || -1) ;
      d.y += rnd(0.2, 1.1) * dt;
      d.life -= dt * 1.4;
      if (d.life <= 0) dust.splice(i, 1);
    }

    trail.push({ x: p.x, y: p.y });
    if (trail.length > 160) trail.shift();

    if (powerDir !== 0) {
      power += powerDir * dt * 1.5;
      if (power >= 1) { power = 1; powerDir = -1; }
      if (power <= 0) { power = 0; powerDir = 1; }
    }

    var target = Math.max(0, (p.x - W / (2 * PX_PER_M)));
    camX += (target - camX) * Math.min(1, dt * 6);
  }

  function sync() {
    elPower.style.width = Math.round(power * 100) + "%";
    elPhase.textContent = phase < 3 ? PHASES[phase].name : "Resultado";
    elWind.textContent = (wind > 0 ? "→ " : wind < 0 ? "← " : "") + Math.abs(wind).toFixed(1) + " m/s";
    elWind.className = Math.abs(wind) > 1.6 ? "strong" : "";
    elScore.textContent = score;
    for (var i = 1; i <= 3; i++) {
      var el = document.getElementById("pip" + i);
      el.className = "pip" + (jumpsDone >= i ? " done" : (phase === i - 1 && !over ? " now" : ""));
    }
  }

  function worldX(x) { return x * PX_PER_M - camX; }

  function drawSky() {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#5aa9e6");
    g.addColorStop(0.55, "#9ed3f0");
    g.addColorStop(1, "#d9edf9");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    var cx = worldX(9) % (W + 400);
    for (var i = -1; i < 3; i++) {
      var x = worldX(6) + i * 520 - (camX % 520);
      cloud(x, 70, 1);
      cloud(x + 260, 120, 0.7);
    }
    void cx;

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(W - 90, 80, 34, 0, Math.PI * 2);
    ctx.fill();
  }

  function cloud(x, y, s) {
    if (x < -200 || x > W + 200) return;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.beginPath();
    ctx.ellipse(x, y, 46 * s, 22 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 34 * s, y + 6 * s, 34 * s, 18 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 32 * s, y + 8 * s, 30 * s, 16 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTrack() {
    var y = GROUND_Y;

    // faixa de pista
    ctx.fillStyle = "var(--track)";
    ctx.fillStyle = "#c8564f";
    ctx.fillRect(0, y, W, 70);
    ctx.fillStyle = "#b34b46";
    ctx.fillRect(0, y + 40, W, 30);

    // areia
    var sx = worldX(SAND_START), ex = worldX(SAND_END);
    if (ex > 0 && sx < W) {
      ctx.fillStyle = "#f0d9a0";
      ctx.fillRect(sx, y, ex - sx, 70);
      ctx.fillStyle = "#e3c887";
      ctx.fillRect(sx, y + 45, ex - sx, 25);
      for (var i = 0; i < 40; i++) {
        var gx = sx + ((i * 97) % (ex - sx));
        if (gx < 0 || gx > W) continue;
        ctx.fillStyle = "rgba(190,160,105,0.55)";
        ctx.fillRect(gx, y + 6 + (i % 5) * 12, 5, 3);
      }
      // bordas
      ctx.strokeStyle = "#b9a06a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sx, y);
      ctx.lineTo(sx, y + 70);
      ctx.moveTo(ex, y);
      ctx.lineTo(ex, y + 70);
      ctx.stroke();
    }

    // linha de takeoff
    var tx = worldX(TAKEOFF_X);
    if (tx > -60 && tx < W + 60) {
      ctx.fillStyle = "#fff3a8";
      ctx.fillRect(tx - 4, y - 130, 8, 200);
      ctx.fillStyle = "#facc15";
      ctx.fillRect(tx - 4, y - 130, 8, 22);
    }

    // marcações de distância
    if (landmarks.length) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "11px system-ui";
      ctx.textAlign = "center";
      for (var m = 0; m < landmarks.length; m++) {
        var d = landmarks[m];
        var mx = worldX(TAKEOFF_X + d);
        if (mx < -30 || mx > W + 30) continue;
        ctx.fillRect(mx - 1, y + 44, 2, 10);
        ctx.fillText(d + "m", mx, y + 68);
      }
    }

    ctx.fillStyle = "#2f5c1f";
    ctx.fillRect(0, y + 70, W, H - y - 70);
  }

  function drawAthlete() {
    var p = player;
    var x = worldX(p.x);
    var scale = 1;
    var h = 54 * scale;
    var footY = GROUND_Y - p.y * PX_PER_M * scale;
    var run = p.onGround ? Math.sin(p.runCycle) : 0;
    var air = !p.onGround;

    // sombra
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(x, GROUND_Y + 4, 20 - Math.min(10, p.y * 8), 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(x, footY);

    // corpo
    ctx.strokeStyle = "#1f3f7a";
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.75);
    ctx.lineTo(air ? -6 : 2, -h * 0.35);
    ctx.stroke();

    // perna dianteira / traseira
    ctx.strokeStyle = "#e8564a";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(air ? -6 : 2, -h * 0.35);
    ctx.lineTo(air ? 14 : 12 + run * 12, air ? -h * 0.55 : -2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(air ? -6 : 2, -h * 0.35);
    ctx.lineTo(air ? -20 : -10 + run * 12, air ? -h * 0.7 : -2);
    ctx.stroke();

    // braço
    ctx.strokeStyle = "#f0c090";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.72);
    ctx.lineTo(air ? 14 : -14 - run * 12, air ? -h * 0.95 : -h * 0.45);
    ctx.stroke();

    // cabeça
    ctx.fillStyle = "#f0c090";
    ctx.beginPath();
    ctx.arc(air ? -2 : 3, -h * 0.88, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2b2118";
    ctx.beginPath();
    ctx.arc(air ? -4 : 1, -h * 0.92, 8, Math.PI, 0);
    ctx.fill();
    ctx.restore();

    // rastro do terceiro salto
    if (air && jumpsDone === 3) {
      ctx.strokeStyle = "rgba(52,211,153,0.5)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (var i = 0; i < trail.length; i += 3) {
        var t = trail[i];
        var tx = worldX(t.x);
        if (tx < 0 || tx > W) continue;
        if (i === 0) ctx.moveTo(tx, GROUND_Y - t.y * PX_PER_M);
        else ctx.lineTo(tx, GROUND_Y - t.y * PX_PER_M);
      }
      ctx.stroke();
    }
  }

  function drawDust() {
    for (var i = 0; i < dust.length; i++) {
      var d = dust[i];
      var x = worldX(d.x);
      if (x < -20 || x > W + 20) continue;
      ctx.globalAlpha = d.life * 0.6;
      ctx.fillStyle = "#cbb287";
      ctx.beginPath();
      ctx.arc(x, GROUND_Y - d.y * PX_PER_M, d.r * 22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawWindFlag() {
    var x = 120, y = 60;
    var mag = Math.min(1, Math.abs(wind) / 3.5);
    ctx.strokeStyle = "#8b93a3";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + 40);
    ctx.stroke();
    ctx.fillStyle = wind >= 0 ? "#38bdf8" : "#f97316";
    var dir = wind >= 0 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(x, y + 2);
    ctx.lineTo(x + dir * (26 + mag * 34), y + 8 + Math.sin(Date.now() / 160) * 3);
    ctx.lineTo(x, y + 16);
    ctx.closePath();
    ctx.fill();

    if (Math.abs(wind) > 1.5) {
      for (var i = 0; i < 5; i++) {
        var sx = (x + dir * (i * 90) + (Date.now() / 8) % 90 * dir) % W;
        if (sx < 0) sx += W;
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx, GROUND_Y - 40 - i * 12);
        ctx.lineTo(sx + dir * 24, GROUND_Y - 44 - i * 12);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  function draw() {
    drawSky();
    drawTrack();
    drawDust();
    drawAthlete();
    drawWindFlag();

    if (running && phase < 3 && !player.onGround) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(W / 2 - 150, H - 52, 300, 34);
      ctx.fillStyle = "#eaf1ff";
      ctx.font = "16px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("ESPAÇO para o próximo salto!", W / 2, H - 29);
    }
  }

  function tick(ts) {
    requestAnimationFrame(tick);
    var dt = Math.min(0.04, (ts - last) / 1000 || 0);
    last = ts;
    update(dt);
    sync();
    draw();
  }

  function press(e) {
    if (e) e.preventDefault();
    tryJump();
  }

  function start() {
    power = rnd(0.2, 0.6);
    powerDir = power > 0.8 ? -1 : 1;
    best = loadBest();
    reset();
    last = performance.now();
  }

  document.getElementById("startBtn").addEventListener("click", start);
  document.getElementById("againBtn").addEventListener("click", start);
  document.getElementById("jumpBtn").addEventListener("click", function () { press(); });
  document.getElementById("restartBtn").addEventListener("click", start);

  canvas.addEventListener("pointerdown", function (ev) { press(ev); });

  window.addEventListener("keydown", function (ev) {
    var k = ev.key.toLowerCase();
    if (k === " " || k === "spacebar") press(ev);
    else if (k === "r") start();
  });

  best = loadBest();
  player = { x: 0.6, y: 0, vx: 9.5, vy: 0, onGround: true, runCycle: 0 };
  phase = 0;
  jumpsDone = 0;
  takeoff = null;
  power = 0.4;
  powerDir = 1;
  running = false;
  over = false;
  wind = 0;
  score = 0;
  best = loadBest();
  trail = [];
  dust = [];
  landmarks = [];
  camX = 0;
  requestAnimationFrame(tick);
})();