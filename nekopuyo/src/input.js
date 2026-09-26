(function (root) {
  'use strict';
  const C = root.Nekopuyo.config;
  class Input {
    constructor(action, game) {
      this.action = action; this.game = game; this.down = new Set(); this.held = new Map(); this.pointers = new Map();
      this.signature = this.getSignature();
      window.addEventListener('keydown', event => {
        const name = C.keys[event.code];
        if (!name || event.altKey || event.ctrlKey || event.metaKey) return;
        // Preserve native Enter activation for a keyboard-focused UI button.
        if (event.code === 'Enter' && event.target instanceof HTMLElement && event.target.closest('button')) return;
        event.preventDefault();
        if (event.repeat || this.down.has(event.code)) return;
        this.down.add(event.code); this.press(event.code, name);
      });
      window.addEventListener('keyup', event => {
        this.down.delete(event.code); this.held.delete(event.code);
      });
      document.querySelectorAll('[data-action]').forEach(button => {
        button.addEventListener('click', event => {
          if (event.detail === 0) { this.action(button.dataset.action); this.synchronize(); }
        });
        button.addEventListener('pointerdown', event => {
          if (event.button !== 0) return;
          event.preventDefault(); button.setPointerCapture(event.pointerId);
          const key = `pointer:${event.pointerId}`;
          this.pointers.set(event.pointerId, key); this.press(key, button.dataset.action);
        });
        const release = event => { this.held.delete(this.pointers.get(event.pointerId)); this.pointers.delete(event.pointerId); };
        button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
      });
    }
    getSignature() { return `${this.game.state}:${this.game.pieceSerial}`; }
    synchronize() {
      const signature = this.getSignature();
      if (signature !== this.signature) { this.held.clear(); this.signature = signature; }
    }
    press(key, name) {
      this.synchronize();
      const before = this.getSignature(); this.action(name); this.synchronize();
      if (before === this.getSignature() && this.game.state === 'playing' && ['left', 'right', 'softDrop'].includes(name)) {
        // The last horizontal direction wins; simultaneous opposite holds cannot oscillate.
        if (name === 'left' || name === 'right') for (const [heldKey, held] of this.held) if (held.name === 'left' || held.name === 'right') this.held.delete(heldKey);
        this.held.set(key, { name, remaining: name === 'softDrop' ? C.softDropInterval : C.repeatDelay });
      }
    }
    tick(dt) {
      this.synchronize();
      if (this.game.state !== 'playing') return;
      for (const [key, held] of this.held) {
        held.remaining -= dt;
        if (held.remaining <= 0) {
          this.action(held.name); this.synchronize();
          if (!this.held.has(key)) break;
          held.remaining += held.name === 'softDrop' ? C.softDropInterval : C.repeatInterval;
        }
      }
    }
    releaseAll() { this.held.clear(); this.down.clear(); this.pointers.clear(); }
  }
  root.Nekopuyo.Input = Input;
})(globalThis);
