(function(root){
  'use strict';
  const definitions={
    stageJingle:['stage_jingle','stageJingle',1],catLand:['cat_land','catLand',0],
    igniteSmall:['ignite_small','igniteSmall',1],igniteLarge:['ignite_large','igniteLarge',2],igniteVertical:['ignite_vertical','igniteVertical',2],
    chain2:['chain_2','chain',1],chain3:['chain_3','chain',2],chain4Plus:['chain_4_plus','chain',3],
    fusion:['fusion','fusion',1],blockLandSmall:['block_land_small','blockLandSmall',0],blockLandMedium:['block_land_medium','blockLandMedium',1],blockLandLarge:['block_land_large','blockLandLarge',2],
    launchSuccess:['launch_success','launchSuccess',2],fastOn:['fast_on','fast',1],fastOff:['fast_off','fast',1],
    dangerStart:['danger_start','dangerStart',3],gameOver:['game_over','gameOver',4],swap:['swap','swap',0]
  };
  const manifest={fallbackSet:'standard',sets:{standard:Object.fromEntries(Object.entries(definitions).map(([key,[file,volume,priority]])=>[key,{src:`./assets/audio/standard/standard_${file}.wav`,volume,priority}]))}};
  // srcに専用音源パスを指定すると合成通知音から差し替え。ゲーム側は論理名だけを使用。
  manifest.timePhases={timePhase60:{stage:1,src:null},timePhase120:{stage:2,src:null},timePhase180:{stage:3,src:null}};
  root.SoundManifest=manifest;if(typeof module!=='undefined')module.exports=manifest;
})(typeof globalThis!=='undefined'?globalThis:this);
