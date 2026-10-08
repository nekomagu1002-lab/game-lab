(function(root){
  'use strict';
  // 拡張子はマネージャーのformatPriorityで解決。惑星追加はこの表とconfigの定義だけ。
  const manifest={tracks:{
    title:{base:'./assets/audio/bgm/common/title'},
    stage_select:{base:'./assets/audio/bgm/common/stage_select'},
    stage01_standard_early:{base:'./assets/audio/bgm/standard/stage01_standard_early'},
    stage01_standard_late:{base:'./assets/audio/bgm/standard/stage01_standard_late'}
  }};
  root.BgmManifest=manifest;if(typeof module!=='undefined')module.exports=manifest;
})(typeof globalThis!=='undefined'?globalThis:this);
