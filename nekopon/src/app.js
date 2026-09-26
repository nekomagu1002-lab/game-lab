(function(N){
  'use strict';
  const $=id=>document.getElementById(id), C=N.config, fmt=n=>n.toLocaleString('ja-JP');
  let storage;try{storage=localStorage;}catch{storage={getItem(){throw Error('unavailable');},setItem(){throw Error('unavailable');}};}
  const save=new N.SaveStore(storage),audio=new N.Audio(save),renderer=new N.Renderer($('board'));
  const app=N.app={game:null,save,audio,renderer};
  let game=null,last=performance.now(),accumulator=0,resultAt=0,toastUntil=0,pointer=null,held=new Set(),modalKind='',uiAt=0,catalogVersion=null,auxiliaryBack=null;
  function formatTime(seconds){return `${Math.floor(seconds/60)}分${Math.floor(seconds%60)}秒`;}
  function updateSave(){save.write();$('save-warning').hidden=save.available;}
  function syncAudio(){for(const key of ['bgm','se']){$(key).textContent=key.toUpperCase()+' '+(save.data[key]?'ON':'OFF');$(key).setAttribute('aria-pressed',String(save.data[key]));}audio.sync();}
  for(const key of ['bgm','se'])$(key).onclick=()=>{audio.unlock();save.data[key]=!save.data[key];updateSave();syncAudio();};
  function clearInput(){held.clear();pointer=null;accumulator=0;}
  function actionButton(label,fn,primary=false){const b=document.createElement('button');b.textContent=label;b.className=primary?'primary':'secondary';b.onclick=()=>{audio.unlock();fn();};$('modal-actions').append(b);}
  function modal(kind,html,actions){clearInput();modalKind=kind;$('modal-body').innerHTML=html;$('modal-actions').replaceChildren();for(const a of actions)actionButton(...a);if(!$('modal').open)$('modal').showModal();}
  function closeModal(){$('modal').close();modalKind='';clearInput();last=performance.now();}
  function resume(){closeModal();if(game?.state==='paused')game.state='playing';audio.active=true;audio.sync();$('board').focus({preventScroll:true});}
  function pauseMenu(){modal('pause','<p class="eyebrow">ひとやすみ</p><h2>猫も、休憩中です。</h2><p>あわてなくても大丈夫。</p>',[['つづける',resume,true],['猫のあゆみ',()=>collection(true)],['遊び方',()=>help(true)],['タイトルへ（今回のプレイを終了）',home]]);}
  function pause(){if(!game||game.state!=='playing')return;game.state='paused';save.record(game);audio.active=false;audio.sync();pauseMenu();}
  function home(){document.body.classList.remove('is-playing');if(game)save.record(game);closeModal();game=null;app.game=null;resultAt=0;$('play-screen').hidden=true;$('title-screen').hidden=false;$('footer').hidden=false;$('title-drops').textContent=fmt(save.data.totalDrops);audio.active=true;audio.sync();$('normal').focus({preventScroll:true});}
  function start(mode){document.body.classList.add('is-playing');closeModal();audio.unlock();audio.active=true;game=new N.Game(mode);app.game=game;save.data.plays++;updateSave();renderer.effects=[];resultAt=0;catalogVersion=null;$('toast').classList.remove('visible');toastUntil=0;$('title-screen').hidden=true;$('play-screen').hidden=false;$('footer').hidden=true;$('mode-label').textContent=game.rules.label;clearInput();last=performance.now();syncUI();requestAnimationFrame(fitBoard);$('board').focus({preventScroll:true});}
  function specialModes(){
    modal('special','<p class="eyebrow">いつもと、ちょっと違う猫。</p><h2>特殊モード</h2><p class="muted">箱がいっぱいになるまで遊べます。</p><div id="special-choices" class="special-choices"></div>',[['もどる',closeModal]]);
    for(const [id,mode] of Object.entries(N.GAME_MODES)){
      if(!mode.special)continue;
      const button=document.createElement('button');button.className='secondary';button.dataset.mode=id;
      const label=document.createElement('strong'),description=document.createElement('span');
      label.textContent=mode.label;description.textContent=mode.description;button.append(label,description);
      button.onclick=()=>start(id);$('special-choices').append(button);
    }
  }
  $('special').onclick=specialModes;
  $('normal').onclick=()=>start('normal');$('endless').onclick=()=>start('endless');$('pause').onclick=pause;
  $('home').onclick=e=>{e.preventDefault();if(game?.state==='playing')pause();else if(!game)home();};
  function catalog(target){target.replaceChildren();C.cats.forEach((cat,i)=>{const known=save.data.discovered.includes(i),li=document.createElement('li'),rank=document.createElement('span'),canvas=document.createElement('canvas'),name=document.createElement('span');rank.className='rank';rank.textContent=String(i+1).padStart(2,'0');canvas.width=84;canvas.height=84;N.drawCat(canvas.getContext('2d'),i,42,45,29,0,!known);name.textContent=known?cat.name:'？？？';if(!known)name.className='locked';li.append(rank,canvas,name);target.append(li);});}
  function help(fromPause=false){const wasPlaying=game?.state==='playing';auxiliaryBack=fromPause===true?pauseMenu:(wasPlaying?resume:closeModal);if(wasPlaying){game.state='paused';audio.active=false;audio.sync();}modal('help','<p class="eyebrow">ぽん、と落として、猫だらけ。</p><h2>遊び方</h2><p>同じ猫をくっつけると、ひとつ上の猫に。猫神様どうしが出会うと、光になって消えます。</p><p><strong>PC：</strong>マウスで左右にねらい、クリック。左右キーで移動、Space / Enterで落下。P / Escapeで一時停止。</p><p><strong>スマホ：</strong>箱の中をタッチして、横にドラッグ。指を離すと落下。箱の外で離すとキャンセル。</p><p>点線を約2.8秒こえ続けると終了。落下直後と合体直後には猶予があります。</p><p>通常モードは猫神様2体の消滅でクリア。エンドレスは箱がいっぱいになるまで続きます。</p>'+Object.values(N.GAME_MODES).filter(mode=>mode.special).map(mode=>`<p><strong>${mode.label}：</strong>${mode.help}</p>`).join(''),[[fromPause===true?'一時停止へ':'わかった',auxiliaryBack,true]]);}
  for(const id of ['help-title','help-play','help-mobile'])$(id).onclick=help;
  function rows(values){return '<dl class="record-list">'+values.map(([a,b])=>`<div><dt>${a}</dt><dd>${b}</dd></div>`).join('')+'</dl>';}
  $('records').onclick=()=>{const d=save.data;modal('records','<p class="eyebrow">猫との日々</p><h2>これまでの記録</h2>'+rows([...Object.values(N.GAME_MODES).map(mode=>[mode.label+' BEST',fmt(d.best[mode.bestKey])]),['通算落下猫数',fmt(d.totalDrops)+' 匹'],['通算プレイ回数',fmt(d.plays)+' 回'],['猫神様消滅回数',fmt(d.gods)+' 回'],['最大到達猫',d.maxLevel>=0?C.cats[d.maxLevel].name:'まだ、これから'],['最少クリア落下数',d.bestClearDrops?fmt(d.bestClearDrops)+' 匹':'—'],['最短クリア時間',d.bestClearTime?formatTime(d.bestClearTime):'—']]),[['もどる',closeModal,true]]);};
  function collection(fromPause=false){if(game?.state==='playing'){game.state='paused';audio.active=false;audio.sync();}auxiliaryBack=fromPause===true?pauseMenu:resume;modal('collection','<h2>猫のあゆみ</h2><p class="muted">出会った猫は、ずっと記録されます。</p><ol id="modal-catalog" class="catalog"></ol>',[[fromPause===true?'一時停止へ':'つづける',auxiliaryBack,true]]);catalog($('modal-catalog'));}
  $('collection').onclick=()=>collection();
  $('modal').addEventListener('cancel',e=>{e.preventDefault();if(modalKind==='pause')resume();else if(['help','collection'].includes(modalKind)&&auxiliaryBack)auxiliaryBack();else if(modalKind!=='result')closeModal();});
  function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');toastUntil=performance.now()+1800;}
  function processEvents(){if(!game)return;let dirty=false;
    for(const e of game.drain()){
      renderer.event(e);
      if(e.type==='discover'){const fresh=!save.data.discovered.includes(e.level);save.discover(e.level);dirty=true;if(fresh&&e.level>=4)toast('はじめまして、'+C.cats[e.level].name+'。');}
      if(e.type==='drop'){save.data.totalDrops++;dirty=true;audio.sound('drop');}
      if(e.type==='contact')audio.sound('contact');
      if(e.type==='merge')audio.sound('merge',e.level,e.chain);
      if(e.type==='god'){save.data.gods++;dirty=true;audio.sound('god');toast('猫神様が消えました。たぶんめでたい。');}
      if(e.type==='clear'||e.type==='over'){save.record(game);resultAt=performance.now()+(e.type==='clear'?1500:850);audio.sound(e.type);clearInput();}
    }
    if(dirty){save.data.best[game.rules.bestKey]=Math.max(save.data.best[game.rules.bestKey],game.score);updateSave();}
  }
  function result(){resultAt=0;const clear=game.state==='clear',mode=game.mode;modal('result',`<p class="eyebrow">${clear?'CLEAR · たぶんめでたいです':'ひとまず、おひらき。'}</p><h2>${clear?'猫神様は、光のなかへ。':'猫がいっぱいです。'}</h2><p>${clear?'箱から宇宙へ。おめでとうございます。':'よく集まりました。また、ぽんとどうぞ。'}</p><p class="result-score">${fmt(game.score)} <span class="muted">点</span></p>`+rows([['モード',game.rules.label],['最大到達猫',game.maxLevel>=0?C.cats[game.maxLevel].name:'—'],['落下猫数',fmt(game.drops)+' 匹'],['プレイ時間',formatTime(game.time)],['猫神様消滅回数',fmt(game.gods)+' 回']]),[['もう一度',()=>start(mode),true],['タイトルへ',home]]);}
  function readyText(){
    if(game.state!=='playing')return 'ひとやすみ';
    if(game.preparing)return '猫をならべています';
    if(game.time<game.readyAt)return 'ひと呼吸…';
    if(game.rules.timeLimit)return 'あと '+game.remaining.toFixed(1)+'秒';
    return game.rules.allowReleaseOverlap?'ぽんぽん、どうぞ':'ぽん、とどうぞ';
  }
  function syncUI(){if(!game)return;$('score').textContent=fmt(game.score);$('best').textContent=fmt(Math.max(game.score,save.data.best[game.rules.bestKey]));$('drops').textContent=fmt(game.drops);$('total-drops').textContent=fmt(save.data.totalDrops);$('next-name').textContent=C.cats[game.next].name;$('current-name').textContent=game.preparing?'準備中':C.cats[game.current].name+'を落とす';$('ready').textContent=readyText();$('ready').classList.toggle('is-urgent',Boolean(game.rules.timeLimit&&game.state==='playing'&&game.remaining<=N.modeSettings.timerWarning));const ctx=$('next-cat').getContext('2d');ctx.clearRect(0,0,150,105);N.drawCat(ctx,game.next,75,59,32);const version=save.data.discovered.join(',');if(version!==catalogVersion){catalogVersion=version;catalog($('catalog'));$('found-count').textContent=save.data.discovered.length+' / 10';}}
  function aim(event){const r=$('board').getBoundingClientRect();game.aim((event.clientX-r.left)/r.width*C.width);}
  function drop(){audio.unlock();if(!game.drop())toast(game.preparing?'猫をならべています。もう少し。':'猫が落ち着くまで、ひと呼吸。');processEvents();syncUI();}
  $('board').addEventListener('pointerdown',e=>{if(e.button!==0||!e.isPrimary||game?.state!=='playing')return;e.preventDefault();pointer=e.pointerId;aim(e);$('board').setPointerCapture(e.pointerId);$('board').focus({preventScroll:true});audio.unlock();});
  $('board').addEventListener('pointermove',e=>{if(game?.state==='playing'&&(e.pointerType==='mouse'||pointer===e.pointerId))aim(e);});
  $('board').addEventListener('pointerup',e=>{if(e.pointerId!==pointer)return;pointer=null;if($('board').hasPointerCapture(e.pointerId))$('board').releasePointerCapture(e.pointerId);const r=$('board').getBoundingClientRect();if(game?.state==='playing'&&e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom){aim(e);drop();}});
  $('board').addEventListener('pointercancel',()=>{pointer=null;});$('board').addEventListener('lostpointercapture',()=>{pointer=null;});
  document.addEventListener('keydown',e=>{if($('modal').open)return;if(game?.state!=='playing')return;if(e.code==='Escape'||e.code==='KeyP'){e.preventDefault();pause();return;}if(e.target.tagName==='BUTTON'||e.target.tagName==='A')return;if(['ArrowLeft','ArrowRight','Space','Enter'].includes(e.code)){e.preventDefault();if(e.repeat||held.has(e.code))return;held.add(e.code);if(e.code==='Space'||e.code==='Enter')drop();}});
  document.addEventListener('keyup',e=>held.delete(e.code));
  window.addEventListener('blur',()=>{clearInput();pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();pause();audio.active=false;audio.sync();}else if(!game){audio.active=true;audio.sync();}});
  window.addEventListener('pagehide',()=>{if(game)save.record(game);});
  const compactLayout=matchMedia('(max-width: 767px), (max-width: 1023px) and (max-height: 540px)');
  function arrangeControls(){
    const host=compactLayout.matches?$('play-screen'):document.querySelector('.stats-panel');
    host.append($('play-controls'));
    requestAnimationFrame(fitBoard);
  }
  function fitBoard(){
    if($('play-screen').hidden)return;
    const column=document.querySelector('.board-column');
    const heading=column.querySelector('.board-heading').getBoundingClientRect().height;
    const caption=$('board-caption').getBoundingClientRect().height;
    const height=Math.max(0,column.clientHeight-heading-caption);
    const width=Math.min(column.clientWidth,height*C.width/C.height);
    const boardHeight=width*C.height/C.width;
    if(pointer!==null&&Math.abs($('board').getBoundingClientRect().width-width)>.5){
      if($('board').hasPointerCapture(pointer))$('board').releasePointerCapture(pointer);
      pointer=null;
    }
    $('board').style.width=width+'px';$('board').style.height=boardHeight+'px';
    $('board').parentElement.style.setProperty('--board-display-height',boardHeight+'px');
  }
  compactLayout.addEventListener('change',arrangeControls);
  new ResizeObserver(fitBoard).observe(document.querySelector('.board-column'));
  window.visualViewport?.addEventListener('resize',fitBoard);
  arrangeControls();
  function frame(now){const dt=Math.min((now-last)/1000,.05);last=now;
    if(game){if(game.state==='playing'){accumulator+=dt;while(accumulator>=C.step){if(held.has('ArrowLeft'))game.aim(game.x-320*C.step);if(held.has('ArrowRight'))game.aim(game.x+320*C.step);game.step();accumulator-=C.step;}processEvents();}renderer.draw(game,dt);if(now-uiAt>80){syncUI();uiAt=now;}if(resultAt&&now>=resultAt)result();}
    if(toastUntil&&now>toastUntil){$('toast').classList.remove('visible');toastUntil=0;}audio.tick();requestAnimationFrame(frame);
  }
  syncAudio();$('title-drops').textContent=fmt(save.data.totalDrops);$('save-warning').hidden=save.available;N.drawHero($('hero'));requestAnimationFrame(frame);
})(globalThis.Nekopon=globalThis.Nekopon||{});
