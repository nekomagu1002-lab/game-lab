(function (N) {
  'use strict';
  const C = N.config;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  N.clamp = clamp;
  N.Physics = class {
    constructor() { this.bodies = []; this.nextId = 1; }
    add(level, x, y, time, options = {}) {
      const radius = C.cats[level].radius;
      const body = { id: this.nextId++, level, x, y, vx: 0, vy: 0, angle: 0, omega: 0,
        radius, startRadius: radius, targetRadius: radius, born: time,
        safeUntil: time + C.spawnGrace, danger: 0, mergeReady: true, landedAt: null, ...options };
      this.bodies.push(body); return body;
    }
    step(dt, time) {
      const contacts = [], pairs = new Set();
      for (const b of this.bodies) {
        b.supported = false; b.floorContact = false;
        const progress = clamp((time - b.born) / C.growthDuration, 0, 1);
        b.radius = b.startRadius + (b.targetRadius - b.startRadius) * (1 - (1 - progress) ** 3);
        b.vy += C.gravity * dt;
        b.vx *= Math.exp(-C.airDrag * dt);
        b.vy *= Math.exp(-C.airDrag * dt);
        this.limit(b);
        b.x += b.vx * dt; b.y += b.vy * dt;
        b.angle += b.omega * dt; b.omega *= Math.exp(-C.angularDamping * dt);
      }
      for (let iteration = 0; iteration < C.solverIterations; iteration++) {
        for (const b of this.bodies) {
          if (b.x - b.radius < C.wall) { b.x = C.wall + b.radius; b.vx = Math.max(0, -b.vx * C.restitution); }
          if (b.x + b.radius > C.width - C.wall) { b.x = C.width - C.wall - b.radius; b.vx = Math.min(0, -b.vx * C.restitution); }
          if (b.y + b.radius > C.floor) {
            b.supported = true; b.floorContact = true;
            b.y = C.floor - b.radius;
            b.vy = b.vy < C.floorBounceThreshold ? 0 : Math.min(0, -b.vy * C.restitution);
            if (!iteration) {
              b.vx *= 1 - C.friction;
              if (Math.abs(b.vx) > C.rollingMinSpeed) b.omega += b.vx / b.radius * 0.03;
            }
          }
        }
        for (let i = 0; i < this.bodies.length; i++) for (let j = i + 1; j < this.bodies.length; j++) {
          const a = this.bodies[i], b = this.bodies[j];
          const dx = b.x - a.x, dy = b.y - a.y, sum = a.radius + b.radius;
          const distance = Math.hypot(dx, dy);
          if (distance > sum + 0.2) continue;
          const key = a.id + ':' + b.id;
          const nx = distance > 0.001 ? dx / distance : 0.7071;
          const ny = distance > 0.001 ? dy / distance : 0.7071;
          if (ny > 0.45) a.supported = true;
          if (ny < -0.45) b.supported = true;
          const speed = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (!pairs.has(key)) { pairs.add(key); contacts.push({ a, b, speed: Math.abs(speed) }); }
          const wa = b.radius ** 2 / (a.radius ** 2 + b.radius ** 2), wb = 1 - wa;
          // Position correction never becomes velocity: growing cats cannot launch their neighbours.
          const correction = Math.max(0, sum - distance - 0.04) * 0.75;
          a.x -= nx * correction * wa; a.y -= ny * correction * wa;
          b.x += nx * correction * wb; b.y += ny * correction * wb;
          if (speed < 0) {
            const impulse = -(1 + C.restitution) * speed;
            a.vx -= nx * impulse * wa; a.vy -= ny * impulse * wa;
            b.vx += nx * impulse * wb; b.vy += ny * impulse * wb;
            if (!iteration) {
              const tangent = (b.vx - a.vx) * -ny + (b.vy - a.vy) * nx;
              const drag = tangent * C.friction;
              a.vx -= ny * drag * wa; a.vy += nx * drag * wa;
              b.vx += ny * drag * wb; b.vy -= nx * drag * wb;
              // Solver micro-slips must not continuously feed visible rotation into a resting pile.
              if (Math.abs(tangent) > C.rollingMinSpeed) {
                a.omega += tangent / a.radius * 0.035; b.omega += tangent / b.radius * 0.035;
              }
            }
          }
        }
      }
      for (const b of this.bodies) {
        b.x = clamp(b.x, C.wall + b.radius, C.width - C.wall - b.radius);
        b.y = Math.min(b.y, C.floor - b.radius); this.limit(b);
        if (b.supported && Math.hypot(b.vx, b.vy) < C.restingSpeed) {
          b.omega *= Math.exp(-C.restingAngularDamping * dt);
          if (Math.abs(b.omega) < C.angularStopThreshold) b.omega = 0;
        }
      }
      return contacts;
    }
    limit(b) {
      b.vy = Math.max(b.vy, -C.maxRiseSpeed);
      const speed = Math.hypot(b.vx, b.vy);
      if (speed > C.maxSpeed) { b.vx *= C.maxSpeed / speed; b.vy *= C.maxSpeed / speed; }
      b.omega = clamp(b.omega, -C.maxAngularSpeed, C.maxAngularSpeed);
    }
  };
})(globalThis.Nekopon = globalThis.Nekopon || {});
