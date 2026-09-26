(function (root) {
  'use strict';
  const C = (typeof module !== 'undefined' ? require('./config.js') : root.Nekopuyo).config;
  const DIRECTIONS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const FLAGS = ['connectedTop', 'connectedRight', 'connectedBottom', 'connectedLeft'];
  const emptyBoard = () => Array.from({ length: C.rows + C.hiddenRows }, () => Array(C.columns).fill(null));
  function seededRandom(seed) {
    let value = seed >>> 0;
    return () => {
      value += 0x6D2B79F5;
      let n = value;
      n = Math.imul(n ^ n >>> 15, n | 1);
      n ^= n + Math.imul(n ^ n >>> 7, n | 61);
      return ((n ^ n >>> 14) >>> 0) / 4294967296;
    };
  }
  function updateConnections(board) {
    board.forEach((row, y) => row.forEach((cat, x) => {
      if (!cat) return;
      DIRECTIONS.forEach(([dx, dy], direction) => {
        cat[FLAGS[direction]] = board[y + dy]?.[x + dx]?.type === cat.type;
      });
    }));
  }
  function findGroups(board) {
    const visited = new Set(), groups = [];
    board.forEach((row, y) => row.forEach((cat, x) => {
      const key = y * C.columns + x;
      if (!cat || visited.has(key)) return;
      const group = [], stack = [{ x, y }];
      visited.add(key);
      while (stack.length) {
        const current = stack.pop();
        group.push(current);
        DIRECTIONS.forEach(([dx, dy]) => {
          const nx = current.x + dx, ny = current.y + dy, nk = ny * C.columns + nx;
          if (nx < 0 || nx >= C.columns || ny < 0 || ny >= board.length || visited.has(nk)) return;
          if (board[ny][nx]?.type === cat.type) { visited.add(nk); stack.push({ x: nx, y: ny }); }
        });
      }
      if (group.length >= C.minimumGroup) groups.push(group);
    }));
    return groups;
  }
  // Mutate only board data. Rendering receives the old/new positions as a separate animation plan.
  function applyGravity(board) {
    const moves = [];
    for (let x = 0; x < C.columns; x++) {
      let destination = board.length - 1;
      for (let y = board.length - 1; y >= 0; y--) {
        const cat = board[y][x];
        if (!cat) continue;
        if (destination !== y) {
          board[destination][x] = cat;
          board[y][x] = null;
          moves.push({ id: cat.id, x, fromY: y, toY: destination });
        }
        destination--;
      }
    }
    updateConnections(board);
    return moves;
  }
  class Game {
    constructor(seed = (Math.random() * 4294967296) >>> 0) {
      this.reset(seed, false);
    }
    reset(seed = (Math.random() * 4294967296) >>> 0, start = true) {
      this.random = seededRandom(seed);
      this.seed = seed; this.nextId = 1;
      this.board = emptyBoard(); this.active = null; this.queue = [];
      this.score = 0; this.chain = 0; this.maxChain = 0; this.clearedCount = 0;
      this.phaseTime = 0; this.fallTime = 0; this.lockTime = 0; this.lockResets = 0;
      this.clearing = []; this.gravityMoves = []; this.lastClear = null;
      this.events = []; this.pieceSerial = 0; this.pausedState = null;
      this.state = 'ready';
      this.fillQueue();
      if (start) this.start();
    }
    makeCat(type) { return { id: this.nextId++, type, connectedTop: false, connectedRight: false, connectedBottom: false, connectedLeft: false }; }
    fillQueue() {
      while (this.queue.length < C.nextCount + 1) this.queue.push([Math.floor(this.random() * C.typeCount), Math.floor(this.random() * C.typeCount)]);
    }
    start() {
      if (this.state !== 'ready') return false;
      return this.spawn();
    }
    spawn() {
      this.active = { x: C.spawnX, y: C.spawnY, orientation: 0, types: this.queue.shift() };
      this.fillQueue(); this.phaseTime = 0; this.fallTime = 0; this.lockTime = 0; this.lockResets = 0;
      this.chain = 0; this.pieceSerial++;
      if (!this.canPlace(this.active)) {
        this.active = null; this.state = 'gameover'; this.events.push({ type: 'gameover' }); return false;
      }
      this.state = 'playing'; this.events.push({ type: 'spawn', serial: this.pieceSerial }); return true;
    }
    get next() { return this.queue[0]; }
    get fallInterval() { return Math.max(C.minimumFallInterval, C.fallInterval - Math.floor(this.clearedCount / C.clearsPerSpeedStep) * C.speedStep); }
    pairCells(pair = this.active) {
      if (!pair) return [];
      const [dx, dy] = DIRECTIONS[pair.orientation];
      return [{ x: pair.x, y: pair.y, type: pair.types[0] }, { x: pair.x + dx, y: pair.y + dy, type: pair.types[1] }];
    }
    canPlace(pair) {
      return this.pairCells(pair).every(({ x, y }) => x >= 0 && x < C.columns && y >= 0 && y < this.board.length && !this.board[y][x]);
    }
    isGrounded() { return this.active && !this.canPlace({ ...this.active, y: this.active.y + 1 }); }
    resetLock(wasGrounded) {
      if (wasGrounded && this.lockResets < C.maxLockResets) { this.lockTime = 0; this.lockResets++; }
      if (!this.isGrounded()) this.lockTime = 0;
    }
    move(dx) {
      if (this.state !== 'playing' || ![-1, 1].includes(dx)) return false;
      const candidate = { ...this.active, x: this.active.x + dx };
      if (!this.canPlace(candidate)) return false;
      const grounded = this.isGrounded(); this.active = candidate; this.resetLock(grounded); return true;
    }
    rotate(direction) {
      if (this.state !== 'playing' || ![-1, 1].includes(direction)) return false;
      const orientation = (this.active.orientation + direction + 4) % 4;
      const grounded = this.isGrounded();
      // A small wall/floor kick is sufficient here; faces always remain upright in the renderer.
      for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1]]) {
        const candidate = { ...this.active, orientation, x: this.active.x + dx, y: this.active.y + dy };
        if (this.canPlace(candidate)) { this.active = candidate; this.resetLock(grounded); return true; }
      }
      return false;
    }
    softDrop() {
      if (this.state !== 'playing') return false;
      const candidate = { ...this.active, y: this.active.y + 1 };
      if (!this.canPlace(candidate)) return false;
      this.active = candidate; this.fallTime = 0; this.lockTime = 0; return true;
    }
    ghostCells() {
      if (!this.active) return [];
      let candidate = { ...this.active };
      while (this.canPlace({ ...candidate, y: candidate.y + 1 })) candidate.y++;
      // The two cats settle independently after the pair touches a ledge.
      const result = this.pairCells(candidate).sort((a, b) => b.y - a.y);
      const occupied = new Set();
      result.forEach(cat => {
        while (cat.y + 1 < this.board.length && !this.board[cat.y + 1][cat.x] && !occupied.has(`${cat.x},${cat.y + 1}`)) cat.y++;
        occupied.add(`${cat.x},${cat.y}`);
      });
      return result;
    }
    hardDrop() {
      if (this.state !== 'playing') return false;
      while (this.canPlace({ ...this.active, y: this.active.y + 1 })) this.active.y++;
      this.lock(); return true;
    }
    lock() {
      if (this.state !== 'playing' || !this.active) return;
      this.pairCells().forEach(({ x, y, type }) => { this.board[y][x] = this.makeCat(type); });
      this.active = null; this.chain = 0;
      updateConnections(this.board);
      this.settle();
    }
    settle() {
      this.gravityMoves = applyGravity(this.board); this.phaseTime = 0;
      if (this.gravityMoves.length) {
        this.state = 'falling';
        this.events.push({ type: 'fall', chain: this.chain });
      }
      else this.resolve();
    }
    resolve() {
      const groups = findGroups(this.board);
      if (!groups.length) { this.clearing = []; this.spawn(); return; }
      this.chain++; this.maxChain = Math.max(this.maxChain, this.chain);
      this.clearing = groups.flat(); this.phaseTime = 0; this.state = 'clearing';
      const multiplier = C.chainMultipliers[Math.min(this.chain, C.chainMultipliers.length - 1)];
      const points = this.clearing.length * C.basePoints * multiplier;
      this.score += points; this.clearedCount += this.clearing.length;
      this.lastClear = { chain: this.chain, count: this.clearing.length, points, groups: groups.length };
      this.events.push({ type: 'clear', ...this.lastClear });
    }
    tick(milliseconds) {
      if (!Number.isFinite(milliseconds) || milliseconds <= 0 || ['ready', 'paused', 'gameover'].includes(this.state)) return;
      // A bounded substep keeps lock timing and phase transitions independent of the render frame rate.
      let remaining = Math.min(milliseconds, 1000);
      while (remaining > 0 && !['ready', 'paused', 'gameover'].includes(this.state)) {
        const duration = { clearing: C.clearDuration, falling: C.gravityDuration, chainPause: C.chainPauseDuration }[this.state];
        // Do not discard time at animation boundaries: each interval retains its configured duration.
        const dt = Math.min(remaining, 16, duration === undefined ? Infinity : duration - this.phaseTime);
        remaining -= dt;
        if (this.state === 'playing') {
          if (this.isGrounded()) { this.lockTime += dt; if (this.lockTime >= C.lockDelay) this.lock(); }
          else {
            this.lockTime = 0; this.fallTime += dt;
            if (this.fallTime >= this.fallInterval) { this.fallTime -= this.fallInterval; this.active.y++; }
          }
        } else if (this.state === 'clearing') {
          const previousTime = this.phaseTime;
          this.phaseTime += dt;
          const squeezeTime = C.clearDuration * C.clearRecognizeEnd;
          if (previousTime < squeezeTime && this.phaseTime >= squeezeTime) this.events.push({ type: 'squeeze', chain: this.chain });
          if (this.phaseTime >= C.clearDuration) {
            this.events.push({ type: 'pop', cells: this.clearing.map(({ x, y }) => ({ x, y, type: this.board[y][x].type })) });
            this.clearing.forEach(({ x, y }) => { this.board[y][x] = null; });
            this.clearing = []; this.settle();
          }
        } else if (this.state === 'falling') {
          this.phaseTime += dt;
          if (this.phaseTime >= C.gravityDuration) {
            this.gravityMoves = [];
            this.events.push({ type: 'land', chain: this.chain });
            // Ordinary pair placement stays responsive. Pause only after a clear-induced fall.
            if (this.chain > 0) { this.state = 'chainPause'; this.phaseTime = 0; }
            else this.resolve();
          }
        } else if (this.state === 'chainPause') {
          this.phaseTime += dt;
          if (this.phaseTime >= C.chainPauseDuration) this.resolve();
        }
      }
    }
    pause() {
      if (!['playing', 'clearing', 'falling', 'chainPause'].includes(this.state)) return false;
      this.pausedState = this.state; this.state = 'paused'; return true;
    }
    resume() {
      if (this.state !== 'paused') return false;
      this.state = this.pausedState; this.pausedState = null; return true;
    }
    drainEvents() { return this.events.splice(0); }
    // Separate board fixture API for deterministic rules tests and future modes; not bound to player controls.
    loadBoard(rows) {
      if (!Array.isArray(rows) || rows.length !== this.board.length || rows.some(row => !Array.isArray(row) || row.length !== C.columns || row.some(type => type !== null && (!Number.isInteger(type) || type < 0 || type >= C.typeCount)))) throw new Error('Invalid board');
      this.board = rows.map(row => row.map(type => type === null ? null : this.makeCat(type)));
      updateConnections(this.board);
    }
  }
  const api = { Game, emptyBoard, updateConnections, findGroups, applyGravity, seededRandom };
  root.Nekopuyo = Object.assign(root.Nekopuyo || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
