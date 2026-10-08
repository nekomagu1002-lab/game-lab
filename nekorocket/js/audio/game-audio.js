(function(root){
  'use strict';
  class GameAudio{
    constructor(game,manager,bgm=null){this.game=game;this.manager=manager;this.bgm=bgm;}
    beginStage(){const afterJingle=this.bgm?.beginStage();this.manager.beginStage(this.game.c.planetProfiles[this.game.c.planetId].soundSet||this.manager.manifest.fallbackSet,afterJingle);}
    update(){
      this.manager.setSoundSet(this.game.c.planetProfiles[this.game.c.planetId].soundSet||this.manager.manifest.fallbackSet);
      const events=this.game.drainSoundEvents();this.manager.sweep();
      if(this.bgm&&!['game','over'].includes(this.bgm.scene))return;
      // 終了フレームの通常SEは鳴らさず、終了音を最優先。以降の通常SEも遮断。
      if(events.some(e=>e.kind==='over')){
        if(this.bgm){this.manager.over=true;this.manager.stagePending=false;this.manager.stopAll();const stage=this.manager.stage;this.bgm.finishStage(()=>{if(this.manager.stage===stage){this.manager.over=false;this.manager.finishStage();}});}
        else this.manager.finishStage();return;
      }
      for(const e of events){
        switch(e.kind){
          case 'ignite':this.manager.play(e.direction==='vertical'?'igniteVertical':e.match>=4?'igniteLarge':'igniteSmall');if(e.chainLevel>=2)this.manager.play(e.chainLevel===2?'chain2':e.chainLevel===3?'chain3':'chain4Plus');break;
          case 'swap':this.manager.play('swap');break;
          case 'catLand':this.manager.play('catLand');break;
          case 'blockLand':{const [small,medium]=this.manager.settings.blockLandThresholds;this.manager.play(e.count<=small?'blockLandSmall':e.count<=medium?'blockLandMedium':'blockLandLarge');break;}
          case 'fusion':this.manager.play('fusion');break;
          case 'launch':this.manager.play('launchSuccess',{groupId:e.groupId});break;
          case 'fastOn':case 'fastOff':case 'dangerStart':this.manager.play(e.kind);break;
        }
      }
    }
  }
  root.GameAudio=GameAudio;if(typeof module!=='undefined')module.exports=GameAudio;
})(typeof globalThis!=='undefined'?globalThis:this);
