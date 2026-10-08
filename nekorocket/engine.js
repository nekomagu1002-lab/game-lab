(function(root) {
  'use strict';
  class RocketGame {
    constructor(config, random = Math.random) { this.configure(config); this.random = random; this.reset(); }
    configure(config) {
      this.c={...config,planetProfiles:Object.fromEntries(Object.entries(config.planetProfiles).map(([id,profile])=>[id,{...profile,physics:{...profile.physics,chainMultipliers:[...profile.physics.chainMultipliers]}}]))};
      if(!this.c.planetProfiles[this.c.planetId]?.physics)throw new Error('Unknown planet: '+this.c.planetId);
    }
    get physics() {return this.c.planetProfiles[this.c.planetId].physics;}
    setPlanet(id) {
      if(!this.c.planetProfiles[id]?.physics)return false;
      this.c.planetId=id;this.reset();return true;
    }
    reset(empty = false) {
      this.cats=[]; this.groups=[]; this.nextId=1; this.nextGroup=1;this.nextCluster=1;this.clusters=new Map();
      this.time=0; this.spawnTimer=this.c.spawnInterval; this.danger=0;
      this.dangerSourceIds=new Set();
      this.autoSpawn=true;this.feedFast=false;this.rush=null;this.rushCooldown=0;this.nextRushTime=this.c.difficultyTurnTime;
      this.ejected=0; this.over=false; this.events=[];this.soundEvents=[];this.dangerSoundEpisode=false; this.latches=new Set();
      this.drag=null;
      this.last={match:0,basePower:0,power:0,impulse:0,weight:0,chainLevel:0,chainMultiplier:1,direction:null};
      if (!empty) for(let y=0;y<this.c.initialRows;y++) for(let x=0;x<this.c.boardWidth;x++) {
        let type;
        do { type=Math.floor(this.random()*this.c.catTypes); }
        while ((x>=2 && this.at(x-1,y)?.type===type && this.at(x-2,y)?.type===type) ||
          (y>=2 && this.at(x,y-1)?.type===type && this.at(x,y-2)?.type===type));
        this.add(x,y,type);
      }
    }
    add(x,y,type,group=null) { const b={id:this.nextId++,x,y,type,burnt:false,burntRest:0,cluster:null,group}; this.cats.push(b); return b; }
    at(x,y,group=null) { return this.cats.find(b=>b.group===group && b.x===x && Math.abs(b.y-y)<0.01); }
    emit(text,kind='ignite') { this.events.push({text,kind,time:this.time}); if(this.events.length>16)this.events.shift(); }
    emitSound(kind,data={}) {
      this.soundEvents.push({kind,time:this.time,...data});
      if(this.soundEvents.length>(this.c.audio?.eventQueueLimit??256))this.soundEvents.shift();
    }
    drainSoundEvents() {const events=this.soundEvents;this.soundEvents=[];return events;}
    makeGroup(cats,v=0,powered=false) {
      const g={id:this.nextGroup++,cats,offset:0,v,powered,boosts:0,apexRemaining:0,chainLevel:this.chainLevelFor(cats)};
      cats.forEach(b=>{b.group=g.id;}); this.groups.push(g);if(powered)this.assignCluster(cats,1);return g;
    }
    // 連鎖履歴は着地後も残る接続IDごとに一元管理。飛行IDは変わってもよい。
    clampChain(level) {return Math.max(0,Math.min(Math.max(1,Math.floor(this.physics.maxChainLevel)),Math.floor(level)));}
    chainLevelFor(cats) {return this.clampChain(Math.max(0,...cats.map(b=>this.clusters.get(b.cluster)?.chainLevel||0)));}
    chainMultiplier(level) {const table=this.physics.chainMultipliers;return table[Math.min(table.length-1,Math.max(0,level-1))];}
    syncGroupChains() {for(const g of this.groups)g.chainLevel=this.chainLevelFor(g.cats);}
    setChainLevel(cats,level) {
      const id=cats[0].cluster;this.clusters.get(id).chainLevel=this.clampChain(level);this.syncGroupChains();
    }
    assignCluster(cats,initialLevel=0) {
      const old=new Set(cats.map(b=>b.cluster).filter(id=>id!==null));
      const id=old.size?Math.min(...old):this.nextCluster++;
      // 異なる接続群の統合を1回の融合と数える。普通の荷物・同じIDは加算しない。
      const level=this.clampChain(Math.max(initialLevel,this.chainLevelFor(cats)+(old.size>1?1:0)));
      for(const b of this.cats)if(old.has(b.cluster))b.cluster=id;
      for(const b of cats)b.cluster=id;
      for(const other of old)if(other!==id)this.clusters.delete(other);
      this.clusters.set(id,{id,chainLevel:level});this.syncGroupChains();if(old.size>1)this.emitSound('fusion',{sourceClusters:[...old],clusterId:id,count:this.cats.filter(b=>b.cluster===id).length});
      return id;
    }
    expandTargets(cats) {
      const targets=new Set(cats);let changed=true;
      while(changed){changed=false;const ids=new Set([...targets].map(b=>b.cluster).filter(id=>id!==null)),flights=new Set([...targets].map(b=>b.group).filter(id=>id!==null));
        for(const b of this.cats)if(!targets.has(b)&&(ids.has(b.cluster)||flights.has(b.group))){targets.add(b);changed=true;}
      }
      return [...targets];
    }
    attachGroup(g,cats) {
      const targets=new Set(cats),world=new Map(cats.map(b=>[b.id,this.worldY(b)]));
      for(const other of this.groups)if(other!==g)other.cats=other.cats.filter(b=>!targets.has(b));
      this.groups=this.groups.filter(other=>other===g||other.cats.length);
      g.cats=[...targets];for(const b of g.cats){b.y=Math.round(world.get(b.id)-g.offset);b.group=g.id;}
      this.assignCluster(g.cats);
    }
    fuseContacts(triggerCats) {
      const tolerance=this.c.fusionContactTolerance;
      for(const b of triggerCats) {
        if(!this.cats.includes(b)||b.cluster===null)continue;
        const g=this.groups.find(g=>g.id===b.group);if(g&&g.v>0)continue;
        for(const a of this.cats){
          if(a.cluster===null||a.cluster===b.cluster)continue;
          const h=this.groups.find(g=>g.id===a.group);if(h&&h.v>0)continue;
          const dx=Math.abs(a.x-b.x),dy=Math.abs(this.worldY(a)-this.worldY(b));
          if(!((dx===1&&dy<=tolerance)||(dx===0&&Math.abs(dy-1)<=tolerance)))continue;
          const old=[a.cluster,b.cluster];this.assignCluster([a,b]);
          const members=this.cats.filter(c=>c.cluster===b.cluster),flights=this.groups.filter(g=>g.cats.some(c=>members.includes(c)));
          if(flights.length){const target=flights.reduce((p,q)=>p.id<q.id?p:q);target.powered=flights.some(g=>g.powered);target.v=Math.min(...flights.map(g=>g.v));if(target.powered)target.v=Math.max(-this.physics.maxFallSpeed,target.v);if(target.v<0)target.apexRemaining=0;this.attachGroup(target,this.expandTargets(members));}
          this.emit(`FUSION #${old.join('+')} → #${b.cluster} · CHAIN ${this.chainLevelFor(members)}`,'fusion');
        }
      }
    }
    wouldMatch(b,type) {
      for(const [dx,dy] of [[1,0],[0,1]]){let count=1;for(const sign of [-1,1])for(let n=1;;n++){const a=this.at(b.x+dx*n*sign,b.y+dy*n*sign);if(!a||a.burnt||a.type!==type)break;count++;}if(count>=3)return true;}
      return false;
    }
    regenerate(dt) {
      for(const b of this.cats)if(b.burnt){
        if(b.group!==null){b.burntRest=0;continue;}
        b.burntRest+=dt;if(b.burntRest<this.c.burntRegenTime)continue;
        const choices=Array.from({length:this.c.catTypes},(_,i)=>i).filter(type=>!this.wouldMatch(b,type));
        if(!choices.length)continue;
        b.type=choices[Math.floor(this.random()*choices.length)];b.burnt=false;b.burntRest=0;
        // 再生だけではscanしない。各猫を逐次確定し、次の猫は最新盤面を見る。
      }
    }
    runs(cats) {
      cats=cats.filter(b=>!b.burnt);
      const result=[];
      for(const b of cats) for(const [dx,dy] of [[1,0],[0,1]]) {
        const lookup=(x,y)=>cats.find(a=>a.x===x && a.y===y && a.type===b.type);
        if(lookup(b.x-dx,b.y-dy))continue;
        const run=[b]; let n=1,a;
        while((a=lookup(b.x+dx*n,b.y+dy*n))) {run.push(a);n++;}
        if(run.length>=3){run.direction=dy?'vertical':'horizontal';result.push(run);}
      }
      return result;
    }
    scan() {
      // ドラッグ中の一時的な並びは評価しない。終了時に最終盤面だけを見る。
      if(this.drag)return;
      const contexts=[{g:null,cats:this.cats.filter(b=>b.group===null)}, ...this.groups.map(g=>({g,cats:g.cats}))];
      const current=new Set(), fresh=[];
      for(const context of contexts) for(const run of this.runs(context.cats)) {
        const key=run.direction+':'+run.map(b=>`${b.id}:${b.x}:${b.y}`).join('|'); current.add(key);
        if(!this.latches.has(key))fresh.push({...context,run,key});
      }
      this.latches=current;
      // 同時マッチは対象が重なるものだけ統合。離れた点火は独立する。
      const batches=[];
      for(const m of fresh) {
        const targets=this.expandTargets(m.g ? m.g.cats : m.cats.filter(b=>m.run.some(a=>a.x===b.x && b.y>=a.y)));
        const touching=batches.filter(a=>a.targets.some(b=>targets.includes(b)));
        const batch={targets:[...targets],fuel:[...m.run],max:m.run.length,g:m.g,ignitions:[{size:m.run.length,direction:m.run.direction}]};
        for(const a of touching) {batch.targets.push(...a.targets);batch.fuel.push(...a.fuel);batch.max=Math.max(batch.max,a.max);batch.ignitions.push(...a.ignitions);batches.splice(batches.indexOf(a),1);}
        batch.targets=[...new Set(batch.targets)];batch.fuel=[...new Set(batch.fuel)];batches.push(batch);
      }
      for(const b of batches) {
        const preferred=b.g&&this.groups.includes(b.g)?b.g:this.groups.find(g=>b.targets.some(cat=>cat.group===g.id));
        const extra=!!preferred?.powered||b.targets.some(cat=>cat.cluster!==null);
        // 新規地上点火の猫はすでに整数座標。飛行中の対象は同じoffsetへ揃える。
        const g=preferred||this.makeGroup(b.targets);
        this.attachGroup(g,b.targets);
        this.setChainLevel(g.cats,extra?this.chainLevelFor(g.cats)+1:1);
        b.fuel.forEach(cat=>{cat.burnt=true;cat.type=null;cat.burntRest=0;});
        // 交差・同時点火は推力が最大の1方向を使う。足し算による二重点火はしない。
        const ignition=b.ignitions.map(m=>({...m,power:this.physics[m.direction+'LaunchPower'+Math.min(5,m.size)]})).sort((a,b)=>b.power-a.power||Number(b.direction==='vertical')-Number(a.direction==='vertical')||b.size-a.size)[0];
        const basePower=ignition.power;
        const multiplier=this.chainMultiplier(g.chainLevel),power=basePower*multiplier;
        const weight=g.cats.length*this.physics.blockWeight;
        // 倍率は今回の推力に適用してから重量を引く。射出・融合だけで速度は増やさない。
        const impulse=this.launchImpulse(power,weight);
        g.v=Math.min(this.physics.maxUpwardSpeed,extra ? Math.max(0,g.v)+impulse*this.physics.extraIgnitionBoost : impulse);g.apexRemaining=0;
        g.powered=true;g.boosts+=extra?1:0;
        this.last={match:ignition.size,direction:ignition.direction,basePower,power,weight,impulse,chainLevel:g.chainLevel,chainMultiplier:multiplier};
        this.emit(`${ignition.direction==='vertical'?'縦':'横'}${ignition.size}MATCH · ${extra?'追加点火！':'点火！'}${g.chainLevel>=2?` · CHAIN ${g.chainLevel}`:''}`,extra?'boost':'ignite');this.emitSound('ignite',{direction:ignition.direction,match:ignition.size,chainLevel:g.chainLevel,groupId:g.id});
      }
    }
    launchImpulse(power,weight) {
      const scale=this.physics.upwardInitialVelocity/this.physics.launchVelocityReferencePower;
      return Math.max(this.physics.minimumLaunchSpeed,(power-weight*this.physics.weightPenalty)*scale);
    }
    // 上昇・最高点・下降を独立した物理時計で計算。通常の供給タイマーは変えない。
    integrateFlight(g,dt) {
      const p=this.physics;
      if(!g.powered){g.v-=p.supplyDownwardAcceleration*dt;g.offset+=g.v*dt;return;}
      let remaining=dt;
      if(g.v>0){
        g.v=Math.min(p.maxUpwardSpeed,g.v);
        const toApex=p.upwardAcceleration<0?g.v/(-p.upwardAcceleration*p.upwardSpeedScale):Infinity;
        const elapsed=Math.min(remaining,toApex),physicalTime=elapsed*p.upwardSpeedScale;
        const next=Math.min(p.maxUpwardSpeed,Math.max(0,g.v+p.upwardAcceleration*physicalTime));
        g.offset+=(g.v+next)*0.5*physicalTime;g.v=next;remaining-=elapsed;
        if(elapsed>=toApex){g.v=0;g.apexRemaining=p.apexHoldTime;}
        else return;
      }
      if(g.apexRemaining>0){const held=Math.min(remaining,g.apexRemaining);g.apexRemaining-=held;remaining-=held;}
      if(remaining<=0)return;
      const physicalTime=remaining*p.downwardSpeedScale;
      g.v=Math.max(-p.maxFallSpeed,g.v);
      const toCap=p.downwardAcceleration>0?Math.max(0,(p.maxFallSpeed+g.v)/p.downwardAcceleration):Infinity;
      const accelerating=Math.min(physicalTime,toCap),next=Math.max(-p.maxFallSpeed,g.v-p.downwardAcceleration*accelerating);
      g.offset+=(g.v+next)*0.5*accelerating+next*(physicalTime-accelerating);g.v=next;
    }
    swap(id,direction) {
      if(this.over || ![-1,1].includes(direction))return false;
      const b=this.cats.find(a=>a.id===id); if(!b)return false;
      return this.swapCells(b.x,Math.min(b.y,b.y+direction),b.group);
    }
    cellPair(x,lowerY,group=null) {
      const g=group===null?null:this.groups.find(a=>a.id===group);
      if(this.over || (group!==null&&!g) || !Number.isInteger(x)||!Number.isInteger(lowerY)||x<0||x>=this.c.boardWidth)return null;
      const world=lowerY+(g?.offset||0);
      if(world < -0.001 || world+2>this.c.boardHeight+0.001)return null;
      const cells=[this.at(x,lowerY,group)||null,this.at(x,lowerY+1,group)||null];
      if(cells.every(b=>!b))return null;
      // 空セルは他の飛行グループの猫が占有している場所には作れない。
      for(let i=0;i<2;i++)if(!cells[i]&&this.cats.some(b=>b.group!==group&&b.x===x&&Math.abs(this.worldY(b)-(world+i))<.999))return null;
      return {x,lowerY,group,ids:cells.map(b=>b?.id||null),worldBottom:world};
    }
    swapCells(x,lowerY,group=null,expectedIds=null) {
      const pair=this.cellPair(x,lowerY,group);if(!pair)return false;
      if(expectedIds&&pair.ids.some((id,i)=>id!==expectedIds[i]))return false;
      const [a,b]=pair.ids.map(id=>this.cats.find(cat=>cat.id===id));
      if(a)a.y=lowerY+1;if(b)b.y=lowerY;
      this.emit('上下交換','swap');this.emitSound('swap');if(!this.drag)this.scan();return true;
    }
    beginDrag(id) {
      const b=this.cats.find(b=>b.id===id);
      if(this.over||this.drag||!b||this.worldY(b)<0||this.worldY(b)>=this.c.boardHeight)return false;
      // 列／浮遊グループの外側にある空は上空。塊の内部の空セルとは区別する。
      const maxY=Math.max(...this.cats.filter(a=>a.x===b.x&&a.group===b.group).map(a=>a.y));
      this.drag={id,x:b.x,swaps:0,maxY,anchorY:b.y};return true;
    }
    dragCeiling() {
      if(!this.drag)return null;
      const b=this.cats.find(b=>b.id===this.drag.id);if(!b)return null;
      // 着地・合流で相対座標が変わった時だけ、上端も同じだけ移す。
      this.drag.maxY+=b.y-this.drag.anchorY;this.drag.anchorY=b.y;
      const offset=this.groups.find(g=>g.id===b.group)?.offset||0;
      return Math.max(0,Math.min(this.c.boardHeight-1,this.drag.maxY+offset));
    }
    moveDragTo(row,fraction=.5) {
      if(!this.drag||this.over||!Number.isFinite(row)||!Number.isFinite(fraction))return 0;
      const b=this.cats.find(b=>b.id===this.drag.id);if(!b||b.x!==this.drag.x)return 0;
      // 入力は盤面上の段。飛行グループ内の相対座標とは分けて制限する。
      this.dragCeiling();
      row=Math.max(0,Math.min(this.c.boardHeight-1,Math.floor(row)));
      fraction=Math.max(0,Math.min(1-1e-9,fraction));
      const offset=this.groups.find(g=>g.id===b.group)?.offset||0;
      const target=Math.max(Math.ceil(-offset),Math.min(this.drag.maxY,Math.floor(this.c.boardHeight-1-offset),Math.floor(row+fraction-offset)));
      let count=0;
      while(b.y!==target&&count<this.c.boardHeight){
        const direction=target>b.y?1:-1,pair=this.cellPair(b.x,Math.min(b.y,b.y+direction),b.group);
        if(!pair||!this.swapCells(pair.x,pair.lowerY,pair.group,pair.ids))break;
        count++;this.drag.swaps++;
      }
      this.drag.anchorY=b.y;
      return count;
    }
    endDrag() {
      if(!this.drag)return false;
      this.drag=null;if(!this.over)this.scan();return true;
    }
    releaseUnsupported() {
      for(let x=0;x<this.c.boardWidth;x++) {
        const col=this.cats.filter(b=>b.group===null&&b.x===x).sort((a,b)=>a.y-b.y);
        let expected=0,index=0;
        while(index<col.length&&col[index].y===expected){expected++;index++;}
        if(index<col.length)this.makeGroup(col.slice(index),0,false);
      }
    }
    difficulty(time=this.time) {
      const early=this.c.difficultyEnabled?Math.min(time,this.c.difficultyTurnTime)/60:0;
      const late=this.c.difficultyEnabled?Math.max(0,time-this.c.difficultyTurnTime):0;
      const interval=Math.max(this.c.minimumSpawnInterval,this.c.spawnInterval-early*this.c.spawnIntervalDecreasePerMinute-late*this.c.lateSpawnIntervalDecreasePerSecond);
      const growth=early*this.c.spawnCountIncreasePerMinute+late*this.c.lateSpawnCountIncreasePerSecond;
      const count=this.c.spawnCount.map(n=>Math.max(1,Math.min(this.c.boardWidth,Math.floor(n+growth))));
      return {interval,count,late:late>0||this.c.difficultyEnabled&&time>=this.c.difficultyTurnTime};
    }
    randomRange([lo,hi]) {return lo+this.random()*(hi-lo);}
    spawn(count=this.difficulty().count) {
      const columns=Array.from({length:this.c.boardWidth},(_,i)=>i);
      for(let i=columns.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[columns[i],columns[j]]=[columns[j],columns[i]];}
      const [lo,hi]=count;
      for(const x of columns.slice(0,lo+Math.floor(this.random()*(hi-lo+1)))) {
        const top=Math.max(this.c.boardHeight,...this.cats.filter(b=>b.x===x).map(b=>this.worldY(b)+1));
        this.makeGroup([this.add(x,top,Math.floor(this.random()*this.c.catTypes))],-this.physics.supplyInitialVelocity);
      }
    }
    updateSpawns(dt) {
      if(!this.autoSpawn)return;
      const feedDt=dt*(this.feedFast?Math.max(1,this.c.feedFastMultiplier):1);
      const profile=this.difficulty();
      if(!this.rush&&profile.late){this.rushCooldown=Math.max(0,this.rushCooldown-feedDt);this.nextRushTime=this.time+this.rushCooldown;}
      if(this.c.difficultyEnabled&&this.c.rushEnabled&&!this.rush&&profile.late&&this.rushCooldown<=0) {
        const [lo,hi]=this.c.rushWaves;
        const total=lo+Math.floor(this.random()*(hi-lo+1));
        this.rush={remaining:total,total,timer:0,interval:this.randomRange(this.c.rushWaveInterval)};
        this.emit(`猫ラッシュ！ ${total}連続`,'rush');
      }
      if(this.rush) {
        this.rush.timer-=feedDt;
        if(this.rush.timer<=0) {
          this.spawn(profile.count);this.rush.remaining--;
          if(this.rush.remaining>0)this.rush.timer=this.rush.interval;
          else {this.rush=null;this.rushCooldown=this.c.rushPeriod;this.nextRushTime=this.time+this.rushCooldown;this.spawnTimer=profile.interval;this.emit('ラッシュ終了','rushEnd');}
        }
      } else {
        this.spawnTimer=Math.min(this.spawnTimer,profile.interval);
        this.spawnTimer-=feedDt;if(this.spawnTimer<=0){this.spawn(profile.count);this.spawnTimer+=profile.interval;}
      }
    }
    setFeedFast(active) {const next=!!active&&!this.over;if(next!==this.feedFast)this.emitSound(next?'fastOn':'fastOff');this.feedFast=next;}
    worldY(b) {return b.y+(this.groups.find(g=>g.id===b.group)?.offset||0);}
    dangerThreshold() {return this.c.dangerLine+this.c.dangerRowOffset;}
    dangerState() {
      const threshold=this.dangerThreshold(),active=new Set(),rescuing=new Set();
      const launched=new Set(this.groups.filter(g=>g.powered).map(g=>g.id));
      const live=new Set(this.cats.map(b=>b.id));
      for(const id of this.dangerSourceIds)if(!live.has(id))this.dangerSourceIds.delete(id);
      for(const b of this.cats){
        if(b.group===null&&b.y>=threshold){active.add(b.x);this.dangerSourceIds.add(b.id);}
        // 危険原因として記録された猫だけが救済対象。飛行中は高さにかかわらず追跡。
        else if(this.dangerSourceIds.has(b.id)&&launched.has(b.group))rescuing.add(b.x);
        else this.dangerSourceIds.delete(b.id);
      }
      // 同じ列に静止猫が残る場合は危険表示を優先する。
      const activeColumns=[...active].sort((a,b)=>a-b),rescuingColumns=[...rescuing].filter(x=>!active.has(x)).sort((a,b)=>a-b);
      const mode=activeColumns.length?'danger':rescuingColumns.length?'rescuing':'safe';
      return {threshold,activeColumns,rescuingColumns,mode,sourceIds:[...this.dangerSourceIds].sort((a,b)=>a-b)};
    }
    step(dt) {
      if(this.over)return;
      dt=Math.min(dt,0.025);this.time+=dt;
      this.releaseUnsupported();
      this.updateSpawns(dt);
      let landed=false;const landingCats=[];
      // 下の塊から処理することで着地時の支持面を先に確定。
      for(const g of [...this.groups].sort((a,b)=>Math.min(...a.cats.map(c=>c.y+a.offset))-Math.min(...b.cats.map(c=>c.y+b.offset)))) {
        if(!this.groups.includes(g))continue;
        const previous=g.offset;this.integrateFlight(g,dt);
        if(g.v>0) {
          // 上昇経路の猫は荷物として合流。すり抜けを避け、重さで勢いを落とす。
          const hits=this.cats.filter(b=>b.group!==g.id && g.cats.some(a=>a.x===b.x && this.worldY(b)>=a.y+previous+1-0.01 && this.worldY(b)<=a.y+g.offset+1));
          const others=new Set(hits.map(b=>b.group).filter(id=>id!==null));
          const cargo=[...new Set([...hits,...this.groups.filter(a=>others.has(a.id)).flatMap(a=>a.cats)])];
          if(cargo.length){for(const b of cargo){b.y=Math.ceil(this.worldY(b)-g.offset-0.001);b.group=g.id;g.cats.push(b);}this.groups=this.groups.filter(a=>!others.has(a.id));this.assignCluster(g.cats);g.v=Math.max(0,g.v-cargo.length*this.physics.blockWeight*this.physics.weightPenalty);}
        }
        if(g.powered) {
          const launched=g.cats.filter(b=>b.y+g.offset+.5>this.c.boardHeight+this.c.ejectMargin);
          if(launched.length) {
            const ids=new Set(launched.map(b=>b.id));
            this.ejected+=launched.length;this.emit(`LAUNCH +${launched.length}`,'launch');this.emitSound('launch',{groupId:g.id,count:launched.length});
            this.cats=this.cats.filter(b=>!ids.has(b.id));g.cats=g.cats.filter(b=>!ids.has(b.id));
            // 射出だけでは速度を変えない。重力運動をそのまま継続。
            if(!g.cats.length){this.groups=this.groups.filter(a=>a!==g);continue;}
          }
        }
        if(g.v<=0) {
          let support=-Infinity;
          for(const b of g.cats) {
            support=Math.max(support,-b.y);
            for(const a of this.cats) if(a.group!==g.id && a.x===b.x && this.worldY(a)+1<=b.y+previous+0.001)
              support=Math.max(support,this.worldY(a)+1-b.y);
          }
          if(g.offset<=support) {
            const supporting=this.groups.find(a=>a!==g && a.cats.some(b=>g.cats.some(c=>b.x===c.x && Math.abs(this.worldY(b)+1-(c.y+support))<0.01)));
            if(supporting) {
              for(const b of g.cats){b.y=Math.round(b.y+support-supporting.offset);b.group=supporting.id;supporting.cats.push(b);}
              supporting.powered ||= g.powered;if(supporting.powered){supporting.v=Math.max(-this.physics.maxFallSpeed,supporting.v);if(supporting.v<0)supporting.apexRemaining=0;this.assignCluster(supporting.cats);}
            } else {
              // 各列に着地。底面の段差は列ごとに落ち着かせる簡易方式。
              for(let x=0;x<this.c.boardWidth;x++) {
                const col=g.cats.filter(b=>b.x===x).sort((a,b)=>a.y-b.y);
                let y=Math.max(0,...this.cats.filter(b=>b.group===null && b.x===x).map(b=>b.y+1));
                for(const b of col){b.y=y++;b.group=null;if(b.burnt)b.burntRest=0;landingCats.push(b);}
              }
              this.emit('着地 · 次の点火を仕込もう','land');this.emitSound(g.powered||g.cats.some(b=>b.cluster!==null)?'blockLand':'catLand',{groupId:g.id,count:g.cats.length});landed=true;
            }
            this.groups=this.groups.filter(a=>a!==g);
          }
        }
      }
      this.fuseContacts([...landingCats,...this.groups.filter(g=>g.v<=0&&g.cats.some(b=>b.cluster!==null)).flatMap(g=>g.cats)]);
      if(this.drag&&!this.cats.some(b=>b.id===this.drag.id))this.endDrag();
      else if(landed&&!this.drag)this.scan();
      this.regenerate(dt);
      const liveClusters=new Set(this.cats.map(b=>b.cluster));
      for(const id of this.clusters.keys())if(!liveClusters.has(id))this.clusters.delete(id);
      const danger=this.dangerState();
      if(danger.mode==='danger'&&!this.dangerSoundEpisode)this.emitSound('dangerStart',{columns:[...danger.activeColumns]});
      this.dangerSoundEpisode=!!(danger.activeColumns.length||danger.rescuingColumns.length);
      if(danger.mode==='danger')this.danger+=dt;
      else if(danger.mode!=='rescuing')this.danger=Math.max(0,this.danger-dt*this.c.dangerRecoveryRate);
      if(this.danger>=this.c.dangerLimit){this.over=true;this.feedFast=false;this.drag=null;this.emit('GAME OVER','over');this.emitSound('over');}
    }
    scenario(name) {
      this.reset(true);this.autoSpawn=false;this.spawnTimer=999;
      if(name==='land') {
        this.add(0,0,0);this.add(1,0,0);this.makeGroup([this.add(2,3,0)],-1);return;
      }
      if(name==='fusion') {
        const types=[[0,1,0,3],[2,0,4,1]],parts=[[],[]];
        for(let y=0;y<2;y++)for(let x=0;x<4;x++)parts[x<2?0:1].push(this.add(x,y+3,types[y][x]));
        parts.forEach(cats=>this.makeGroup(cats,-1,true));this.add(5,0,4);return;
      }
      if(name==='danger') {for(let x=0;x<this.c.boardWidth;x++)for(let y=0;y<Math.max(this.c.boardHeight,this.dangerThreshold()+1);y++)this.add(x,y,(x+y*2)%5);return;}
      const rows=name==='light'?1:name==='air'?7:8;
      for(let x=0;x<3;x++)for(let y=0;y<rows;y++)this.add(x,y,y===0?0:(x+y)%5);
      for(let y=0;y<3;y++)this.add(5,y,(y+2)%5);
      if(name==='air'){for(let x=0;x<3;x++){this.at(x,2).type=x===1?2:1;this.at(x,3).type=x===1?1:3;}}
      this.scan();
    }
  }
  RocketGame.build='20261008-rescue-source-1';
  root.RocketGame=RocketGame;
  if(typeof module!=='undefined')module.exports=RocketGame;
})(globalThis);
