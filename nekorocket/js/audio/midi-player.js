(function(root){
  'use strict';
  // SMF format 0/1 + PPQN。音源依存を持たない簡易シンセ。GMサンプル音源の再現ではない。
  function parseMidi(buffer){
    const bytes=new Uint8Array(buffer),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let p=0,order=0;
    const need=n=>{if(p+n>bytes.length)throw new Error('Truncated MIDI');};
    const u8=()=>{need(1);return bytes[p++];},u16=()=>{need(2);const v=view.getUint16(p);p+=2;return v;},u32=()=>{need(4);const v=view.getUint32(p);p+=4;return v;};
    const tag=()=>String.fromCharCode(u8(),u8(),u8(),u8());
    const vlq=()=>{let v=0;for(let i=0;i<4;i++){const b=u8();v=(v<<7)|(b&127);if(!(b&128))return v;}throw new Error('Invalid MIDI delta');};
    if(tag()!=='MThd')throw new Error('Not a Standard MIDI File');
    const header=u32();if(header<6)throw new Error('Invalid MIDI header');need(header);const format=u16(),tracks=u16(),division=u16();p+=header-6;
    if(format>1||!division||(division&0x8000))throw new Error('Only SMF format 0/1, PPQN supported');
    const events=[];let finalTick=0;
    for(let t=0;t<tracks;t++){
      if(tag()!=='MTrk')throw new Error('Missing MIDI track');const size=u32();need(size);const end=p+size;let tick=0,running=0;
      while(p<end){
        tick+=vlq();let status=u8();if(status<128){if(!running)throw new Error('Invalid running status');p--;status=running;}
        if(status===255){running=0;const type=u8(),length=vlq();need(length);if(type===81&&length===3)events.push({tick,order:order++,tempo:bytes[p]*65536+bytes[p+1]*256+bytes[p+2]});p+=length;if(type===47)break;}
        else if(status===240||status===247){running=0;const length=vlq();need(length);p+=length;}
        else if(status>=128&&status<240){running=status;const kind=status>>4,ch=status&15,a=u8(),b=kind===12||kind===13?0:u8();if(a>127||b>127)throw new Error('Invalid MIDI data');events.push({tick,order:order++,kind,ch,a,b});}
        else throw new Error('Unsupported MIDI event');
        if(p>end)throw new Error('MIDI event exceeds track');
      }
      finalTick=Math.max(finalTick,tick);p=end;
    }
    events.sort((a,b)=>a.tick-b.tick||a.order-b.order);
    let tick=0,time=0,tempo=500000;const notes=[],active=new Map(),channels=Array.from({length:16},()=>({program:0,volume:100/127,expression:1,sustain:false,held:[]}));
    const close=(note,at)=>{if(note)notes.push({...note,duration:Math.max(.01,at-note.start)});};
    for(const e of events){time+=(e.tick-tick)*tempo/1e6/division;tick=e.tick;if(e.tempo){tempo=e.tempo;continue;}
      const c=channels[e.ch],key=e.ch+':'+e.a;
      if(e.kind===12)c.program=e.a;
      else if(e.kind===11){if(e.a===7)c.volume=e.b/127;else if(e.a===11)c.expression=e.b/127;else if(e.a===64){const down=e.b>=64;if(c.sustain&&!down){c.held.forEach(n=>close(n,time));c.held=[];}c.sustain=down;}else if(e.a===120||e.a===123){for(const [k,n] of active)if(n.ch===e.ch){close(n,time);active.delete(k);}c.held.forEach(n=>close(n,time));c.held=[];}}
      else if(e.kind===9&&e.b){close(active.get(key),time);active.set(key,{start:time,note:e.a,ch:e.ch,program:c.program,velocity:e.b/127*c.volume*c.expression});}
      else if(e.kind===8||e.kind===9&&!e.b){const n=active.get(key);if(n){active.delete(key);if(c.sustain)c.held.push(n);else close(n,time);}}
    }
    time+=(finalTick-tick)*tempo/1e6/division;
    for(const n of active.values())close(n,time);for(const c of channels)c.held.forEach(n=>close(n,time));
    notes.sort((a,b)=>a.start-b.start);
    return {notes,duration:notes.reduce((duration,n)=>Math.max(duration,n.start+n.duration),Math.max(.1,time))};
  }
  // MIDIは必要になった時だけ取得。file://ではSTART.batが作るバイト完全一致のsidecarを読む。
  async function loadMidi(src,options={}){
    const protocol=options.protocol??root.location?.protocol;
    if(protocol!=='file:'){
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),options.timeoutMs||5000);
      try{const response=await (options.fetch||root.fetch)(src,{signal:controller.signal});if(!response.ok)throw new Error('MIDI missing: '+src);return parseMidi(await response.arrayBuffer());}finally{clearTimeout(timer);}
    }
    const script=document.createElement('script');const key=decodeURI(src.replace(/^\.\//,''));
    root.NekoMidiAssets ||= Object.create(null);
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{script.remove();reject(new Error('MIDI sidecar timeout'));},options.timeoutMs||5000);
      script.onload=()=>{clearTimeout(timer);script.remove();resolve();};script.onerror=()=>{clearTimeout(timer);script.remove();reject(new Error('MIDI sidecar missing: '+src+'.js (START.batで準備してください)'));};script.src=src+'.js';document.head.append(script);
    });
    const encoded=root.NekoMidiAssets[key];if(!encoded)throw new Error('MIDI sidecar has no data: '+key);
    delete root.NekoMidiAssets[key];const binary=atob(encoded),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));return parseMidi(bytes.buffer);
  }
  class MidiPlayer{
    constructor(score,context,settings={}){
      this.score=score;this.context=context;this.settings={lookAhead:.2,maxVoices:48,voiceGain:.08,...settings};
      this.output=context.createGain();this.output.gain.value=0;this.output.connect(context.destination);this.nodes=new Set();this.playing=false;this.position=0;this.cursor=0;
    }
    get duration(){return this.score.duration;}
    get currentTime(){return this.playing?(this.position+this.context.currentTime-this.started)%this.duration:this.position;}
    set volume(value){this.output.gain.value=value;}
    async play(position=0){await this.context.resume();if(this.context.state!=='running'){const e=new Error('AudioContext suspended');e.name='NotAllowedError';throw e;}this.stopNotes();this.position=position%this.duration;this.started=this.context.currentTime;this.playing=true;this.cycle=0;this.cursor=0;while(this.cursor<this.score.notes.length&&this.score.notes[this.cursor].start+this.score.notes[this.cursor].duration<=this.position)this.cursor++;if(this.cursor===this.score.notes.length){this.cursor=0;this.cycle=1;}this.update();}
    update(){
      if(!this.playing)return;const elapsed=this.context.currentTime-this.started+this.position,horizon=elapsed+this.settings.lookAhead,notes=this.score.notes;
      if(!notes.length)return;
      while(this.cycle*this.duration+notes[this.cursor].start<=horizon){
        const n=notes[this.cursor],start=this.started-this.position+this.cycle*this.duration+n.start,end=start+n.duration;
        if(end>this.context.currentTime)this.note(n,Math.max(this.context.currentTime,start),end);
        this.cursor++;if(this.cursor>=notes.length){this.cursor=0;this.cycle++;}
        // バックグラウンドから復帰した時に過去のループを逐次再生しない。
        if(this.cycle*this.duration+this.duration<elapsed){this.cycle=Math.floor(elapsed/this.duration);this.cursor=0;}
      }
    }
    note(n,start,end){
      if(this.nodes.size>=this.settings.maxVoices)return;
      const o=this.context.createOscillator(),g=this.context.createGain(),percussion=n.ch===9;
      o.type=percussion?'triangle':['triangle','sine','triangle','sawtooth'][Math.floor(n.program/8)%4];
      const freq=440*Math.pow(2,(n.note-69)/12);o.frequency.setValueAtTime(percussion?Math.min(freq,180):freq,start);
      end=percussion?Math.min(end,start+.12):end;const attack=Math.min(.015,(end-start)/2),level=n.velocity*this.settings.voiceGain;
      g.gain.setValueAtTime(0,start);g.gain.linearRampToValueAtTime(level,start+attack);g.gain.setValueAtTime(level,Math.max(start+attack,end-.03));g.gain.linearRampToValueAtTime(0,end+.025);
      o.connect(g);g.connect(this.output);this.nodes.add(o);o.onended=()=>{this.nodes.delete(o);o.disconnect();g.disconnect();};o.start(start);o.stop(end+.03);
    }
    stopNotes(){for(const o of this.nodes){try{o.stop();}catch{}}this.nodes.clear();}
    stop(){this.position=this.currentTime;this.playing=false;this.stopNotes();}
    dispose(){this.stop();this.output.disconnect();}
  }
  const api={parseMidi,loadMidi,MidiPlayer};root.NekoMidi=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
