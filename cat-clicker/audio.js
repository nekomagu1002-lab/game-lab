// Fileless, bounded sound effects. The context is created only by a user gesture.
(function (root) {
  'use strict';
  const patterns = {
    click: [[0, 290, .085, .17, 'sine', 125]],
    cat: [[0, 430, .11, .15, 'sine', 560], [.095, 660, .18, .11, 'sine', 600]],
    purchase: [[0, 420, .09, .12, 'triangle'], [.08, 560, .14, .10, 'sine']],
    event: [[0, 523, .16, .11, 'sine'], [.14, 659, .16, .10, 'sine'], [.28, 784, .22, .09, 'sine']],
    box: [[0, 330, .085, .14, 'triangle'], [.075, 494, .11, .12, 'sine'], [.16, 740, .19, .10, 'sine']],
    stage: [[0, 392, .19, .12, 'sine'], [.13, 494, .19, .11, 'sine'], [.26, 587, .19, .10, 'sine'], [.39, 784, .28, .10, 'sine']]
  };
  class SoundManager {
    constructor() { this.enabled = true; this.volume = .45; this.context = null; this.master = null; this.voices = new Set(); this.last = {}; this.failed = false; }
    unlock() {
      if (!this.enabled || this.failed) return;
      try {
        if (!this.context) {
          const Audio = root.AudioContext || root.webkitAudioContext;
          if (!Audio) { this.failed = true; return; }
          this.context = new Audio(); this.master = this.context.createGain();
          this.master.gain.value = this.volume; this.master.connect(this.context.destination);
        }
        if (this.context.state === 'suspended') this.context.resume().catch(() => {});
      } catch { this.failed = true; }
    }
    setEnabled(enabled) { this.enabled = Boolean(enabled); if (this.master) this.master.gain.value = this.enabled ? this.volume : 0; if (!this.enabled) this.stopAll(); }
    setVolume(volume) { this.volume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : this.volume; if (this.master) this.master.gain.value = this.enabled ? this.volume : 0; }
    stopAll() { for (const osc of this.voices) { try { osc.stop(); } catch {} } this.voices.clear(); }
    static schedule(context, destination, kind, at = context.currentTime, level = 1, voices = new Set()) {
      for (const [delay, hz, duration, amplitude, wave, endHz] of patterns[kind] || []) {
        if (voices.size >= 12) break;
        const osc = context.createOscillator(), gain = context.createGain(); const start = at + delay;
        osc.type = wave; osc.frequency.setValueAtTime(hz, start); if (endHz) osc.frequency.exponentialRampToValueAtTime(endHz, start + duration);
        gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(amplitude * level, start + .008); gain.gain.exponentialRampToValueAtTime(.0001, start + duration); gain.gain.setValueAtTime(0, start + duration + .005);
        osc.connect(gain); gain.connect(destination); voices.add(osc);
        osc.onended = () => { voices.delete(osc); osc.disconnect(); gain.disconnect(); };
        osc.start(start); osc.stop(start + duration + .015);
      }
    }
    play(kind, quiet = false) {
      if (!this.enabled || !this.context || this.context.state !== 'running' || document.hidden) return;
      const now = this.context.currentTime;
      if (now - (this.last[kind] ?? -100) < (kind === 'click' ? .075 : .10)) return;
      this.last[kind] = now;
      try { SoundManager.schedule(this.context, this.master, kind, now, quiet ? .26 : 1, this.voices); } catch { /* Audio failure never blocks gameplay. */ }
    }
    playClick(auto = false) { this.play('click', auto); }
    playPurchase(cat = false) { this.play(cat ? 'cat' : 'purchase'); }
    playEvent() { this.play('event'); }
    playBox() { this.play('box'); }
    playStageUp() { this.play('stage'); }
  }
  root.SoundManager = SoundManager;
})(window);
