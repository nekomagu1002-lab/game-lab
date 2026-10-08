/* 単位: 猫1段、秒。惑星物理はこのプロファイル定義だけで変更できます。
 * 速度倍率は各方向の物理時計だけを変え、経過時間・供給・危険・入力には影響しません。
 * upwardAccelerationは符号付き（負なら上昇を減速）。供給猫の降下は別設定。
 */
const BASIC_PLANET_PHYSICS = {
  horizontalLaunchPower3: 24.2, horizontalLaunchPower4: 30, horizontalLaunchPower5: 36,
  verticalLaunchPower3: 36, verticalLaunchPower4: 42, verticalLaunchPower5: 48,
  upwardInitialVelocity: 18.9, launchVelocityReferencePower: 25.2,
  upwardAcceleration: -13, maxUpwardSpeed: 36, upwardSpeedScale: 1,
  downwardAcceleration: 3, maxFallSpeed: 2.4, downwardSpeedScale: 1,
  apexHoldTime: 0.08,
  blockWeight: 1, weightPenalty: 0.65, minimumLaunchSpeed: 3,
  extraIgnitionBoost: 1.05,
  chainMultipliers: [1, 1.25, 1.6, 2, 2.4, 2.8], maxChainLevel: 6,
  supplyDownwardAcceleration: 9, supplyInitialVelocity: 12
};
const planetPhysics = overrides => ({...BASIC_PLANET_PHYSICS,...overrides,chainMultipliers:[...(overrides.chainMultipliers??BASIC_PLANET_PHYSICS.chainMultipliers)]});
const standardBgm = () => ({earlyTrack:'stage01_standard_early',lateTrack:'stage01_standard_late',switchMode:'occupancy',lateThreshold:0.55,earlyThreshold:0.45,crossFadeDuration:1.2});
globalThis.GAME_CONFIG = {
  boardWidth: 8, boardHeight: 12, initialRows: 3, catTypes: 5,
  spawnInterval: 3, spawnCount: [3, 5],
  planetId: 'basic',
  planetProfiles: {
    basic: {name: '基本惑星', soundSet: 'standard', bgm: standardBgm(), physics: planetPhysics({})},
    // 将来用の実験例。Dの惑星選択で試せます。追加はこの表への定義だけ。
    planetA: {name: '惑星A（対称）', soundSet: 'standard', bgm: standardBgm(), physics: planetPhysics({downwardAcceleration:13,maxFallSpeed:36,apexHoldTime:0})},
    planetB: {name: '惑星B（遅い上昇・速い下降）', soundSet: 'standard', bgm: standardBgm(), physics: planetPhysics({upwardSpeedScale:0.5,downwardSpeedScale:2,downwardAcceleration:13,maxFallSpeed:36})},
    planetC: {name: '惑星C（速い上昇・遅い下降）', soundSet: 'standard', bgm: standardBgm(), physics: planetPhysics({upwardSpeedScale:1.8,downwardSpeedScale:0.4,apexHoldTime:0.18})}
  },
  // 音量・抑制はここで調整。既存UIと同じく初期状態は音OFF。
  audio: {
    masterVolume: 1, seVolume: 1, mixHeadroom: 0.85, maxVoices: 6,
    defaultPerSoundLimit: 2, perSoundLimits: {swap:1,catLand:1,launchSuccess:1,stageJingle:1,gameOver:1},
    defaultCooldownMs: 100, cooldowns: {swap:60,catLand:120,launchSuccess:350,fusion:100,fastOn:80,fastOff:80,dangerStart:0,stageJingle:0,gameOver:0},
    launchGroupCooldownMs: 600, blockLandThresholds: [5,15],
    lowPriorityDuck: 0.2, otherPriorityDuck: 0.55,
    eventQueueLimit: 256, diagnosticLimit: 200, maxVoiceLifetimeMs: 10000,
    soundVolume: {swap:0.20,catLand:0.30,igniteSmall:0.65,igniteLarge:0.75,igniteVertical:0.75,
      chain:0.80,fusion:0.70,blockLandSmall:0.40,blockLandMedium:0.60,blockLandLarge:0.80,
      launchSuccess:0.70,fast:0.50,dangerStart:0.90,gameOver:0.90,stageJingle:0.85,milestone:0.35}
  },
  bgm: {
    common: {title:'title',stageSelect:'stage_select'},
    masterVolume:1,bgmVolume:0.65,pauseVolumeScale:0.4,
    formatPriority:['mp3','mid'],crossFadeDuration:1.2,menuFadeDuration:0.6,
    fadeInDuration:0.4,gameOverFadeDuration:0.8,loadTimeoutMs:5000,
    midiModule:'./js/audio/midi-player.js?v=20261008-bgm-1',
    midiSynth:{lookAhead:0.2,maxVoices:48,voiceGain:0.08}
  },
  difficultyEnabled: true, difficultyTurnTime: 180,
  spawnIntervalDecreasePerMinute: 0.3, spawnCountIncreasePerMinute: 0.65,
  lateSpawnIntervalDecreasePerSecond: 0.02, lateSpawnCountIncreasePerSecond: 0.06,
  minimumSpawnInterval: 0.65,
  rushEnabled: true, rushPeriod: 18, rushWaves: [2, 4], rushWaveInterval: [0.3, 0.6],
  dangerLine: 11, dangerLimit: 5, dangerRecoveryRate: 2,
  // ラインの描画位置は維持。危険な静止猫の段を従来より1段上へ。
  dangerRowOffset: 1, dangerColumnBlinkPeriod: 0.65,
  dangerColumnAlpha: [0.06, 0.18], dangerRescueColumnAlpha: 0.045,
  // 射出ラインは盤面上端+ejectMargin。猫の中心が越えたら射出。
  ejectMargin: 1,
  // 着地して静止した時間のみ再生待ちへ加算。供給倍率は供給タイマーだけに適用。
  burntRegenTime: 4, feedFastMultiplier: 3.0,
  // 落下する過去の打ち上げグループ同士が接触したとみなす段数の許容差。
  fusionContactTolerance: 0.06,
  // セル中央10%では直前の交換方向を維持。交換スライドは入力を止めない。
  swapFocusDeadZone: 0.10, swapAnimationDuration: 120,
  dragStartDistanceCells: 0.18, dragHorizontalCancelCells: 1.25,
  // 時間フェーズの表示だけを調整。供給・物理・難易度の境界は変更しない。
  timeMilestones: [60, 120, 180], timeMilestoneDurations: [1.6, 2.1, 2.8],
  timeMilestoneScales: [1.25, 1.38, 1.55], timeMilestoneBlinks: [2, 3, 4],
  timeMilestoneGlow: [0.35, 0.65, 1], timeMilestoneShakePixels: [0, 1.5, 3],
  timeMilestoneShakeDuration: [0, 0.18, 0.26], timeMilestoneBlinkDepth: 0.55,
  timePhaseSounds: ['timePhase60', 'timePhase120', 'timePhase180'],
  dangerGaugeBlinkThreshold: 0.70
};
if (typeof module !== 'undefined') module.exports = GAME_CONFIG;
