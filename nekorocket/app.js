/* Canvas描画と入力。engine.jsはDOM非依存。 */
(() => {
  const $=id=>document.getElementById(id), canvas=$('board'),ctx=canvas.getContext('2d');
  const build='20261008-rescue-source-1';
  const game=new RocketGame(GAME_CONFIG),audio=new SoundManager(SoundManifest,GAME_CONFIG.audio),bgm=new BgmManager(BgmManifest,GAME_CONFIG.bgm),gameBgm=new GameBgm(game,bgm,GAME_CONFIG.bgm),gameAudio=new GameAudio(game,audio,gameBgm);
  let scene='title';
  window.nekoRocket={game,build,audio,bgm,gameBgm,scene:()=>scene,
    setMasterVolume(value){audio.setMasterVolume(value);bgm.setMasterVolume(value);},setBgmMuted(value){bgm.setMuted(value);},setSeMuted(value){audio.setMuted(value);}};
  const colors=['#ffe16b','#f38eb8','#64cf9a','#f59a52','#83b9ff'];
  const outlines=['#927019','#9a355f','#246b4a','#954518','#315d9c'];
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let touchDrag=null,paused=false,last=performance.now(),fps=60,seen=0;
  let pointer=null,focusDirection=1,renderedPair=null;
  let mousePress=null;
  let lastPress=null,lastTraceTime=-Infinity;
  const dragTrace=[];
  const slides=new Map();
  let previousTime=0,milestone=null;
  function resetTimeUI(){previousTime=0;milestone=null;}
  function updateTimeUI(){
    if(game.time<previousTime)resetTimeUI();
    let stage=0;
    game.c.timeMilestones.forEach((t,i)=>{if(game.time>=t)stage=i+1;if(previousTime<t&&game.time>=t){milestone={stage:i+1,start:game.time};}});
    if(milestone&&milestone.start===game.time&&previousTime<game.time)audio.playTimePhase(game.c.timePhaseSounds[milestone.stage-1]);
    previousTime=game.time;
    const seconds=Math.max(0,Math.floor(game.time));$('elapsed').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
    $('timer').dataset.stage=stage;
    let strength=0,active=false,shake=0;
    if(milestone){const i=milestone.stage-1,progress=(game.time-milestone.start)/game.c.timeMilestoneDurations[i];active=progress<1;
      if(active){const wave=(1-Math.cos(progress*Math.PI*2*game.c.timeMilestoneBlinks[i]))/2;strength=reducedMotion?.55:wave;$('timer').style.setProperty('--time-scale',String(reducedMotion?1:1+(game.c.timeMilestoneScales[i]-1)*wave));$('timer').style.setProperty('--time-opacity',String(reducedMotion?1:1-wave*game.c.timeMilestoneBlinkDepth));
        const elapsed=game.time-milestone.start,duration=game.c.timeMilestoneShakeDuration[i];if(!reducedMotion&&elapsed<duration)shake=Math.sin(elapsed*Math.PI*2*23)*game.c.timeMilestoneShakePixels[i]*(1-elapsed/duration);
      }
      else milestone=null;
    }
    if(!active){$('timer').style.setProperty('--time-scale','1');$('timer').style.setProperty('--time-opacity','1');}
    $('timer').dataset.celebrating=String(active);$('timer').dataset.milestone=active?milestone.stage:'';
    $('stageLabel').textContent=active?['ペースアップ','降下加速','RUSH MODE'][milestone.stage-1]:'';
    return {stage:active?milestone.stage:0,strength,shake};
  }
  const findCat=id=>game.cats.find(b=>b.id===id);
  const dragY=y=>Math.max(0,Math.min(game.dragCeiling()??game.c.boardHeight-1,y));
  function clipDrag(s){const top=(game.c.boardHeight-(game.dragCeiling()??game.c.boardHeight-1))*s;ctx.beginPath();ctx.rect(0,top,canvas.width,canvas.height-top);ctx.clip();}
  function visualY(b,now=performance.now()){const slide=slides.get(b.id);let y=game.worldY(b);if(slide){const p=Math.min(1,(now-slide.start)/game.c.swapAnimationDuration),ease=p*p*(3-2*p);y+=slide.delta*(1-ease);}return mousePress?.active&&mousePress.catId===b.id?dragY(y):y;}
  function traceDrag(event,e=null){
    const press=mousePress||lastPress;if(!press)return;
    const b=findCat(press.catId),g=b&&game.groups.find(g=>g.id===b.group),r=canvas.getBoundingClientRect(),s=r.width/game.c.boardWidth;
    const clientY=e?.clientY??pointer?.y,world=Number.isFinite(clientY)?game.c.boardHeight+1-(clientY-r.top)/s:null;
    dragTrace.push({event,now:performance.now(),gameTime:game.time,active:!!mousePress?.active,buttons:e?.buttons??null,pointerType:e?.pointerType??null,pointer:{x:e?.clientX??pointer?.x??null,y:clientY??null,world,row:world===null?null:Math.max(0,Math.min(game.c.boardHeight-1,Math.floor(world)))},board:{top:r.top+s,bottom:r.bottom,cell:s,height:game.c.boardHeight},target:press.catId,cat:b?{x:b.x,localY:b.y,worldY:game.worldY(b),visualY:visualY(b),group:b.group,powered:!!g?.powered,offset:g?.offset??0,velocity:g?.v??0}:null,swaps:game.drag?.swaps??null,ejected:game.ejected});
    const entry=dragTrace.at(-1);entry.ceiling=game.dragCeiling();entry.localCeiling=game.drag?.maxY??null;
    if(dragTrace.length>400)dragTrace.shift();
  }
  window.nekoRocket.dragDiagnostics=()=>({build,engineBuild:RocketGame.build??'unknown',url:location.href,userAgent:navigator.userAgent,devicePixelRatio,events:dragTrace});
  function exchange(pair){
    if(!pair)return false;
    const cats=pair.ids.map(findCat).filter(Boolean),before=cats.map(b=>visualY(b));
    if(!game.swapCells(pair.x,pair.lowerY,pair.group,pair.ids))return false;
    if(!reducedMotion){const start=performance.now();cats.forEach((b,i)=>slides.set(b.id,{start,delta:before[i]-game.worldY(b)}));}
    // クリック時は描画済みの組を使用。次フレーム前の連打も同じ2セルで処理。
    const group=cats[0]?.group??null;
    renderedPair=game.cellPair(pair.x,pair.lowerY,group);
    return true;
  }
  function finishMousePress(click=false){
    const press=mousePress;if(!press)return;traceDrag(click?'release-before':'cancel-before');lastPress=press;mousePress=null;
    if(press.active)game.endDrag();else if(click)exchange(press.pair);
    traceDrag(click?'release-after':'cancel-after');
    if(canvas.hasPointerCapture(press.pointerId))canvas.releasePointerCapture(press.pointerId);
  }
  function clearInput(){finishMousePress();touchDrag=null;pointer=null;renderedPair=null;slides.clear();focusDirection=1;}
  window.nekoRocket.uiSnapshot=()=>({pair:renderedPair,selected:null,drag:mousePress?.active?{id:mousePress.catId,x:mousePress.x,originWorld:mousePress.originWorld,swaps:game.drag?.swaps||0}:null,slides:[...slides.keys()],positions:game.cats.map(b=>({id:b.id,y:visualY(b)}))});
  function resize(){const box=canvas.parentElement.getBoundingClientRect();const ratio=game.c.boardWidth/(game.c.boardHeight+1);const h=Math.min(box.height,box.width/ratio);canvas.style.height=h+'px';canvas.style.width=h*ratio+'px';for(const id of ['dangerPanel','boardStats','boardTop'])$(id).style.width=h*ratio+'px';const d=window.devicePixelRatio||1;canvas.width=Math.round(h*ratio*d);canvas.height=Math.round(h*d);}
  new ResizeObserver(resize).observe(canvas.parentElement);
  function cat(b,s){const g=game.groups.find(g=>g.id===b.group),x=(b.x+.5)*s,y=(game.c.boardHeight+.5-visualY(b))*s;
    ctx.save();if(mousePress?.active&&mousePress.catId===b.id)clipDrag(s);ctx.translate(x,y);
    if(g?.powered){const strength=Math.min(.16,Math.max(0,g.chainLevel-1)*.03);ctx.fillStyle=g.v>0?(g.chainLevel>=4?'#ffdb76':'#ffb968'):'#8dc8f4';ctx.globalAlpha=.75+strength*.5;ctx.beginPath();ctx.moveTo(-s*.18,s*.3);ctx.lineTo(0,s*(.6+strength+Math.sin(game.time*25)*.08));ctx.lineTo(s*.18,s*.3);ctx.fill();ctx.globalAlpha=1;}
    ctx.fillStyle=b.burnt?'#34383e':colors[b.type];ctx.strokeStyle=b.burnt?'#a1a8b1':outlines[b.type];ctx.lineWidth=Math.max(1.5,s*.04);
    // 約96%のセル幅・高さ。耳と頬の形も種類ごとに変える。
    const ear=b.burnt?.40:[.44,.38,.46,.34,.43][b.type],corner=b.burnt?.12:[.09,.19,.07,.23,.13][b.type];
    ctx.beginPath();ctx.moveTo(-s*.47,-s*.15);ctx.lineTo(-s*ear,-s*.46);ctx.lineTo(-s*.19,-s*.26);ctx.lineTo(s*.19,-s*.26);ctx.lineTo(s*ear,-s*.46);ctx.lineTo(s*.47,-s*.15);ctx.lineTo(s*.47,s*(.46-corner));ctx.quadraticCurveTo(s*.47,s*.46,s*(.47-corner),s*.46);ctx.lineTo(-s*(.47-corner),s*.46);ctx.quadraticCurveTo(-s*.47,s*.46,-s*.47,s*(.46-corner));ctx.closePath();ctx.fill();ctx.stroke();
    if(b.burnt){
      // 元の種類の色・模様を残さない、共通の濃いグレーの燃えカス。
      ctx.strokeStyle='#d5dae0';ctx.lineWidth=Math.max(1.4,s*.035);
      for(const sign of [-1,1]){const x=sign*s*.2;ctx.beginPath();ctx.moveTo(x-s*.05,s*.05);ctx.lineTo(x+s*.05,s*.15);ctx.moveTo(x+s*.05,s*.05);ctx.lineTo(x-s*.05,s*.15);ctx.stroke();}
      ctx.beginPath();ctx.moveTo(-s*.1,s*.3);ctx.lineTo(0,s*.26);ctx.lineTo(s*.1,s*.3);ctx.stroke();
      ctx.strokeStyle='#838b95';ctx.beginPath();ctx.moveTo(-s*.08,-s*.23);ctx.lineTo(s*.03,-s*.12);ctx.lineTo(-s*.04,-s*.02);ctx.stroke();ctx.restore();return;
    }
    function patch(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x*s,y*s,rx*s,ry*s,0,0,Math.PI*2);ctx.fill();}
    if(b.type===0){ctx.fillStyle='#fff7d9';ctx.beginPath();ctx.moveTo(0,-s*.24);ctx.lineTo(s*.12,-s*.04);ctx.lineTo(0,s*.08);ctx.lineTo(-s*.12,-s*.04);ctx.fill();}
    if(b.type===1){ctx.fillStyle='#a83065';ctx.beginPath();ctx.moveTo(0,-s*.13);ctx.bezierCurveTo(-s*.3,-s*.27,-s*.18,-s*.43,0,-s*.3);ctx.bezierCurveTo(s*.18,-s*.43,s*.3,-s*.27,0,-s*.13);ctx.fill();patch(-.33,.23,.08,.055,'#ffcbdc');patch(.33,.23,.08,.055,'#ffcbdc');}
    if(b.type===2){ctx.strokeStyle='#1c7048';ctx.lineWidth=s*.075;for(const x of [-.19,0,.19]){ctx.beginPath();ctx.moveTo(x*s,-s*.26);ctx.lineTo(x*s*.75,-s*.08);ctx.stroke();}patch(0,.32,.26,.1,'#dffce9');}
    if(b.type===3){patch(-.32,-.13,.14,.18,'#773a28');patch(.31,.3,.14,.12,'#fff5df');patch(0,.32,.24,.095,'#ffe3c0');}
    if(b.type===4){patch(0,.23,.32,.2,'#eef6ff');ctx.fillStyle='#285b9e';ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?.065:.15;ctx.lineTo(Math.cos(a)*r*s,(-.18+Math.sin(a)*r)*s);}ctx.closePath();ctx.fill();}
    ctx.fillStyle='#263c44';ctx.strokeStyle='#263c44';ctx.lineWidth=Math.max(1.4,s*.035);for(const sign of [-1,1]){ctx.beginPath();ctx.arc(sign*s*.2,s*.105,s*.045,0,Math.PI*2);ctx.fill();}ctx.beginPath();ctx.moveTo(-s*.09,s*.27);ctx.quadraticCurveTo(0,s*.36,s*.09,s*.27);ctx.stroke();
    ctx.restore();
  }
  function drawPair(s){
    if(mousePress?.active){drawDrag(s);return;}
    const pair=(scene==='game'&&!paused&&!game.over&&!$('debug').open)?focusAtPointer():null;
    renderedPair=pair;
    if(!pair){canvas.dataset.swapPair='';canvas.dataset.swapState='none';canvas.style.cursor='default';return;}
    canvas.dataset.swapPair=pair.ids.map(id=>id??'empty').join(',');canvas.dataset.swapState='hover';canvas.style.cursor='pointer';
    const top=(game.c.boardHeight-pair.worldBottom-1)*s,x=pair.x*s;
    ctx.save();ctx.fillStyle='#fff0a326';ctx.strokeStyle='#fff09b';ctx.lineWidth=Math.max(2,s*.05);
    ctx.beginPath();ctx.roundRect(x+s*.03,top+s*.03,s*.94,s*1.94,s*.12);ctx.fill();ctx.stroke();ctx.setLineDash([]);
    // 組の境界に表示。猫の顔を隠さず、交換の方向を示す。
    ctx.fillStyle='#fff09b';ctx.beginPath();ctx.arc(x+s*.5,top+s,s*.18,0,Math.PI*2);ctx.fill();ctx.fillStyle='#234356';ctx.font=`bold ${s*.31}px "Segoe UI Symbol",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('↕',x+s*.5,top+s);ctx.restore();
  }
  function drawDrag(s){
    const b=findCat(mousePress.catId);renderedPair=null;if(!b)return;
    canvas.dataset.swapPair='';canvas.dataset.swapState='drag';canvas.style.cursor='grabbing';
    const current=dragY(game.worldY(b)),origin=dragY(mousePress.originWorld),lo=Math.min(origin,current),hi=Math.max(origin,current),x=b.x*s;
    ctx.save();clipDrag(s);ctx.fillStyle='#fff0a31e';ctx.fillRect(x,(game.c.boardHeight-hi)*s,s,(hi-lo+1)*s);
    // 目的セルを実際のセル位置で示し、猫の枠はスライド表示へ追従させる。
    ctx.strokeStyle='#ffeb85';ctx.lineWidth=Math.max(2,s*.045);ctx.setLineDash([s*.10,s*.07]);ctx.strokeRect(x+s*.04,(game.c.boardHeight-current)*s+s*.04,s*.92,s*.92);
    ctx.setLineDash([]);ctx.strokeStyle='#fff9d0';ctx.lineWidth=Math.max(2,s*.065);ctx.beginPath();ctx.roundRect(x+s*.01,(game.c.boardHeight-visualY(b))*s+s*.01,s*.98,s*.98,s*.10);ctx.stroke();ctx.restore();
  }
  function drawChains(s){
    const visible=[];
    for(const cluster of game.clusters.values()){
      const cats=game.cats.filter(b=>b.cluster===cluster.id),level=game.chainLevelFor(cats);
      if(level<2)continue;
      visible.push(`#${cluster.id}:CHAIN ${level}`);
      const onBoard=cats.filter(b=>game.worldY(b)>=0&&game.worldY(b)<game.c.boardHeight);
      if(!onBoard.length)continue;
      const text=`CHAIN ${level}`,fontSize=Math.max(12*(window.devicePixelRatio||1),s*.30);
      ctx.save();ctx.font=`bold ${fontSize}px "Segoe UI",sans-serif`;
      const width=ctx.measureText(text).width+s*.24,height=fontSize+s*.18;
      const center=onBoard.reduce((sum,b)=>sum+b.x+.5,0)/onBoard.length*s;
      const x=Math.max(s*.06,Math.min(canvas.width-width-s*.06,center-width/2));
      const y=Math.max(s*.06,(game.c.boardHeight-Math.max(...onBoard.map(b=>visualY(b))))*s-height-s*.08);
      ctx.fillStyle='#183844e8';ctx.strokeStyle=level>=4?'#ffcd65':'#fff0a3';ctx.lineWidth=Math.max(1,s*.025);
      ctx.beginPath();ctx.roundRect(x,y,width,height,s*.10);ctx.fill();ctx.stroke();
      ctx.fillStyle=ctx.strokeStyle;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x+width/2,y+height/2);ctx.restore();
    }
    canvas.dataset.chainLabels=visible.join(' / ');
  }
  function drawDangerColumns(s,state){
    const [lo,hi]=game.c.dangerColumnAlpha;
    const wave=reducedMotion?.5:(1+Math.cos(game.time*Math.PI*2/game.c.dangerColumnBlinkPeriod))/2;
    const alpha=lo+(hi-lo)*wave;
    ctx.save();
    for(const x of state.activeColumns){
      ctx.fillStyle=`rgba(235,68,68,${alpha})`;ctx.fillRect(x*s,0,s,canvas.height);
      ctx.strokeStyle='rgba(245,113,105,.35)';ctx.lineWidth=Math.max(1,s*.025);ctx.strokeRect(x*s+s*.02,s*.02,s*.96,canvas.height-s*.04);
    }
    // 救済中の列は淡い青緑で固定表示。赤の点滅を止める。
    for(const x of state.rescuingColumns){ctx.fillStyle=`rgba(126,223,226,${game.c.dangerRescueColumnAlpha})`;ctx.fillRect(x*s,0,s,canvas.height);}
    ctx.restore();
    canvas.dataset.dangerColumns=state.activeColumns.map(x=>x+1).join(',');
    canvas.dataset.rescuingColumns=state.rescuingColumns.map(x=>x+1).join(',');
    canvas.dataset.columnWarningAlpha=state.activeColumns.length?alpha.toFixed(3):'0';
  }
  function draw(){gameAudio.update();bgm.setPaused(scene==='game'&&(paused||$('debug').open));gameBgm.update();const w=canvas.width,h=canvas.height,s=w/game.c.boardWidth;ctx.clearRect(0,0,w,h);
    if(mousePress&&(game.over||(mousePress.active&&(!game.drag||!findCat(mousePress.catId)))))finishMousePress();
    canvas.dataset.dragging=String(!!mousePress?.active);canvas.dataset.dragCat=mousePress?.active?String(mousePress.catId):'';
    if(mousePress&&performance.now()-lastTraceTime>=50){lastTraceTime=performance.now();traceDrag('frame');}
    const timeEffect=updateTimeUI();
    for(const [id,slide] of slides)if(performance.now()-slide.start>=game.c.swapAnimationDuration||!findCat(id))slides.delete(id);
    canvas.dataset.swapAnimating=String(slides.size>0);
    ctx.fillStyle='#234356';ctx.fillRect(0,0,w,h);for(let i=0;i<32;i++){ctx.fillStyle='#ffffff55';ctx.fillRect((i*97%997)/997*w,(i*47%211)/211*s,2,2);}
    ctx.strokeStyle='#ffffff0e';ctx.lineWidth=1;for(let x=0;x<=game.c.boardWidth;x++){ctx.beginPath();ctx.moveTo(x*s,s);ctx.lineTo(x*s,h);ctx.stroke();}for(let y=1;y<=game.c.boardHeight+1;y++){ctx.beginPath();ctx.moveTo(0,y*s);ctx.lineTo(w,y*s);ctx.stroke();}
    for(const b of game.cats)cat(b,s);
    const danger=game.dangerState();drawDangerColumns(s,danger);
    drawChains(s);
    drawPair(s);
    const unsafe=danger.activeColumns.length>0,rescuing=danger.mode==='rescuing';
    const level=Math.min(1,game.danger/game.c.dangerLimit),warning=danger.mode!=='safe',strength=rescuing?.15:level;
    const pulse=reducedMotion||rescuing?1:.75+.25*Math.sin(game.time*Math.PI*2*(.6+level*.5));
    const dangerColor=rescuing?'#659cae':level>=.65?'#e64343':'#ef8650',dy=(game.c.boardHeight-game.c.dangerLine)*s;
    canvas.dataset.warning=danger.mode;canvas.dataset.warningLevel=level.toFixed(2);
    ctx.save();ctx.globalAlpha=warning?(rescuing?.4:.6+.4*level)*pulse:1;ctx.setLineDash(warning?[]:[8,5]);ctx.lineWidth=warning?s*(.04+.05*strength):Math.max(1,s*.025);ctx.strokeStyle=warning?dangerColor:'#f3a880';ctx.beginPath();ctx.moveTo(0,dy);ctx.lineTo(w,dy);ctx.stroke();ctx.setLineDash([]);
    if(warning){ctx.lineWidth=s*(.045+.09*strength);ctx.strokeStyle=dangerColor;ctx.shadowColor=dangerColor;ctx.shadowBlur=s*(.1+.4*strength);ctx.strokeRect(ctx.lineWidth/2,ctx.lineWidth/2,w-ctx.lineWidth,h-ctx.lineWidth);}
    ctx.restore();
    const frameGlow=timeEffect.stage?timeEffect.strength*game.c.timeMilestoneGlow[timeEffect.stage-1]:0;
    canvas.dataset.stageGlow=frameGlow.toFixed(2);
    canvas.dataset.phaseShake=timeEffect.shake.toFixed(2);canvas.parentElement.style.transform=timeEffect.shake?`translateX(${timeEffect.shake.toFixed(2)}px)`:'';
    const shadows=['0 8px 24px #294c5020'];if(warning)shadows.push(`0 0 ${8+20*strength}px ${2+5*strength}px rgba(${rescuing?'101,156,174':'230,67,67'},${((.15+.35*strength)*pulse).toFixed(2)})`);if(frameGlow>0)shadows.push(`0 0 ${12+20*frameGlow}px ${2+3*frameGlow}px rgba(239,112,64,${(.7*frameGlow).toFixed(2)})`);canvas.style.boxShadow=shadows.join(',');
    const profile=game.difficulty();
    $('score').textContent=game.ejected;$('next').textContent=!game.autoSpawn?'実験配置':game.rush?`猫ラッシュ ${game.rush.total-game.rush.remaining}/${game.rush.total}`:`次の猫 ${Math.max(0,game.spawnTimer).toFixed(1)}秒 · ${profile.count[0]}–${profile.count[1]}匹`;
    $('next').style.color=game.rush?'#c54239':'';
    $('fast').hidden=!(game.feedFast&&game.autoSpawn&&!paused&&!$('debug').open&&!game.over);
    $('danger').max=game.c.dangerLimit;$('danger').value=game.danger;$('dangerText').textContent=warning?`${rescuing?'救済中':'残り'} ${Math.max(0,game.c.dangerLimit-game.danger).toFixed(1)}秒`:`${game.danger.toFixed(1)} / ${game.c.dangerLimit}秒`;$('dangerText').style.color=warning?dangerColor:'';$('danger').style.accentColor=warning?dangerColor:'';
    const panel=$('dangerPanel'),urgent=unsafe&&level>=game.c.dangerGaugeBlinkThreshold;panel.dataset.warning=String(warning);panel.dataset.urgent=String(urgent);panel.dataset.state=danger.mode;
    const columnWave=reducedMotion||rescuing?1:(1+Math.cos(game.time*Math.PI*2/game.c.dangerColumnBlinkPeriod))/2;
    const gaugeColor=rescuing?'#659cae':unsafe?`hsl(${Math.round(22*(1-level))}, ${Math.round(75+10*level)}%, ${Math.round(51-7*level)}%)`:dangerColor;
    $('danger').style.accentColor=warning?gaugeColor:'';$('danger').style.setProperty('--gauge-color',warning?gaugeColor:'#789a8a');panel.style.borderColor=warning?gaugeColor:'transparent';panel.style.background=warning?(rescuing?'#e7f2f4':level>=.65?'#ffe0da':'#fff0da'):'';panel.style.color=warning?gaugeColor:'';panel.style.boxShadow=warning?`0 0 ${4+16*strength}px rgba(${rescuing?'101,156,174':'230,67,67'},${.12+.35*strength})`:'';panel.style.opacity=unsafe&&!reducedMotion?String(1-columnWave*(urgent?.38:.12)):'1';
    panel.dataset.warningPulse=columnWave.toFixed(3);
    $('overlay').hidden=!game.over&&!paused;$('overlay').querySelector('strong').textContent=game.over?'GAME OVER':'PAUSE';
    const powered=game.groups.filter(g=>g.powered);$('flight').textContent=powered.length?`${powered.length}つの塊が飛行中`:'次の点火を仕込もう';
    const highestChain=game.chainLevelFor(game.cats);
    $('status').textContent=powered.length?powered.map(g=>`#${g.id} ${g.v>1?'上昇':g.v<-1?'落下':'失速'} / ${g.cats.length}匹${g.chainLevel>=2?` · CHAIN ${g.chainLevel}`:''}`).join('　'):highestChain>=2?`CHAIN ${highestChain}の塊を、もう一度点火しよう。`:'軽い塊は遠くへ。重い塊はもう一押し。';
    const ev=game.events.at(-1);if(ev && ev!==seen){seen=ev;$('log').replaceChildren(...game.events.slice(-5).reverse().map(e=>{const d=document.createElement('div');d.textContent=e.text;return d;}));}
    if($('debug').open){const clusters=[...new Set(game.cats.map(b=>b.cluster).filter(id=>id!==null))];$('metrics').textContent=`FPS ${fps.toFixed(0)} | 経過 ${game.time.toFixed(1)}秒\n供給倍率 ${game.feedFast?game.c.feedFastMultiplier:1}x | 次の猫 ${game.spawnTimer.toFixed(1)}秒\n間隔 ${profile.interval.toFixed(2)}秒 / ${profile.count.join('–')}匹\n${game.rush?`ラッシュ残り ${game.rush.remaining}波 / ${game.rush.interval.toFixed(2)}秒間隔`:`ラッシュまで ${Math.max(0,game.nextRushTime-game.time).toFixed(1)}秒`}\n危険 ${game.danger.toFixed(2)} | 浮遊 ${game.groups.length}\n接続群 ${clusters.map(id=>`#${id}:${game.cats.filter(b=>b.cluster===id).length}匹 CHAIN ${game.chainLevelFor(game.cats.filter(b=>b.cluster===id))}`).join(' / ')}\n惑星 ${game.c.planetProfiles[game.c.planetId].name}\n最終 ${game.last.direction==='vertical'?'縦':game.last.direction==='horizontal'?'横':''}${game.last.match}MATCH | 推力 ${game.last.basePower} × ${game.last.chainMultiplier} = ${game.last.power.toFixed(2)} | 初速加算 ${game.last.impulse.toFixed(2)} | 重量 ${game.last.weight} | CHAIN ${game.last.chainLevel}\n${game.groups.map(g=>`飛行#${g.id} 接続#${g.cats[0]?.cluster??'-'} v=${g.v.toFixed(2)} ${g.cats.length}匹`).join('\n')}`;}
  }
  function focusAtPointer(){
    if(!pointer)return null;
    const r=canvas.getBoundingClientRect(),s=r.width/game.c.boardWidth,x=touchDrag?.anchor.x??Math.floor((pointer.x-r.left)/s),world=game.c.boardHeight+1-(pointer.y-r.top)/s;
    if(x<0||x>=game.c.boardWidth||world<0||world>=game.c.boardHeight)return null;
    const hit=[...game.cats].reverse().find(b=>b.x===x&&world>=game.worldY(b)&&world<game.worldY(b)+1);
    const contexts=touchDrag?[touchDrag.anchor.group]:hit?[hit.group]:[null,...game.groups.map(g=>g.id)];
    for(const group of contexts){
      const offset=game.groups.find(g=>g.id===group)?.offset||0,local=world-offset,y=touchDrag?.anchor.y??Math.floor(local),fraction=1-(local-Math.floor(local));
      const dead=game.c.swapFocusDeadZone/2;
      let direction=fraction<.5-dead?1:fraction>.5+dead?-1:focusDirection;
      if(touchDrag&&Math.abs(pointer.y-touchDrag.y)>4)direction=pointer.y<touchDrag.y?1:-1;
      const pair=game.cellPair(x,direction===1?y:y-1,group)||game.cellPair(x,direction===1?y-1:y,group);
      if(pair){focusDirection=pair.lowerY===y?1:-1;return pair;}
    }
    return null;
  }
  function updateMouseDrag(e){
    const press=mousePress;if(!press||press.pointerId!==e.pointerId)return;
    traceDrag('pointer-move',e);
    if(paused||game.over||$('debug').open){finishMousePress();return;}
    const r=canvas.getBoundingClientRect(),s=r.width/game.c.boardWidth;
    if(Math.abs(e.clientX-press.startX)>game.c.dragHorizontalCancelCells*s){finishMousePress();return;}
    if(!press.active){
      if(Math.abs(e.clientY-press.startY)<Math.max(5,game.c.dragStartDistanceCells*s))return;
      if(!press.catId||!game.beginDrag(press.catId)){finishMousePress();return;}
      press.active=true;
    }
    const b=findCat(press.catId);if(!b||!game.drag){finishMousePress();return;}
    const world=game.c.boardHeight+1-(e.clientY-r.top)/s;
    const row=Math.max(0,Math.min(game.c.boardHeight-1,Math.floor(world)));
    traceDrag('move-before',e);
    const before=new Map(game.cats.map(cat=>[cat.id,{visual:visualY(cat),world:game.worldY(cat)}]));
    if(game.moveDragTo(row,world-row)&&!reducedMotion){
      const start=performance.now();for(const cat of game.cats){const old=before.get(cat.id);if(old&&Math.abs(old.world-game.worldY(cat))>.001)slides.set(cat.id,{start,delta:old.visual-game.worldY(cat)});}
    }
    traceDrag('move-after',e);
  }
  canvas.addEventListener('pointermove',e=>{pointer={x:e.clientX,y:e.clientY};if(mousePress&&!(e.buttons&1))finishMousePress();else updateMouseDrag(e);});
  canvas.addEventListener('pointerleave',()=>{if(!touchDrag&&!mousePress){pointer=null;renderedPair=null;}});
  canvas.addEventListener('pointerdown',e=>{
    if(scene!=='game'||paused||game.over||$('debug').open||e.button!==0||mousePress||touchDrag)return;
    if(e.pointerType==='touch'){
      pointer={x:e.clientX,y:e.clientY};
      const r=canvas.getBoundingClientRect(),s=r.width/game.c.boardWidth,x=Math.floor((e.clientX-r.left)/s),world=game.c.boardHeight+1-(e.clientY-r.top)/s;
      const b=[...game.cats].reverse().find(b=>b.x===x&&world>=game.worldY(b)&&world<game.worldY(b)+1),group=b?.group??null,offset=game.groups.find(g=>g.id===group)?.offset||0;
      touchDrag={id:e.pointerId,y:e.clientY,anchor:{x,y:Math.floor(world-offset),group}};renderedPair=null;canvas.setPointerCapture(e.pointerId);draw();return;
    }
    const r=canvas.getBoundingClientRect(),s=r.width/game.c.boardWidth,x=Math.floor((e.clientX-r.left)/s),world=game.c.boardHeight+1-(e.clientY-r.top)/s;
    const b=[...game.cats].reverse().find(b=>b.x===x&&world>=visualY(b)&&world<visualY(b)+1);
    // 短いクリックは、押した直前に描かれていた組を離した時に実行する。
    mousePress={pointerId:e.pointerId,catId:b?.id||null,x,startX:e.clientX,startY:e.clientY,originWorld:b?game.worldY(b):Math.floor(world),pair:renderedPair?{...renderedPair,ids:[...renderedPair.ids]}:null,active:false};
    dragTrace.length=0;lastPress=null;lastTraceTime=-Infinity;traceDrag('down',e);
    pointer={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});
  });
  canvas.addEventListener('pointerup',e=>{if(mousePress?.pointerId===e.pointerId){updateMouseDrag(e);finishMousePress(true);}if(touchDrag&&touchDrag.id===e.pointerId){exchange(renderedPair);touchDrag=null;pointer=null;renderedPair=null;}});
  canvas.addEventListener('pointercancel',()=>{finishMousePress();touchDrag=null;pointer=null;renderedPair=null;});
  canvas.addEventListener('lostpointercapture',e=>{if(mousePress?.pointerId===e.pointerId)finishMousePress();});
  canvas.addEventListener('dragstart',e=>traceDrag('native-dragstart',e));
  document.addEventListener('keydown',e=>{audio.unlock();bgm.unlock();if(scene!=='game'||e.target.matches('input,textarea,select')||e.target.isContentEditable)return;if(e.code==='Space'){e.preventDefault();if(!paused&&!$('debug').open&&!document.hidden)game.setFeedFast(true);return;}if(e.key.toLowerCase()==='d'){toggleDebug();return;}if(e.key==='Escape'){clearInput();return;}if(e.key==='Enter'&&document.activeElement===canvas&&!paused&&!$('debug').open&&!mousePress){e.preventDefault();exchange(renderedPair);}});
  document.addEventListener('pointerdown',()=>{audio.unlock();bgm.unlock();});
  document.addEventListener('keyup',e=>{if(e.code==='Space'){e.preventDefault();game.setFeedFast(false);}});
  window.addEventListener('blur',()=>{finishMousePress();game.setFeedFast(false);});
  function startStage(){scene='game';$('menu').close();game.configure(GAME_CONFIG);game.reset();gameAudio.beginStage();clearInput();resetTimeUI();paused=false;seen=0;$('log').replaceChildren();$('pause').textContent='一時停止';resize();}
  $('restart').onclick=startStage;
  $('pause').onclick=()=>{if(scene!=='game'||game.over)return;finishMousePress();paused=!paused;game.setFeedFast(false);bgm.setPaused(paused);$('pause').textContent=paused?'再開':'一時停止';};
  function toggleSound(){audio.setEnabled(!audio.enabled);bgm.setEnabled(audio.enabled);for(const id of ['sound','menuSound']){$(id).textContent='音 '+(audio.enabled?'ON':'OFF');$(id).setAttribute('aria-pressed',audio.enabled);}}
  $('sound').onclick=toggleSound;$('menuSound').onclick=toggleSound;
  function showMenu(next){clearInput();game.setFeedFast(false);audio.stage++;audio.over=true;audio.stagePending=false;audio.stopAll();scene=next;gameBgm.enterScene(next);$('titlePanel').hidden=next!=='title';$('selectPanel').hidden=next!=='stageSelect';if(!$('menu').open)$('menu').showModal();}
  $('toTitle').onclick=()=>showMenu('title');$('selectStage').onclick=()=>showMenu('stageSelect');$('backTitle').onclick=()=>showMenu('title');$('startStandard').onclick=()=>{GAME_CONFIG.planetId='basic';startStage();rebuildTuning();};
  $('menu').addEventListener('cancel',e=>e.preventDefault());
  function toggleDebug(){finishMousePress();game.setFeedFast(false);if($('debug').open)$('debug').close();else $('debug').showModal();}
  $('debugToggle').onclick=toggleDebug;$('closeDebug').onclick=()=>$('debug').close();
  $('dragBuild').textContent=`実行版 ${build} / engine ${RocketGame.build??'unknown'}`;
  $('saveDragTrace').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(window.nekoRocket.dragDiagnostics(),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='neko-drag-trace.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  for(const b of document.querySelectorAll('[data-scene]'))b.onclick=()=>{game.scenario(b.dataset.scene);gameAudio.beginStage();clearInput();resetTimeUI();paused=false;$('pause').textContent='一時停止';$('debug').close();};
  const planetSelect=$('debugPlanet');
  for(const [id,profile] of Object.entries(GAME_CONFIG.planetProfiles)){const option=document.createElement('option');option.value=id;option.textContent=profile.name;planetSelect.append(option);}
  function rebuildTuning(){
    planetSelect.value=GAME_CONFIG.planetId;$('tuning').replaceChildren();
    const profile=GAME_CONFIG.planetProfiles[GAME_CONFIG.planetId].physics;
    const keys=['horizontalLaunchPower3','horizontalLaunchPower4','horizontalLaunchPower5','verticalLaunchPower3','verticalLaunchPower4','verticalLaunchPower5','upwardInitialVelocity','launchVelocityReferencePower','upwardAcceleration','maxUpwardSpeed','upwardSpeedScale','downwardAcceleration','maxFallSpeed','downwardSpeedScale','apexHoldTime','blockWeight','weightPenalty','minimumLaunchSpeed','extraIgnitionBoost','maxChainLevel','supplyDownwardAcceleration','supplyInitialVelocity'];
    for(const [object,list] of [[profile,keys],[GAME_CONFIG,['spawnInterval','burntRegenTime','feedFastMultiplier']]])for(const key of list){
      const label=document.createElement('label');label.textContent=key;
      const input=document.createElement('input'),signed=key==='upwardAcceleration',zero=['downwardAcceleration','apexHoldTime','weightPenalty','supplyDownwardAcceleration'].includes(key),minimum=signed?-100:zero?0:['feedFastMultiplier','maxChainLevel'].includes(key)?1:.1;
      input.type='number';input.min=String(minimum);input.max='100';input.step=key==='maxChainLevel'?'1':'.05';input.value=object[key];
      input.onchange=()=>{const v=Number(input.value);if(Number.isFinite(v)&&v>=minimum&&v<=100&&(key!=='maxChainLevel'||Number.isInteger(v))){object[key]=v;(object===profile?game.physics:game.c)[key]=v;if(key==='maxChainLevel')game.syncGroupChains();}};
      label.append(input);$('tuning').append(label);
    }
    for(const [i,multiplier] of profile.chainMultipliers.entries()){
      const label=document.createElement('label');label.textContent=`CHAIN ${i+1} 倍率`;
      const input=document.createElement('input');input.type='number';input.min='.1';input.max='10';input.step='.05';input.value=multiplier;
      input.onchange=()=>{const v=Number(input.value);if(Number.isFinite(v)&&v>=.1&&v<=10){const values=[...profile.chainMultipliers];values[i]=v;profile.chainMultipliers=values;game.physics.chainMultipliers=[...values];}};
      label.append(input);$('tuning').append(label);
    }
  }
  planetSelect.onchange=()=>{if(!GAME_CONFIG.planetProfiles[planetSelect.value])return;GAME_CONFIG.planetId=planetSelect.value;game.configure(GAME_CONFIG);game.reset();gameAudio.beginStage();clearInput();resetTimeUI();paused=false;seen=0;$('pause').textContent='一時停止';$('log').replaceChildren();rebuildTuning();resize();};
  rebuildTuning();
  document.addEventListener('visibilitychange',()=>{if(document.hidden)audio.stopAll();bgm.setHidden(document.hidden);finishMousePress();game.setFeedFast(false);last=performance.now();});
  function frame(now){const elapsed=Math.min((now-last)/1000,.1);last=now;fps=fps*.95+(.05/Math.max(elapsed,.001));if(scene==='game'&&!paused&&!$('debug').open&&!document.hidden){let remaining=elapsed;while(remaining>0){const dt=Math.min(remaining,1/120);game.step(dt);remaining-=dt;}}draw();requestAnimationFrame(frame);}
  showMenu('title');resize();requestAnimationFrame(frame);
})();
