(function (root) {
  'use strict';
  const config = Object.freeze({
    title: 'ねこぷよ',
    columns: 6, rows: 12, hiddenRows: 2,
    spawnX: 2, spawnY: 2, typeCount: 5, nextCount: 2,
    minimumGroup: 4, basePoints: 10,
    chainMultipliers: Object.freeze([0, 1, 2, 4, 8, 12, 16, 20]),
    fallInterval: 850, minimumFallInterval: 480, speedStep: 35, clearsPerSpeedStep: 24,
    lockDelay: 380, maxLockResets: 8,
    clearDuration: 560, gravityDuration: 300, chainPauseDuration: 150,
    clearRecognizeEnd: .35, clearSqueezeEnd: .75, chainToastDuration: 1300,
    repeatDelay: 155, repeatInterval: 65, softDropInterval: 48,
    keys: Object.freeze({
      ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'softDrop',
      ArrowUp: 'rotateRight', KeyX: 'rotateRight', KeyZ: 'rotateLeft',
      Space: 'hardDrop', KeyR: 'restart', KeyP: 'pause', Escape: 'pause', Enter: 'start'
    })
  });
  const cats = Object.freeze([
    { name: 'そら・たて線', color: '#afcddd', shade: '#6c97af', pattern: 'stripe' },
    { name: 'ミント・しま', color: '#b1d5c4', shade: '#689b88', pattern: 'tabby' },
    { name: 'あんず・ハチワレ', color: '#edb091', shade: '#bc8064', pattern: 'bicolor' },
    { name: 'バニラ・まる', color: '#f4e4a9', shade: '#bd9e58', pattern: 'plain' },
    { name: 'もも・ハート', color: '#e7b8d0', shade: '#b5799c', pattern: 'heart' }
  ]);
  root.Nekopuyo = Object.assign(root.Nekopuyo || {}, { config, cats });
  if (typeof module !== 'undefined') module.exports = { config, cats };
})(typeof globalThis !== 'undefined' ? globalThis : this);
