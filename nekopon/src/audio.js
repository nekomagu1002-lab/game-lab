(function(N){
  'use strict';
  N.Audio=class{
    constructor(save){this.save=save;this.ctx=null;this.lastContact=0;this.nextNote=0;this.note=0;this.musicGain=null;this.active=true;}
    unlock(){try{if(!this.ctx){this.ctx=new (globalThis.AudioContext||globalThis.webkitAudioContext)();this.musicGain=this.ctx.createGain();this.musicGain.connect(this.ctx.destination);}if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});}catch{}}
    tone(frequency,start,duration,volume,type='sine',music=false){if(!this.ctx)return;const o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(frequency,start);g.gain.setValueAtTime(0,start);g.gain.linearRampToValueAtTime(volume,start+.012);g.gain.exponentialRampToValueAtTime(.0001,start+duration);o.connect(g);g.connect(music?this.musicGain:this.ctx.destination);o.start(start);o.stop(start+duration+.02);o.onended=()=>{o.disconnect();g.disconnect();};}
    sync(){if(this.musicGain)this.musicGain.gain.setTargetAtTime(this.save.data.bgm&&this.active?1:0,this.ctx.currentTime,.035);}
    sound(type,level=0,chain=1){if(!this.ctx||!this.save.data.se||!this.active)return;const now=this.ctx.currentTime;
      if(type==='contact'){if(now-this.lastContact<.15)return;this.lastContact=now;this.tone(140,now,.07,.025);return;}
      const notes={drop:[330,250],merge:[440+level*34,660+level*34],god:[523,659,784,1047],clear:[523,659,784,1047,1319],over:[330,294,220]}[type];
      if(notes)notes.forEach((n,i)=>this.tone(n*(type==='merge'?1+Math.min(chain-1,5)*.04:1),now+i*.09,type==='god'||type==='clear'?.55:.22,.07));
    }
    tick(){if(!this.ctx)return;this.sync();if(!this.active||!this.save.data.bgm||this.ctx.state!=='running')return;const now=this.ctx.currentTime;if(now>=this.nextNote){const melody=[262,330,392,330,294,349,440,349,262,330,392,523,440,392,330,294];this.tone(melody[this.note++%melody.length],now,.8,.025,'sine',true);if(this.note%4===1)this.tone(131,now,1.2,.02,'sine',true);this.nextNote=now+.55;}}
  };
})(globalThis.Nekopon=globalThis.Nekopon||{});
