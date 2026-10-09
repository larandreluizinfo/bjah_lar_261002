(function () {
  "use strict";

  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");

  var elName = document.getElementById("clientName");
  var elStyle = document.getElementById("clientStyle");
  var elHint = document.getElementById("clientHint");
  var elScore = document.getElementById("scoreValue");
  var elCount = document.getElementById("clientCount");
  var elVerdict = document.getElementById("verdict");
  var elVerdictTitle = document.getElementById("verdictTitle");
  var elVerdictText = document.getElementById("verdictText");
  var elOverlay = document.getElementById("overlay");
  var elStart = document.getElementById("startBtn");
  var elDone = document.getElementById("doneBtn");

  var HEAD = { x: 450, y: 285, r: 92 };
  var N = 44;
  var TOOLS = {
    scissors: { name: "Tesoura", width: 13, rate: 190 },
    clipper: { name: "Máquina", width: 34, rate: 150 },
    razor: { name: "Navalha", width: 22, rate: 70 }
  };

  var NAMES = [
    "Zé do Bonfim", "Careca do Bar", "Seu Arlindo", "Bigodeiro", "Tião do Gol",
    "Marlon Careca", "Pitoco", "Nenê da Farmácia", "Capivara do Zap",
    "Jorginho do Salão", "Betinho do Campo", "Rafa Corta", "Didi do Tatu",
    "Carlão do Painel", "Tuca do Tsukuba"
  ];

  var STYLES = [
    {
      name: "Degradê",
      hint: "Lateral raspada, topo comprido",
      face: [0, 0.18, 0.06],
      top: 74,
      min: 6
    },
    {
      name: "Coroa",
      hint: "Faixa no meio alta, laterais baixas",
      face: [0.02, 0.08, 0.02],
      top: 90,
      min: 4
    },
    {
      name: "Militar",
      hint: "Tudo igual, uns 2 dedos",
      face: [0.22, 0.22, 0.22],
      top: 26,
      min: 2
    },
    {
      name: "Moicano",
      hint: "Só a crista no meio",
      face: [0, 0.02, 0],
      top: 96,
      min: 2
    },
    {
      name: "Careca deEquipe",
      hint: "Raspado, sobra só um sombra",
      face: [0.06, 0.06, 0.06],
      top: 10,
      min: 2
    },
    {
      name: "Gafieiro",
      hint: "Topo grande, laterais quase zero",
      face: [0, 0, 0],
      top: 84,
      min: 4
    },
    {
      name: "Social English",
      hint: "Tudo baixo e alinhado",
      face: [0.14, 0.14, 0.14],
      top: 18,
      min: 2
    },
    {
      name: "Topete do Pagode",
      hint: "Franja pra frente, até a testa",
      face: [0.12, 0.12, 0.12],
      top: 70,
      min: 4
    }
  ];



  var strands = [];
  var target = [];
  var style = null;
  var clientName = "";
  var served = 0;
  var money = 0;
  var tool = "scissors";
  var mouse = { x: -999, y: -999, down: false };
  var phase = "idle";
  var shake = 0;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function targetAt(i) {
    var t = i / (N - 1);
    var dTop = Math.abs(t - 0.5) * 2;
    var top = style.top * (1 - dTop * dTop);
    var side = style.face[t < 0.18 ? 0 : t > 0.82 ? 2 : 1];
    return Math.max(style.min, side + top);
  }

  function newClient() {
    served++;
    clientName = NAMES[(served - 1) % NAMES.length] + (served > NAMES.length ? " Jr." : "");
    style = pick(STYLES);
    elName.textContent = clientName;
    elStyle.textContent = style.name;
    elHint.textContent = style.hint;
    elCount.textContent = served;

    strands = [];
    target = [];
    for (var i = 0; i < N; i++) {
      var t = targetAt(i);
      target.push(t);
      strands.push({ len: rnd(t + 26, t + 74), cut: false, cutAt: 0 });
    }
    elScore.textContent = "—";
    elVerdict.hidden = true;
    phase = "cut";
  }

  function strandBase(i) {
    var t = i / (N - 1);
    var a = Math.PI + t * Math.PI;
    var wob = 1 + 0.035 * Math.sin(i * 2.3);
    return {
      x: HEAD.x + Math.cos(a) * HEAD.r * wob,
      y: HEAD.y + Math.sin(a) * HEAD.r * wob,
      a: a,
      w: HEAD.r * wob
    };
  }

  function drawHead() {
    ctx.save();
    ctx.translate(HEAD.x, HEAD.y);

    ctx.beginPath();
    ctx.ellipse(0, 0, HEAD.r * 0.94, HEAD.r * 1.06, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#e8b98f";
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(-HEAD.r * 0.9, 6, 13, 20, -0.1, 0, Math.PI * 2);
    ctx.ellipse(HEAD.r * 0.9, 6, 13, 20, 0.1, 0, Math.PI * 2);
    ctx.fillStyle = "#e3ad83";
    ctx.fill();

    var eyeY = -8;
    ctx.fillStyle = "#2b1d16";
    ctx.beginPath();
    ctx.ellipse(-30, eyeY, 5, 4, 0, 0, Math.PI * 2);
    ctx.ellipse(30, eyeY, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#5b463a";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(0, 34, 22, 0.25, Math.PI - 0.25);
    ctx.stroke();

    ctx.fillStyle = "#c98f6b";
    ctx.fillRect(0, 12, 20, 6);
    ctx.restore();
  }

  function drawMirror() {
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(20, 20, 130, 170);
    ctx.strokeStyle = "#6b4c36";
    ctx.lineWidth = 6;
    ctx.strokeRect(20, 20, 130, 170);
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.translate(85, 190);
    ctx.scale(0.34, 0.34);
    drawHead();
    ctx.restore();
    ctx.fillStyle = "#b39c88";
    ctx.font = "12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("espelho", 85, 208);
  }

  function drawChair() {
    ctx.fillStyle = "#5b3b28";
    ctx.fillRect(HEAD.x - 120, HEAD.y + 118, 240, 26);
    ctx.fillRect(HEAD.x - 96, HEAD.y + 140, 192, 150);
    ctx.fillStyle = "#43291b";
    ctx.fillRect(HEAD.x - 130, HEAD.y + 96, 26, 60);
    ctx.fillRect(HEAD.x + 104, HEAD.y + 96, 26, 60);
  }

  function drawStrands() {
    for (var i = 0; i < N; i++) {
      var b = strandBase(i);
      var s = strands[i];
      var len = s.len;
      var err = Math.abs(len - target[i]);
      var col = err <= 6 ? "#34d399" : "#3b2a20";
      if (phase === "cut" && err > 6) col = "#4a3527";

      ctx.strokeStyle = col;
      ctx.lineWidth = 15;
      ctx.lineCap = "round";
      ctx.beginPath();
      var ex = b.x + Math.cos(b.a) * len;
      var ey = b.y + Math.sin(b.a) * len;
      ctx.moveTo(b.x, b.y);
      ctx.quadraticCurveTo(
        (b.x + ex) / 2 + Math.cos(b.a + 0.7) * 5,
        (b.y + ey) / 2 + Math.sin(b.a + 0.7) * 5,
        ex, ey
      );
      ctx.stroke();

      if (s.cut) {
        ctx.fillStyle = "rgba(250,204,21,0.9)";
        ctx.beginPath();
        ctx.arc(ex, ey, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawGhost() {
    if (phase !== "cut") return;
    ctx.save();
    ctx.setLineDash([5, 7]);
    ctx.strokeStyle = "rgba(250,204,21,0.55)";
    ctx.lineWidth = 3;
    for (var i = 0; i < N; i += 2) {
      var b = strandBase(i);
      var len = target[i];
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x + Math.cos(b.a) * len, b.y + Math.sin(b.a) * len);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTool() {
    if (!mouse.down || phase !== "cut") return;
    ctx.save();
    ctx.translate(mouse.x, mouse.y);
    ctx.rotate(-0.6);
    var t = TOOLS[tool];
    ctx.fillStyle = "#9fb4c7";
    if (tool === "scissors") {
      ctx.beginPath();
      ctx.ellipse(-9, 22, 7, 13, 0.2, 0, Math.PI * 2);
      ctx.ellipse(9, 22, 7, 13, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#6b7d90";
      ctx.fillRect(-3, -6, 6, 20);
    } else if (tool === "clipper") {
      ctx.fillRect(-t.width / 2, -22, t.width, 34);
      ctx.fillStyle = "#3a3a3a";
      ctx.fillRect(-t.width / 2 - 2, 10, t.width + 4, 8);
    } else {
      ctx.fillRect(-3, -26, 6, 34);
      ctx.fillStyle = "#4b3a2c";
      ctx.fillRect(-11, 6, 22, 16);
    }
    ctx.restore();
  }

  function drawClippings() {
    if (phase !== "cut") return;
    ctx.fillStyle = "rgba(90,62,44,0.55)";
    for (var i = 0; i < 40; i++) {
      var x = HEAD.x + rnd(-130, 130);
      var y = HEAD.y + HEAD.r + rnd(40, 170);
      ctx.fillRect(x, y, rnd(2, 5), rnd(1, 3));
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    var g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, "#2a1c12");
    g.addColorStop(1, "#150e09");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    if (shake > 0) {
      ctx.translate(rnd(-3, 3), rnd(-3, 3));
      shake = Math.max(0, shake - 1);
    }

    drawMirror();
    drawChair();
    drawHead();
    drawStrands();
    drawGhost();
    drawClippings();
    drawTool();
    ctx.restore();

    ctx.fillStyle = "#8b7460";
    ctx.font = "13px system-ui";
    ctx.textAlign = "left";
    ctx.fillText("ferramenta: " + TOOLS[tool].name, 20, canvas.height - 18);
  }

  function cut() {
    var t = TOOLS[tool];
    for (var i = 0; i < N; i++) {
      var b = strandBase(i);
      var dx = mouse.x - b.x;
      var dy = mouse.y - b.y;
      var along = dx * Math.cos(b.a) + dy * Math.sin(b.a);
      var perp = Math.abs(-dx * Math.sin(b.a) + dy * Math.cos(b.a));
      if (along < -6 || along > strands[i].len + 8) continue;
      if (perp > t.width / 2) continue;
      var newLen = Math.max(2, Math.min(strands[i].len, along - t.width / 2 + 2));
      if (newLen < strands[i].len) {
        strands[i].len = newLen;
        strands[i].cut = true;
      }
    }
  }

  function evaluate() {
    var total = 0;
    var worst = 0;
    for (var i = 0; i < N; i++) {
      var e = Math.abs(strands[i].len - target[i]);
      total += e;
      if (e > worst) worst = e;
    }
    var avg = total / N;
    var score = Math.max(0, Math.round(100 - avg * 7 - worst * 0.8));

    var title, text;
    if (score >= 95) { title = "Perfeito! 👌"; text = "Saí da cadeira parecendo foto de revista."; }
    else if (score >= 80) { title = "Bom corte! ✂️"; text = "Passou na inspeção do salão."; }
    else if (score >= 60) { title = "Mais ou menos 😐"; text = "Deu pro gasto, mas deu ruim."; }
    else { title = "Estragou o cliente 😬"; text = "Ele vai contar isso no grupo do WhatsApp."; }
    return { score: score, title: title, text: text };
  }

  function finish() {
    if (phase !== "cut") return;
    var r = evaluate();
    var pay = Math.round(r.score * 1.6) + 10;
    money += pay;
    elScore.textContent = r.score + " · R$ " + pay;
    elVerdictTitle.textContent = r.title + "  " + r.score + "/100";
    elVerdictText.textContent = r.text + " Caixa: R$ " + money;
    elVerdict.hidden = false;
    phase = "done";
    shake = r.score < 60 ? 8 : 3;
    elVerdictTitle.style.color = r.score >= 80 ? "#34d399" : r.score >= 60 ? "#facc15" : "#ef4444";
    elDone.textContent = "";
    elDone.innerHTML = '<span class="ico">➡️</span><strong>Próximo</strong><small><kbd>Enter</kbd></small>';
  }

  function next() {
    if (phase !== "done") return;
    elDone.innerHTML = '<span class="ico">✅</span><strong>Pronto</strong><small><kbd>Enter</kbd></small>';
    newClient();
  }

  function loop() {
    if (mouse.down && phase === "cut") cut();
    draw();
    requestAnimationFrame(loop);
  }

  function pos(ev) {
    var r = canvas.getBoundingClientRect();
    var cx = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
    var cy = (ev.touches ? ev.touches[0].clientY : ev.clientY) - r.top;
    mouse.x = cx * (canvas.width / r.width);
    mouse.y = cy * (canvas.height / r.height);
  }

  canvas.addEventListener("mousedown", function (ev) { pos(ev); mouse.down = true; ev.preventDefault(); });
  window.addEventListener("mousemove", function (ev) { pos(ev); });
  window.addEventListener("mouseup", function () { mouse.down = false; });

  canvas.addEventListener("touchstart", function (ev) { pos(ev); mouse.down = true; ev.preventDefault(); }, { passive: false });
  canvas.addEventListener("touchmove", function (ev) { pos(ev); ev.preventDefault(); }, { passive: false });
  canvas.addEventListener("touchend", function () { mouse.down = false; });

  var buttons = document.querySelectorAll(".tool[data-tool]");
  Array.prototype.forEach.call(buttons, function (btn) {
    btn.addEventListener("click", function () {
      tool = btn.getAttribute("data-tool");
      Array.prototype.forEach.call(buttons, function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
    });
  });

  elDone.addEventListener("click", function () {
    if (phase === "cut") finish();
    else next();
  });

  elStart.addEventListener("click", function () {
    elOverlay.hidden = true;
    money = 0;
    served = 0;
    newClient();
  });

  window.addEventListener("keydown", function (ev) {
    var k = ev.key.toLowerCase();
    if (k === "1") { tool = "scissors"; }
    else if (k === "2") { tool = "clipper"; }
    else if (k === "3") { tool = "razor"; }
    else if (k === "enter") { if (phase === "cut") finish(); else if (phase === "done") next(); else return; }
    else { return; }
    Array.prototype.forEach.call(buttons, function (b) {
      b.classList.toggle("active", b.getAttribute("data-tool") === tool);
    });
    ev.preventDefault();
  });

  newClient();
  phase = "idle";
  loop();
})();