(function (root) {
  'use strict';
  const N = root.Nekopuyo, C = N.config;
  const INK = '#55645c';
  function clearScale(progress) {
    const p = Math.max(0, Math.min(1, progress));
    if (p < C.clearRecognizeEnd) return 1 + .025 * Math.sin(Math.PI * p / C.clearRecognizeEnd);
    if (p < C.clearSqueezeEnd) {
      const t = (p - C.clearRecognizeEnd) / (C.clearSqueezeEnd - C.clearRecognizeEnd);
      // Ease out into a short held squeeze, with a small elastic rebound.
      const squeeze = Math.min(1, t / .8);
      return 1 - .16 * (1 - (1 - squeeze) ** 3) - .012 * Math.sin(Math.PI * 2 * squeeze) * Math.sin(Math.PI * squeeze);
    }
    const t = (p - C.clearSqueezeEnd) / (1 - C.clearSqueezeEnd);
    return .84 - .59 * t * t;
  }
  function surface(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * dpr)), height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    return { ctx, width: rect.width, height: rect.height };
  }
  // A rounded, slightly squashed body with small ears. No bitmap or connection-specific sprites.
  function bodyPath(path, x, y, size, scale = 1) {
    const s = size * scale;
    const point = (px, py) => [x + px * s, y + py * s];
    path.moveTo(...point(-.39, -.18));
    path.bezierCurveTo(...point(-.43, -.48), ...point(-.39, -.56), ...point(-.20, -.38));
    path.bezierCurveTo(...point(-.08, -.44), ...point(.10, -.44), ...point(.23, -.37));
    path.bezierCurveTo(...point(.41, -.54), ...point(.44, -.50), ...point(.41, -.16));
    path.bezierCurveTo(...point(.57, .13), ...point(.40, .45), ...point(0, .46));
    path.bezierCurveTo(...point(-.39, .46), ...point(-.58, .14), ...point(-.39, -.18));
    path.closePath();
  }
  function face(ctx, cat, size) {
    const palette = N.cats[cat.type];
    ctx.save(); ctx.translate(cat.px, cat.py); ctx.scale(size * (cat.scale ?? 1), size * (cat.scale ?? 1));
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // Inner ears stay recognizably separate even in a large connected group.
    ctx.fillStyle = '#f1c5b5';
    ctx.beginPath(); ctx.moveTo(-.345, -.22); ctx.lineTo(-.343, -.39); ctx.lineTo(-.235, -.29); ctx.fill();
    ctx.beginPath(); ctx.moveTo(.285, -.29); ctx.lineTo(.365, -.40); ctx.lineTo(.37, -.22); ctx.fill();
    if (palette.pattern === 'bicolor') {
      ctx.fillStyle = '#fff2d8'; ctx.beginPath();
      ctx.moveTo(0, -.24); ctx.bezierCurveTo(-.08, -.04, -.31, -.09, -.39, .12);
      ctx.bezierCurveTo(-.34, .47, .34, .47, .39, .12); ctx.bezierCurveTo(.31, -.09, .08, -.04, 0, -.24); ctx.fill();
    } else if (palette.pattern === 'stripe' || palette.pattern === 'tabby') {
      ctx.strokeStyle = palette.shade; ctx.lineWidth = .053;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.moveTo(i * .1, -.32); ctx.lineTo(i * .087, -.16 + Math.abs(i) * -.012); ctx.stroke();
      }
      if (palette.pattern === 'tabby') {
        ctx.lineWidth = .04;
        for (const sign of [-1, 1]) for (const offset of [0, .09]) {
          ctx.beginPath(); ctx.moveTo(sign * .38, .035 + offset); ctx.lineTo(sign * .28, .06 + offset); ctx.stroke();
        }
      }
    } else if (palette.pattern === 'heart') {
      ctx.fillStyle = palette.shade; ctx.beginPath();
      ctx.moveTo(0, -.15); ctx.bezierCurveTo(-.24, -.29, -.06, -.42, 0, -.30);
      ctx.bezierCurveTo(.06, -.42, .24, -.29, 0, -.15); ctx.fill();
    }
    ctx.fillStyle = '#cf9490'; ctx.globalAlpha *= .40;
    for (const x of [-.235, .235]) { ctx.beginPath(); ctx.ellipse(x, .13, .071, .04, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha /= .40;
    ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineWidth = .024;
    for (const x of [-.135, .135]) {
      ctx.beginPath();
      if (palette.pattern === 'bicolor') { ctx.moveTo(x - .039, .023); ctx.quadraticCurveTo(x, .051, x + .039, .023); ctx.stroke(); }
      else { ctx.ellipse(x, .017, palette.pattern === 'plain' ? .022 : .026, palette.pattern === 'heart' ? .046 : .037, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.beginPath(); ctx.moveTo(-.031, .09); ctx.quadraticCurveTo(0, .07, .031, .09); ctx.lineTo(0, .118); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, .112); ctx.bezierCurveTo(-.005, .17, -.07, .17, -.076, .132);
    ctx.moveTo(0, .112); ctx.bezierCurveTo(.005, .17, .07, .17, .076, .132); ctx.stroke();
    if (palette.pattern !== 'plain') {
      ctx.globalAlpha *= .60; ctx.lineWidth = .018;
      for (const sign of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(sign * .28, .11); ctx.lineTo(sign * .385, .085);
        ctx.moveTo(sign * .28, .17); ctx.lineTo(sign * .38, .19); ctx.stroke();
      }
    }
    ctx.restore();
  }
  function roundedBridge(path, a, b, size, scale = 1) {
    const radius = size * .26 * scale;
    if (Math.abs(a.px - b.px) > Math.abs(a.py - b.py)) {
      path.roundRect(Math.min(a.px, b.px), (a.py + b.py) / 2 - radius, Math.abs(a.px - b.px), radius * 2, radius);
    } else {
      path.roundRect((a.px + b.px) / 2 - radius, Math.min(a.py, b.py), radius * 2, Math.abs(a.py - b.py), radius);
    }
  }
  function drawCats(ctx, cats, size, opacity = 1, allowConnections = true) {
    ctx.save(); ctx.globalAlpha = opacity;
    // Draw an entire color's silhouette first, then every face. Filling the union hides inner outline seams.
    for (let type = 0; type < N.cats.length; type++) for (const highlight of [false, true]) {
      // Separate clear targets from isolated cats of the same color; connection geometry is unchanged.
      const members = cats.filter(cat => cat.type === type && !!cat.highlight === highlight), path = new Path2D();
      if (!members.length) continue;
      const byCell = new Map(members.map(cat => [`${cat.x},${cat.y}`, cat]));
      if (allowConnections) members.forEach(cat => {
        for (const [flag, dx, dy] of [['connectedRight', 1, 0], ['connectedBottom', 0, 1]]) {
          if (!cat[flag]) continue;
          const neighbor = byCell.get(`${cat.x + dx},${cat.y + dy}`);
          if (neighbor && Math.abs(neighbor.px - cat.px) + Math.abs(neighbor.py - cat.py) < size * 1.08) roundedBridge(path, cat, neighbor, size, Math.min(cat.scale ?? 1, neighbor.scale ?? 1));
        }
      });
      members.forEach(cat => bodyPath(path, cat.px, cat.py, size, cat.scale));
      ctx.strokeStyle = highlight ? '#536e5e' : '#708074'; ctx.lineWidth = Math.max(1, size * (highlight ? .052 : .038)); ctx.lineJoin = 'round';
      ctx.stroke(path); ctx.fillStyle = N.cats[type].color; ctx.fill(path);
      if (highlight) { ctx.fillStyle = '#fffdf526'; ctx.fill(path); }
    }
    cats.forEach(cat => face(ctx, cat, size));
    ctx.restore();
  }
  function connectFreeCats(cats) {
    cats.forEach(cat => {
      cat.connectedRight = cats.some(other => other.type === cat.type && other.x === cat.x + 1 && other.y === cat.y);
      cat.connectedBottom = cats.some(other => other.type === cat.type && other.x === cat.x && other.y === cat.y + 1);
    });
    return cats;
  }
  class Renderer {
    constructor(board, next) { this.board = board; this.next = next; this.particles = []; this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches; }
    pop(cells) {
      if (this.reducedMotion) return;
      cells.forEach(cell => { for (let i = 0; i < 5; i++) this.particles.push({ ...cell, angle: i * Math.PI * 2 / 5, age: 0 }); });
    }
    draw(game, dt = 0) {
      const { ctx, width, height } = surface(this.board), size = width / C.columns, rowSize = height / C.rows;
      ctx.fillStyle = '#edf0e5'; ctx.fillRect(0, 0, width, height);
      for (let y = 0; y < C.rows; y++) for (let x = 0; x < C.columns; x++) {
        if ((x + y) % 2 === 0) { ctx.fillStyle = '#e6ebdd'; ctx.fillRect(x * size, y * rowSize, size, rowSize); }
        ctx.fillStyle = '#cbd5c4'; ctx.beginPath(); ctx.arc((x + .5) * size, (y + .5) * rowSize, .85, 0, 2 * Math.PI); ctx.fill();
      }
      ctx.strokeStyle = '#b3bfa8'; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo((C.spawnX + .35) * size, 6); ctx.lineTo((C.spawnX + .5) * size, 11); ctx.lineTo((C.spawnX + .65) * size, 6); ctx.stroke();
      const state = game.state === 'paused' ? game.pausedState : game.state;
      const toPixels = cat => ({ ...cat, px: (cat.x + .5) * size, py: (cat.y - C.hiddenRows + .5) * rowSize });
      if (game.active && state === 'playing') drawCats(ctx, connectFreeCats(game.ghostCells().map(toPixels)), size * .97, .20);
      const clearing = new Set(game.clearing.map(cat => `${cat.x},${cat.y}`));
      const moves = new Map(game.gravityMoves.map(move => [move.id, move]));
      const progress = Math.min(1, game.phaseTime / C.clearDuration);
      const cats = [];
      game.board.forEach((row, y) => row.forEach((cat, x) => {
        if (!cat) return;
        const visual = toPixels({ ...cat, x, y, scale: 1 });
        if (state === 'falling' && moves.has(cat.id)) {
          const move = moves.get(cat.id), t = Math.min(1, game.phaseTime / C.gravityDuration);
          visual.py = (move.fromY + (move.toY - move.fromY) * t * t - C.hiddenRows + .5) * rowSize;
        }
        if (state === 'clearing' && clearing.has(`${x},${y}`)) {
          visual.scale = this.reducedMotion ? 1 : clearScale(progress);
          visual.highlight = true;
        }
        cats.push(visual);
      }));
      drawCats(ctx, cats, size * .97, 1, state !== 'falling');
      if (game.active) {
        const active = connectFreeCats(game.pairCells().map(toPixels));
        drawCats(ctx, active, size * .97);
        const pivot = active[0];
        ctx.strokeStyle = '#546b5990'; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.arc(pivot.px, pivot.py + size * .35, size * .034, 0, 2 * Math.PI); ctx.stroke();
      }
      this.particles.forEach(particle => {
        particle.age += dt; const t = particle.age / 360;
        if (t > 1) return;
        ctx.globalAlpha = 1 - t; ctx.fillStyle = N.cats[particle.type].shade;
        ctx.beginPath(); ctx.arc((particle.x + .5) * size + Math.cos(particle.angle) * t * size * .62, (particle.y - C.hiddenRows + .5) * rowSize + Math.sin(particle.angle) * t * size * .62, (1 - t) * 3.5, 0, 2 * Math.PI); ctx.fill();
      });
      ctx.globalAlpha = 1; this.particles = this.particles.filter(p => p.age < 360);
      this.drawNext(game.next);
    }
    drawNext(types) {
      const { ctx, width, height } = surface(this.next), size = Math.min(54, height * .45, width * .64);
      const cats = [...types].reverse().map((type, i) => ({ type, x: 0, y: i, px: width / 2, py: height / 2 + (i - .5) * size * .94 }));
      drawCats(ctx, connectFreeCats(cats), size);
      this.next.setAttribute('aria-label', `次の猫：${N.cats[types[0]].name}、${N.cats[types[1]].name}`);
    }
  }
  function drawDecorations() {
    const family = surface(document.getElementById('family'));
    const size = Math.min(family.width / 4.4, family.height / 1.45);
    const members = [0, 1, 2, 3, 4].map((type, i) => ({ type, px: family.width * (.13 + i * .183), py: family.height * (.54 + (i % 2 ? -.1 : .09)) }));
    drawCats(family.ctx, members, size, 1, false);
    const welcome = surface(document.getElementById('welcome-cats'));
    drawCats(welcome.ctx, connectFreeCats([0, 1].map(i => ({ type: 1, x: i, y: 0, px: welcome.width / 2 + (i - .5) * 56, py: welcome.height / 2 + 5 }))), 58);
  }
  root.Nekopuyo = Object.assign(N, { Renderer, drawCats, drawDecorations, connectFreeCats, clearScale });
})(globalThis);
