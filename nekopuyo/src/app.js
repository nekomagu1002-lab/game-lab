(function () {
  'use strict';
  const N = window.Nekopuyo;
  const game = new N.Game();
  const $ = id => document.getElementById(id);
  const renderer = new N.Renderer($('board'), $('next'));
  let lastTime = 0, toastRemaining = 0, previousState = '', previousText = '';
  document.title = N.config.title;
  document.querySelectorAll('[data-game-title]').forEach(element => { element.textContent = N.config.title; });
  const text = (id, value) => { const element = $(id); if (element.textContent !== String(value)) element.textContent = value; };
  function action(name) {
    switch (name) {
      case 'left': game.move(-1); break;
      case 'right': game.move(1); break;
      case 'rotateLeft': game.rotate(-1); break;
      case 'rotateRight': game.rotate(1); break;
      case 'softDrop': game.softDrop(); break;
      case 'hardDrop': game.hardDrop(); break;
      case 'restart': game.reset(); renderer.particles = []; toastRemaining = 0; break;
      case 'pause': if (game.state === 'paused') game.resume(); else game.pause(); break;
      case 'start':
        if (game.state === 'ready') game.start();
        else if (game.state === 'gameover') { game.reset(); renderer.particles = []; toastRemaining = 0; }
        else if (game.state === 'paused') game.resume();
        break;
    }
    sync();
  }
  const input = new N.Input(action, game);
  $('main-action').addEventListener('click', () => action('start'));
  $('restart').addEventListener('click', () => action('restart'));
  $('pause').addEventListener('click', () => action('pause'));
  function sync() {
    text('score', game.score.toLocaleString('ja-JP')); text('max-chain', game.maxChain); text('cleared-count', game.clearedCount);
    input?.synchronize();
    game.drainEvents().forEach(event => {
      if (event.type === 'clear') {
        toastRemaining = N.config.chainToastDuration;
        text('chain-toast', event.chain > 1 ? `${event.chain}れんさ！` : 'むぎゅっ、ポン！');
        text('announcement', `${event.chain}連鎖、${event.count}匹消去。スコア${game.score}点。`);
      } else if (event.type === 'pop') renderer.pop(event.cells);
      else if (event.type === 'gameover') text('announcement', `ゲームオーバー。スコア${game.score}点、最大${game.maxChain}連鎖。`);
    });
    $('chain-toast').classList.toggle('visible', toastRemaining > 0 && !['paused', 'gameover'].includes(game.state));
    const stateLabel = { ready: '準備できた？', playing: 'のんびり、くっつけよう', clearing: `${game.chain}れんさ！`, falling: 'ころん、ころん', chainPause: 'ぴたっ、つぎは…', paused: 'ひとやすみ', gameover: 'また、あそぼう' }[game.state];
    text('state-label', stateLabel);
    $('pause').disabled = ['ready', 'gameover'].includes(game.state);
    const pauseText = game.state === 'paused' ? '<span aria-hidden="true">▷</span> つづける <kbd>P</kbd>' : '<span aria-hidden="true">Ⅱ</span> 一時停止 <kbd>P</kbd>';
    if (pauseText !== previousText) { $('pause').innerHTML = pauseText; previousText = pauseText; }
    if (previousState === game.state) return;
    previousState = game.state;
    $('overlay').hidden = !['ready', 'paused', 'gameover'].includes(game.state);
    if (game.state === 'ready') {
      text('overlay-eyebrow', "LET'S GET COZY"); text('overlay-title', 'のんびり、ひと勝負。');
      $('overlay-description').innerHTML = '2匹ずつ、ころん。<br>同じ猫を4匹つなげよう。';
      $('main-action').innerHTML = 'あそぶ <span aria-hidden="true">→</span>'; text('start-hint', 'Enter キーでもスタート');
    } else if (game.state === 'paused') {
      text('overlay-eyebrow', 'TAKE A LITTLE BREAK'); text('overlay-title', 'ちょっと、ひとやすみ。');
      $('overlay-description').innerHTML = '猫たちも、お昼寝中。<br>準備ができたら、つづきを。';
      text('main-action', 'つづける'); text('start-hint', 'P / Enter キーでつづける');
    } else if (game.state === 'gameover') {
      text('overlay-eyebrow', 'THANK YOU FOR PLAYING'); text('overlay-title', 'おつかれさま。');
      $('overlay-description').innerHTML = `SCORE ${game.score.toLocaleString('ja-JP')}<br>最大 ${game.maxChain} れんさ・${game.clearedCount} 匹`;
      text('main-action', 'もういちど あそぶ'); text('start-hint', 'R / Enter キーでもういちど');
    }
    N.drawDecorations();
  }
  function autoPause() { if (game.pause()) sync(); input.releaseAll(); }
  window.addEventListener('blur', autoPause);
  document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); lastTime = 0; });
  window.addEventListener('resize', () => { N.drawDecorations(); renderer.draw(game); });
  function frame(now) {
    const dt = lastTime ? Math.min(now - lastTime, 50) : 0; lastTime = now;
    input.tick(dt); game.tick(dt);
    if (game.state !== 'paused') toastRemaining = Math.max(0, toastRemaining - dt);
    sync(); renderer.draw(game, game.state === 'paused' ? 0 : dt);
    requestAnimationFrame(frame);
  }
  // Deliberately opt-in test access. Normal play does not expose mutable game state.
  if (new URLSearchParams(location.search).has('test')) window.__NEKOPUYO_TEST__ = { game, action, renderer, input, sync };
  sync(); N.drawDecorations(); renderer.draw(game); requestAnimationFrame(frame);
})();
