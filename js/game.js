/* =========================================================================
   FUTEBOL DE RUA  ⚽
   Campo de futebol com arquibancadas + Quadra de futsal
   Criado por Bernardo, Helena, Arthur e João.
   Canvas 2D puro, sem dependências.
   ========================================================================= */
(function () {
  'use strict';

  /* ------------------------------------------------------------- canvas */
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;

  /* -------------------------------------------------------- utilidades */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* -------------------------------------------------------------- áudio */
  var sound = (function () {
    var ac = null, master = null, crowd = null, noise = null, muted = false, ready = false;

    function init() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = muted ? 0 : 0.9;
      master.connect(ac.destination);

      var len = Math.floor(ac.sampleRate * 2);
      var buf = ac.createBuffer(1, len, ac.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      noise = buf;

      var src = ac.createBufferSource();
      src.buffer = buf; src.loop = true;
      var hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 130;
      var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 720;
      crowd = ac.createGain(); crowd.gain.value = 0;
      src.connect(hp); hp.connect(lp); lp.connect(crowd); crowd.connect(master);
      src.start();
      crowd.gain.setTargetAtTime(0.045, ac.currentTime, 1.2);
      ready = true;
    }

    function burst(vol, freq, dur, type) {
      if (!ready || muted) return;
      var t = ac.currentTime;
      var s = ac.createBufferSource(); s.buffer = noise;
      var f = ac.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq;
      var g = ac.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      s.connect(f); f.connect(g); g.connect(master);
      s.start(t); s.stop(t + dur + 0.02);
    }

    function tone(f0, f1, dur, vol, type) {
      if (!ready || muted) return;
      var t = ac.currentTime;
      var o = ac.createOscillator(); o.type = type || 'triangle';
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
      var g = ac.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.02);
    }

    return {
      init: init,
      kick: function (p) { burst(0.5, 900 + p * 0.4, 0.13); tone(210, 70, 0.12, 0.22, 'sine'); },
      missile: function () {
        if (!ready || muted) return;
        burst(0.65, 2600, 0.5);
        burst(0.4, 420, 0.7);
        tone(880, 90, 0.45, 0.3, 'sawtooth');
        tone(160, 40, 0.6, 0.22, 'sine');
      },
      post: function () { burst(0.22, 1800, 0.08); },
      cheer: function () {
        if (!ready || muted) return;
        burst(0.55, 2600, 1.4);
        crowd.gain.cancelScheduledValues(ac.currentTime);
        crowd.gain.setValueAtTime(0.05, ac.currentTime);
        crowd.gain.linearRampToValueAtTime(0.16, ac.currentTime + 0.35);
        crowd.gain.setTargetAtTime(0.05, ac.currentTime + 0.5, 1.6);
      },
      whistle: function () {
        if (!ready || muted) return;
        var t = ac.currentTime;
        var o = ac.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(2150, t);
        o.frequency.linearRampToValueAtTime(2450, t + 0.25);
        var lfo = ac.createOscillator(); lfo.frequency.value = 28;
        var lg = ac.createGain(); lg.gain.value = 90;
        lfo.connect(lg); lg.connect(o.frequency);
        var g = ac.createGain();
        g.gain.setValueAtTime(0.001, t);
        g.gain.exponentialRampToValueAtTime(0.18, t + 0.05);
        g.gain.setValueAtTime(0.18, t + 0.5);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
        o.connect(g); g.connect(master);
        o.start(t); lfo.start(t); o.stop(t + 0.9); lfo.stop(t + 0.9);
      },
      setMuted: function (v) {
        muted = v;
        if (master) master.gain.value = v ? 0 : 0.9;
      },
      isMuted: function () { return muted; }
    };
  })();

  /* -------------------------------------------------------------- locais */
  var VENUES = {
    campo: {
      id: 'campo',
      short: 'Campo',
      full: 'Estádio · Campo de grama',
      outdoor: true,
      boards: false,
      seed: 20261002,
      bounds: { l: 186, r: 774, t: 112, b: 436 },
      goalW: 116, goalDepth: 26, ballR: 8,
      kick: 585, pass: 445, shot: 1.0
    },
    quadra: {
      id: 'quadra',
      short: 'Quadra',
      full: 'Ginásio · Quadra de futsal',
      outdoor: false,
      boards: true,
      seed: 777001,
      bounds: { l: 232, r: 728, t: 150, b: 414 },
      goalW: 76, goalDepth: 11, ballR: 7,
      kick: 480, pass: 360, shot: 0.86
    }
  };

  var venueKey = 'campo';
  var V = VENUES[venueKey];
  var F = V.bounds;
  var BALL_R = V.ballR;
  var CX = (F.l + F.r) / 2;
  var CY = (F.t + F.b) / 2;

  /* ------------------------------------------------------------- estado */
  var PLAYER_R = 15;
  var GRAVITY = 1150;
  var SPEED = { user: 236, ai: 208, gk: 190, slide: 410 };
  var HALF_TIME = 45;

  var HOME = [
    { name: 'Bernardo', num: 9 },
    { name: 'Helena', num: 7 },
    { name: 'Arthur', num: 6 },
    { name: 'João', num: 4 },
    { name: 'GK', num: 1, gk: true }
  ];
  var AWAY = [
    { name: 'Bravo', num: 9 },
    { name: 'Charlie', num: 7 },
    { name: 'Delta', num: 6 },
    { name: 'Echo', num: 4 },
    { name: 'GK', num: 1, gk: true }
  ];
  var SLOTS = [
    { fx: 0.19, fy: 0.50 },
    { fx: 0.35, fy: 0.21 },
    { fx: 0.37, fy: 0.79 },
    { fx: 0.55, fy: 0.50 }
  ];

  var KITS = {
    1: { a: '#2f6fe0', b: '#ffffff', shorts: '#0f2a5c', socks: '#bfdbfe', skin: '#e0a97c', hair: '#2b1a12', style: 'stripes' },
    2: { a: '#d92b2b', b: '#ffffff', shorts: '#2a0f0f', socks: '#fecaca', skin: '#c68642', hair: '#1c1410', style: 'hoops' },
    gk1: { a: '#16a34a', b: '#0f2a1c', shorts: '#052e16', socks: '#bbf7d0', skin: '#e0a97c', hair: '#2b1a12', style: 'plain' },
    gk2: { a: '#f59e0b', b: '#3b1d02', shorts: '#3b1d02', socks: '#fde68a', skin: '#c68642', hair: '#1c1410', style: 'plain' }
  };

  var players = [];
  var ball = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rot: 0, owner: null, last: null, hot: false };
  var trail = [];
  var fx = [];
  var score = [0, 0];
  var possession = [0, 0];
  var half = 1, halfDir = 1, clock = HALF_TIME * 2;
  var state = 'demo', stateTimer = 0, flash = '';
  var flashTimer = 0, flashTeam = 0;
  var controlled = null, controlled2 = null, wantSwitch = false, wantSwitch2 = false;
  var versus = false;

  /* quem controla o jogador: 1 = voce (azul), 2 = segundo jogador (vermelho) */
  function isHuman(p) {
    return p === controlled || (versus && p === controlled2);
  }
  function ctrlOf(team) {
    if (team === 1) return controlled;
    return versus ? controlled2 : null;
  }

  function setVersus(on, noRestart) {
    versus = !!on;
    keys2 = {};
    var label = document.getElementById('modeName');
    if (label) label.textContent = versus ? '2 jogadores' : '1 jogador';
    Array.prototype.forEach.call(document.querySelectorAll('.mode'), function (b) {
      b.classList.toggle('is-active', (b.dataset.mode === '2p') === versus);
    });
    var vh = document.getElementById('versusHint');
    if (vh) vh.hidden = !versus;
    try { localStorage.setItem('fr-versus', versus ? '1' : '0'); } catch (err) { /* ignora */ }
    if (!noRestart) startMatch();
  }

  function loadVersus() {
    var v = null;
    try { v = localStorage.getItem('fr-versus'); } catch (err) { v = null; }
    setVersus(v === '1', true);
  }
  var bg = null;
  var rain = [];

  /* -------------------------------------------------------- posições base */
  function dirOf(team) { return team === 1 ? halfDir : -halfDir; }
  function goalX(dir) { return dir === 1 ? F.r : F.l; }
  function slotPos(slot, dir) {
    return {
      x: F.l + (F.r - F.l) * (dir === 1 ? slot.fx : 1 - slot.fx),
      y: F.t + (F.b - F.t) * (dir === 1 ? slot.fy : 1 - slot.fy)
    };
  }

  /* ================================================================== */
  /*  PRÉ-RENDERIZAÇÃO DO CENÁRIO (grama, arquibancadas, placas, gols)  */
  /* ================================================================== */
  function buildBackground(key) {
    var v = VENUES[key];
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    var rnd = mulberry32(v.seed);
    if (v.outdoor) stadium(g, v, rnd);
    else gym(g, v, rnd);
    surface(g, v, rnd);
    lines(g, v);
    goals(g, v);
    if (v.outdoor) light(g, v);
    return c;
  }

  /* ------------------------------------------------------- arquibancadas */
  function drawStand(g, x, y, w, h, axis, rnd, opts) {
    opts = opts || {};
    if (w < 12 || h < 12) return;
    var grad = axis === 'h'
      ? g.createLinearGradient(0, y, 0, y + h)
      : g.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, '#080d16');
    grad.addColorStop(0.5, '#151d31');
    grad.addColorStop(1, '#26324f');
    g.fillStyle = grad;
    g.fillRect(x, y, w, h);

    var step = 9;
    var depth = axis === 'h' ? h : w;
    var rows = Math.max(1, Math.floor(depth / step));
    var span = axis === 'h' ? w : h;
    var pal = ['#e11d48', '#f59e0b', '#22d3ee', '#a3e635', '#f8fafc', '#38bdf8', '#fbbf24', '#94a3b8', '#f472b6', '#facc15'];

    for (var r = 0; r < rows; r++) {
      g.fillStyle = r % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.16)';
      if (axis === 'h') g.fillRect(x, y + h - (r + 1) * step, w, step);
      else g.fillRect(x + w - (r + 1) * step, y, step, h);

      var density = (0.9 - r * 0.035) * (opts.density || 1);
      var count = Math.floor(span / 7.5);
      for (var i = 0; i < count; i++) {
        if (rnd() > density) continue;
        var col = pal[(rnd() * pal.length) | 0];
        var px, py;
        if (axis === 'h') {
          px = x + 2 + rnd() * (w - 5);
          py = y + h - (r + 1) * step + 2.5 + rnd() * (step - 5);
        } else {
          px = x + w - (r + 1) * step + 2.5 + rnd() * (step - 5);
          py = y + 2 + rnd() * (h - 5);
        }
        g.fillStyle = col;
        g.fillRect(px, py, 2.6, 3.4);
        g.fillStyle = 'rgba(255,255,255,0.22)';
        g.fillRect(px + 0.4, py - 1.1, 1.8, 1.6);
      }
    }

    // guarda-corpo
    g.fillStyle = 'rgba(226,232,255,0.22)';
    if (axis === 'h') g.fillRect(x, y + h - 2.5, w, 2.5);
    else g.fillRect(x + w - 2.5, y, 2.5, h);

    // sombra do teto
    var sh = axis === 'h'
      ? g.createLinearGradient(0, y, 0, y + h * 0.7)
      : g.createLinearGradient(x, 0, x + w * 0.7, 0);
    sh.addColorStop(0, 'rgba(0,0,0,0.72)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sh;
    g.fillRect(x, y, w, h);
  }

  function banner(g, x, y, w, h, text, c1, c2) {
    g.fillStyle = c1; g.fillRect(x, y, w, h);
    g.fillStyle = c2;
    g.fillRect(x, y + h - 2, w, 2);
    g.fillStyle = '#0b1220';
    g.font = '700 9px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, x + w / 2, y + h / 2 + 0.5);
  }

  function adBoards(g, v) {
    var b = v.bounds;
    var hb = 17;
    var texts = ['FUTEBOL DE RUA', '★ CAMPO & QUADRA ★', 'TORCIDA AZUL', 'COPA DA RUA'];
    var colors = ['#0b1220', '#0b1220'];
    var ink = ['#facc15', '#22d3ee', '#f8fafc', '#f472b6'];

    function strip(x, y, w, h) {
      var grd = g.createLinearGradient(x, y, x, y + h);
      grd.addColorStop(0, '#1e293b');
      grd.addColorStop(0.5, '#0b1220');
      grd.addColorStop(1, '#020617');
      g.fillStyle = grd; g.fillRect(x, y, w, h);
      g.strokeStyle = 'rgba(148,163,184,0.35)';
      g.lineWidth = 1;
      g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      var seg = 150;
      var n = Math.max(1, Math.round(w / seg));
      g.font = '700 9px system-ui, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (var i = 0; i < n; i++) {
        var cx = x + (w / n) * (i + 0.5);
        var idx = ((Math.round(cx) + Math.round(y)) >> 3) % texts.length;
        g.fillStyle = ink[Math.abs(idx) % ink.length];
        g.fillText(texts[Math.abs(idx) % texts.length], cx, y + h / 2 + 0.5);
        if (i > 0) {
          g.fillStyle = 'rgba(148,163,184,0.2)';
          g.fillRect(x + (w / n) * i, y + 2, 1, h - 4);
        }
      }
    }

    strip(b.l - 26, b.t - hb - 4, (b.r - b.l) + 52, hb);          // cima
    strip(b.l - 26, b.b + 4, (b.r - b.l) + 52, hb);              // baixo
    strip(b.l - hb - 4, b.t, hb, b.b - b.t);                    // esquerda
    strip(b.r + 4, b.t, hb, b.b - b.t);                         // direita
  }

  function stadium(g, v, rnd) {
    var b = v.bounds;
    // estrutura escura
    g.fillStyle = '#05080f'; g.fillRect(0, 0, W, H);

    drawStand(g, 4, 4, W - 8, b.t - 32, 'h', rnd, { density: 1 });
    drawStand(g, 4, b.b + 32, W - 8, H - b.b - 36, 'h', rnd, { density: 1 });
    drawStand(g, 4, 4, b.l - 32, H - 8, 'v', rnd, { density: 0.85 });
    drawStand(g, b.r + 32, 4, W - b.r - 36, H - 8, 'v', rnd, { density: 0.85 });

    // teto / sombra superior
    var roof = g.createLinearGradient(0, 0, 0, 26);
    roof.addColorStop(0, 'rgba(2,4,10,0.95)');
    roof.addColorStop(1, 'rgba(2,4,10,0)');
    g.fillStyle = roof; g.fillRect(0, 0, W, 26);
    var roof2 = g.createLinearGradient(0, H, 0, H - 26);
    roof2.addColorStop(0, 'rgba(2,4,10,0.95)');
    roof2.addColorStop(1, 'rgba(2,4,10,0)');
    g.fillStyle = roof2; g.fillRect(0, H - 26, W, 26);

    banner(g, 150, 30, 300, 14, 'TORCIDA · BERNARDO · HELENA · ARTHUR · JOÃO', '#facc15', '#b45309');
    banner(g, 520, H - 44, 260, 14, 'FUTEBOL DE RUA — JOGUE COM CALMA', '#0ea5e9', '#075985');

    adBoards(g, v);
    towers(g, v);
  }

  function towers(g, v) {
    var spots = [[16, 16], [W - 16, 16], [16, H - 16], [W - 16, H - 16]];
    spots.forEach(function (s) {
      var x = s[0], y = s[1];
      // poste
      g.strokeStyle = '#0f172a'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (x < W / 2 ? 14 : -14), y + (y < H / 2 ? 14 : -14)); g.stroke();
      // refletores
      var lx = x + (x < W / 2 ? 16 : -16), ly = y + (y < H / 2 ? 16 : -16);
      for (var i = -1; i <= 1; i++) {
        g.fillStyle = '#fefce8';
        g.beginPath(); g.arc(lx + i * 6, ly, 2.4, 0, Math.PI * 2); g.fill();
      }
      var glow = g.createRadialGradient(lx, ly, 2, lx, ly, 46);
      glow.addColorStop(0, 'rgba(255,250,214,0.5)');
      glow.addColorStop(1, 'rgba(255,250,214,0)');
      g.fillStyle = glow;
      g.beginPath(); g.arc(lx, ly, 46, 0, Math.PI * 2); g.fill();
    });
  }

  function gym(g, v, rnd) {
    var b = v.bounds;
    g.fillStyle = '#0a0f1a'; g.fillRect(0, 0, W, H);

    // teto com luminárias
    g.fillStyle = '#070b12'; g.fillRect(0, 0, W, 40);
    for (var i = 0; i < 6; i++) {
      var lx = 90 + i * 155, ly = 20;
      g.fillStyle = '#e2e8f0';
      g.fillRect(lx - 22, ly - 5, 44, 10);
      var gl = g.createRadialGradient(lx, ly, 4, lx, ly, 70);
      gl.addColorStop(0, 'rgba(226,232,240,0.30)');
      gl.addColorStop(1, 'rgba(226,232,240,0)');
      g.fillStyle = gl;
      g.beginPath(); g.arc(lx, ly, 70, 0, Math.PI * 2); g.fill();
    }
    // parede superior com bandeiras
    g.fillStyle = '#111a2b'; g.fillRect(0, 40, W, b.t - 40);
    g.fillStyle = 'rgba(148,163,184,0.08)';
    g.fillRect(0, 40, W, 4);
    for (var f = 0; f < 8; f++) {
      var fx0 = 60 + f * 110;
      var fc = ['#1d4ed8', '#dc2626', '#0f766e', '#7c3aed'][f % 4];
      g.fillStyle = fc;
      g.beginPath();
      g.moveTo(fx0, 52); g.lineTo(fx0 + 30, 52); g.lineTo(fx0 + 26, 84); g.lineTo(fx0 + 4, 84);
      g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.font = '700 9px system-ui, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(['AZUL', 'RUA', 'FUT', 'SALA'][f % 4], fx0 + 15, 68);
    }

    // arquibancadas laterais
    drawStand(g, 4, 52, b.l - 44, H - 60, 'v', rnd, { density: 0.8 });
    drawStand(g, b.r + 44, 52, W - b.r - 48, H - 60, 'v', rnd, { density: 0.8 });
    // arquibancada de fundo
    drawStand(g, 4, b.b + 44, W - 8, H - b.b - 48, 'h', rnd, { density: 0.95 });

    banner(g, b.l - 34, b.t - 8, b.l - 46, 14, 'TORCIDA AZUL', '#facc15', '#b45309');
    banner(g, b.r + 46, b.t - 8, b.l - 46, 14, 'FUTSAL • QUADRA 1', '#0ea5e9', '#075985');

    boards(g, v);
  }

  /* placas de quadra (rebote) */
  function boards(g, v) {
    var b = v.bounds, h = 26;
    var kitA = '#1d4ed8', kitB = '#b91c1c';
    function wall(x, y, w, hh, main, accent) {
      var grd = g.createLinearGradient(x, y, x, y + hh);
      grd.addColorStop(0, accent);
      grd.addColorStop(0.35, main);
      grd.addColorStop(1, '#0b1220');
      g.fillStyle = grd; g.fillRect(x, y, w, hh);
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.fillRect(x, y, w, 3);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (var i = 0; i < w; i += 16) g.fillRect(x + i, y + 5, 1, hh - 7);
    }
    wall(b.l - h, b.t, h, b.b - b.t, kitA, '#60a5fa');
    wall(b.r + 3, b.t, h, b.b - b.t, kitB, '#f87171');
    wall(b.l - h, b.t - h - 3, (b.r - b.l) + h * 2, h, '#0f766e', '#5eead4');
    wall(b.l - h, b.b + 3, (b.r - b.l) + h * 2, h, '#0f766e', '#5eead4');
  }

  /* ------------------------------------------------------------- piso */
  function grass(g, x, y, w, h, rnd) {
    var stripes = 9;
    for (var i = 0; i < stripes; i++) {
      var sw = w / stripes;
      g.fillStyle = i % 2 ? '#1c7a3c' : '#16682f';
      g.fillRect(x + i * sw, y, sw + 0.5, h);
    }
    // textura: tufos de grama
    for (var t = 0; t < 5200; t++) {
      var gx = x + rnd() * w, gy = y + rnd() * h;
      var dark = rnd() < 0.5;
      g.fillStyle = dark ? 'rgba(6,40,18,0.35)' : 'rgba(150,230,160,0.13)';
      g.fillRect(gx, gy, 1.2, 2.2);
    }
    // desgaste na entrada dos gols e no meio
    wear(g, x + 6, y + h / 2 - 44, 52, 88, rnd);
    wear(g, x + w - 58, y + h / 2 - 44, 52, 88, rnd);
    wear(g, x + w / 2 - 46, y + h / 2 - 34, 92, 68, rnd);
    // sombreado lateral
    var sh = g.createLinearGradient(x, 0, x + w, 0);
    sh.addColorStop(0, 'rgba(0,0,0,0.18)');
    sh.addColorStop(0.25, 'rgba(0,0,0,0)');
    sh.addColorStop(0.75, 'rgba(0,0,0,0)');
    sh.addColorStop(1, 'rgba(0,0,0,0.18)');
    g.fillStyle = sh; g.fillRect(x, y, w, h);
  }

  function wear(g, x, y, w, h, rnd) {
    for (var i = 0; i < 220; i++) {
      var a = rnd() * 0.14;
      g.fillStyle = 'rgba(150,120,60,' + a + ')';
      g.beginPath();
      g.arc(x + rnd() * w, y + rnd() * h, rnd() * 7 + 1.5, 0, Math.PI * 2);
      g.fill();
    }
  }

  function wood(g, x, y, w, h, rnd) {
    g.fillStyle = '#c98a4b';
    g.fillRect(x, y, w, h);
    var planks = 11;
    var pw = h / planks;
    for (var i = 0; i < planks; i++) {
      var py = y + i * pw;
      var tone = 0.5 + rnd() * 0.5;
      g.fillStyle = 'rgba(' + Math.round(196 * tone) + ',' + Math.round(140 * tone) + ',' + Math.round(84 * tone) + ',1)';
      g.fillRect(x, py, w, pw);
      // veio da madeira
      g.strokeStyle = 'rgba(120,74,34,0.20)';
      g.lineWidth = 1;
      for (var k = 0; k < 4; k++) {
        var gy2 = py + 2 + rnd() * (pw - 4);
        g.beginPath();
        g.moveTo(x, gy2);
        for (var sx = x; sx <= x + w; sx += 24) g.lineTo(sx, gy2 + Math.sin(sx * 0.05 + i) * 1.2);
        g.stroke();
      }
      g.fillStyle = 'rgba(70,40,15,0.35)';
      g.fillRect(x, py, w, 1);
    }
    // brilho do piso polido
    var sh = g.createLinearGradient(x, y, x + w * 0.4, y + h);
    sh.addColorStop(0, 'rgba(255,255,255,0.16)');
    sh.addColorStop(0.5, 'rgba(255,255,255,0.03)');
    sh.addColorStop(1, 'rgba(0,0,0,0.12)');
    g.fillStyle = sh; g.fillRect(x, y, w, h);
  }

  function surface(g, v, rnd) {
    var b = v.bounds;
    g.save();
    g.beginPath();
    g.rect(b.l, b.t, b.r - b.l, b.b - b.t);
    g.clip();
    if (v.outdoor) grass(g, b.l, b.t, b.r - b.l, b.b - b.t, rnd);
    else wood(g, b.l, b.t, b.r - b.l, b.b - b.t, rnd);
    g.restore();
  }

  /* --------------------------------------------------------- marcações */
  function lines(g, v) {
    var b = v.bounds, w = b.r - b.l, h = b.b - b.t;
    var cxx = (b.l + b.r) / 2, cyy = (b.t + b.b) / 2;
    g.save();
    g.strokeStyle = v.outdoor ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.85)';
    g.lineWidth = 3;
    g.lineJoin = 'round';

    g.strokeRect(b.l, b.t, w, h);

    g.beginPath(); g.moveTo(cxx, b.t); g.lineTo(cxx, b.b); g.stroke();
    g.beginPath(); g.arc(cxx, cyy, v.outdoor ? 54 : 44, 0, Math.PI * 2); g.stroke();
    g.fillStyle = g.strokeStyle;
    g.beginPath(); g.arc(cxx, cyy, 3, 0, Math.PI * 2); g.fill();

    if (v.outdoor) {
      // círculo de 9 m (traqueamento moderno)
      g.save();
      g.setLineDash([7, 9]);
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 2;
      g.beginPath(); g.arc(cxx, cyy, 128, 0, Math.PI * 2); g.stroke();
      g.restore();

      // grandes áreas
      var pw = 96, ph = 250;
      g.strokeRect(b.l, cyy - ph / 2, pw, ph);
      g.strokeRect(b.r - pw, cyy - ph / 2, pw, ph);
      var gw = 36, gh = 104;
      g.strokeRect(b.l, cyy - gh / 2, gw, gh);
      g.strokeRect(b.r - gw, cyy - gh / 2, gw, gh);

      // marcas e arcos de pênalti
      g.beginPath(); g.arc(b.l + 76, cyy, 3, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(b.r - 76, cyy, 3, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.92)';
      arcHalf(g, b.l + 76, cyy, 44, -Math.PI * 0.31, Math.PI * 0.31);
      arcHalf(g, b.r - 76, cyy, 44, Math.PI * 0.69, Math.PI * 1.31);

      // cantos
      corner(g, b.l, b.t, 1, 1);
      corner(g, b.r, b.t, -1, 1);
      corner(g, b.l, b.b, 1, -1);
      corner(g, b.r, b.b, -1, -1);
    } else {
      // futsal: área e meia-lua
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(255,255,255,0.8)';
      arcHalf(g, b.l + 22, cyy, 96, -Math.PI * 0.42, Math.PI * 0.42);
      arcHalf(g, b.r - 22, cyy, 96, Math.PI * 0.58, Math.PI * 1.42);
      g.lineWidth = 2;
      arcHalf(g, b.l + 22, cyy, 74, -Math.PI * 0.36, Math.PI * 0.36);
      arcHalf(g, b.r - 22, cyy, 74, Math.PI * 0.64, Math.PI * 1.36);
      corner(g, b.l, b.t, 1, 1);
      corner(g, b.r, b.t, -1, 1);
      corner(g, b.l, b.b, 1, -1);
      corner(g, b.r, b.b, -1, -1);
    }
    g.restore();
  }

  function arcHalf(g, cx, cy, r, a0, a1) {
    g.beginPath(); g.arc(cx, cy, r, a0, a1); g.stroke();
  }

  /* canto de meia-lua (1/4 de círculo dentro do campo) */
  function corner(g, x, y, sx, sy) {
    var a0 = sy > 0 ? (sx > 0 ? 0 : Math.PI / 2) : (sx > 0 ? -Math.PI / 2 : Math.PI);
    g.beginPath();
    g.arc(x, y, 14, a0, a0 + Math.PI / 2);
    g.stroke();
  }

  /* ------------------------------------------------------------- gols */
  function goals(g, v) {
    var b = v.bounds, gy = (b.t + b.b) / 2, hw = v.goalW / 2;
    [[b.l, -1], [b.r, 1]].forEach(function (side) {
      var x = side[0], dir = side[1];
      var gx = dir < 0 ? x - v.goalDepth : x;
      // rede
      var net = g.createLinearGradient(gx, 0, gx + v.goalDepth, 0);
      net.addColorStop(0, 'rgba(226,240,255,0.05)');
      net.addColorStop(1, 'rgba(226,240,255,0.20)');
      g.fillStyle = net;
      g.fillRect(gx, gy - hw, v.goalDepth, v.goalW);
      // malha
      g.strokeStyle = 'rgba(240,248,255,0.35)';
      g.lineWidth = 1;
      for (var i = 1; i < 6; i++) {
        var y2 = gy - hw + (v.goalW / 6) * i;
        g.beginPath(); g.moveTo(gx, y2); g.lineTo(gx + v.goalDepth, y2); g.stroke();
      }
      for (var j = 1; j < 3; j++) {
        var x2 = gx + (v.goalDepth / 3) * j;
        g.beginPath(); g.moveTo(x2, gy - hw); g.lineTo(x2, gy + hw); g.stroke();
      }
      // traves
      g.strokeStyle = '#f8fafc';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(x, gy - hw); g.lineTo(gx, gy - hw);
      g.lineTo(gx, gy + hw); g.lineTo(x, gy + hw);
      g.stroke();
      // sombra da trave no gramado
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x + 2, gy - hw + 3); g.lineTo(gx + 2, gy - hw + 3);
      g.lineTo(gx + 2, gy + hw + 3); g.lineTo(x + 2, gy + hw + 3);
      g.stroke();
    });
  }

  function light(g, v) {
    // brilho dos refletores + vinheta
    var b = v.bounds;
    var lg = g.createRadialGradient((b.l + b.r) / 2, (b.t + b.b) / 2, 40, (b.l + b.r) / 2, (b.t + b.b) / 2, 460);
    lg.addColorStop(0, 'rgba(255,255,240,0.10)');
    lg.addColorStop(1, 'rgba(255,255,240,0)');
    g.fillStyle = lg; g.fillRect(0, 0, W, H);
    var vg = g.createRadialGradient(W / 2, H / 2, 260, W / 2, H / 2, 620);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
  }

  /* ================================================================== */
  /*  PARTIDA                                                            */
  /* ================================================================== */
  function build() {
    players = [];
    [HOME, AWAY].forEach(function (squad, i) {
      var team = i + 1, slot = 0;
      squad.forEach(function (m) {
        if (!m.gk) m.slot = slot++;
        players.push({
          team: team, name: m.name, num: m.num, gk: !!m.gk, slot: m.slot,
          x: CX, y: CY, vx: 0, vy: 0, fx: dirOf(team), fy: 0,
          slide: 0, slideCd: 0, stun: 0, kickCd: 0, think: rand(0, 0.25),
          step: 0, sprint: 0, missileCd: 0
        });
      });
    });
  }

  function setupPositions(kickoffTeam) {
    players.forEach(function (p) {
      var dir = dirOf(p.team), pos;
      if (p.gk) pos = { x: dir === 1 ? F.l + 22 : F.r - 22, y: CY };
      else {
        pos = slotPos(SLOTS[p.slot], dir);
        if (kickoffTeam && p.team !== kickoffTeam) pos.x -= dir * 40;
      }
      p.x = clamp(pos.x, F.l + PLAYER_R * 0.4, F.r - PLAYER_R * 0.4);
      p.y = clamp(pos.y, F.t + PLAYER_R * 0.4, F.b - PLAYER_R * 0.4);
      p.vx = p.vy = 0;
      p.fx = dir; p.fy = 0;
      p.slide = p.slideCd = p.stun = p.kickCd = 0;
    });

    ball.x = CX; ball.y = CY; ball.z = 0; ball.vx = ball.vy = ball.vz = 0;
    ball.owner = null; ball.last = null;
    trail.length = 0;

    if (kickoffTeam) {
      var list = fieldPlayers(kickoffTeam);
      var kicker = list.reduce(function (best, p) {
        return p.x * dirOf(p.team) > best.x * dirOf(best.team) ? p : best;
      }, list[0]);
      kicker.x = CX - dirOf(kicker.team) * 26;
      kicker.y = CY + 16;
      ball.x = CX + dirOf(kicker.team) * 18;
      ball.y = CY + 16;
      takePossession(kicker);
    }
    controlled = closestToBall(fieldPlayers(1));
    controlled2 = closestToBall(fieldPlayers(2));
  }

  function fieldPlayers(team) {
    return players.filter(function (p) { return p.team === team && !p.gk; });
  }
  function mates(p) { return players.filter(function (q) { return q.team === p.team && q !== p; }); }
  function foes(p) { return players.filter(function (q) { return q.team !== p.team; }); }
  function closestToBall(list) {
    return list.reduce(function (best, q) {
      return dist(q.x, q.y, ball.x, ball.y) < dist(best.x, best.y, ball.x, ball.y) ? q : best;
    }, list[0]);
  }
  function nearestOpp(p) {
    return foes(p).reduce(function (m, q) { return Math.min(m, dist(p.x, p.y, q.x, q.y)); }, Infinity);
  }

  function setVenue(key) {
    if (!VENUES[key]) return;                 // ignora cliques que não são de local
    venueKey = key;
    V = VENUES[key];
    F = V.bounds;
    BALL_R = V.ballR;
    CX = (F.l + F.r) / 2;
    CY = (F.t + F.b) / 2;
    bg = buildBackground(key);
    fx.length = 0;
    if (key === 'quadra') buildRain();
    else rain.length = 0;
    var venueLabel = document.getElementById('venueName');
    if (venueLabel) venueLabel.textContent = V.short;
    Array.prototype.forEach.call(document.querySelectorAll('.venue, .arena'), function (b) {
      b.classList.toggle('is-active', b.dataset.venue === key);
    });
    if (state === 'demo') { build(); setupPositions(1); }
    else startMatch();
  }

  /* poeira/garoa leve na quadra */
  function buildRain() {
    var rnd = mulberry32(99);
    rain = [];
    for (var i = 0; i < 90; i++) {
      rain.push({ x: rnd() * W, y: rnd() * H, s: 6 + rnd() * 10, a: 0.05 + rnd() * 0.08 });
    }
  }

  /* ------------------------------------------------------------ input */
  var keys = {};
  var keys2 = {};
  var KEYMAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right',
    W: 'up', S: 'down', A: 'left', D: 'right',
    ' ': 'kick', Shift: 'slide', q: 'switch', Q: 'switch',
    e: 'venue', E: 'venue', r: 'reset', R: 'reset', Enter: 'start',
    1: 'diff1', 2: 'diff2', 3: 'diff3',
    F1: 'diff1', F2: 'diff2', F3: 'diff3',
    '[': 'lvlDown', ']': 'lvlUp',
    v: 'versus', V: 'versus'
  };

  /* jogador 2 no modo Versus (mesmo teclado) */
  var KEYMAP2 = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    Slash: 'kick', Period: 'kick', Numpad0: 'kick', NumpadDecimal: 'kick',
    Quote: 'slide', ShiftRight: 'slide', NumpadEnter: 'slide',
    Comma: 'switch', Numpad1: 'switch'
  };

  function mapKey(map, e) {
    if (!e) return null;
    if (e.code && map[e.code]) return map[e.code];
    if (e.key && map[e.key]) return map[e.key];
    if (e.code === 'Space' && map[' ']) return map[' '];
    if (e.code && e.code.indexOf('Key') === 0) {
      var d = e.code.slice(3).toLowerCase();
      if (map[d]) return map[d];
    }
    return null;
  }

  /* no Versus as setas ficam com o jogador 2 */
  function mapKeyP1(e) {
    if (versus && e && e.code && e.code.indexOf('Arrow') === 0) return null;
    return mapKey(KEYMAP, e);
  }

  window.addEventListener('keydown', function (e) {
    var k = mapKeyP1(e);
    if (!k) {
      if (versus) {
        var k2 = mapKey(KEYMAP2, e);
        if (k2) {
          e.preventDefault();
          if (k2 === 'kick' && !keys2.kick) onKick(2);
          if (k2 === 'slide' && !keys2.slide) onSlide(2);
          if (k2 === 'switch') wantSwitch2 = true;
          keys2[k2] = true;
        }
      }
      return;
    }
    e.preventDefault();
    if (k === 'kick' && !keys.kick) onKick(1);
    if (k === 'slide' && !keys.slide) onSlide(1);
    if (k === 'switch') wantSwitch = true;
    if (k === 'venue') toggleVenue();
    if (k === 'versus') setVersus(!versus);
    if (k === 'diff1') setDifficulty('facil');
    if (k === 'diff2') setDifficulty('normal');
    if (k === 'diff3') setDifficulty('dificil');
    if (k === 'lvlDown') setLevel(level - 1);
    if (k === 'lvlUp') setLevel(level + 1);
    if (k === 'reset') startMatch();
    if (k === 'start' && state !== 'play') startMatch();
    keys[k] = true;
  });
  window.addEventListener('keyup', function (e) {
    var k = mapKeyP1(e);
    if (k) {
      if (k === 'kick') onKickUp(1);
      keys[k] = false;
      return;
    }
    var k2 = mapKey(KEYMAP2, e);
    if (k2) {
      if (k2 === 'kick') onKickUp(2);
      keys2[k2] = false;
    }
  });

  function inputDir(who) {
    var dx = 0, dy = 0;
    var src = (who === 2 && versus) ? keys2 : keys;
    if (src.left) dx -= 1;
    if (src.right) dx += 1;
    if (src.up) dy -= 1;
    if (src.down) dy += 1;
    if (who !== 2 && touch.active) { dx += touch.dx; dy += touch.dy; }
    var l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    return { x: dx, y: dy };
  }

  function toggleVenue() {
    sound.init();
    setVenue(venueKey === 'campo' ? 'quadra' : 'campo');
  }

  /* ------------------------------------------------------------ ações */
  function onKick(who) {
    var p = (who === 2) ? controlled2 : controlled;
    if (state !== 'play' || !p || p.kickCd > 0) return;
    if (ball.owner === p) {
      // segura para carregar o míssil
      if (canMissile(who)) startCharge(who);
      else smartKick(p);
    } else if (dist(p.x, p.y, ball.x, ball.y) < 52) {
      var i = inputDir(who);
      if (Math.hypot(i.x, i.y) > 0.1) smartKick(p);
    }
  }
  function onKickUp(who) { releaseCharge(who); }
  function onSlide(who) {
    var p = (who === 2) ? controlled2 : controlled;
    if (state === 'play' && p) slide(p);
  }

  function slide(p) {
    if (p.slideCd > 0 || p.slide > 0 || p.stun > 0) return;
    var l = Math.hypot(p.fx, p.fy) || 1;
    p.slide = 0.32; p.slideCd = 1.8;
    p.sx = p.fx / l; p.sy = p.fy / l;
    puff(p.x, p.y);
  }

  function takePossession(p) {
    ball.owner = p; ball.last = p;
  }

  function kick(p, tx, ty, power, loft) {
    var dx = tx - p.x, dy = ty - p.y;
    var d = Math.hypot(dx, dy) || 1;
    var nx = dx / d, ny = dy / d;
    ball.owner = null;
    ball.x = p.x + nx * (PLAYER_R + BALL_R + 4);
    ball.y = p.y + ny * (PLAYER_R + BALL_R + 4);
    ball.vx = nx * power; ball.vy = ny * power;
    ball.vz = 40 + (loft === undefined ? 1 : loft) * (40 + d * 0.28);
    ball.last = p;
    p.kickCd = 0.2;
    puff(ball.x, ball.y, V.outdoor ? 'grass' : 'dust');
    sound.kick(Math.min(1, power / 600));
  }

  /* ------------------------------------------------- chute misil (poder) */
  var MISSILE_CD = 7;          // segundos de recarga
  var CHARGE_TIME = 1.1;       // tempo para carregar o míssil
  var shot = { 1: { charge: 0, on: false, cd: 0 }, 2: { charge: 0, on: false, cd: 0 } };
  var shake = 0;

  function canMissile(who) {
    var s = shot[who];
    return s.cd <= 0 && state === 'play';
  }

  function startCharge(who) {
    var p = ctrlOf(who === 2 ? 2 : 1);
    var s = shot[who];
    if (state !== 'play' || !p || s.on) return;
    if (ball.owner === p) { s.on = true; s.charge = 0; }
  }

  function releaseCharge(who) {
    var s = shot[who];
    if (!s.on) return;
    s.on = false;
    var p = ctrlOf(who === 2 ? 2 : 1);
    var power = s.charge;
    s.charge = 0;
    if (!p || ball.owner !== p) return;
    if (power >= 0.82) missileKick(p);
    else smartKick(p, 0.72 + power * 0.5);
  }

  function missileKick(p) {
    var dir = dirOf(p.team);
    var gx = goalX(dir);
    var gd = dist(ball.x, ball.y, gx, CY) || 1;
    var aimX = gx, aimY = CY + rand(-14, 14);
    if (gd > 620) {
      // sem visao do gol: mira na direcao que o jogador esta olhando
      aimX = ball.x + p.fx * 400;
      aimY = ball.y + p.fy * 400;
    }
    kick(p, aimX, aimY, 1080, 0.55);
    ball.vz = 120;
    ball.hot = true;
    shake = 13;
    for (var i = 0; i < 26; i++) {
      fx.push({
        x: ball.x + rand(-6, 6), y: ball.y + rand(-6, 6), life: rand(0.5, 1),
        kind: 'fire', vx: rand(-70, 70), vy: rand(-70, 70), r: rand(2.5, 6)
      });
    }
    sound.missile();
    flash = '🚀 MISSILE!';
    flashTeam = p.team;
    flashTimer = 1.1;
    p.missileCd = MISSILE_CD;
    if (p === controlled) shot[1].cd = MISSILE_CD;
    if (p === controlled2 && versus) shot[2].cd = MISSILE_CD;
  }

  function fireTrail() {
    if (fx.length > 200) fx.shift();
    fx.push({
      x: ball.x + rand(-3, 3), y: ball.y - ball.z * 0.6 + rand(-3, 3),
      life: 1, kind: 'fire',
      vx: -ball.vx * 0.08 + rand(-24, 24), vy: -ball.vy * 0.08 + rand(-24, 24),
      r: rand(2, 5)
    });
  }

  function updateShots(dt) {
    if (shake > 0) shake = Math.max(0, shake - dt * 26);
    [1, 2].forEach(function (who) {
      var s = shot[who];
      if (s.cd > 0) s.cd = Math.max(0, s.cd - dt);
      var p = ctrlOf(who);
      if (p && p.missileCd > 0) p.missileCd = Math.max(0, p.missileCd - dt);
      if (!s.on) return;
      if (!p || ball.owner !== p || state !== 'play') { s.on = false; s.charge = 0; return; }
      s.charge = Math.min(1, s.charge + dt / CHARGE_TIME);
      if (s.charge > 0.35 && Math.random() < 0.6) {
        fx.push({
          x: p.x + rand(-6, 6), y: p.y + rand(-4, 4), life: 1, kind: 'fire',
          vx: rand(-30, 30), vy: rand(-50, -10), r: rand(1.5, 4)
        });
      }
    });
  }

  function bestPass(p) {
    var dir = dirOf(p.team), best = null, bestScore = -Infinity;
    mates(p).forEach(function (m) {
      if (m.gk) return;
      var d = dist(p.x, p.y, m.x, m.y);
      if (d < 72 || d > 380) return;
      var advance = ((m.x - ball.x) / d) * dir;
      var open = clamp(1 - nearestOpp(m) / 150, 0, 1);
      var safe = clamp(1 - nearestOpp(m) / 95, 0, 1);
      var sc = advance * 1.5 + open * 0.9 + safe * 0.6 - d / 700;
      if (sc > bestScore) { bestScore = sc; best = m; }
    });
    return bestScore > -0.15 ? best : null;
  }

  function smartKick(p, mul) {
    if (ball.owner !== p) return;
    mul = mul || 1;
    var isAI = !isHuman(p);
    var aimErr = isAI ? D.aimErr : 8;
    var passErr = isAI ? D.passErr : 6;
    var dir = dirOf(p.team);
    var gx = goalX(dir);
    var gd = dist(ball.x, ball.y, gx, CY) || 1;
    var gdx = (gx - ball.x) / gd, gdy = (CY - ball.y) / gd;
    var align = p.fx * gdx + p.fy * gdy;
    var pass = bestPass(p);
    var pressured = nearestOpp(p) < 72;

    if (p.gk) {
      if (pass) kick(p, pass.x + pass.vx * 0.25 + rand(-passErr, passErr),
        pass.y + pass.vy * 0.25 + rand(-passErr, passErr), V.pass * mul, 1.6);
      else kick(p, gx, CY + rand(-aimErr, aimErr), V.kick * mul, 2.2);
      return;
    }
    if (gd < D.range && align > D.align) {
      kick(p, gx, CY + rand(-aimErr, aimErr),
        V.kick * (0.62 + 0.38 * (1 - gd / 430)) * V.shot * (D.shotPower || 1) * mul, 0.7);
      return;
    }
    if (pressured && pass) {
      kick(p, pass.x + pass.vx * 0.22 + rand(-passErr, passErr),
        pass.y + pass.vy * 0.22 + rand(-passErr, passErr), V.pass * mul, 0.9);
      return;
    }
    if (pass && gd > 210 && gd < 640) {
      kick(p, pass.x + pass.vx * 0.18 + rand(-passErr, passErr),
        pass.y + pass.vy * 0.18 + rand(-passErr, passErr), V.pass * mul, 1);
      return;
    }
    kick(p, gx, CY + rand(-aimErr * 1.6, aimErr * 1.6), V.kick * 0.8 * mul, 1.3);
  }

  /* -------------------------------------------------------- partículas */
  function puff(x, y, kind) {
    kind = kind || 'dust';
    if (fx.length > 140) fx.shift();
    for (var i = 0; i < 3; i++) {
      fx.push({
        x: x, y: y, life: 1, kind: kind,
        vx: rand(-60, 60), vy: rand(-60, 20), r: rand(1.4, 3.4)
      });
    }
  }
  function confetti() {
    var pal = ['#fde047', '#22d3ee', '#f472b6', '#4ade80', '#f97316'];
    for (var i = 0; i < 70; i++) {
      fx.push({
        x: rand(F.l, F.r), y: CY - rand(20, 180), life: 1, kind: 'confetti',
        vx: rand(-90, 90), vy: rand(-170, -40), r: rand(2, 5),
        c: pal[(Math.random() * pal.length) | 0], rot: rand(0, 6.28), vr: rand(-8, 8)
      });
    }
  }

  /* ------------------------------------------------------------ update */
  function drive(p, dx, dy, speed, dt) {
    var l = Math.hypot(dx, dy);
    var tx = 0, ty = 0;
    if (l > 0.08) {
      var m = Math.min(1, l);
      tx = (dx / l) * speed * m; ty = (dy / l) * speed * m;
    }
    if (p.stun > 0) { tx = ty = 0; }
    var k = Math.min(1, 12 * dt);
    p.vx += (tx - p.vx) * k;
    p.vy += (ty - p.vy) * k;
  }

  function aiIntent(p) {
    var dir = dirOf(p.team);
    var myGoal = goalX(-dir);
    var enemyHas = ball.owner && ball.owner.team !== p.team;
    var chaser = isChaser(p);

    if (p.gk) {
      var gx = dir === 1 ? F.l + 20 : F.r - 20;
      var tx = gx, ty = clamp(ball.y, F.t + 14, F.b - 14);
      var d = dist(ball.x, ball.y, myGoal, CY);
      if (d < 150 || (enemyHas && dist(ball.x, ball.y, myGoal, ball.y) < 165)) {
        tx = ball.x + ball.vx * 0.2; ty = ball.y + ball.vy * 0.2;
      }
      return { x: tx - p.x, y: ty - p.y, slide: d < 100 && chaser };
    }

    if (chaser) {
      return {
        x: ball.x + ball.vx * 0.22 - p.x,
        y: ball.y + ball.vy * 0.22 - p.y,
        slide: enemyHas && dist(p.x, p.y, ball.x, ball.y) < 56
      };
    }

    var base = slotPos(SLOTS[p.slot], dir);
    var shift = clamp((ball.x - CX) * 0.42, -95, 95) * dir;
    var ttx = base.x + shift + (ball.owner && ball.owner.team === p.team ? dir * 60 : 0);
    var tty = base.y + clamp((ball.y - CY) * 0.34, -80, 80);
    var mark = closestTo(p, foes(p));
    if (mark && dist(p.x, p.y, myGoal, CY) < 340) {
      var mx = (mark.x + myGoal) / 2, my = (mark.y + CY) / 2;
      if (dist(base.x, base.y, mx, my) < 150) { ttx = mx; tty = my; }
    }
    /* nos niveis baixos a IA joga mais recuada (postura defensiva) */
    var atk = D.attack === undefined ? 1 : D.attack;
    if (p.team !== 1) {
      var f = 0.4 + 0.6 * atk;
      ttx = myGoal + (ttx - myGoal) * f;
    }
    return {
      x: clamp(ttx, F.l + PLAYER_R, F.r - PLAYER_R) - p.x,
      y: clamp(tty, F.t + PLAYER_R, F.b - PLAYER_R) - p.y,
      slide: false
    };
  }

  function closestTo(p, list) {
    return list.reduce(function (best, q) {
      if (!best) return q;
      return dist(p.x, p.y, q.x, q.y) < dist(p.x, p.y, best.x, best.y) ? q : best;
    }, null);
  }

  function isChaser(p) {
    if (ball.owner && ball.owner.team === p.team) {
      return players.filter(function (q) { return q.team === p.team && !q.gk; })
        .reduce(function (best, q) {
          return dist(p.x, p.y, ball.x, ball.y) < dist(best.x, best.y, ball.x, ball.y) ? q : best;
        }, p) === p;
    }
    return closestTo({ x: ball.x, y: ball.y }, fieldPlayers(p.team)) === p;
  }

  function pickControlled() {
    if (versus) { pickFor(2); }
    pickFor(1);
  }

  /* escolhe (e troca) o jogador humano mais proximo da bola de um time */
  function pickFor(team) {
    var list = fieldPlayers(team);
    var cur = team === 1 ? controlled : controlled2;
    var flag = team === 1 ? 'wantSwitch' : 'wantSwitch2';

    if (window[flag]) {
      window[flag] = false;
      var sorted = list.slice().sort(function (a, b) {
        return dist(a.x, a.y, ball.x, ball.y) - dist(b.x, b.y, ball.x, ball.y);
      });
      var i = sorted.indexOf(cur);
      var next = sorted[(i + 1) % sorted.length];
      if (team === 1) controlled = next; else controlled2 = next;
      return;
    }
    if (ball.owner === cur) return;
    if (!cur || cur.gk) { if (team === 1) controlled = list[0]; else controlled2 = list[0]; }
    var c = closestTo({ x: ball.x, y: ball.y }, list);
    if (c !== cur && dist(c.x, c.y, ball.x, ball.y) < dist(cur.x, cur.y, ball.x, ball.y) - 55) {
      if (team === 1) controlled = c; else controlled2 = c;
    }
  }

  function separate() {
    for (var i = 0; i < players.length; i++) {
      for (var j = i + 1; j < players.length; j++) {
        var a = players[i], b = players[j];
        var dx = b.x - a.x, dy = b.y - a.y;
        var d = Math.hypot(dx, dy), min = PLAYER_R * 2;
        if (d < min && d > 0.001) {
          var push = (min - d) / 2, nx = dx / d, ny = dy / d;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
        } else if (d <= 0.001) { a.x -= 1; b.x += 1; }
      }
    }
    players.forEach(function (p) {
      p.x = clamp(p.x, F.l + PLAYER_R * 0.35, F.r - PLAYER_R * 0.35);
      p.y = clamp(p.y, F.t + PLAYER_R * 0.35, F.b - PLAYER_R * 0.35);
    });
  }

  function slideHit(p) {
    foes(p).forEach(function (q) {
      if (dist(p.x, p.y, q.x, q.y) > PLAYER_R * 2) return;
      if (ball.owner === q) { takePossession(p); q.stun = 0.3; }
      else if (!ball.owner && dist(q.x, q.y, ball.x, ball.y) < PLAYER_R + BALL_R + 8) takePossession(p);
      else { q.stun = 0.45; q.vx *= 0.25; q.vy *= 0.25; }
      puff(p.x, p.y, V.outdoor ? 'grass' : 'dust');
      p.slide = 0;
    });
  }

  function deflect(p) {
    var dx = ball.x - p.x, dy = ball.y - p.y;
    var d = Math.hypot(dx, dy) || 1;
    var nx = dx / d, ny = dy / d;
    ball.x = p.x + nx * (PLAYER_R + BALL_R + 3);
    ball.y = p.y + ny * (PLAYER_R + BALL_R + 3);
    var dot = ball.vx * nx + ball.vy * ny;
    if (dot < 0) { ball.vx -= 1.5 * dot * nx; ball.vy -= 1.5 * dot * ny; }
    var sp = Math.hypot(ball.vx, ball.vy);
    if (sp > 330) { ball.vx *= 330 / sp; ball.vy *= 330 / sp; }
    if (Math.random() < 0.35) sound.post();
  }

  /* disputa de bola: adversário colado no dono rouba a posse */
  function contest(dt) {
    var o = ball.owner;
    if (!o) return;
    var rival = null, bestD = 1e9;
    for (var i = 0; i < players.length; i++) {
      var q = players[i];
      if (q.team === o.team || q.slide > 0 || q.stun > 0) continue;
      var d = dist(q.x, q.y, o.x, o.y);
      if (d < bestD) { bestD = d; rival = q; }
    }
    if (!rival || bestD > PLAYER_R + BALL_R + 9) {
      ball.press = Math.max(0, (ball.press || 0) - dt * 0.9);
      return;
    }
    var rate = (rival.gk ? 2.1 : 1.05) * (isHuman(rival) ? 1.25 : 1);
    if (rival.team === 2) rate *= D.press;
    if (rival.sprint > 0) rate *= 1.3;
    ball.press = (ball.press || 0) + dt * rate;
    if (ball.press >= 0.5) {
      ball.press = 0;
      takePossession(rival);
      puff(rival.x, rival.y, V.outdoor ? 'grass' : 'dust');
    }
  }

  function ballStep(dt) {
    if (ball.owner) {
      var o = ball.owner;
      ball.x = o.x + o.fx * (PLAYER_R + BALL_R + 2);
      ball.y = o.y + o.fy * (PLAYER_R + BALL_R + 2);
      ball.z = 0;
      ball.vx = o.vx; ball.vy = o.vy;
      contest(dt);
      return;
    }
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    if (ball.z > 0 || ball.vz > 0) {
      ball.vz -= GRAVITY * dt;
      ball.z += ball.vz * dt;
      if (ball.z <= 0) {
        ball.z = 0;
        if (ball.vz < -60) { sound.kick(0.35); puff(ball.x, ball.y, V.outdoor ? 'grass' : 'dust'); }
        ball.vz = -ball.vz * 0.55;
        if (Math.abs(ball.vz) < 45) ball.vz = 0;
        ball.vx *= 0.82; ball.vy *= 0.82;
      }
    }
    var drag = Math.max(0, 1 - 1.0 * dt);
    ball.vx *= drag; ball.vy *= drag;
    var sp = Math.hypot(ball.vx, ball.vy);
    if (sp > 950) { ball.vx *= 950 / sp; ball.vy *= 950 / sp; }
    ball.rot += (sp * dt * 0.05) + ball.vz * dt * 0.006;

    if (sp > 180) {
      trail.push({ x: ball.x, y: ball.y, z: ball.z, life: 1 });
      if (trail.length > 9) trail.shift();
    }
    trail.forEach(function (t) { t.life -= dt * 3.2; });

// captura da bola (goleiros segura chutes mais fortes)
    for (var i = 0; i < players.length; i++) {
      var p = players[i];
      if (dist(ball.x, ball.y, p.x, p.y) >= PLAYER_R + BALL_R + 3) continue;
      var capLimit = p.gk ? 470 : 300;
      if (p.stun > 0) { deflect(p); break; }
      if (sp > capLimit && ball.last !== p) { deflect(p); break; }
      takePossession(p);
      break;
    }
  }

  function teamAttLeft() { return dirOf(1) === -1 ? 1 : 2; }
  function teamAttRight() { return dirOf(1) === 1 ? 1 : 2; }

  function boundaries() {
    if (ball.owner) return;
    var hw = V.goalW / 2 - BALL_R * 0.5;
    var inMouth = Math.abs(ball.y - CY) < hw;
    var out = null;

    if (ball.x < F.l - BALL_R) out = inMouth ? 'goalL' : 'outL';
    else if (ball.x > F.r + BALL_R) out = inMouth ? 'goalR' : 'outR';
    else if (ball.y < F.t - BALL_R) out = (V.boards && ball.z < 52) ? 'wallT' : 'outT';
    else if (ball.y > F.b + BALL_R) out = (V.boards && ball.z < 52) ? 'wallB' : 'outB';

    if (!out) {
      if (ball.y < F.t + BALL_R) { ball.y = F.t + BALL_R; ball.vy = Math.abs(ball.vy) * 0.6; }
      else if (ball.y > F.b - BALL_R) { ball.y = F.b - BALL_R; ball.vy = -Math.abs(ball.vy) * 0.6; }
      return;
    }
    if (out === 'goalL') return goal(teamAttLeft());
    if (out === 'goalR') return goal(teamAttRight());
    if (out === 'wallT') { ball.y = F.t - BALL_R; ball.vy = Math.abs(ball.vy) * 0.72; sound.post(); return; }
    if (out === 'wallB') { ball.y = F.b + BALL_R; ball.vy = -Math.abs(ball.vy) * 0.72; sound.post(); return; }
    outOfPlay(out === 'outL' ? 'left' : out === 'outR' ? 'right' : out === 'outT' ? 'top' : 'bottom');
  }

  function goal(team) {
    score[team - 1]++;
    possession[team - 1] += 1;
    flash = 'GOOOL!';
    flashTeam = team;
    flashTimer = 1.9;
    confetti();
    ball.owner = null;
    sound.cheer();
    if (state === 'demo') {          // demonstração não interrompe o fluxo
      demoConceded = team === 1 ? 1 : 2;
      stateTimer = 1.9;
      return;
    }
    state = 'goal'; stateTimer = 1.9;
    syncHud(true);
    if (navigator.vibrate) navigator.vibrate([60, 40, 90]);
  }
  var demoConceded = 1;

  function outOfPlay(side) {
    var last = ball.last;
    var attL = teamAttLeft(), attR = teamAttRight();
    var team, place, label;

    if (side === 'left' || side === 'right') {
      var att = side === 'left' ? attL : attR;
      var def = att === 1 ? 2 : 1;
      if (last && last.team === att) {
        label = 'ESCANTEIO'; team = att;
        place = {
          x: side === 'left' ? F.l + 12 : F.r - 12,
          y: clamp(ball.y, F.t + 18, F.b - 18)
        };
      } else {
        label = 'TIRO DE META'; team = def;
        var gk = players.filter(function (p) { return p.team === def && p.gk; })[0];
        place = {
          x: side === 'left' ? F.l + 34 : F.r - 34,
          y: CY + rand(-46, 46)
        };
        if (gk) { place.x = gk.x; }
      }
    } else {
      label = 'LATERAL';
      team = last ? (last.team === 1 ? 2 : 1) : 1;
      place = {
        x: clamp(ball.x, F.l + 18, F.r - 18),
        y: side === 'top' ? F.t + 12 : F.b - 12
      };
    }

    ball.owner = null; ball.last = null;
    ball.x = place.x; ball.y = place.y; ball.z = 0;
    ball.vx = ball.vy = ball.vz = 0;
    trail.length = 0;

    var pool = players.filter(function (p) { return p.team === team; });
    var taker = closestTo(place, pool.filter(function (p) { return !p.gk; })) ||
                closestTo(place, pool);
    if (taker) {
      taker.x = place.x; taker.y = place.y;
      takePossession(taker);
      ball.x = place.x; ball.y = place.y;
      if (versus) {
        if (team === 1) controlled = taker.gk ? controlled : taker;
        else if (!taker.gk) controlled2 = taker;
      } else if (team === 1) {
        controlled = taker.gk ? controlled : taker;
      }
    }
    flash = label;
    flashTeam = 0;
    flashTimer = 1.4;
  }

  function update(dt) {
    /* modo demonstração: IA x IA enquanto o jogador não começa */
    if (state === 'demo') {
      if (stateTimer > 0) {
        stateTimer -= dt;
        updateFx(dt);
        if (flash && flash !== 'GOOOL!') {
          flashTimer -= dt;
          if (flashTimer <= 0) flash = '';
        }
        if (stateTimer <= 0) { setupPositions(demoConceded); flash = ''; flashTeam = 0; }
        return;
      }
      simulate(dt, true);
      syncHud();
      return;
    }

    if (state === 'goal' || state === 'half') {
      stateTimer -= dt;
      updateFx(dt);
      if (stateTimer <= 0) {
        var conceded = flashTeam === 1 ? 1 : 2;
        setupPositions(state === 'goal' ? conceded : 1);
        state = 'play';
        flash = ''; flashTeam = 0;
        sound.whistle();
      }
      return;
    }
    if (state !== 'play') return;

    if (flash && flash !== 'INTERVALO') {
      flashTimer -= dt;
      if (flashTimer <= 0) { flash = ''; flashTeam = 0; }
    }

    clock -= dt;
    if (clock <= 0) {
      clock = 0;
      if (half === 1) {
        half = 2; halfDir = -1;
        state = 'half'; stateTimer = 2.2;
        flash = 'INTERVALO'; flashTeam = 0;
        sound.whistle();
        setupPositions(1);
      } else {
        state = 'over';
        sound.whistle();
        sound.cheer();
        var res = score[0] === score[1] ? 'empate!' :
          score[0] > score[1] ? 'vitória do Azul! 🏆' : 'vitória do Vermelho!';
        var won = score[0] > score[1];
        var drew = score[0] === score[1];
        applyLevelResult(won, drew);
        overlay('Fim de jogo', 'Azul ' + score[0] + ' × ' + score[1] + ' Vermelho — ' + res +
          (DIFFS[diffKey].levels ? (won ? ' · Subiu para o nível ' + level :
            drew ? ' · Nível ' + level + ' (empate)' : ' · Voltou ao nível ' + level) : ''),
          'Jogar de novo');
      }
      syncHud(true);
      return;
    }

    simulate(dt, false);
    updateShots(dt);
    syncHud();
  }

  function simulate(dt, demo) {
    if (!demo) pickControlled();

    players.forEach(function (p) {
      p.slideCd = Math.max(0, p.slideCd - dt);
      p.kickCd = Math.max(0, p.kickCd - dt);
      p.stun = Math.max(0, p.stun - dt);
      var isUser = !demo && isHuman(p);
      var who = p === controlled2 ? 2 : 1;
      var intent = isUser ? null : aiIntent(p);
      var spd = isUser ? SPEED.user * D.userBoost
                       : (p.gk ? SPEED.gk * D.gk : SPEED.ai * D.ai);
      var d;
      var l = Math.hypot(p.vx, p.vy);
      p.step += l * dt * 0.055;

      if (p.slide > 0) {
        p.slide -= dt;
        drive(p, p.sx, p.sy, SPEED.slide, dt);
        p.fx = p.sx; p.fy = p.sy;
        slideHit(p);
      } else {
        if (isUser) {
          var i = inputDir(who);
          d = { x: i.x, y: i.y };
        } else {
          d = intent;
          if (intent.slide && Math.random() < D.slide * dt * 12) slide(p);
        }
        drive(p, d.x, d.y, spd, dt);
        l = Math.hypot(p.vx, p.vy);
        if (l > 14) { p.fx = p.vx / l; p.fy = p.vy / l; }
        else if (isUser) {
          var il = Math.hypot(d.x, d.y);
          if (il > 0.1) { p.fx = d.x / il; p.fy = d.y / il; }
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }

      p.x = clamp(p.x, F.l + PLAYER_R * 0.35, F.r - PLAYER_R * 0.35);
      p.y = clamp(p.y, F.t + PLAYER_R * 0.35, F.b - PLAYER_R * 0.35);

      if (ball.owner === p && !isUser && p.kickCd <= 0 && p.stun <= 0) {
        p.think -= dt;
        if (p.think <= 0) {
          p.think = rand(D.think[0], D.think[1]);
          // IA tambem usa missil nos niveis altos
          if (DIFFS[diffKey].levels && level >= 55 && p.missileCd <= 0 &&
              Math.random() < 0.35 && dist(ball.x, ball.y, goalX(dirOf(p.team)), CY) < 520) {
            missileKick(p);
          } else {
            smartKick(p);
          }
        }
      }
    });

    separate();
    ballStep(dt);
    if (ball.hot) {
      fireTrail();
      if (ball.owner || Math.hypot(ball.vx, ball.vy) < 110) ball.hot = false;
    }
    if (!demo && ball.owner) possession[ball.owner.team - 1] += dt;

    boundaries();
    updateFx(dt);
  }

  function updateFx(dt) {
    for (var i = fx.length - 1; i >= 0; i--) {
      var f = fx[i];
      f.life -= dt * (f.kind === 'confetti' ? 0.55 : 1.7);
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.kind === 'confetti') {
        f.vy += 300 * dt; f.rot += f.vr * dt;
      } else {
        f.vy += 40 * dt; f.vx *= 0.94; f.vy *= 0.94;
      }
      if (f.life <= 0) fx.splice(i, 1);
    }
    for (var j = trail.length - 1; j >= 0; j--) {
      trail[j].life -= dt * 3.2;
      if (trail[j].life <= 0) trail.splice(j, 1);
    }
  }

  /* --------------------------------------------------------------- HUD */
  var el = {
    gh: document.getElementById('goalsHome'),
    ga: document.getElementById('goalsAway'),
    clock: document.getElementById('clock'),
    half: document.getElementById('half'),
    overlay: document.getElementById('overlay'),
    title: document.getElementById('overlayTitle'),
    text: document.getElementById('overlayText'),
    btn: document.getElementById('btnPlay'),
    venue: document.getElementById('venueName'),
    sound: document.getElementById('btnSound')
  };
  if (el.sound) el.sound.textContent = sound.isMuted() ? '🔇' : '🔊';
  var hudKey = '';

  function syncHud(force) {
    var m = Math.floor(clock / 60);
    var s = Math.floor(clock % 60);
    var txt = m + ':' + ('0' + s).slice(-2);
    var key = score.join() + txt + half;
    if (!force && key === hudKey) return;
    hudKey = key;
    el.gh.textContent = score[0];
    el.ga.textContent = score[1];
    el.clock.textContent = txt;
    el.half.textContent = half === 1 ? '1º tempo' : '2º tempo';
  }

  function overlay(title, text, btn) {
    el.title.textContent = title;
    el.text.textContent = text;
    el.btn.textContent = btn;
    el.overlay.hidden = false;
  }

  function startMatch() {
    score = [0, 0];
    possession = [0, 0];
    half = 1; halfDir = 1;
    clock = HALF_TIME * 2;
    flash = ''; flashTeam = 0;
    fx.length = 0;
    build();
    setupPositions(1);
    state = 'play';
    el.overlay.hidden = true;
    syncHud(true);
    sound.init();
    sound.whistle();
  }

  el.btn.addEventListener('click', function () {
    sound.init();
    if (state !== 'play') startMatch();
  });
  document.getElementById('btnVenue').addEventListener('click', toggleVenue);
  if (el.sound) el.sound.addEventListener('click', function () {
    sound.init();
    var m = !sound.isMuted();
    sound.setMuted(m);
    el.sound.textContent = m ? '🔇' : '🔊';
    el.sound.classList.toggle('is-off', m);
  });
  Array.prototype.forEach.call(document.querySelectorAll('.venue[data-venue]'), function (b) {
    b.addEventListener('click', function () {
      sound.init();
      setVenue(b.dataset.venue);
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll('.arena[data-venue]'), function (b) {
    b.addEventListener('click', function () {
      sound.init();
      setVenue(b.dataset.venue);
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll('.diff'), function (b) {
    b.addEventListener('click', function () {
      sound.init();
      setDifficulty(b.dataset.diff);
    });
  });
  var btnDiff = document.getElementById('btnDiff');
  if (btnDiff) {
    btnDiff.addEventListener('click', function () {
      sound.init();
      var order = ['facil', 'normal', 'dificil'];
      setDifficulty(order[(order.indexOf(diffKey) + 1) % order.length]);
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll('.mode'), function (b) {
    b.addEventListener('click', function () {
      sound.init();
      setVersus(b.dataset.mode === '2p');
    });
  });
  var btnMode = document.getElementById('btnMode');
  if (btnMode) btnMode.addEventListener('click', function () { sound.init(); setVersus(!versus); });

  /* --------------------------------------------------------- dificuldades */
  var DIFFS = {
    facil: { id: 'facil', label: 'Fácil', levels: true },
    normal: {
      id: 'normal', label: 'Normal', ai: 1, gk: 1, aimErr: 32,
      passErr: 30, think: [0.14, 0.34], press: 1, userBoost: 1,
      slide: 1, range: 350, align: 0.28
    },
    dificil: {
      id: 'dificil', label: 'Difícil', ai: 1.15, gk: 1.18, aimErr: 10,
      passErr: 10, think: [0.06, 0.18], press: 1.4, userBoost: 0.96,
      slide: 1.35, range: 420, align: 0.12
    }
  };
  var MAX_LEVEL = 100;
  var diffKey = 'facil';
  var level = 1;
  var D = null;

  function lerp(a, b, t) { return a + (b - a) * t; }

  /* no modo Facil a IA evolui continuamente do nivel 1 ao 100 */
  function levelParams(n) {
    var t = clamp((n - 1) / (MAX_LEVEL - 1), 0, 1);
    return {
      id: 'facil', label: 'Fácil', level: n,
      ai: lerp(0.5, 1.12, t),
      gk: lerp(0.78, 1.22, t),
      aimErr: lerp(95, 18, t),
      passErr: lerp(115, 18, t),
      think: [lerp(0.55, 0.06, t), lerp(0.95, 0.2, t)],
      press: lerp(0.3, 1.35, t),
      userBoost: lerp(1.1, 0.96, t),
      slide: lerp(0.1, 1.4, t),
      range: lerp(180, 430, t),
      align: lerp(0.58, 0.12, t),
      attack: lerp(0.12, 1, t),
      shotPower: lerp(0.55, 1.05, t)
    };
  }

  function refreshDifficulty() {
    var leveled = !!DIFFS[diffKey].levels;
    D = leveled ? levelParams(level) : DIFFS[diffKey];
    var txt = leveled ? ('Fácil · Nv ' + level) : D.label;
    var label = document.getElementById('diffName');
    if (label) label.textContent = txt;
    var inline = document.getElementById('diffInline');
    if (inline) inline.textContent = txt;
    var out = document.getElementById('lvlOut');
    if (out) out.textContent = String(level);
    var rng = document.getElementById('lvlRange');
    if (rng && rng.value !== String(level)) rng.value = String(level);
    var box = document.getElementById('levelBox');
    if (box) box.hidden = !leveled;
    var vh = document.getElementById('versusHint');
    if (vh) vh.hidden = !versus;
    Array.prototype.forEach.call(document.querySelectorAll('.diff'), function (b) {
      b.classList.toggle('is-active', b.dataset.diff === diffKey);
    });
  }

  function setDifficulty(key, noRestart) {
    if (!DIFFS[key]) return;
    diffKey = key;
    refreshDifficulty();
    try {
      localStorage.setItem('fr-mode', key);
      localStorage.setItem('fr-level', String(level));
    } catch (err) { /* ignora */ }
    if (!noRestart && (state === 'play' || state === 'demo')) startMatch();
  }

  function setLevel(n) {
    level = clamp(Math.round(n) || 1, 1, MAX_LEVEL);
    refreshDifficulty();
    try { localStorage.setItem('fr-level', String(level)); } catch (err) { /* ignora */ }
  }

  /* sobe (ou cai) de nivel conforme o resultado da partida */
  function applyLevelResult(won, drew) {
    if (!DIFFS[diffKey].levels) return;
    if (won) {
      setLevel(level + 1);
      flash = 'SUBIU PARA O NÍVEL ' + level;
      flashTimer = 2.4;
      flashTeam = 1;
    } else if (!drew) {
      setLevel(level - 1);
      flash = 'VOLTOU AO NÍVEL ' + level;
      flashTimer = 1.8;
      flashTeam = 2;
    }
  }

  function loadDifficulty() {
    var m = null, l = 1;
    try {
      m = localStorage.getItem('fr-mode');
      l = parseInt(localStorage.getItem('fr-level'), 10);
    } catch (err) { m = null; }
    diffKey = DIFFS[m] ? m : 'facil';
    level = (l >= 1 && l <= MAX_LEVEL) ? l : 1;
    refreshDifficulty();

    var rng = document.getElementById('lvlRange');
    if (rng) rng.addEventListener('input', function () { setLevel(parseInt(rng.value, 10)); });
    var dn = document.getElementById('lvlDown');
    if (dn) dn.addEventListener('click', function () { setLevel(level - 1); });
    var up = document.getElementById('lvlUp');
    if (up) up.addEventListener('click', function () { setLevel(level + 1); });
    var rs = document.getElementById('lvlReset');
    if (rs) rs.addEventListener('click', function () { setLevel(1); });
  }
  /* --------------------------------------------------------- closet (cores) */
  var closet = { on: false };

  function bindCloset() {
    var sel = document.getElementById('kitTeam');
    var panel = document.getElementById('closet');
    var btn = document.getElementById('btnCustom');
    if (!sel || !panel) return;

    if (!kit[sel.value]) sel.value = '1';
    function team() { return kit[sel.value] ? sel.value : '1'; }

    var fields = {
      kitShirt: 'a', kitTrim: 'b', kitShorts: 'shorts', kitSocks: 'socks',
      kitBoot: 'boot', kitBoot2: 'boot2', kitSkin: 'skin', kitHair: 'hair'
    };
    var inputs = {};

    Object.keys(fields).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      inputs[id] = el;
      el.addEventListener('input', function () {
        kit[team()][fields[id]] = el.value;
      });
    });
    var styleEl = document.getElementById('kitStyle');
    if (styleEl) {
      styleEl.addEventListener('change', function () {
        kit[team()].style = styleEl.value;
      });
    }

    function loadTeam() {
      var k = kit[team()];
      if (!k) return;
      Object.keys(fields).forEach(function (id) {
        if (inputs[id]) inputs[id].value = k[fields[id]];
      });
      if (styleEl) styleEl.value = k.style;
    }
    sel.addEventListener('change', loadTeam);

    var rnd = document.getElementById('kitRandom');
    if (rnd) rnd.addEventListener('click', function () {
      var k = kit[team()];
      if (!k) return;
      var h = function () {
        return '#' + ('000000' + Math.floor(Math.random() * 0x1000000).toString(16)).slice(-6);
      };
      k.a = h(); k.b = h(); k.shorts = h(); k.socks = h();
      k.boot = h(); k.boot2 = h(); k.skin = h(); k.hair = h();
      k.style = ['stripes', 'hoops', 'plain', 'sash', 'gradient'][Math.floor(Math.random() * 5)];
      loadTeam();
    });
    var rst = document.getElementById('kitReset');
    if (rst) rst.addEventListener('click', function () {
      kit[team()] = defaultKit(Number(team()));
      loadTeam();
    });

    function toggle(on) {
      closet.on = on === undefined ? !closet.on : on;
      panel.hidden = !closet.on;
      if (closet.on) loadTeam();
    }

    if (btn) btn.addEventListener('click', function () { toggle(); });
    var cl = document.getElementById('btnCloseCloset');
    if (cl) cl.addEventListener('click', function () { toggle(false); });

    bindCloset.toggle = toggle;
  }

  var BOOT_BASES = [
    { name: 'CTR', mult: 1 }, { name: 'TOTAL', mult: 0.92 }, { name: 'NIG', mult: 0.85 },
    { name: 'TIK', mult: 0.8 }, { name: 'AD', mult: 1.05 }, { name: 'UM', mult: 0.78 }
  ];

  function defaultKit(team) {
    var base = team === 1
      ? { a: '#2f6fe0', b: '#ffffff', shorts: '#0f2a5c', socks: '#bfdbfe', skin: '#e0a97c', hair: '#2b1a12', style: 'stripes', boot: '#facc15', boot2: '#111827' }
      : { a: '#d92b2b', b: '#ffffff', shorts: '#2a0f0f', socks: '#fecaca', skin: '#c68642', hair: '#1c1410', style: 'hoops', boot: '#22d3ee', boot2: '#0f172a' };
    base.team = team;
    base.bootBase = team === 1 ? 1 : 3;
    base.number = BOOT_BASES[base.bootBase];
    return base;
  }

  var kit = { 1: defaultKit(1), 2: defaultKit(2) };

  function shade(hex, f) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (isNaN(n)) return hex;
    var r = clamp(Math.round(((n >> 16) & 255) * f), 0, 255);
    var g = clamp(Math.round(((n >> 8) & 255) * f), 0, 255);
    var b = clamp(Math.round((n & 255) * f), 0, 255);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function kitOf(p) {
    if (p.gk) {
      var g = p.team === 1
        ? { a: '#16a34a', b: '#0f2a1c', shorts: '#052e16', socks: '#bbf7d0', skin: '#e0a97c', hair: '#2b1a12', style: 'plain', boot: '#f97316', boot2: '#111827' }
        : { a: '#f59e0b', b: '#3b1d02', shorts: '#3b1d02', socks: '#fde68a', skin: '#c68642', hair: '#1c1410', style: 'plain', boot: '#111827', boot2: '#f59e0b' };
      g.number = p.team === 1 ? BOOT_BASES[4] : BOOT_BASES[2];
      return g;
    }
    return kit[p.team];
  }

  /* --------------------------------------------------------------- draw */

  function drawPlayer(p) {
    var kit = kitOf(p);
    var isUser = isHuman(p);
    var stunned = p.stun > 0;
    var speed = Math.hypot(p.vx, p.vy);
    var fxv = p.fx, fyv = p.fy;
    var px = -fyv, py = fxv; // perpendicular

    ctx.save();
    ctx.translate(p.x, p.y);

    // sombra
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.beginPath();
    ctx.ellipse(1.5, PLAYER_R * 0.55, PLAYER_R * 0.95, PLAYER_R * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    if (p.slide > 0) {
      ctx.rotate(Math.atan2(p.sy, p.sx));
      ctx.fillStyle = kit.a;
      ctx.beginPath();
      ctx.ellipse(0, 0, PLAYER_R * 1.3, PLAYER_R * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = kit.socks;
      ctx.beginPath();
      ctx.ellipse(PLAYER_R * 1.15, 0, 6, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (isUser) ring(p);
      return;
    }

    // pernas (animação de corrida)
    var swing = Math.sin(p.step * 2) * Math.min(1, speed / 130) * 7;
    [[-4, swing], [4, -swing]].forEach(function (leg, li) {
      var lx = leg[0], ly = leg[1];
      var bootCol = li === 0 ? kit.boot : kit.boot2;

      // meiao
      ctx.fillStyle = kit.socks;
      ctx.beginPath();
      ctx.ellipse(lx, ly - 1.5, 4.4, 5.2, 0, 0, Math.PI * 2);
      ctx.fill();

      // calcao
      ctx.fillStyle = kit.shorts;
      ctx.beginPath();
      ctx.ellipse(lx, ly - 5.6, 4.1, 3.4, 0, 0, Math.PI * 2);
      ctx.fill();

      // chuteira
      ctx.save();
      ctx.translate(lx + fxv * 4.4, ly + fyv * 4.4 - 0.6);
      ctx.rotate(Math.atan2(fyv, fxv));

      ctx.fillStyle = 'rgba(0,0,0,0.24)';
      ctx.beginPath();
      ctx.ellipse(0.6, 1.8, 6.4, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      var bg2 = ctx.createLinearGradient(0, -4, 0, 4);
      bg2.addColorStop(0, shade(bootCol, 1.3));
      bg2.addColorStop(0.55, bootCol);
      bg2.addColorStop(1, shade(bootCol, 0.6));
      ctx.fillStyle = bootCol.toLowerCase() === '#ffffff' ? '#eef2f7' : bg2;
      ctx.beginPath();
      ctx.moveTo(-4.4, -3.4);
      ctx.quadraticCurveTo(4.6, -4, 6.8, -1.1);
      ctx.quadraticCurveTo(7.4, 2.5, 3.4, 3.4);
      ctx.lineTo(-4.2, 3.4);
      ctx.quadraticCurveTo(-5.6, 0, -4.4, -3.4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(2,6,23,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // detalhe e cadarco
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(3.5, 0.3, 1.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = shade(bootCol, 0.45);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(-3.6, -1.9); ctx.lineTo(2.4, -1.6);
      ctx.moveTo(-3.4, -0.2); ctx.lineTo(2, 0.1);
      ctx.stroke();

      // solado + studs
      ctx.fillStyle = shade(bootCol, 0.5);
      ctx.beginPath();
      ctx.moveTo(-4.2, 2.5);
      ctx.lineTo(6.6, 2.2);
      ctx.quadraticCurveTo(7.2, 3.5, 3.4, 3.7);
      ctx.lineTo(-4.2, 3.7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      for (var st = 0; st < 3; st++) {
        ctx.beginPath();
        ctx.arc(-2.6 + st * 3.1, 3.8, 0.75, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    // braços
    var armSwing = swing * 0.45;
    ctx.fillStyle = kit.skin;
    ctx.beginPath();
    ctx.ellipse(px * 11 + fxv * armSwing, py * 11 + fyv * armSwing, 3.4, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-px * 11 - fxv * armSwing, -py * 11 - fyv * armSwing, 3.4, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // tronco
    ctx.fillStyle = stunned ? '#94a3b8' : kit.a;
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER_R, 0, Math.PI * 2);
    ctx.fill();

    // padrão do uniforme
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER_R, 0, Math.PI * 2);
    ctx.clip();
    if (kit.style === 'stripes') {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (var s = -2; s <= 2; s++) {
        ctx.save();
        ctx.translate(s * 6, 0);
        ctx.rotate(Math.atan2(fyv, fxv));
        ctx.fillRect(-1.8, -PLAYER_R, 3.6, PLAYER_R * 2);
        ctx.restore();
      }
    } else if (kit.style === 'hoops') {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (var s2 = -1; s2 <= 1; s2++) {
        ctx.fillRect(-PLAYER_R, s2 * 7 - 1.6, PLAYER_R * 2, 3.2);
      }
    } else if (kit.style === 'sash') {
      ctx.save();
      ctx.rotate(Math.atan2(fyv, fxv) + 0.7);
      ctx.fillStyle = kit.b;
      ctx.fillRect(-PLAYER_R, -2.6, PLAYER_R * 2, 5.2);
      ctx.restore();
    } else if (kit.style === 'gradient') {
      var gd = ctx.createLinearGradient(-PLAYER_R, -PLAYER_R, PLAYER_R, PLAYER_R);
      gd.addColorStop(0, kit.a);
      gd.addColorStop(1, kit.b);
      ctx.fillStyle = gd;
      ctx.fillRect(-PLAYER_R, -PLAYER_R, PLAYER_R * 2, PLAYER_R * 2);
    } else {
      ctx.fillStyle = kit.b;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(-PLAYER_R, -3, PLAYER_R * 2, 6);
      ctx.globalAlpha = 1;
    }
    // gola e detalhe do uniforme na cor escolhida
    ctx.strokeStyle = kit.b;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER_R - 2.4, 0, Math.PI * 2);
    ctx.stroke();
    // sombreado lateral
    var sh = ctx.createLinearGradient(-PLAYER_R, 0, PLAYER_R, 0);
    sh.addColorStop(0, 'rgba(0,0,0,0.28)');
    sh.addColorStop(0.6, 'rgba(255,255,255,0.06)');
    sh.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = sh;
    ctx.fillRect(-PLAYER_R, -PLAYER_R, PLAYER_R * 2, PLAYER_R * 2);
    ctx.restore();

    ctx.strokeStyle = 'rgba(2,6,23,0.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER_R, 0, Math.PI * 2);
    ctx.stroke();

    // cabeça
    var hx = fxv * 7.5, hy = fyv * 7.5;
    ctx.fillStyle = kit.skin;
    ctx.beginPath();
    ctx.arc(hx, hy, 6.2, 0, Math.PI * 2);
    ctx.fill();
    // cabelo
    ctx.fillStyle = kit.hair;
    ctx.beginPath();
    ctx.arc(hx - fxv * 1.4, hy - fyv * 1.4, 5.4, Math.PI * 0.45, Math.PI * 1.55);
    ctx.fill();

    // número nas costas
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(p.num), -fxv * 8.5, -fyv * 8.5);

    // nome
    if (!p.gk) {
      ctx.font = '600 9.5px system-ui, sans-serif';
      ctx.fillStyle = kit.b;
      ctx.globalAlpha = 0.9;
      ctx.fillText(p.name, 0, -PLAYER_R - 9);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 2.5;
      ctx.strokeText(p.name, 0, -PLAYER_R - 9);
      ctx.fillText(p.name, 0, -PLAYER_R - 9);
    }

    ctx.restore();

    if (isUser) ring(p);
  }

  function ring(p) {
    var col = (p === controlled2) ? 'rgba(244,114,182,0.95)' : 'rgba(34,211,238,0.95)';
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER_R + 6.5, 0, Math.PI * 2);
    ctx.stroke();
    var fx = p.fx, fy = p.fy;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(fx * (PLAYER_R + 15), fy * (PLAYER_R + 15));
    ctx.lineTo(fx * (PLAYER_R + 7) - fy * 5.5, fy * (PLAYER_R + 7) + fx * 5.5);
    ctx.lineTo(fx * (PLAYER_R + 7) + fy * 5.5, fy * (PLAYER_R + 7) - fx * 5.5);
    ctx.closePath();
    ctx.fill();
    ctx.font = '700 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = col;
    ctx.fillText(p === controlled2 ? 'J2' : 'J1', 0, -PLAYER_R - 18);
    ctx.restore();
  }

  function drawBall() {
    var h = ball.z;
    var sc = 1 + h / 340;
    var shadowScale = clamp(1 - h / 420, 0.3, 1);

    // rastro
    trail.forEach(function (t) {
      ctx.globalAlpha = Math.max(0, t.life) * 0.18;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(t.x, t.y, BALL_R * shadowScale * 0.9, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // sombra (proporcional à altura)
    ctx.fillStyle = 'rgba(0,0,0,' + (0.34 * shadowScale) + ')';
    ctx.beginPath();
    ctx.ellipse(ball.x + h * 0.22, ball.y + h * 0.3, BALL_R * shadowScale, BALL_R * shadowScale * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(ball.x, ball.y - h * 0.62);
    ctx.scale(sc, sc);
    ctx.rotate(ball.rot);

    var g = ctx.createRadialGradient(-BALL_R * 0.35, -BALL_R * 0.4, 1, 0, 0, BALL_R + 1);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#cbd5e1');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(15,23,42,0.85)';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    for (var i = 0; i < 5; i++) {
      var a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * BALL_R * 0.5, Math.sin(a) * BALL_R * 0.5, BALL_R * 0.26, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFx() {
    fx.forEach(function (f) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      if (f.kind === 'confetti') {
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.rot);
        ctx.fillStyle = f.c;
        ctx.fillRect(-f.r, -f.r * 0.5, f.r * 2, f.r);
        ctx.restore();
      } else {
        if (f.kind === 'grass') {
          ctx.fillStyle = 'rgba(140,220,150,0.6)';
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r * f.life, 0, Math.PI * 2);
          ctx.fill();
        } else if (f.kind === 'fire') {
          var r2 = f.r * (0.5 + f.life);
          var g2 = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r2 * 2.2);
          g2.addColorStop(0, 'rgba(255,241,180,' + (0.9 * f.life) + ')');
          g2.addColorStop(0.4, 'rgba(249,115,22,' + (0.75 * f.life) + ')');
          g2.addColorStop(1, 'rgba(220,38,38,0)');
          ctx.fillStyle = g2;
          ctx.beginPath();
          ctx.arc(f.x, f.y, r2 * 2.2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r * f.life, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });
    ctx.globalAlpha = 1;
  }

  function banner(text, color) {
    if (!text) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 46px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(text, CX + 2, CY + 3);
    ctx.fillStyle = color;
    ctx.fillText(text, CX, CY);
    ctx.restore();
  }

  function drawInfo() {
    var total = possession[0] + possession[1];
    var p0 = total > 1 ? Math.round(possession[0] / total * 100) : 50;
    ctx.save();
    ctx.font = '600 10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(2,6,23,0.62)';
    ctx.fillRect(F.l + 6, F.b - 22, 186, 16);
    ctx.fillStyle = '#93c5fd';
    ctx.fillText('Posse  Azul ' + p0 + '%  ·  Vermelho ' + (100 - p0) + '%', F.l + 12, F.b - 13.5);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(2,6,23,0.62)';
    ctx.fillRect(F.r - 152, F.b - 22, 146, 16);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(V.full, F.r - 12, F.b - 13.5);
    ctx.restore();
  }

  function render(dt) {
    ctx.drawImage(bg, 0, 0);

    var sx = shake > 0.05 ? rand(-shake, shake) : 0;
    var sy = shake > 0.05 ? rand(-shake, shake) : 0;
    ctx.save();
    if (sx || sy) ctx.translate(sx, sy);

    if (rain.length) {
      ctx.save();
      rain.forEach(function (d) {
        d.y += d.s * dt * 2.4;
        d.x += d.s * dt * 0.3;
        if (d.y > H) { d.y = -4; d.x = rand(0, W); }
        ctx.fillStyle = 'rgba(200,225,255,' + d.a + ')';
        ctx.fillRect(d.x, d.y, 1.2, 3);
      });
      ctx.restore();
    }

    drawFx();

    var order = players.slice().sort(function (a, b) { return a.y - b.y; });
    order.forEach(drawPlayer);
    drawBall();

    if (flash) {
      banner(flash, flash === 'GOOOL!' ? (flashTeam === 1 ? '#93c5fd' : '#fca5a5') : '#fde047');
    }
    drawInfo();
    drawChargeBars();
    ctx.restore();
  }

  /* barra de carga do míssil + recarga */
  function drawChargeBars() {
    var list = versus ? [1, 2] : [1];
    for (var i = 0; i < list.length; i++) {
      var who = list[i];
      var s = shot[who];
      var p = ctrlOf(who);
      if (!p) continue;
      var w = 54, h = 6;
      var x = clamp(p.x - w / 2, F.l, F.r - w);
      var y = p.y - PLAYER_R - 26;

      ctx.save();
      ctx.fillStyle = 'rgba(2,6,23,0.65)';
      ctx.fillRect(x, y, w, h);
      var ready = s.cd <= 0;
      var fill = s.on ? s.charge : (ready ? 1 : 1 - s.cd / MISSILE_CD);
      var col = ready ? (s.on && s.charge >= 0.82 ? '#f97316' : '#22d3ee') : '#64748b';
      ctx.fillStyle = col;
      ctx.fillRect(x, y, w * clamp(fill, 0, 1), h);
      ctx.strokeStyle = 'rgba(226,232,255,0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

      if (ready && !s.on) {
        ctx.font = '700 8px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#22d3ee';
        ctx.fillText('🚀', x + w / 2, y - 2);
      } else if (s.cd > 0) {
        ctx.font = '700 8px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'rgba(148,163,184,0.9)';
        ctx.fillText(s.cd.toFixed(1) + 's', x + w / 2, y - 2);
      } else if (s.on) {
        ctx.font = '700 9px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = s.charge >= 0.82 ? '#fdba74' : '#e0f2fe';
        ctx.fillText(s.charge >= 0.82 ? 'MISSILE!' : 'carregando', x + w / 2, y - 2);
      }
      ctx.restore();
    }
  }

  /* -------------------------------------------------------------- loop */
  var touch = { active: false, dx: 0, dy: 0 };
  var pad = document.getElementById('pad');
  var knob = document.getElementById('knob');
  var padId = null;

  function padMove(e) {
    var r = pad.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2);
    var l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    touch.dx = dx; touch.dy = dy;
    knob.style.transform = 'translate(' + dx * 32 + 'px,' + dy * 32 + 'px)';
  }
  if (window.PointerEvent) {
    pad.addEventListener('pointerdown', function (e) {
      padId = e.pointerId; touch.active = true;
      pad.setPointerCapture(padId); padMove(e); e.preventDefault();
    });
    pad.addEventListener('pointermove', function (e) {
      if (padId === e.pointerId) padMove(e);
    });
    function endPad(e) {
      if (padId !== e.pointerId) return;
      padId = null; touch.active = false; touch.dx = touch.dy = 0;
      knob.style.transform = 'translate(0,0)';
    }
    pad.addEventListener('pointerup', endPad);
    pad.addEventListener('pointercancel', endPad);
    document.getElementById('btnKick').addEventListener('pointerdown', function (e) { e.preventDefault(); onKick(1); });
    document.getElementById('btnSlide').addEventListener('pointerdown', function (e) { e.preventDefault(); onSlide(1); });
  }
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    document.getElementById('touch').hidden = false;
  }

  var last = performance.now();
  function frame(now) {
    var dt = clamp((now - last) / 1000, 0, 0.04);
    last = now;
    update(dt);
    render(dt);
    requestAnimationFrame(frame);
  }

  bg = buildBackground(venueKey);
  build();
  setupPositions(1);
  bindCloset();
  loadDifficulty();
  loadVersus();
  if (V.boards) buildRain();
  syncHud(true);
  requestAnimationFrame(frame);

  /* gancho de depuração (útil para testes automatizados) */
  window.__jogo = {
    ball: ball,
    get players() { return players; },
    score: function () { return score.join('x'); },
    raw: { get score() { return score; } },
    clock: function () { return clock; },
    half: function () { return half; },
    state: function () { return state; },
    owner: function () { return ball.owner ? (ball.owner.team + ':' + ball.owner.name) : null; },
    controlled: function () { return controlled; },
    ctrl: function (n) { return n === 2 ? controlled2 : controlled; },
    setVersus: setVersus,
    versus: function () { return versus; },
    bounds: function () { return F; },
    venue: function () { return venueKey; },
    kit: kit,
    kitOf: kitOf,
    setVenue: setVenue,
    setDifficulty: setDifficulty,
    setLevel: setLevel,
    level: function () { return level; },
    get params() { return D; },
    difficulty: function () { return diffKey; },
    startMatch: startMatch,
    toggleVenue: toggleVenue
  };
})();