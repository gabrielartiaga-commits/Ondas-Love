/* ============ SIMULADOR PRINCIPAL ============ */
(() => {
  const $ = id => document.getElementById(id);
  const cv = $('sim'), ctx = cv.getContext('2d'), stage = $('stage');
  const C = { jas: '#F4D06F', ora: '#FF8811', aqua: '#9DD9D2', floral: '#FFF8F0' };
  const PX = 30;                    // píxeles por metro (escala visual)
  const PHI = Math.PI / 6;          // el frente llega en diagonal (30°) desde el fondo
  const QUAKE_T = 7;                // duración del terremoto (s)
  const S = { amp: 50, freq: 2, vel: 3, blocks: 8, mode: 'wave', build: false, iso: false };

  let W, H, GY, t = 0, quakeT = 0, bl = [], deb = [], hudT = 0;

  /* ---------- Física de la onda ----------
     Love (SH): el desplazamiento es SOLO horizontal (eje x) y decae con la profundidad. */
  const wave = () => {
    const w = 2 * Math.PI * S.freq, lam = S.vel / S.freq;
    return { w, lam, k: 2 * Math.PI / lam, T: 1 / S.freq };
  };
  const ampF = () => 0.2 + 0.8 * (quakeT > 0 ? Math.min(1, (QUAKE_T - quakeT) / 1, quakeT / 1.5) : 0);
  // desplazamiento horizontal del suelo en x (px) a cierta profundidad (px)
  const gu = (x, depth, P) => S.amp * ampF() * Math.cos(PHI) * Math.exp(-depth / (H * 0.25)) *
    Math.sin(P.k / PX * Math.sin(PHI) * x - P.w * t);

  /* ---------- Edificios: oscilador de corte (masa-resorte-amortiguador) ---------- */
  function mkBuilding(x) {
    const h = 60 + Math.random() * 80;
    return { x, w: 28, h, f0: 3.2 * 70 / h, r: 0, v: 0, dmg: 0, dead: false, seed: Math.random() * 100,
      col: Math.random() > .5 ? C.jas : C.ora };
  }
  function layout() {
    const sp = W / (S.blocks + 1);
    bl = Array.from({ length: S.blocks }, (_, i) => mkBuilding((i + 1) * sp - 14));
    deb = [];
  }

  function collapse(b, u, P) {
    b.dead = true;
    const n = Math.round(b.h / 8);
    for (let i = 0; i < n; i++) deb.push({ x: b.x + u + Math.random() * b.w, y: GY - Math.random() * b.h,
      vx: Math.sign(b.r || 1) * (40 + Math.random() * 160), vy: -Math.random() * 120, s: 6 + Math.random() * 10,
      a: Math.random() * 6, va: (Math.random() - .5) * 8, rest: false, ox: 0, c: b.col });
  }

  function step(dt) {
    const P = wave();
    t += dt;
    if (quakeT > 0) { quakeT -= dt; if (quakeT <= 0) { quakeT = 0; $('quake-alert').classList.remove('active'); } }
    const sub = 4, h = dt / sub;
    let maxDrift = 0;
    for (const b of bl) {
      if (b.dead) continue;
      const cx = b.x + b.w / 2, u = gu(cx, 0, P);
      const w0 = 2 * Math.PI * (S.iso ? 0.4 : b.f0), z = S.iso ? 0.25 : 0.12;
      const a_g = -P.w * P.w * u;                       // aceleración horizontal del suelo
      for (let i = 0; i < sub; i++) {
        const a = -2 * z * w0 * b.v - w0 * w0 * b.r - a_g;
        b.v += a * h; b.r += b.v * h;
      }
      const lim = S.iso ? 260 : b.h * 1.1;
      b.r = Math.max(-lim, Math.min(lim, b.r));
      const drift = Math.abs(b.r) / b.h * (S.iso ? 0.08 : 1); // el aislador absorbe el desplazamiento
      maxDrift = Math.max(maxDrift, drift);
      if (drift > 0.17) b.dmg += (drift - 0.17) * 2.2 * dt;  // fatiga por fuerza de corte
      if (b.dmg >= 1) collapse(b, u, P);
    }
    for (const p of deb) {
      if (p.rest) { p.x = p.ox + gu(p.ox, 0, P); continue; }
      p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.va * dt;
      if (p.y >= GY - p.s / 2) { p.y = GY - p.s / 2; p.rest = true; p.ox = p.x - gu(p.x, 0, P); }
    }
    if ((hudT += dt) > 0.12) { hudT = 0; hud(P, maxDrift); }
  }

  /* ---------- Dibujo ---------- */
  function drawWave(P) {
    const cols = Math.max(6, Math.floor(W / 36)), rows = Math.floor(H / 5), cw = W / cols, A = S.amp * ampF();
    // franjas de fase (frente de onda)
    for (let y = 0; y < H; y += 4) {
      const ph = P.k / PX * y - P.w * t;
      ctx.fillStyle = `rgba(255,136,17,${0.02 + 0.1 * (1 + Math.cos(ph)) / 2})`;
      ctx.fillRect(0, y, W, 4);
    }
    for (let c = 0; c < cols; c++) {           // cada columna es una línea de partículas; se desplaza solo en x
      const x0 = (c + .5) * cw;
      ctx.beginPath(); ctx.strokeStyle = 'rgba(157,217,210,.55)'; ctx.lineWidth = 1.4;
      for (let r = 0; r <= rows; r++) {
        const y = r * 5, x = x0 + A * Math.sin(P.k / PX * y - P.w * t);
        r ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
      for (let y = 10; y < H; y += 30) {
        const s = Math.sin(P.k / PX * y - P.w * t);
        ctx.fillStyle = s > 0 ? C.ora : C.jas;
        ctx.beginPath(); ctx.arc(x0 + A * s, y, 3.6, 0, 7); ctx.fill();
      }
    }
    // guías de dirección
    ctx.fillStyle = C.floral; ctx.font = '600 12px Segoe UI'; ctx.strokeStyle = C.floral; ctx.lineWidth = 2;
    const arrow = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      const a = Math.atan2(y2 - y1, x2 - x1); ctx.beginPath(); ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - 8 * Math.cos(a - .5), y2 - 8 * Math.sin(a - .5)); ctx.lineTo(x2 - 8 * Math.cos(a + .5), y2 - 8 * Math.sin(a + .5)); ctx.fill(); };
    ctx.fillStyle = 'rgba(57,47,90,.8)'; ctx.fillRect(W - 176, 8, 168, 62);
    ctx.fillStyle = C.floral; ctx.strokeStyle = C.floral;
    arrow(W - 166, 26, W - 166, 56); ctx.fillText('Propagación', W - 150, 44);
    arrow(W - 96, 22, W - 66, 22); arrow(W - 66, 22, W - 96, 22); ctx.fillText('Partículas', W - 92, 16 + 26);
  }

  function drawGround(P) {
    const rows = 8, ch = (H - GY) / rows, cols = Math.ceil(W / 22), cw = W / cols;
    for (let r = 0; r < rows; r++) {
      const dep = (r + .5) * ch;
      for (let c = 0; c < cols; c++) {
        const x = c * cw, u = gu(x + cw / 2, dep, P);
        ctx.fillStyle = `rgba(157,217,210,${0.85 - r * 0.08})`;
        ctx.fillRect(x + u, GY + r * ch, cw + .5, ch - 1);
      }
    }
    // frente de onda: intensidad naranja sobre la capa superficial
    for (let x = 0; x < W; x += 4) {
      const ph = P.k / PX * Math.sin(PHI) * x - P.w * t;
      ctx.fillStyle = `rgba(255,136,17,${0.32 * Math.max(0, Math.cos(ph))})`;
      ctx.fillRect(x, GY, 4, ch);
    }
    const g = ctx.createLinearGradient(0, GY - 2, 0, GY + 6);
    g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, GY - 2, W, 8);
  }

  function drawBuilding(b, P) {
    if (b.dead) return;
    const u = gu(b.x + b.w / 2, 0, P), pad = S.iso ? 9 : 0, y0 = GY - pad, h = b.h;
    const bo = S.iso ? u + b.r : u;                           // desplazamiento de la base de la estructura
    const to = S.iso ? bo + b.r * 0.08 : u + b.r;             // desplazamiento de la cima (corte)
    const px = (s, f = 0) => b.x + bo + (to - bo) * s + f * b.w, py = s => y0 - s * h;
    if (S.iso) {                                              // aisladores de goma entre suelo y estructura
      ctx.fillStyle = C.floral; ctx.fillRect(b.x - 4 + u, GY - 3, b.w + 8, 3);
      ctx.fillStyle = '#5b4a9a'; ctx.beginPath();
      ctx.moveTo(b.x + u, GY - 3); ctx.lineTo(b.x + b.w + u, GY - 3);
      ctx.lineTo(b.x + b.w + bo, y0); ctx.lineTo(b.x + bo, y0); ctx.fill();
    }
    const g = ctx.createLinearGradient(px(0), 0, px(1, 1), 0);
    g.addColorStop(0, b.col); g.addColorStop(1, '#c95f00');
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.moveTo(px(0), py(0)); ctx.lineTo(px(0, 1), py(0)); ctx.lineTo(px(1, 1), py(1)); ctx.lineTo(px(1), py(1)); ctx.closePath();
    ctx.fillStyle = g; ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = `rgba(255,30,60,${b.dmg * .55})`; ctx.fill();
    ctx.strokeStyle = C.floral; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(57,47,90,.7)';                      // ventanas que siguen la deformación
    for (let s = .14; s < .9; s += .2) for (const f of [.22, .6]) ctx.fillRect(px(s, f), py(s) - 7, 6, 8);
    ctx.strokeStyle = '#2a1f45'; ctx.lineWidth = 1.5;         // grietas según el daño
    for (let i = 0; i < Math.floor(b.dmg * 6); i++) {
      const s = ((b.seed * (i + 3)) % 1) * .8 + .1, f = ((b.seed * (i + 7)) % 1) * .6 + .2;
      ctx.beginPath(); ctx.moveTo(px(s, f), py(s)); ctx.lineTo(px(s + .06, f + .18), py(s + .05)); ctx.lineTo(px(s + .1, f), py(s + .12)); ctx.stroke();
    }
  }

  function drawDebris() {
    for (const p of deb) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
      ctx.fillStyle = p.c; ctx.strokeStyle = 'rgba(255,248,240,.7)'; ctx.lineWidth = 1;
      ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s); ctx.strokeRect(-p.s / 2, -p.s / 2, p.s, p.s); ctx.restore();
    }
  }

  function draw() {
    const P = wave();
    ctx.clearRect(0, 0, W, H);
    if (S.mode === 'wave') drawWave(P);
    else { drawGround(P); bl.forEach(b => drawBuilding(b, P)); drawDebris(); }
  }

  function hud(P, drift) {
    $('d-lambda').textContent = P.lam.toFixed(2) + ' m';
    $('d-period').textContent = P.T.toFixed(2) + ' s';
    $('d-k').textContent = P.k.toFixed(2) + ' rad/m';
    $('d-w').textContent = P.w.toFixed(2) + ' rad/s';
    $('d-drift').textContent = (drift * 100).toFixed(0) + ' %';
    $('d-alive').textContent = bl.filter(b => !b.dead).length + ' / ' + bl.length;
  }

  /* ---------- Interfaz ---------- */
  function setHint() {
    $('hint').textContent = S.mode === 'wave'
      ? 'Vista superior: la onda avanza hacia abajo y las partículas se mueven solo de lado a lado.'
      : (S.build ? 'Modo construcción: haz clic en el suelo para agregar un edificio.' : 'Vista frontal: el frente llega en diagonal desde el fondo.');
  }
  function setMode(m) {
    S.mode = m;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
    cv.classList.toggle('building', S.build && m === 'carpet'); setHint();
  }
  const units = { amp: v => v + ' px', freq: v => v.toFixed(1) + ' Hz', vel: v => v.toFixed(1) + ' m/s', blocks: v => v };
  ['amp', 'freq', 'vel', 'blocks'].forEach(id => $(id).addEventListener('input', e => {
    S[id] = parseFloat(e.target.value); $('val-' + id).textContent = units[id](S[id]);
    if (id === 'blocks') layout();
  }));
  document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));

  $('btn-quake').addEventListener('click', () => { quakeT = QUAKE_T; $('quake-alert').classList.add('active'); });
  $('btn-reset').addEventListener('click', () => { quakeT = 0; t = 0; $('quake-alert').classList.remove('active'); layout(); });
  $('btn-isolator').addEventListener('click', e => { S.iso = !S.iso; e.currentTarget.setAttribute('aria-pressed', S.iso); });
  $('btn-build').addEventListener('click', e => {
    S.build = !S.build; e.currentTarget.setAttribute('aria-pressed', S.build);
    if (S.build) setMode('carpet'); else setMode(S.mode);
  });
  cv.addEventListener('click', e => {
    if (!S.build || S.mode !== 'carpet' || bl.length >= 24) return;
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (y < GY - 30) return;                                  // solo se construye sobre el suelo
    bl.push(mkBuilding(Math.max(4, Math.min(W - 32, x - 14))));
  });

  /* ---------- Tilt 3D ---------- */
  document.querySelectorAll('.tilt-container').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      el.classList.add('moving');
      el.style.setProperty('--ry', ((px - .5) * 16) + 'deg'); el.style.setProperty('--rx', ((.5 - py) * 16) + 'deg');
      el.style.setProperty('--mx', px * 100 + '%'); el.style.setProperty('--my', py * 100 + '%');
    });
    el.addEventListener('pointerleave', () => {
      el.classList.remove('moving'); el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg');
    });
  });

  /* ---------- Bucle ---------- */
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), r = stage.getBoundingClientRect();
    W = r.width; H = r.height; GY = H * 0.58;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layout();
  }
  new ResizeObserver(resize).observe(stage);
  resize(); setHint();

  let last = performance.now();
  (function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    step(dt); draw(); requestAnimationFrame(loop);
  })(last);
})();

/* ============ EXTRAS: cursor, scroll, sismógrafo, comparador, línea de tiempo, quiz ============ */
(() => {
  const $ = id => document.getElementById(id);
  const fine = matchMedia('(pointer:fine)').matches;

  /* ===== Cursor átomo brillante ===== */
  const atom = $('atom'); let hideT, lastSpark = 0;
  const move = (x, y) => { atom.style.transform = `translate(${x}px,${y}px)`; atom.classList.add('on'); };
  const spark = (x, y) => {
    const s = document.createElement('i'); s.className = 'spark';
    s.style.left = x + 'px'; s.style.top = y + 'px';
    s.style.setProperty('--dx', (Math.random() - .5) * 60 + 'px'); s.style.setProperty('--dy', (Math.random() - .5) * 60 + 'px');
    document.body.appendChild(s); s.addEventListener('animationend', () => s.remove());
  };
  const ring = (x, y) => {
    const r = document.createElement('i'); r.className = 'ring'; r.style.left = x + 'px'; r.style.top = y + 'px';
    document.body.appendChild(r); r.addEventListener('animationend', () => r.remove());
  };
  addEventListener('pointermove', e => {
    move(e.clientX, e.clientY);
    if (e.timeStamp - lastSpark > 45) { lastSpark = e.timeStamp; spark(e.clientX, e.clientY); }
    if (!fine) { clearTimeout(hideT); hideT = setTimeout(() => atom.classList.remove('on'), 1600); }
  });
  addEventListener('pointerdown', e => {
    move(e.clientX, e.clientY); atom.classList.add('down'); ring(e.clientX, e.clientY);
    for (let i = 0; i < 8; i++) spark(e.clientX, e.clientY);
    if (!fine) { clearTimeout(hideT); hideT = setTimeout(() => atom.classList.remove('on'), 1600); }
  });
  addEventListener('pointerup', () => atom.classList.remove('down'));
  document.addEventListener('mouseleave', () => atom.classList.remove('on'));

  /* ===== Progreso, luz en paneles, reveal, contadores ===== */
  addEventListener('scroll', () => {
    $('progress').style.width = scrollY / (document.documentElement.scrollHeight - innerHeight) * 100 + '%';
  }, { passive: true });
  document.addEventListener('pointermove', e => {
    const g = e.target.closest && e.target.closest('.glass'); if (!g) return;
    const r = g.getBoundingClientRect();
    g.style.setProperty('--sx', e.clientX - r.left + 'px'); g.style.setProperty('--sy', e.clientY - r.top + 'px');
  });
  const count = el => {
    const end = +el.dataset.count, t0 = performance.now();
    (function f(n) { const p = Math.min(1, (n - t0) / 1400); el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(f); })(t0);
  };
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; e.target.classList.add('in');
    e.target.querySelectorAll('[data-count]').forEach(count); io.unobserve(e.target);
  }), { threshold: .15 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
  document.querySelectorAll('.flip').forEach(f => f.addEventListener('click', () => f.classList.toggle('on')));

  /* ===== Sismógrafo en vivo (componente horizontal del suelo) ===== */
  const sc = $('seismo'), sx = sc.getContext('2d'); let sT = 0, buf = [];
  function seismo(dt) {
    const w = sc.clientWidth, h = sc.clientHeight;
    if (sc.width !== w) { sc.width = w; sc.height = h; buf = []; }
    sT += dt;
    const A = +$('amp').value, f = +$('freq').value, q = $('quake-alert').classList.contains('active') ? 1 : .2;
    buf.push(A * q * Math.sin(2 * Math.PI * f * sT) + (Math.random() - .5) * 3 * q);
    if (buf.length > w / 2) buf.shift();
    sx.clearRect(0, 0, w, h);
    sx.strokeStyle = 'rgba(157,217,210,.25)'; sx.beginPath(); sx.moveTo(0, h / 2); sx.lineTo(w, h / 2); sx.stroke();
    sx.strokeStyle = '#FF8811'; sx.lineWidth = 2; sx.shadowColor = '#FF8811'; sx.shadowBlur = 8; sx.beginPath();
    buf.forEach((v, i) => { const y = h / 2 - v / 100 * (h / 2 - 6); i ? sx.lineTo(i * 2, y) : sx.moveTo(0, y); });
    sx.stroke(); sx.shadowBlur = 0;
  }

  /* ===== Comparador de ondas con mini animación ===== */
  const waves = [
    { n: 'Ondas P', t: 'Compresionales: las partículas vibran en la misma dirección en que avanza la onda. Son las más rápidas (unos 5 a 8 km/s en la corteza) y llegan primero. Viajan por sólidos y líquidos.', m: 'p' },
    { n: 'Ondas S', t: 'De cizalla: las partículas se mueven perpendicular a la propagación. Son más lentas (unos 3 a 4,5 km/s) y no atraviesan líquidos.', m: 's' },
    { n: 'Rayleigh', t: 'Superficiales: las partículas describen elipses, combinando movimiento vertical y horizontal, parecido a las olas del mar.', m: 'r' },
    { n: 'Love', t: 'Superficiales: movimiento solo horizontal y perpendicular a la propagación (vista superior). Necesitan una capa blanda sobre una más rígida y suelen ser más rápidas que las Rayleigh. Su corte lateral es muy dañino para las estructuras.', m: 'l' }
  ];
  let wSel = 3;
  const tabs = $('wtabs'), wc = $('wmini'), wx = wc.getContext('2d');
  waves.forEach((w, i) => {
    const b = document.createElement('button'); b.className = 'wtab' + (i === wSel ? ' on' : ''); b.textContent = w.n;
    b.onclick = () => { wSel = i; tabs.querySelectorAll('.wtab').forEach((x, j) => x.classList.toggle('on', j === i)); showW(); };
    tabs.appendChild(b);
  });
  const showW = () => { $('wcard').innerHTML = `<h4>${waves[wSel].n}</h4><p>${waves[wSel].t}</p>`; };
  showW();
  let wT = 0;
  function miniWave(dt) {
    const w = wc.clientWidth, h = wc.clientHeight; if (wc.width !== w) { wc.width = w; wc.height = h; }
    wT += dt; wx.clearRect(0, 0, w, h);
    const m = waves[wSel].m, cols = 16, rows = 6, a = 9;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x0 = 18 + c * (w - 36) / (cols - 1), y0 = 26 + r * (h - 52) / (rows - 1), ph = c * .7 - wT * 4, d = Math.exp(-r * .35);
      let dx = 0, dy = 0;
      if (m === 'p') dx = a * Math.sin(ph);
      else if (m === 's' || m === 'l') dy = a * Math.sin(ph);
      else { dx = -a * Math.cos(ph) * d; dy = a * Math.sin(ph) * d; }
      wx.fillStyle = m === 'l' ? '#F4D06F' : '#9DD9D2'; wx.shadowColor = '#FF8811'; wx.shadowBlur = 6;
      wx.beginPath(); wx.arc(x0 + dx, y0 + dy, 3, 0, 7); wx.fill();
    }
    wx.shadowBlur = 0; wx.fillStyle = '#FFF8F0'; wx.font = '12px Exo 2';
    wx.fillText(m === 'l' ? 'Vista superior: avanza a la derecha, se mueve de lado' : 'Vista lateral: la onda avanza a la derecha', 10, h - 6);
  }

  /* ===== Línea de tiempo ===== */
  const tl = [
    ['1885', 'Lord Rayleigh', 'Predice matemáticamente las ondas superficiales que hoy llevan su nombre.'],
    ['1897', 'Oldham y las ondas', 'Richard Oldham identifica en los sismogramas las ondas P y S, y se empieza a distinguir el resto del registro.'],
    ['1911', 'Aparecen las ondas Love', 'A.E.H. Love explica que existen ondas superficiales con movimiento puramente horizontal en su trabajo sobre geodinámica.'],
    ['1935', 'Escala de Richter', 'Charles Richter propone una escala para comparar la magnitud de los terremotos.'],
    ['1969', 'Primer edificio aislado', 'En Skopje se construye la escuela Pestalozzi con apoyos de goma, una de las primeras estructuras con aislamiento de base.'],
    ['1975', 'Aislador plomo-caucho', 'William Robinson desarrolla en Nueva Zelanda el apoyo de plomo y caucho, muy usado hoy.'],
    ['1999', 'Sismo del Eje Cafetero', 'Un terremoto de magnitud cercana a 6 golpea Armenia, Colombia, y cambia la forma de entender la construcción sismorresistente en el país.']
  ];
  const tt = $('tl-track'), tc = $('tl-card');
  tl.forEach((e, i) => {
    const b = document.createElement('button'); b.className = 'tl-node' + (i === 2 ? ' on' : '');
    b.innerHTML = `<span class="tl-year">${e[0]}</span>${e[1]}`;
    b.onclick = () => { tt.querySelectorAll('.tl-node').forEach((x, j) => x.classList.toggle('on', j === i)); showT(i); };
    tt.appendChild(b);
  });
  const showT = i => { tc.style.animation = 'none'; tc.offsetWidth; tc.style.animation = ''; tc.innerHTML = `<h4>${tl[i][0]}: ${tl[i][1]}</h4><p>${tl[i][2]}</p>`; };
  showT(2);

  /* ===== Quiz ===== */
  const qs = [
    ['¿Cómo se mueven las partículas en una onda Love?', ['Solo en horizontal', 'En vertical', 'En elipses'], 0],
    ['¿Qué fórmula relaciona velocidad, longitud de onda y frecuencia?', ['v = λ·f', 'v = λ/f²', 'v = f − λ'], 0],
    ['¿Qué hacen los aisladores de base?', ['Hacen el edificio más pesado', 'Separan el edificio del movimiento del suelo', 'Aumentan la frecuencia natural'], 1],
    ['¿Qué pasa si la frecuencia de la onda coincide con la del edificio?', ['Nada', 'Resonancia y más daño', 'La onda desaparece'], 1]
  ];
  let qi = 0, sc2 = 0; const qz = $('quiz');
  function quiz() {
    if (qi >= qs.length) { qz.innerHTML = `<div class="quiz-q">Terminaste: ${sc2} de ${qs.length} correctas.</div><button class="quiz-opt" id="qr">Intentar de nuevo</button>`; $('qr').onclick = () => { qi = 0; sc2 = 0; quiz(); }; return; }
    const [q, o, c] = qs[qi];
    qz.innerHTML = `<div class="quiz-q">${qi + 1}. ${q}</div><div class="quiz-opts"></div><div class="quiz-score">Puntaje: ${sc2}</div>`;
    const box = qz.querySelector('.quiz-opts');
    o.forEach((t, i) => {
      const b = document.createElement('button'); b.className = 'quiz-opt'; b.textContent = t;
      b.onclick = () => {
        box.querySelectorAll('button').forEach(x => x.disabled = true);
        b.classList.add(i === c ? 'ok' : 'bad'); if (i === c) sc2++; else box.children[c].classList.add('ok');
        setTimeout(() => { qi++; quiz(); }, 1100);
      };
      box.appendChild(b);
    });
  }
  quiz();

  /* ===== Bucle de las animaciones nuevas ===== */
  let last = performance.now();
  (function loop(n) { const dt = Math.min(.05, (n - last) / 1000); last = n; seismo(dt); miniWave(dt); requestAnimationFrame(loop); })(last);
})();
