(function (root) {
  const TAU = Math.PI * 2;
  const FONT = 'Fredoka, Rubik, system-ui, sans-serif';
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // Seeded rng so the skyline and stars stay put across resizes.
  function seeded(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  const M = 12; // background margin so screen shake never exposes an edge

  function create(canvas) {
    const ctx = canvas.getContext('2d');
    let W = 1, H = 1, groundY = 1, R = 24, dpr = 1;
    let bg = null, cloudSprites = [], clouds = [], twinkles = [];
    let t = 0, shakeAmt = 0;
    const sparks = [], smoke = [], fire = [], rings = [], flashes = [], confettiBits = [];
    const cannon = { angle: -Math.PI / 2, recoil: 0, flash: 0 };

    function resize(nW, nH, nGroundY, nR, nDpr) {
      W = nW; H = nH; groundY = nGroundY; R = nR; dpr = nDpr;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      bg = renderBackground();
      cloudSprites = [0, 1, 2].map((i) => renderCloud(seeded(100 + i)));
      if (!clouds.length) {
        clouds = Array.from({ length: 6 }, (_, i) => ({
          x: rand(0, 1), y: rand(0.06, 0.42), s: rand(0.6, 1.25), v: rand(0.006, 0.016), sprite: i % 3,
        }));
      }
    }

    // ---------- Prerendered background ----------

    function renderBackground() {
      const c = document.createElement('canvas');
      c.width = Math.round((W + 2 * M) * dpr); c.height = Math.round((H + 2 * M) * dpr);
      const g = c.getContext('2d');
      g.scale(dpr, dpr);
      g.translate(M, M);
      const rng = seeded(7);
      const r = (a, b) => a + rng() * (b - a);

      // Sky
      const sky = g.createLinearGradient(0, 0, 0, groundY);
      sky.addColorStop(0, '#0a0f2e');
      sky.addColorStop(0.35, '#1f1b52');
      sky.addColorStop(0.62, '#4b2a70');
      sky.addColorStop(0.84, '#b3497d');
      sky.addColorStop(1, '#ff9a5c');
      g.fillStyle = sky; g.fillRect(-M, -M, W + 2 * M, H + 2 * M);
      const horizon = g.createRadialGradient(W / 2, groundY, 0, W / 2, groundY, Math.max(W, groundY) * 0.7);
      horizon.addColorStop(0, 'rgba(255,190,120,.45)');
      horizon.addColorStop(1, 'rgba(255,190,120,0)');
      g.fillStyle = horizon; g.fillRect(-M, -M, W + 2 * M, groundY + M);

      // Stars, denser near the top
      const n = Math.round((W * groundY) / 2600);
      g.fillStyle = '#fff';
      for (let i = 0; i < n; i++) {
        const y = groundY * 0.62 * rng() ** 1.6;
        g.globalAlpha = r(0.25, 0.95) * (1 - y / (groundY * 0.7));
        g.beginPath(); g.arc(r(0, W), y, r(0.4, 1.5), 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
      twinkles = Array.from({ length: Math.round(W / 70) }, () => ({
        x: r(0, W), y: r(0, groundY * 0.4), s: r(2.5, 4.5), ph: r(0, TAU), f: r(1.2, 2.6),
      }));

      // Moon with glow
      const mr = clamp(Math.min(W, H) * 0.055, 20, 56);
      const mx = W * 0.8, my = groundY * 0.2;
      const glow = g.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 4.5);
      glow.addColorStop(0, 'rgba(255,236,190,.45)');
      glow.addColorStop(0.4, 'rgba(255,220,180,.12)');
      glow.addColorStop(1, 'rgba(255,220,180,0)');
      g.fillStyle = glow; g.fillRect(-M, -M, W + 2 * M, groundY + M);
      const moon = g.createRadialGradient(mx - mr * 0.35, my - mr * 0.35, mr * 0.1, mx, my, mr);
      moon.addColorStop(0, '#fffbea'); moon.addColorStop(1, '#f5deaa');
      g.fillStyle = moon; g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill();
      g.fillStyle = 'rgba(205,175,125,.35)';
      [[-0.32, -0.18, 0.24], [0.34, 0.12, 0.17], [-0.05, 0.42, 0.13], [0.2, -0.45, 0.09]].forEach(([dx, dy, s]) => {
        g.beginPath(); g.arc(mx + dx * mr, my + dy * mr, s * mr, 0, TAU); g.fill();
      });

      // Two mountain layers
      const ridge = (base, amp, f) => {
        const p = [r(0, TAU), r(0, TAU), r(0, TAU)];
        return (x) => base - amp * (0.55 * Math.sin(x * f + p[0]) + 0.3 * Math.sin(x * f * 2.3 + p[1]) + 0.15 * Math.sin(x * f * 5.1 + p[2]) + 0.4);
      };
      const layer = (fy, top, bottom, rim) => {
        const grad = g.createLinearGradient(0, groundY * 0.45, 0, groundY);
        grad.addColorStop(0, top); grad.addColorStop(1, bottom);
        g.fillStyle = grad;
        g.beginPath(); g.moveTo(-M, groundY);
        for (let x = -M; x <= W + 2 * M; x += 12) g.lineTo(x, fy(x));
        g.lineTo(W + 2 * M, groundY); g.closePath(); g.fill();
        g.strokeStyle = rim; g.lineWidth = 2;
        g.beginPath();
        for (let x = -M; x <= W + 2 * M; x += 12) (x > -M ? g.lineTo : g.moveTo).call(g, x, fy(x));
        g.stroke();
      };
      layer(ridge(groundY * 0.68, groundY * 0.1, 0.006), '#7a4f98', '#4a3170', 'rgba(255,180,160,.35)');
      layer(ridge(groundY * 0.76, groundY * 0.08, 0.011), '#4a2f6e', '#2e1f52', 'rgba(255,160,150,.25)');

      // Skyline: a hazy back row, then a front row with lit windows
      const row = (hMin, hMax, color, windows) => {
        let x = r(-20, 0) - M;
        while (x < W + M) {
          const bw = r(28, 64), bh = r(hMin, hMax), top = groundY - bh;
          g.fillStyle = color;
          g.fillRect(x, top, bw, bh);
          const roof = rng();
          if (roof < 0.25) g.fillRect(x + bw * 0.2, top - bh * 0.12, bw * 0.6, bh * 0.12 + 1);
          else if (roof < 0.4) {
            g.fillRect(x + bw / 2 - 1, top - 16, 2, 16);
            if (windows) { g.fillStyle = '#ff5a6e'; g.beginPath(); g.arc(x + bw / 2, top - 17, 2, 0, TAU); g.fill(); }
          }
          if (windows) {
            g.shadowBlur = 6;
            for (let wy = top + 8; wy < groundY - 12; wy += 13) {
              for (let wx = x + 6; wx < x + bw - 9; wx += 10) {
                if (rng() > 0.32) continue;
                const cool = rng() < 0.2;
                g.fillStyle = g.shadowColor = cool ? 'rgba(150,215,255,.85)' : 'rgba(255,214,130,.92)';
                g.fillRect(wx, wy, 5, 7);
              }
            }
            g.shadowBlur = 0;
          }
          x += bw + r(1, 8);
        }
      };
      row(groundY * 0.12, groundY * 0.26, '#2c2254', false);
      row(groundY * 0.06, groundY * 0.18, '#17112f', true);

      // Ground band with grass edge
      const top = groundY - 18;
      const gr = g.createLinearGradient(0, top, 0, H);
      gr.addColorStop(0, '#4d8c4b'); gr.addColorStop(0.25, '#2d6036'); gr.addColorStop(1, '#10261a');
      g.fillStyle = gr; g.fillRect(-M, top, W + 2 * M, H - top + M);
      g.fillStyle = '#5ea75a';
      for (let x = -M; x < W + M; x += r(5, 11)) {
        const h = r(3, 8);
        g.beginPath(); g.moveTo(x, top + 1); g.lineTo(x + 3, top - h); g.lineTo(x + 6, top + 1); g.fill();
      }
      g.fillStyle = 'rgba(200,255,180,.3)'; g.fillRect(-M, top, W + 2 * M, 2);
      return c;
    }

    function renderCloud(rng) {
      const w = 220, h = 90, c = document.createElement('canvas');
      c.width = w * dpr; c.height = h * dpr;
      const g = c.getContext('2d');
      g.scale(dpr, dpr);
      const grad = g.createLinearGradient(0, 10, 0, h);
      grad.addColorStop(0, '#f4ecff'); grad.addColorStop(0.6, '#e6c8f0'); grad.addColorStop(1, '#ffab9c');
      g.filter = 'blur(1.5px)';
      g.fillStyle = grad;
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const cx = 40 + i * 28 + rng() * 10, cr = 18 + rng() * 22 * Math.sin(((i + 0.5) / 6) * Math.PI);
        g.moveTo(cx + cr, h - 22 - cr * 0.6);
        g.arc(cx, h - 22 - cr * 0.6, cr, 0, TAU);
      }
      g.fill();
      g.fillRect(30, h - 36, 160, 14);
      return c;
    }

    // ---------- Effects ----------

    function explode(x, y, hue) {
      flashes.push({ x, y, life: 0.3 });
      rings.push({ x, y, r: R * 0.3, life: 0.45 });
      for (let i = 0; i < 6; i++) {
        const a = rand(0, TAU), d = rand(0, 0.45 * R);
        fire.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, r: rand(0.35, 0.6) * R, life: rand(0.35, 0.55), max: 0.55 });
      }
      for (let i = 0; i < 30; i++) {
        const a = rand(0, TAU), s = rand(80, 420);
        sparks.push({
          x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: rand(0.4, 0.9), max: 0.9, size: rand(1.8, 4.5),
          col: Math.random() < 0.5 ? `hsl(${hue},95%,65%)` : ['#fff3b0', '#ffc24a', '#ff7a3d'][i % 3],
        });
      }
      for (let i = 0; i < 6; i++) {
        const a = rand(0, TAU), s = rand(80, 220);
        sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, life: 1.1, max: 1.1, size: rand(3, 5), col: `hsl(${hue},55%,35%)`, chunk: true, rot: rand(0, TAU) });
      }
      for (let i = 0; i < 7; i++) {
        smoke.push({ x: x + rand(-10, 10), y: y + rand(-10, 10), vx: rand(-25, 25), vy: rand(-45, -15), r: rand(6, 12), life: rand(0.7, 1.1), max: 1.1 });
      }
    }

    function confetti() {
      const colors = ['#ff5470', '#ffc83d', '#3ee08f', '#4fc3ff', '#b57bff', '#ff8c42', '#ffffff'];
      for (let i = 0; i < 150; i++) {
        confettiBits.push({
          x: rand(0, W), y: rand(-H * 0.3, -10), vx: rand(-40, 40), vy: rand(90, 200),
          w: rand(6, 11), h: rand(3, 6), rot: rand(0, TAU), spin: rand(-6, 6), flip: rand(0, TAU),
          col: colors[i % colors.length], life: rand(2.6, 3.6),
        });
      }
    }

    function shake(px) { shakeAmt = Math.max(shakeAmt, px); }

    function muzzle(angle) {
      cannon.angle = clampAim(angle);
      cannon.recoil = 1;
      cannon.flash = 1;
    }

    const clampAim = (a) => clamp(a, -Math.PI + 0.2, -0.2);

    // ---------- Per-frame ----------

    function aimTarget(game) {
      const { x, y } = game.cannon;
      const m = game.missiles.find((mm) => !mm.done);
      if (m) return Math.atan2(m.ty - y, m.tx - x);
      const lastId = game.plan.ids[game.plan.length - 1];
      const d = lastId !== undefined && game.drones.find((dd) => dd.id === lastId);
      if (d) return Math.atan2(d.y + 0.5 * R - y, d.x - x);
      return -Math.PI / 2;
    }

    function step(game, dt) {
      t += dt;
      const want = clampAim(aimTarget(game));
      cannon.angle += (want - cannon.angle) * Math.min(1, dt * 10);
      cannon.recoil = Math.max(0, cannon.recoil - dt * 4);
      cannon.flash = Math.max(0, cannon.flash - dt * 9);
      shakeAmt = shakeAmt > 0.3 ? shakeAmt * Math.exp(-dt * 9) : 0;
      for (const c of clouds) {
        c.x += c.v * dt;
        if (c.x > 1.15) { c.x = -0.25; c.y = rand(0.06, 0.42); }
      }
      for (const p of sparks) {
        p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
        p.vx *= 1 - dt * 1.6; p.vy = p.vy * (1 - dt * 1.6) + 480 * dt;
        if (p.chunk) p.rot += dt * 10;
      }
      for (const s of smoke) { s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.r += dt * 22; }
      for (const r of rings) { r.life -= dt; r.r += dt * R * 7; }
      for (const f of flashes) f.life -= dt;
      for (const f of fire) { f.life -= dt; f.r += dt * R * 1.5; f.y -= dt * 30; }
      for (const c of confettiBits) {
        c.life -= dt; c.x += (c.vx + Math.sin(t * 2 + c.flip) * 40) * dt; c.y += c.vy * dt;
        c.rot += c.spin * dt; c.flip += dt * 7;
      }
      prune(sparks); prune(smoke); prune(fire); prune(rings); prune(flashes); prune(confettiBits);
    }

    function prune(arr) {
      for (let i = arr.length - 1; i >= 0; i--) if (arr[i].life <= 0) arr.splice(i, 1);
    }

    function draw(game, dt) {
      step(game, Math.min(dt, 0.05));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sx = shakeAmt ? rand(-shakeAmt, shakeAmt) : 0, sy = shakeAmt ? rand(-shakeAmt, shakeAmt) : 0;
      ctx.translate(sx, sy);
      if (bg) ctx.drawImage(bg, -M, -M, W + 2 * M, H + 2 * M); // 1:1, no stretch
      drawTwinkles();
      drawClouds();
      for (const d of game.drones) drawDrone(game, d);
      for (const m of game.missiles) if (m.fired && !m.done) drawMissile(m);
      drawEffects();
      drawCannon(game.cannon);
      drawConfetti();
    }

    function drawTwinkles() {
      ctx.fillStyle = '#fff';
      for (const s of twinkles) {
        const a = 0.5 + 0.5 * Math.sin(t * s.f + s.ph);
        ctx.globalAlpha = a * 0.9;
        const k = s.s * (0.6 + 0.4 * a);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - k); ctx.quadraticCurveTo(s.x, s.y, s.x + k, s.y);
        ctx.quadraticCurveTo(s.x, s.y, s.x, s.y + k); ctx.quadraticCurveTo(s.x, s.y, s.x - k, s.y);
        ctx.quadraticCurveTo(s.x, s.y, s.x, s.y - k);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function drawClouds() {
      ctx.globalAlpha = 0.42;
      for (const c of clouds) {
        const img = cloudSprites[c.sprite];
        if (!img) continue;
        const w = 220 * c.s * (R / 32), h = 90 * c.s * (R / 32);
        ctx.drawImage(img, c.x * W - w / 2, c.y * groundY - h / 2, w, h);
      }
      ctx.globalAlpha = 1;
    }

    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    function drawDrone(game, d) {
      const r = R, x = d.x, y = d.y, hue = d.hue;
      const planIndex = d.marked ? game.plan.indexOf(d.id) : -1;
      if (planIndex >= 0) drawTargetRing(x, y + 0.6 * r, r);

      // Hanging card on two tethers, swaying like a pendulum
      const px = x, py = y + 0.26 * r, cs = 1.18 * r, drop = 0.95 * r;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.sin(t * 1.9 + d.phase) * 0.09);
      ctx.strokeStyle = 'rgba(225,232,255,.75)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-0.18 * r, 0); ctx.lineTo(-cs * 0.32, drop - cs / 2 + 2);
      ctx.moveTo(0.18 * r, 0); ctx.lineTo(cs * 0.32, drop - cs / 2 + 2);
      ctx.stroke();
      ctx.translate(0, drop);
      ctx.shadowColor = 'rgba(10,6,30,.45)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
      const cg = ctx.createLinearGradient(0, -cs / 2, 0, cs / 2);
      cg.addColorStop(0, '#ffffff'); cg.addColorStop(1, `hsl(${hue},90%,90%)`);
      ctx.fillStyle = cg;
      roundRect(-cs / 2, -cs / 2, cs, cs, cs * 0.24); ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = Math.max(2.5, r * 0.09); ctx.strokeStyle = `hsl(${hue},75%,52%)`; ctx.stroke();
      ctx.fillStyle = `hsl(${hue},70%,26%)`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.round(cs * 0.7)}px ${FONT}`;
      ctx.fillText(root.Lexicon.display([d.letter], game.lang)[0], 0, cs * 0.05);
      if (planIndex >= 0) drawBadge(cs / 2 - 0.04 * r, -cs / 2 + 0.04 * r, r, planIndex + 1);
      ctx.restore();

      // Arm and rotors
      const ay = y - 0.12 * r, span = 0.95 * r;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#3b4468'; ctx.lineWidth = r * 0.14;
      ctx.beginPath(); ctx.moveTo(x - span, ay); ctx.lineTo(x + span, ay); ctx.stroke();
      for (const side of [-1, 1]) {
        const rx = x + side * span, ry = y - 0.34 * r;
        ctx.strokeStyle = '#2b3252'; ctx.lineWidth = r * 0.08;
        ctx.beginPath(); ctx.moveTo(rx, ay); ctx.lineTo(rx, ry); ctx.stroke();
        ctx.fillStyle = 'rgba(210,225,255,.22)';
        ctx.beginPath(); ctx.ellipse(rx, ry, 0.56 * r, 0.1 * r, 0, 0, TAU); ctx.fill();
        const k = Math.cos(t * 38 + side * 1.3 + d.phase);
        ctx.strokeStyle = 'rgba(235,242,255,.9)'; ctx.lineWidth = Math.max(2, r * 0.07);
        ctx.beginPath(); ctx.moveTo(rx - 0.56 * r * k, ry); ctx.lineTo(rx + 0.56 * r * k, ry); ctx.stroke();
        ctx.fillStyle = '#e8ecff';
        ctx.beginPath(); ctx.arc(rx, ry, r * 0.07, 0, TAU); ctx.fill();
      }

      // Body
      const bw = 0.64 * r, bh = 0.36 * r, by = y - 0.02 * r;
      const body = ctx.createLinearGradient(0, by - bh, 0, by + bh);
      body.addColorStop(0, `hsl(${hue},80%,72%)`); body.addColorStop(1, `hsl(${hue},65%,38%)`);
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.ellipse(x, by, bw, bh, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = `hsl(${hue},60%,28%)`; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.4)';
      ctx.beginPath(); ctx.ellipse(x - 0.18 * r, by - 0.17 * r, 0.26 * r, 0.08 * r, -0.15, 0, TAU); ctx.fill();
      // Camera eye
      ctx.fillStyle = '#1a1f3d';
      ctx.beginPath(); ctx.arc(x + 0.12 * r, by + 0.06 * r, 0.15 * r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#7fe3ff';
      ctx.beginPath(); ctx.arc(x + 0.12 * r, by + 0.06 * r, 0.08 * r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x + 0.09 * r, by + 0.02 * r, 0.03 * r, 0, TAU); ctx.fill();
      // Blinking light
      const on = Math.sin(t * 5 + d.phase * 3) > 0.2;
      ctx.fillStyle = on ? '#ff4d6d' : '#6b2635';
      if (on) { ctx.shadowColor = '#ff4d6d'; ctx.shadowBlur = 10; }
      ctx.beginPath(); ctx.arc(x - 0.36 * r, by + 0.02 * r, 0.065 * r, 0, TAU); ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    }

    function drawTargetRing(cx, cy, r) {
      const rr = 1.3 * r + Math.sin(t * 7) * 0.07 * r;
      ctx.save();
      ctx.fillStyle = 'rgba(255,60,90,.10)';
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#ff3b5c'; ctx.lineWidth = 3;
      ctx.shadowColor = '#ff3b5c'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.stroke();
      ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const a = t * 1.4 + (i * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * (rr - 7), cy + Math.sin(a) * (rr - 7));
        ctx.lineTo(cx + Math.cos(a) * (rr + 7), cy + Math.sin(a) * (rr + 7));
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawBadge(bx, by, r, n) {
      const br = Math.max(11, 0.34 * r);
      ctx.fillStyle = '#ff3b5c';
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = `700 ${Math.round(br * 1.25)}px ${FONT}`;
      ctx.fillText(String(n), bx, by + br * 0.06);
    }

    function drawMissile(m) {
      const tr = m.trail;
      for (let i = 0; i < tr.length; i++) {
        const k = i / tr.length;
        ctx.fillStyle = `rgba(240,232,250,${0.65 * k})`;
        ctx.beginPath(); ctx.arc(tr[i][0], tr[i][1], 3 + (1 - k) * 9, 0, TAU); ctx.fill();
      }
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(Math.atan2(m.vy, m.vx));
      ctx.scale(R / 26, R / 26);
      // Flame
      const fl = 10 + Math.random() * 8;
      const fg = ctx.createLinearGradient(-11 - fl, 0, -9, 0);
      fg.addColorStop(0, 'rgba(255,120,40,0)'); fg.addColorStop(0.5, '#ff9a3d'); fg.addColorStop(1, '#fff3b0');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.moveTo(-9, -4); ctx.quadraticCurveTo(-11 - fl, 0, -9, 4); ctx.fill();
      // Fins
      ctx.fillStyle = '#e8364f';
      ctx.beginPath(); ctx.moveTo(-9, -3); ctx.lineTo(-13, -8); ctx.lineTo(-3, -3); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-9, 3); ctx.lineTo(-13, 8); ctx.lineTo(-3, 3); ctx.fill();
      // Body and nose
      const bgr = ctx.createLinearGradient(0, -4, 0, 4);
      bgr.addColorStop(0, '#ffffff'); bgr.addColorStop(1, '#a9b4d6');
      ctx.fillStyle = bgr;
      roundRect(-10, -4, 16, 8, 3); ctx.fill();
      ctx.fillStyle = '#e8364f';
      ctx.beginPath(); ctx.moveTo(5, -4); ctx.quadraticCurveTo(14, 0, 5, 4); ctx.fill();
      ctx.fillStyle = '#4fc3ff';
      ctx.beginPath(); ctx.arc(0, 0, 1.8, 0, TAU); ctx.fill();
      ctx.restore();
    }

    function drawEffects() {
      for (const s of smoke) {
        ctx.fillStyle = `rgba(90,80,110,${0.35 * (s.life / s.max)})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
      }
      ctx.globalCompositeOperation = 'lighter';
      for (const f of fire) {
        const k = f.life / f.max;
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
        g.addColorStop(0, `rgba(255,240,180,${0.9 * k})`);
        g.addColorStop(0.5, `rgba(255,150,50,${0.6 * k})`);
        g.addColorStop(1, 'rgba(255,80,40,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill();
      }
      for (const f of flashes) {
        const k = f.life / 0.3, fr = R * (2.4 - k);
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, fr);
        g.addColorStop(0, `rgba(255,255,235,${k})`);
        g.addColorStop(0.4, `rgba(255,200,90,${0.7 * k})`);
        g.addColorStop(1, 'rgba(255,120,60,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(f.x, f.y, fr, 0, TAU); ctx.fill();
      }
      for (const r of rings) {
        ctx.strokeStyle = `rgba(255,236,190,${Math.min(1, r.life * 2.2)})`;
        ctx.lineWidth = 3 + r.life * 6;
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      for (const p of sparks) {
        ctx.globalAlpha = Math.max(0, p.life / p.max);
        ctx.fillStyle = p.col;
        if (p.chunk) {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size); ctx.restore();
        } else {
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    function drawCannon(pos) {
      const { x, y } = pos;
      // Barrel (behind the dome)
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(cannon.angle);
      const back = cannon.recoil * 10;
      const bar = ctx.createLinearGradient(0, -9, 0, 9);
      bar.addColorStop(0, '#8fa2cf'); bar.addColorStop(0.45, '#eef3ff'); bar.addColorStop(1, '#56638f');
      ctx.fillStyle = bar;
      roundRect(8 - back, -9, 52, 18, 6); ctx.fill();
      ctx.fillStyle = '#ffc83d'; ctx.fillRect(30 - back, -9, 7, 18);
      ctx.fillStyle = '#2f3858'; roundRect(54 - back, -11, 12, 22, 4); ctx.fill();
      if (cannon.flash > 0) {
        const k = cannon.flash, tip = 66 - back;
        const fg = ctx.createRadialGradient(tip + 8, 0, 0, tip + 8, 0, 34 * k);
        fg.addColorStop(0, `rgba(255,250,220,${k})`); fg.addColorStop(1, 'rgba(255,170,60,0)');
        ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(tip + 8, 0, 34 * k, 0, TAU); ctx.fill();
        ctx.fillStyle = `rgba(255,226,138,${k})`;
        ctx.beginPath();
        ctx.moveTo(tip, -6); ctx.lineTo(tip + 38 * k, 0); ctx.lineTo(tip, 6);
        ctx.moveTo(tip, -4); ctx.lineTo(tip + 20 * k, -16 * k); ctx.lineTo(tip + 6, 0);
        ctx.moveTo(tip, 4); ctx.lineTo(tip + 20 * k, 16 * k); ctx.lineTo(tip + 6, 0);
        ctx.fill();
      }
      ctx.restore();
      // Platform with hazard stripes
      ctx.save();
      roundRect(x - 62, y + 6, 124, 20, 8);
      ctx.fillStyle = '#262e50'; ctx.fill();
      ctx.clip();
      ctx.fillStyle = '#ffc83d';
      for (let i = -80; i < 80; i += 18) {
        ctx.beginPath();
        ctx.moveTo(x + i, y + 26); ctx.lineTo(x + i + 9, y + 26); ctx.lineTo(x + i + 21, y + 6); ctx.lineTo(x + i + 12, y + 6);
        ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = '#1b2240'; ctx.fillRect(x - 62, y + 6, 124, 3);
      // Dome
      const dome = ctx.createRadialGradient(x - 10, y - 12, 3, x, y, 36);
      dome.addColorStop(0, '#e4ebff'); dome.addColorStop(0.6, '#7d8cc0'); dome.addColorStop(1, '#3d4a78');
      ctx.fillStyle = dome;
      ctx.beginPath(); ctx.arc(x, y + 10, 32, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#2a3358'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#2a3358';
      for (let i = 0; i < 5; i++) {
        const a = Math.PI + ((i + 0.5) / 5) * Math.PI;
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * 25, y + 10 + Math.sin(a) * 25, 2, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = cannon.flash > 0 ? '#ffd35a' : '#4fc3ff';
      ctx.beginPath(); ctx.arc(x, y - 6, 5, 0, TAU); ctx.fill();
    }

    function drawConfetti() {
      for (const c of confettiBits) {
        ctx.globalAlpha = Math.min(1, c.life);
        ctx.fillStyle = c.col;
        ctx.save();
        ctx.translate(c.x, c.y); ctx.rotate(c.rot); ctx.scale(Math.cos(c.flip), 1);
        ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    return { resize, draw, explode, confetti, shake, muzzle };
  }

  root.Render = { create };
})(window);
