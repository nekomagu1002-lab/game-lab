(function (N) {
  'use strict';
  const C = N.config;
  N.Game = class {
    constructor(mode, random = Math.random) {
      this.mode = Object.hasOwn(N.GAME_MODES, mode) ? mode : 'endless'; this.random = random;
      this.rules = N.GAME_MODES[this.mode];
      this.physics = new N.Physics(); this.state = 'playing'; this.time = 0;
      this.score = 0; this.drops = 0; this.gods = 0; this.maxLevel = -1;
      this.current = this.pick(); this.next = this.pick(); this.x = C.width / 2;
      this.readyAt = 0; this.events = []; this.lastMerge = -10; this.chain = 0;
      this.graceUntil = 0; this.warning = 0;
      this.deadline = this.rules.timeLimit; this.preparing = null;
      if (this.rules.initialPile) this.preparePile();
    }
    pick(weights = C.spawnWeights) {
      let n = this.random() * weights.reduce((a, b) => a + b, 0);
      for (let i = 0; i < weights.length; i++) { n -= weights[i]; if (n < 0) return i; }
      return weights.length - 1;
    }
    preparePile() {
      const settings = this.rules.initialPile;
      this.preparing = { elapsed: 0, quiet: 0 };
      // Jittered, non-overlapping rows fall into a different natural pile each game.
      const maxRadius = Math.max(...C.cats.slice(0, settings.weights.length).map(cat => cat.radius));
      const columns = Math.max(1, Math.floor((C.width - 2 * C.wall) / (maxRadius * 2 + 16)));
      const spacing = (C.width - 2 * C.wall) / columns;
      for (let i = 0; i < settings.count; i++) {
        const level = this.pick(settings.weights);
        const x = C.wall + spacing * (i % columns + 0.5) + (this.random() - 0.5) * 14;
        const y = C.floor - maxRadius - 25 - Math.floor(i / columns) * (maxRadius * 2 + 18);
        this.physics.add(level, x, y, 0, { scoringEligible: false, angle: (this.random() - 0.5) * 0.5 });
      }
    }
    settlePile(dt) {
      const prep = this.preparing, settings = this.rules.initialPile;
      prep.elapsed += dt;
      this.physics.step(dt, prep.elapsed); // No merges, timer, danger, score, or drop events during preparation.
      const quiet = this.physics.bodies.every(b => Math.hypot(b.vx, b.vy) < settings.quietSpeed);
      prep.quiet = quiet ? prep.quiet + dt : 0;
      if ((prep.elapsed >= settings.minSettle && prep.quiet >= settings.quietTime) || prep.elapsed >= settings.maxSettle) {
        for (const b of this.physics.bodies) {
          b.born = this.time; b.safeUntil = this.time + C.spawnGrace; b.danger = 0;
          this.discover(b.level);
        }
        this.preparing = null; this.events.push({ type: 'prepared' });
      }
    }
    get remaining() { return this.rules.timeLimit ? N.clamp(this.deadline - this.time, 0, this.rules.timeLimit) : 0; }
    aim(x) { if (this.preparing) return; const r = C.cats[this.current].radius; this.x = N.clamp(x, C.wall + r, C.width - C.wall - r); }
    discover(level) { this.maxLevel = Math.max(this.maxLevel, level); this.events.push({ type: 'discover', level }); }
    drop(automatic = false) {
      if (this.state !== 'playing' || this.preparing || this.time < this.readyAt) return false;
      this.aim(this.x);
      // Occupied release space must clear before another cat can be placed there.
      const r = C.cats[this.current].radius;
      if (!this.rules.allowReleaseOverlap && this.physics.bodies.some(b => Math.hypot(b.x - this.x, b.y - C.spawnY) < b.radius + r + 3)) return false;
      this.physics.add(this.current, this.x, C.spawnY, this.time, {
        vx: (this.random() - 0.5) * C.dropDrift * 2, mergeReady: !this.rules.landingOnly, scoringEligible: true
      });
      this.discover(this.current); this.drops++;
      this.events.push({ type: 'drop', level: this.current, automatic });
      this.current = this.next; this.next = this.pick(); this.aim(this.x);
      this.readyAt = this.time + this.rules.dropCooldown;
      this.deadline = this.readyAt + this.rules.timeLimit; return true;
    }
    updateLanding(contacts) {
      // Snapshot eligibility before propagation: two airborne cats never qualify each other.
      const settled = new Set(this.physics.bodies.filter(b => b.mergeReady).map(b => b.id));
      const touchedPile = new Set();
      for (const { a, b } of contacts) {
        if (settled.has(a.id)) touchedPile.add(b.id);
        if (settled.has(b.id)) touchedPile.add(a.id);
      }
      for (const b of this.physics.bodies) {
        if (b.mergeReady) continue;
        if (b.landedAt === null && (b.floorContact || touchedPile.has(b.id))) b.landedAt = this.time;
        if (b.landedAt !== null && this.time - b.landedAt >= this.rules.landingDelay) {
          b.mergeReady = true;
          b.safeUntil = Math.max(b.safeUntil, this.time + C.mergeGrace);
        }
      }
    }
    step(dt = C.step) {
      if (this.state !== 'playing') return;
      if (this.preparing) { this.settlePile(dt); return; }
      this.time += dt;
      const contacts = this.physics.step(dt, this.time), used = new Set();
      if (this.rules.landingOnly) this.updateLanding(contacts);
      for (const { a, b, speed } of contacts) {
        if (used.has(a.id) || used.has(b.id)) continue;
        if (a.level !== b.level || (this.rules.landingOnly && (!a.mergeReady || !b.mergeReady))) {
          if (speed > 75) this.events.push({ type: 'contact', speed }); continue;
        }
        used.add(a.id); used.add(b.id);
        this.physics.bodies = this.physics.bodies.filter(body => body !== a && body !== b);
        const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
        this.chain = this.time - this.lastMerge < 1.3 ? this.chain + 1 : 1; this.lastMerge = this.time;
        const god = a.level === C.cats.length - 1;
        // Initial-pile-only descendants stay scoreless until a player-dropped cat joins them.
        const scoringEligible = a.scoringEligible !== false || b.scoringEligible !== false;
        const points = scoringEligible ? (god ? C.godScore : C.cats[a.level + 1].score) : 0;
        this.score += points;
        this.graceUntil = this.time + C.mergeGrace;
        for (const nearby of this.physics.bodies) {
          if (Math.hypot(nearby.x - x, nearby.y - y) < 160) {
            nearby.vx *= 0.55; nearby.vy *= 0.55; nearby.omega *= 0.5;
          }
        }
        if (god) {
          this.gods++; this.events.push({ type: 'god', x, y, points, chain: this.chain });
          if (this.rules.clearOnGod) { this.finish('clear'); break; }
        } else {
          // Start inside the actual gap at the midpoint. Larger evolved cats then grow gently,
          // instead of inserting a full-radius collider into a neighbour or jumping above the floor.
          let startRadius = Math.min(a.radius, b.radius, x-C.wall, C.width-C.wall-x, C.floor-y);
          for (const neighbour of this.physics.bodies) {
            startRadius = Math.min(startRadius, Math.hypot(neighbour.x-x, neighbour.y-y)-neighbour.radius-.5);
          }
          startRadius = Math.max(6, startRadius);
          this.physics.add(a.level + 1, N.clamp(x, C.wall + startRadius, C.width - C.wall - startRadius),
            Math.min(y, C.floor - startRadius), this.time, {
              startRadius, radius: startRadius, safeUntil: this.time + C.mergeGrace, scoringEligible,
              vx: (a.vx + b.vx) * C.mergeDamping / 2,
              vy: Math.max(0, (a.vy + b.vy) * C.mergeDamping / 2), angle: (a.angle + b.angle) / 2
            });
          this.discover(a.level + 1);
          this.events.push({ type: 'merge', x, y, level: a.level + 1, points, chain: this.chain });
        }
      }
      this.warning = 0;
      for (const b of this.physics.bodies) {
        if ((!this.rules.landingOnly || b.mergeReady) && b.y - b.radius < C.dangerY && this.time > b.safeUntil && this.time > this.graceUntil) b.danger += dt;
        else b.danger = 0;
        this.warning = Math.max(this.warning, b.danger / C.dangerDuration);
      }
      if (this.warning >= 1 && this.state === 'playing') this.finish('over');
      if (this.rules.timeLimit && this.state === 'playing' && this.time + 1e-9 >= this.deadline) this.drop(true);
    }
    finish(state) { this.state = state; this.events.push({ type: state }); }
    drain() { return this.events.splice(0); }
  };
})(globalThis.Nekopon = globalThis.Nekopon || {});
