(function(root){
  'use strict';
  class SoundManager{
    constructor(manifest,settings,options={}){
      this.manifest=manifest;this.settings=settings;this.clock=options.clock||(()=>performance.now());
      this.createAudio=options.createAudio||(src=>new Audio(src));this.createContext=options.createContext||(()=>new AudioContext());
      this.enabled=false;this.muted=false;this.over=false;this.setName=manifest.fallbackSet;this.stage=0;this.stagePending=false;
      this.active=[];this.pools=new Map();this.cooldowns=new Map();this.history=[];this.errors=[];this.stats={requested:0,started:0,dropped:0,maxActive:0,maxVolumeSum:0};
      this.preloadSet(this.setName);
    }
    record(key,status,reason=''){this.history.push({key,status,reason,time:this.clock(),set:this.setName});if(this.history.length>this.settings.diagnosticLimit)this.history.shift();}
    fail(key,error){this.errors.push({key,message:String(error?.message||error),time:this.clock()});if(this.errors.length>20)this.errors.shift();this.record(key,'error',String(error?.message||error));}
    definition(key){const phase=this.manifest.timePhases?.[key];return this.manifest.sets[this.setName]?.[key]||(phase?.src?{src:phase.src,volume:'milestone',priority:2}:null);}
    preloadSet(name){
      for(const [key,definition] of Object.entries(this.manifest.sets[name]||{})){const poolKey=name+':'+key;if(this.pools.has(poolKey))continue;
        try{const audio=this.createAudio(definition.src);audio.preload='auto';audio.volume=0;this.pools.set(poolKey,[audio]);}catch(e){this.fail(key,e);}
      }
    }
    setSoundSet(name){const next=this.manifest.sets[name]?name:this.manifest.fallbackSet;if(next===this.setName)return;this.stopAll();this.cooldowns.clear();this.setName=next;this.preloadSet(next);}
    beginStage(name,onJingleEnd){this.stage++;this.stopAll();this.onJingleEnd=onJingleEnd;this.over=false;this.cooldowns.clear();this.setSoundSet(name);this.stagePending=true;this.playPendingJingle();}
    playPendingJingle(){
      if(!this.enabled||!this.stagePending||this.over)return;const stage=this.stage;this.stagePending=false;
      const complete=()=>{if(this.stage===stage&&!this.over){this.stagePending=false;const callback=this.onJingleEnd;this.onJingleEnd=null;callback?.();}};
      const accepted=this.play('stageJingle',{
        onComplete:reason=>{if(reason==='ended'||reason==='timeout')complete();else if(reason==='cancelled'&&this.stage===stage&&!this.over)this.stagePending=true;},
        onFailure:error=>{if(this.stage!==stage||this.over)return;if(error?.name==='NotAllowedError'||!this.onJingleEnd)this.stagePending=true;else complete();}
      });if(!accepted)this.stagePending=true;
    }
    unlock(){this.playPendingJingle();if(this.context?.state==='suspended')this.context.resume().catch(e=>this.fail('milestone',e));}
    setEnabled(enabled){this.enabled=!!enabled;if(!this.enabled)this.stopAll();else this.unlock();}
    setMasterVolume(volume){this.settings.masterVolume=Math.max(0,Math.min(1,volume));this.mix();}
    setVolume(volume){this.settings.seVolume=Math.max(0,Math.min(1,volume));this.mix();}
    setMuted(value){this.muted=!!value;this.mix();}
    finishStage(){if(this.over)return;this.stopAll();this.over=true;this.stagePending=false;this.play('gameOver');}
    stopAll(){for(const voice of [...this.active])voice.finish();}
    sweep(){const now=this.clock();for(const voice of [...this.active])if(voice.audio.ended||now>=voice.expires)voice.finish(voice.audio.ended?'ended':'timeout');const expiry=Math.max(this.settings.launchGroupCooldownMs,this.settings.defaultCooldownMs,...Object.values(this.settings.cooldowns));for(const [key,time] of this.cooldowns)if(now-time>=expiry)this.cooldowns.delete(key);}
    mix(){
      const highest=Math.max(0,...this.active.map(v=>v.priority));
      const levels=this.active.map(v=>(this.muted?0:1)*Math.max(0,Math.min(1,this.settings.masterVolume))*Math.max(0,Math.min(1,this.settings.seVolume??1))*Math.max(0,Math.min(1,this.settings.soundVolume[v.volume]??1))*(highest>=3&&v.priority<highest?(v.priority===0?this.settings.lowPriorityDuck:this.settings.otherPriorityDuck):1));
      const sum=levels.reduce((a,b)=>a+b,0),scale=sum>this.settings.mixHeadroom?this.settings.mixHeadroom/sum:1;
      this.active.forEach((v,i)=>{v.audio.volume=levels[i]*scale;});
      this.stats.maxVolumeSum=Math.max(this.stats.maxVolumeSum,levels.reduce((a,b)=>a+b*scale,0));
    }
    admit(key,priority,limit){
      this.sweep();if(this.active.filter(v=>v.key===key).length>=limit)return false;
      if(this.active.length>=this.settings.maxVoices){const lowest=this.active.reduce((a,b)=>a.priority<=b.priority?a:b);if(lowest.priority>=priority)return false;lowest.finish();}
      return true;
    }
    play(key,options={}){
      this.stats.requested++;const d=this.definition(key);
      if(!this.enabled||this.over&&key!=='gameOver'||!d){this.stats.dropped++;this.record(key,'dropped',!d?'undefined':!this.enabled?'muted':'game-over');return false;}
      const now=this.clock(),cooldownKey=this.setName+':'+key,groupKey=options.groupId==null?null:cooldownKey+':group:'+options.groupId;
      if(now-(this.cooldowns.get(cooldownKey)??-Infinity)<(this.settings.cooldowns[key]??this.settings.defaultCooldownMs)||groupKey&&now-(this.cooldowns.get(groupKey)??-Infinity)<this.settings.launchGroupCooldownMs){this.stats.dropped++;this.record(key,'dropped','cooldown');return false;}
      const limit=this.settings.perSoundLimits[key]??this.settings.defaultPerSoundLimit;
      if(!this.admit(key,d.priority,limit)){this.stats.dropped++;this.record(key,'dropped','voice-limit');return false;}
      const pool=this.pools.get(cooldownKey)||[];let audio=pool.find(a=>!this.active.some(v=>v.audio===a));
      if(!audio){try{audio=this.createAudio(d.src);audio.preload='auto';pool.push(audio);this.pools.set(cooldownKey,pool);}catch(e){this.fail(key,e);return false;}}
      const voice={key,priority:d.priority,volume:d.volume,audio,expires:now+(Number.isFinite(audio.duration)?audio.duration*1000+250:this.settings.maxVoiceLifetimeMs)};
      const finish=(reason='cancelled')=>{if(!this.active.includes(voice))return;audio.removeEventListener('ended',ended);audio.removeEventListener('error',error);audio.pause();this.active=this.active.filter(v=>v!==voice);this.mix();options.onComplete?.(reason);};
      const ended=()=>finish('ended');
      const failed=e=>{if(!this.active.includes(voice))return;this.fail(key,e);finish('error');if(key==='stageJingle')this.cooldowns.delete(cooldownKey);options.onFailure?.(e);};
      const error=()=>failed(new Error('WAV load/play failed: '+d.src));voice.finish=finish;
      try{audio.currentTime=0;}catch(e){this.fail(key,e);return false;}
      audio.addEventListener('ended',ended);audio.addEventListener('error',error);this.active.push(voice);this.stats.maxActive=Math.max(this.stats.maxActive,this.active.length);this.mix();
      this.cooldowns.set(cooldownKey,now);if(groupKey)this.cooldowns.set(groupKey,now);this.record(key,'requested');
      try{const playback=audio.play();Promise.resolve(playback).then(()=>{if(this.active.includes(voice)){this.stats.started++;this.record(key,'started');}},failed);}catch(e){failed(e);}
      return true;
    }
    // 既存の60/120/180秒の短い合成SEも同じミュート・音量・優先度の管理下に置く。
    playTimePhase(key){const phase=this.manifest.timePhases?.[key];if(!phase)return;if(this.definition(key))this.play(key);else {this.playMilestone(phase.stage);if(this.enabled&&!this.over)this.record(key,'phase-notification','synth');}}
    playMilestone(stage){
      if(!this.enabled||this.over||!this.admit('milestone',2,1))return;
      try{
        this.context ||= this.createContext();this.context.resume().catch(e=>this.fail('milestone',e));
        const context=this.context,gain=context.createGain(),notes=stage===1?[620]:stage===2?[620,820]:[280,200,280],nodes=[];
        gain.connect(context.destination);const duration=notes.length*.14+.15;
        const audio={ended:false,set volume(value){gain.gain.value=value*.1;},pause(){for(const o of nodes){try{o.stop();}catch{}}gain.disconnect();}};
        const voice={key:'milestone',priority:2,volume:'milestone',audio,expires:this.clock()+duration*1000,finish:()=>{if(!this.active.includes(voice))return;audio.pause();this.active=this.active.filter(v=>v!==voice);this.mix();}};
        this.active.push(voice);this.stats.maxActive=Math.max(this.stats.maxActive,this.active.length);this.mix();
        notes.forEach((f,i)=>{const start=context.currentTime+i*.14,o=context.createOscillator(),envelope=context.createGain();o.type=stage===3?'triangle':'sine';o.frequency.setValueAtTime(f,start);o.frequency.exponentialRampToValueAtTime(f*(stage===3?.75:1.2),start+.1);envelope.gain.setValueAtTime(1,start);envelope.gain.exponentialRampToValueAtTime(.03,start+.12);o.connect(envelope);envelope.connect(gain);nodes.push(o);o.start(start);o.stop(start+.13);});
        this.record('milestone','started');
      }catch(e){this.fail('milestone',e);}
    }
    diagnostics(){return {enabled:this.enabled,muted:this.muted,soundSet:this.setName,over:this.over,active:this.active.map(v=>({key:v.key,priority:v.priority,volume:v.audio.volume})),stats:{...this.stats},errors:[...this.errors],history:[...this.history]};}
  }
  root.SoundManager=SoundManager;if(typeof module!=='undefined')module.exports=SoundManager;
})(typeof globalThis!=='undefined'?globalThis:this);
