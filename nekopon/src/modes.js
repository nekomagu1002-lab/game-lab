(function (N) {
  'use strict';
  // Special-mode tuning lives here; shared cat sizes and physics stay in config.js.
  N.modeSettings = {
    pile: { count: 24, weights: [40, 32, 23, 5], minSettle: 2.5, maxSettle: 8, quietTime: 0.35, quietSpeed: 10 },
    dropTimeLimit: 5,
    timerWarning: 1,
    rapidCooldown: 0.08,
    landingDelay: 0.03
  };
  const S = N.modeSettings;
  const common = {
    clearOnGod: false, initialPile: null, timeLimit: 0,
    dropCooldown: N.config.dropCooldown, landingOnly: false,
    landingDelay: 0, allowReleaseOverlap: false, special: false
  };
  N.GAME_MODES = {
    normal: { ...common, label: '通常モード', description: '猫神様をふたつ、ひとつに。', bestKey: 'normal', clearOnGod: true },
    endless: { ...common, label: 'エンドレス', description: '猫のいるかぎり、のんびり。', bestKey: 'endless' },
    pile: { ...common, label: '猫だまり', description: '最初から、ちょっといっぱい。', bestKey: 'pile', special: true, initialPile: S.pile,
      help: `最初から${S.pile.count}匹。猫が落ち着いたら開始です。初期猫だけの合体は0点。` },
    timed: { ...common, label: 'せかせか', description: '考えていると、落ちます。', bestKey: 'timed', special: true, timeLimit: S.dropTimeLimit,
      help: `${S.dropTimeLimit}秒で現在位置から自動落下。手動でも落とせます。` },
    rapid: { ...common, label: '猫連打', description: '待たずに、ぽんぽん。', bestKey: 'rapid', special: true,
      dropCooldown: S.rapidCooldown, landingOnly: true, landingDelay: S.landingDelay, allowReleaseOverlap: true,
      help: '待たずに続けて投入。床や積まれた猫に触れるまで合体しません。' }
  };
})(globalThis.Nekopon = globalThis.Nekopon || {});
