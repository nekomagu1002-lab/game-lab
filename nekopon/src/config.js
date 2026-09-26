(function (N) {
  'use strict';
  N.config = {
    width: 480, height: 660, wall: 14, floor: 640, dangerY: 112, spawnY: 54,
    step: 1 / 120, gravity: 540, restitution: 0.025, friction: 0.22,
    airDrag: 0.22, maxSpeed: 290, maxRiseSpeed: 70, maxAngularSpeed: 2, solverIterations: 10,
    angularDamping: 2.6, restingAngularDamping: 12, angularStopThreshold: 0.045,
    restingSpeed: 14, rollingMinSpeed: 12, floorBounceThreshold: 18,
    dropCooldown: 0.48, dropDrift: 4, spawnGrace: 1.35, mergeGrace: 0.8, dangerDuration: 2.8,
    growthDuration: 0.55, mergeDamping: 0.18, godScore: 12000,
    spawnWeights: [35, 30, 22, 13],
    cats: [
      ['チビ', 17, '#fff0bf', 10], ['子猫', 22, '#efbfd6', 25],
      ['猫', 27, '#9dccbd', 55], ['デブ猫', 32, '#e6a080', 110],
      ['巨猫', 39, '#a7c6e5', 230], ['侍猫', 48, '#a6c5b2', 480],
      ['殿様猫', 59, '#ceafe0', 1000], ['仙猫', 73, '#bce3db', 2100],
      ['超猫', 90, '#dec9ed', 4300], ['猫神様', 108, '#f5dc8d', 9000]
    ].map(([name, radius, color, score]) => ({ name, radius, color, score }))
  };
})(globalThis.Nekopon = globalThis.Nekopon || {});
