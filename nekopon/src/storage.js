(function (N) {
  'use strict';
  const KEY = 'nekopon.save.v1';
  const integer = (x, max = 1e12) => Number.isFinite(x) ? Math.min(max, Math.max(0, Math.floor(x))) : 0;
  N.SaveStore = class {
    constructor(storage) {
      this.storage = storage; this.available = true; let raw = {};
      try { raw = JSON.parse(storage.getItem(KEY) || '{}') || {}; } catch { this.available = false; }
      this.data = {
        version: 1, best: Object.fromEntries(Object.values(N.GAME_MODES).map(mode => [mode.bestKey, integer(raw.best?.[mode.bestKey])])),
        totalDrops: integer(raw.totalDrops), plays: integer(raw.plays), gods: integer(raw.gods),
        discovered: [...new Set(Array.isArray(raw.discovered) ? raw.discovered.filter(n => Number.isInteger(n) && n >= 0 && n < 10) : [])],
        maxLevel: Math.max(-1, Math.min(9, Number.isInteger(raw.maxLevel) ? raw.maxLevel : -1)),
        bestClearDrops: integer(raw.bestClearDrops), bestClearTime: integer(raw.bestClearTime),
        bgm: raw.bgm === true, se: raw.se !== false
      };
      this.data.maxLevel = Math.max(this.data.maxLevel, ...this.data.discovered);
    }
    write() {
      try { this.storage.setItem(KEY, JSON.stringify(this.data)); this.available = true; }
      catch { this.available = false; }
      return this.available;
    }
    discover(level) {
      if (!this.data.discovered.includes(level)) this.data.discovered.push(level);
      this.data.maxLevel = Math.max(this.data.maxLevel, level);
    }
    record(game) {
      const key = N.GAME_MODES[game.mode].bestKey;
      this.data.best[key] = Math.max(this.data.best[key], game.score);
      if (game.state === 'clear') {
        this.data.bestClearDrops = this.data.bestClearDrops ? Math.min(this.data.bestClearDrops, game.drops) : game.drops;
        const seconds = Math.max(1, Math.round(game.time));
        this.data.bestClearTime = this.data.bestClearTime ? Math.min(this.data.bestClearTime, seconds) : seconds;
      }
      this.write();
    }
  };
})(globalThis.Nekopon = globalThis.Nekopon || {});
