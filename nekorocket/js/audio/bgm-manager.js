(function(root){
  'use strict';
  const clamp=v=>Math.max(0,Math.min(1,v));
  class BgmManager{
    constructor(manifest,settings,options={}){
      this.manifest=manifest;this.settings=settings;this.options=options;this.clock=options.clock||(()=>performance.now()/1000);
      this.createAudio=options.createAudio||(src=>new Audio(src));this.createContext=options.createContext||(()=>new AudioContext());
      this.cache=new Map();this.entries=[];this.enabled=false;this.muted=false;this.paused=false;this.hidden=false;this.desired=null;this.revision=0;this.history=[];
    }
    record(track,event,detail=''){this.history.push({track,event,detail,time:this.clock()});if(this.history.length>100)this.history.shift();}
    warn(track,error){this.record(track,'warning',String(error?.message||error));(this.options.warn||console.warn)('[BGM] '+track+': '+(error?.message||error));}
    async midiApi(){
      if(this.options.midi)return this.options.midi;
      if(root.NekoMidi)return root.NekoMidi;
      this.midiPromise ||= new Promise((resolve,reject)=>{
        const s=document.createElement('script'),timer=setTimeout(()=>{s.remove();reject(new Error('MIDI module timeout'));},this.settings.loadTimeoutMs);s.src=this.settings.midiModule;s.onload=()=>{clearTimeout(timer);s.remove();root.NekoMidi?resolve(root.NekoMidi):reject(new Error('MIDI module unavailable'));};s.onerror=()=>{clearTimeout(timer);s.remove();reject(new Error('MIDI module load failed'));};document.head.append(s);
      });return this.midiPromise;
    }
    probeMedia(src){
      if(this.options.probeMedia)return this.options.probeMedia(src);
      return new Promise((resolve,reject)=>{
        const audio=this.createAudio(src);audio.preload='metadata';audio.volume=0;
        const clear=()=>{clearTimeout(timer);audio.removeEventListener('loadedmetadata',ready);audio.removeEventListener('error',fail);audio.pause();audio.removeAttribute('src');audio.load();};
        const ready=()=>{const duration=audio.duration;clear();Number.isFinite(duration)&&duration>0?resolve({duration}):reject(new Error('Invalid media duration'));};
        const fail=()=>{clear();reject(new Error('Missing or unsupported media: '+src));};
        const timer=setTimeout(fail,this.settings.loadTimeoutMs);audio.addEventListener('loadedmetadata',ready);audio.addEventListener('error',fail);audio.load();
      });
    }
    resolveTrack(track){
      if(this.cache.has(track))return this.cache.get(track);
      const promise=(async()=>{
        const d=this.manifest.tracks[track];if(!d){this.warn(track,'Undefined logical name');return null;}
        const failures=[];
        for(const format of this.settings.formatPriority){
          const src=d.files?.[format]||(d.base+'.'+format);
          try{
            if(format==='mid'){
              const api=await this.midiApi(),score=await api.loadMidi(src,{timeoutMs:this.settings.loadTimeoutMs});this.record(track,'resolved',format);return {format,src,score,api};
            }
            const info=await this.probeMedia(src);this.record(track,'resolved',format);return {format,src,...info};
          }catch(e){failures.push(format+': '+e.message);}
        }
        this.warn(track,failures.join(' / '));return null;
      })();this.cache.set(track,promise);return promise;
    }
    createPlayer(resolved){
      if(resolved.format==='mid'){this.context ||= this.createContext();return new resolved.api.MidiPlayer(resolved.score,this.context,this.settings.midiSynth);}
      const a=this.createAudio(resolved.src),loadTimeoutMs=this.settings.loadTimeoutMs;a.preload='auto';a.loop=true;a.volume=0;
      return {get currentTime(){return a.currentTime||0;},get duration(){return Number.isFinite(a.duration)?a.duration:resolved.duration;},set volume(v){a.volume=v;},
        async play(position){
          if(position>0&&a.readyState<1)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>done(new Error('BGM seek timeout')),loadTimeoutMs);const ready=()=>done(),error=()=>done(new Error('BGM load failed'));function done(e){clearTimeout(timer);a.removeEventListener('loadedmetadata',ready);a.removeEventListener('error',error);e?reject(e):resolve();}a.addEventListener('loadedmetadata',ready);a.addEventListener('error',error);a.load();});
          a.currentTime=position%(Number.isFinite(a.duration)?a.duration:resolved.duration);await a.play();
        },stop(){a.pause();},dispose(){a.pause();a.removeAttribute('src');a.load();}};
    }
    level(){return this.enabled&&!this.muted&&!this.hidden?clamp(this.settings.masterVolume)*clamp(this.settings.bgmVolume)*(this.paused?this.settings.pauseVolumeScale:1):0;}
    applyVolume(){for(const e of this.entries)e.player.volume=clamp(e.gain*this.level());}
    setEnabled(value){this.enabled=!!value;this.applyVolume();if(value)this.unlock();}
    setMuted(value){this.muted=!!value;this.applyVolume();if(!value)this.unlock();}
    setMasterVolume(value){this.settings.masterVolume=clamp(value);this.applyVolume();}
    setVolume(value){this.settings.bgmVolume=clamp(value);this.applyVolume();}
    setPaused(value){this.paused=!!value;this.applyVolume();}
    setHidden(value){this.hidden=!!value;this.applyVolume();if(!value)this.unlock();}
    unlock(){
      if(this.context?.state==='suspended')this.context.resume().catch(e=>this.warn('MIDI',e));
      if(this.enabled&&!this.muted&&this.desired&&!this.entries.some(e=>e.track===this.desired.track&&e.started))this.playBgm(this.desired.track,this.desired.options);
    }
    fade(entry,to,duration){entry.fade={from:entry.gain,to,start:this.clock(),duration:Math.max(0,duration)};}
    async playBgm(track,options={}){
      this.desired={track,options};const revision=++this.revision;
      if(!this.enabled||this.muted)return false;
      let entry=this.entries.find(e=>e.track===track);
      if(entry?.started){for(const e of this.entries)this.fade(e,e===entry?1:0,options.duration??this.settings.crossFadeDuration);return true;}
      const resolved=await this.resolveTrack(track);if(revision!==this.revision)return false;
      if(!resolved){for(const e of this.entries)this.fade(e,0,options.duration??this.settings.crossFadeDuration);return false;}
      try{
        this.tick();const old=this.entries.reduce((a,b)=>!a||b.gain>a.gain?b:a,null);
        const position=options.sync&&old?old.player.currentTime:0;
        const player=this.createPlayer(resolved);entry={track,format:resolved.format,player,gain:0,started:false,fade:null};
        // 最大2曲。切り替え連打時は最も大きい旧曲だけを残す。
        for(const e of [...this.entries])if(e!==old)this.remove(e);
        this.entries.push(entry);this.applyVolume();await player.play(position);
        if(revision!==this.revision){this.remove(entry);return false;}
        entry.started=true;this.record(track,'playing',resolved.format);
        const duration=options.duration??this.settings.crossFadeDuration;for(const e of this.entries)this.fade(e,e===entry?1:0,duration);this.tick();return true;
      }catch(e){if(entry)this.remove(entry);if(e.name!=='NotAllowedError')this.warn(track,e);else this.record(track,'await-gesture');return false;}
    }
    remove(entry){if(!this.entries.includes(entry))return;entry.player.dispose();this.entries=this.entries.filter(e=>e!==entry);entry.onStop?.();}
    stop(duration=0){
      this.revision++;this.desired=null;this.tick();
      if(duration<=0){for(const e of [...this.entries])this.remove(e);return Promise.resolve();}
      return Promise.all(this.entries.map(e=>new Promise(resolve=>{const previous=e.onStop;e.onStop=()=>{previous?.();resolve();};this.fade(e,0,duration);}))).then(()=>{});
    }
    tick(){
      const now=this.clock();for(const e of [...this.entries]){
        e.player.update?.();if(e.fade){const p=e.fade.duration?Math.min(1,(now-e.fade.start)/e.fade.duration):1;e.gain=e.fade.from+(e.fade.to-e.fade.from)*p;if(p>=1){const to=e.fade.to;e.fade=null;if(!to)this.remove(e);}}
      }this.applyVolume();
    }
    diagnostics(){return {enabled:this.enabled,muted:this.muted,paused:this.paused,desired:this.desired?.track??null,entries:this.entries.map(e=>({track:e.track,format:e.format,position:e.player.currentTime,gain:e.gain,volume:e.gain*this.level()})),history:[...this.history]};}
  }
  class GameBgm{
    constructor(game,manager,settings){this.game=game;this.manager=manager;this.settings=settings;this.scene='title';this.mode='early';this.stage=0;this.waiting=false;this.rate=0;}
    profile(){return this.game.c.planetProfiles[this.game.c.planetId].bgm;}
    enterScene(scene){this.stage++;this.scene=scene;this.waiting=false;this.manager.setPaused(false);if(scene==='title'||scene==='stageSelect')this.manager.playBgm(this.settings.common[scene],{duration:this.settings.menuFadeDuration});}
    beginStage(){this.stage++;this.scene='game';this.mode='early';this.waiting=true;this.manager.stop();const stage=this.stage;return ()=>{if(stage!==this.stage||this.scene!=='game')return;this.waiting=false;this.manager.playBgm(this.profile().earlyTrack,{duration:this.settings.fadeInDuration});};}
    // 盤面内に中心がある猫の実占有セルを数える。飛行中も実位置を使用し、盤面外は除く。
    occupancy(){const cells=new Set(),g=this.game;for(const b of g.cats){const y=g.worldY(b)+.5;if(b.x>=0&&b.x<g.c.boardWidth&&y>=0&&y<g.c.boardHeight)cells.add(b.x+':'+Math.floor(y));}return cells.size/(g.c.boardWidth*g.c.boardHeight);}
    update(){
      this.manager.tick();this.rate=this.occupancy();if(this.scene!=='game'||this.waiting||this.game.over)return;
      const p=this.profile();let next=this.mode;
      if(p.switchMode==='danger')next=this.game.dangerState().mode==='danger'?'late':'early';
      else if(this.mode==='early'&&this.rate>=p.lateThreshold)next='late';else if(this.mode==='late'&&this.rate<=p.earlyThreshold)next='early';
      if(next!==this.mode){this.mode=next;this.manager.playBgm(p[next+'Track'],{sync:true,duration:p.crossFadeDuration});}
    }
    async finishStage(onFinished){this.scene='over';this.waiting=false;const stage=++this.stage;await this.manager.stop(this.settings.gameOverFadeDuration);if(this.stage===stage&&this.scene==='over')onFinished();}
  }
  root.BgmManager=BgmManager;root.GameBgm=GameBgm;if(typeof module!=='undefined')module.exports={BgmManager,GameBgm};
})(typeof globalThis!=='undefined'?globalThis:this);
