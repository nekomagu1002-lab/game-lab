(function (N) {
  'use strict';
  const C = N.config;
  function ellipse(ctx, x, y, rx, ry, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
  // Independent visual layers. Replace any layer with sprites without changing the circular collider.
  N.catLayers = {
    body(ctx, level, r) {
      const color = C.cats[level].color;
      if (level === 9) {
        const glow=ctx.createRadialGradient(0,0,r*.8,0,0,r*1.14);
        glow.addColorStop(0,'#f4d67b55');glow.addColorStop(1,'#f4d67b00');
        ellipse(ctx,0,0,r*1.14,r*1.14,glow);
        ctx.strokeStyle='#d2af62';ctx.lineWidth=r*.025;
        for(let i=0;i<16;i++){const a=i*Math.PI/8;ctx.beginPath();ctx.moveTo(Math.cos(a)*r*1.01,Math.sin(a)*r*1.01);ctx.lineTo(Math.cos(a)*r*1.09,Math.sin(a)*r*1.09);ctx.stroke();}
      }
      ctx.fillStyle = color; ctx.strokeStyle = '#64665c'; ctx.lineWidth = Math.max(1.4, r * 0.035);
      ctx.beginPath();ctx.moveTo(-r*.76,-r*.46);ctx.lineTo(-r*.73,-r*1.08);ctx.quadraticCurveTo(-r*.65,-r*1.2,-r*.27,-r*.77);ctx.lineTo(r*.27,-r*.77);ctx.quadraticCurveTo(r*.65,-r*1.2,r*.73,-r*1.08);ctx.lineTo(r*.76,-r*.46);ctx.fill();ctx.stroke();
      ellipse(ctx,-r*.58,-r*.8,r*.1,r*.15,'#e1a89c');ellipse(ctx,r*.58,-r*.8,r*.1,r*.15,'#e1a89c');
      ctx.beginPath();ctx.arc(0,0,r*.96,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.stroke();
      if (level === 3) ellipse(ctx,0,r*.2,r*.78,r*.39,'#fff1db');
      else if (level > 0) ellipse(ctx,0,r*.35,r*.67,r*.49,'#fff7e344');
      if (level === 2 || level === 4) {
        ctx.strokeStyle = level === 2 ? '#598e7d' : '#577eaa';
        ctx.lineWidth = r * .12; ctx.lineCap = 'round';
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath(); ctx.moveTo(i*r*.22,-r*.79); ctx.lineTo(i*r*.18,-r*.53); ctx.stroke();
        }
      }
    },
    face(ctx, level, r) {
      ctx.strokeStyle='#54564e';ctx.fillStyle='#54564e';ctx.lineWidth=Math.max(1.5,r*.045);ctx.lineCap='round';
      // The smallest face has only two dots and a mouth; no fine markings to blur at phone scale.
      if (level === 0) {
        for (const s of [-1,1]) ellipse(ctx,s*r*.29,-r*.06,r*.062,r*.068,'#54564e');
        ctx.beginPath(); ctx.moveTo(-r*.10,r*.2); ctx.quadraticCurveTo(0,r*.29,r*.1,r*.2); ctx.stroke();
        return;
      }
      if (level === 1) {
        for (const s of [-1,1]) {
          ellipse(ctx,s*r*.29,-r*.08,r*.10,r*.13,'#645264');
          ellipse(ctx,s*r*.29-r*.025,-r*.12,r*.029,r*.035,'#fff9f1');
          ellipse(ctx,s*r*.5,r*.19,r*.12,r*.07,'#d584a3');
        }
        ellipse(ctx,0,r*.22,r*.07,r*.09,'#925b73');
        return;
      }
      if(level===3||level===7){for(const s of [-1,1]){const x=s*r*(level===3?.37:.3);ctx.beginPath();ctx.moveTo(x-r*.13,-r*.04);ctx.quadraticCurveTo(x,-r*(level===7?.2:.04),x+r*.13,-r*.04);ctx.stroke();}}
      else {ellipse(ctx,-r*.3,-r*.12,r*.055,r*.082,'#54564e');ellipse(ctx,r*.3,-r*.12,r*.055,r*.082,'#54564e');}
      if(level!==3){ellipse(ctx,-r*.48,r*.1,r*.14,r*.072,'#e3a49a77');ellipse(ctx,r*.48,r*.1,r*.14,r*.072,'#e3a49a77');}
      ctx.beginPath();ctx.moveTo(-r*.07,r*.04);ctx.lineTo(r*.07,r*.04);ctx.lineTo(0,r*.12);ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.moveTo(0,r*.1);ctx.quadraticCurveTo(-r*.02,r*.26,-r*.17,r*.18);ctx.moveTo(0,r*.1);ctx.quadraticCurveTo(r*.02,r*.26,r*.17,r*.18);ctx.stroke();
      for(const s of [-1,1]) {ctx.beginPath();ctx.moveTo(s*r*.61,r*.02);ctx.lineTo(s*r*.84,-r*.02);ctx.moveTo(s*r*.62,r*.17);ctx.lineTo(s*r*.84,r*.21);ctx.stroke();}
    },
    decoration(ctx, level, r) {
      if (level === 1) {
        ctx.fillStyle='#b96e92'; ctx.beginPath(); ctx.moveTo(0,-r*.43);
        ctx.bezierCurveTo(-r*.34,-r*.66,-r*.12,-r*.87,0,-r*.68);
        ctx.bezierCurveTo(r*.12,-r*.87,r*.34,-r*.66,0,-r*.43); ctx.fill();
      }
      if (level === 5) {
        // Broad helmet, side guards and a gold crescent crest.
        ctx.fillStyle='#4e716c'; ctx.beginPath();ctx.ellipse(0,-r*.39,r*.82,r*.55,0,Math.PI,Math.PI*2);ctx.fill();
        for(const s of [-1,1]){ctx.beginPath();ctx.roundRect(s*r*.75-r*.12,-r*.48,r*.24,r*.46,r*.06);ctx.fill();}
        ctx.strokeStyle='#e3bd68';ctx.lineWidth=r*.10;ctx.beginPath();ctx.arc(0,-r*.86,r*.29,.12,Math.PI-.12);ctx.stroke();
        ctx.fillStyle='#e3bd68';ctx.beginPath();ctx.moveTo(0,-r*.7);ctx.lineTo(r*.12,-r*.47);ctx.lineTo(-r*.12,-r*.47);ctx.fill();
      }
      if (level === 6) {
        ctx.fillStyle='#555865';ctx.beginPath();ctx.roundRect(-r*.12,-r*1.16,r*.24,r*.55,r*.07);ctx.fill();
        ctx.beginPath();ctx.roundRect(-r*.25,-r*1.20,r*.5,r*.17,r*.07);ctx.fill();
        ctx.strokeStyle='#97719e';ctx.lineWidth=r*.15;ctx.beginPath();ctx.moveTo(-r*.62,r*.52);ctx.lineTo(0,r*.85);ctx.lineTo(r*.62,r*.52);ctx.stroke();
        ellipse(ctx,0,r*.73,r*.13,r*.13,'#e5bf67');
      }
      if (level === 7) {
        ctx.strokeStyle='#fffdf2';ctx.lineWidth=r*.13;
        for(const s of [-1,1]){ctx.beginPath();ctx.moveTo(s*r*.15,-r*.24);ctx.quadraticCurveTo(s*r*.43,-r*.43,s*r*.64,-r*.15);ctx.stroke();}
        ctx.fillStyle='#fffdf2';ctx.beginPath();ctx.moveTo(-r*.25,r*.18);ctx.quadraticCurveTo(-r*.48,r*.57,0,r*.9);ctx.quadraticCurveTo(r*.48,r*.57,r*.25,r*.18);ctx.quadraticCurveTo(0,r*.4,-r*.25,r*.18);ctx.fill();
        ctx.strokeStyle='#6aaba0';ctx.lineWidth=r*.065;ctx.beginPath();ctx.arc(0,-r*.6,r*.16,0,Math.PI*1.7);ctx.stroke();
      }
      if (level === 8) {
        ctx.strokeStyle='#866ba7';ctx.lineWidth=r*.09;ctx.beginPath();ctx.moveTo(r*.1,-r*.82);ctx.lineTo(-r*.17,-r*.51);ctx.lineTo(r*.14,-r*.51);ctx.lineTo(-r*.08,-r*.26);ctx.stroke();
        for(const s of [-1,1]){ctx.strokeStyle='#a186ba';ctx.lineWidth=r*.055;ctx.beginPath();ctx.moveTo(s*r*.62,r*.22);ctx.lineTo(s*r*.71,r*.35);ctx.lineTo(s*r*.84,r*.22);ctx.stroke();}
      }
      if (level === 9) {
        ctx.strokeStyle='#ba9342';ctx.lineWidth=r*.07;ctx.beginPath();ctx.ellipse(0,-r*1.1,r*.54,r*.13,0,0,Math.PI*2);ctx.stroke();
        ctx.fillStyle='#ba9342';ctx.beginPath();ctx.moveTo(0,-r*.77);ctx.lineTo(r*.14,-r*.56);ctx.lineTo(0,-r*.35);ctx.lineTo(-r*.14,-r*.56);ctx.fill();
        ctx.strokeStyle='#fffdf2';ctx.lineWidth=r*.1;ctx.beginPath();ctx.arc(0,r*.15,r*.62,.35,Math.PI-.35);ctx.stroke();
      }
    },
    effect(ctx, level, r) {
      if (level < 8) return;
      ctx.save();ctx.strokeStyle=level===9?'#d4b46799':'#b69fcd88';ctx.lineWidth=Math.max(1.3,r*.025);
      if(level===9){for(let i=0;i<12;i++){const a=i*Math.PI/6;ctx.beginPath();ctx.moveTo(Math.cos(a)*r*.84,Math.sin(a)*r*.84);ctx.lineTo(Math.cos(a)*r*.92,Math.sin(a)*r*.92);ctx.stroke();}}
      else {ctx.beginPath();ctx.ellipse(0,r*.46,r*1.02,r*.23,-.15,0,Math.PI*2);ctx.stroke();}
      ctx.restore();
    }
  };
  N.drawCat = function(ctx, level, x, y, r, angle = 0, silhouette = false) {
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    if(silhouette){ellipse(ctx,0,0,r*.94,r*.94,'#d8ddd1');ctx.fillStyle='#d8ddd1';for(const s of [-1,1]){ctx.beginPath();ctx.moveTo(s*r*.7,-r*.35);ctx.lineTo(s*r*.7,-r*.95);ctx.lineTo(s*r*.18,-r*.68);ctx.fill();}ctx.fillStyle='#818b7a';ctx.font=`bold ${r}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('?',0,1);}
    else for(const layer of Object.values(N.catLayers)) layer(ctx,level,r);
    ctx.restore();
  };
  N.Renderer = class {
    constructor(canvas) { this.canvas=canvas;this.ctx=canvas.getContext('2d');this.effects=[];this.reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches; }
    resize() {const dpr=Math.min(globalThis.devicePixelRatio||1,2);const w=Math.round(C.width*dpr),h=Math.round(C.height*dpr);if(this.canvas.width!==w){this.canvas.width=w;this.canvas.height=h;}}
    event(e) { if(e.type==='merge'||e.type==='god')this.effects.push({...e,age:0}); }
    draw(game, dt) {
      this.resize();const c=this.ctx;c.setTransform(this.canvas.width/C.width,0,0,this.canvas.height/C.height,0,0);
      c.clearRect(0,0,C.width,C.height);c.fillStyle='#fcfbf4';c.beginPath();c.roundRect(3,3,474,651,22);c.fill();
      c.fillStyle='#e9eee2';c.fillRect(14,114,452,526);
      c.fillStyle='#f7f9f077';for(let y=141;y<640;y+=36)for(let x=32;x<465;x+=36){c.beginPath();c.arc(x,y,1.3,0,7);c.fill();}
      const warning=game.warning>0;c.strokeStyle=warning?'#c78372':'#b8bca7';c.lineWidth=2;c.setLineDash([7,8]);c.beginPath();c.moveTo(16,C.dangerY);c.lineTo(464,C.dangerY);c.stroke();c.setLineDash([]);
      if(warning){c.fillStyle='#db998922';c.fillRect(14,113,452,26);c.fillStyle='#996252';c.font='bold 17px sans-serif';c.textAlign='center';c.fillText('少し、いっぱいかも…',240,145);c.fillStyle='#ca8c78';c.fillRect(16,115,448*Math.min(1,game.warning),4);}
      const current=C.cats[game.current];
      if(!game.preparing&&(game.state==='playing'||game.state==='paused')){
        c.strokeStyle='#81998580';c.lineWidth=1.5;c.setLineDash([4,8]);c.beginPath();c.moveTo(game.x,C.spawnY+current.radius+8);c.lineTo(game.x,C.floor);c.stroke();c.setLineDash([]);
        c.globalAlpha=game.time>=game.readyAt?.65:.25;N.drawCat(c,game.current,game.x,C.spawnY,current.radius);c.globalAlpha=1;
      }
      for(const b of game.physics.bodies){N.drawCat(c,b.level,b.x,b.y,b.radius,b.angle);}
      c.strokeStyle='#aebda6';c.lineWidth=8;c.lineJoin='round';c.beginPath();c.moveTo(9,119);c.lineTo(9,633);c.quadraticCurveTo(9,646,24,646);c.lineTo(456,646);c.quadraticCurveTo(471,646,471,633);c.lineTo(471,119);c.stroke();
      c.strokeStyle='#dedfd3';c.lineWidth=2;c.beginPath();c.roundRect(2,2,476,656,24);c.stroke();
      for(const e of this.effects){e.age+=dt;const life=e.type==='god'?1.8:1.15;if(e.age>life)continue;const f=e.age/life;c.save();c.globalAlpha=1-f;
        if(e.type==='god'){const gradient=c.createRadialGradient(e.x,e.y,0,e.x,e.y,180);gradient.addColorStop(0,'#fff6c5');gradient.addColorStop(1,'#fff6c500');c.fillStyle=gradient;c.fillRect(0,0,480,660);}
        if(!this.reduced){const count=e.type==='god'?20:6+e.level;for(let i=0;i<count;i++){const angle=i/count*Math.PI*2;const r=(20+f*(e.type==='god'?145:55));ellipse(c,e.x+Math.cos(angle)*r,e.y+Math.sin(angle)*r,3*(1-f)+1,3*(1-f)+1,i%2?'#c8aa6f':'#fffaf0');}}
        c.fillStyle='#4e6554';c.font=`bold ${e.type==='god'?32:23}px sans-serif`;c.textAlign='center';if(e.points>0)c.fillText('+'+e.points.toLocaleString(),e.x,e.y-15-(this.reduced?0:f*40));if(e.chain>1){c.font='bold 16px sans-serif';c.fillText(e.chain+' 連鎖',e.x,e.y+10-f*30);}c.restore();
      }this.effects=this.effects.filter(e=>e.age<(e.type==='god'?1.8:1.15));
    }
  };
  N.drawHero=function(canvas){const c=canvas.getContext('2d');c.clearRect(0,0,540,570);ellipse(c,274,511,209,22,'#d9ddcd77');ellipse(c,273,286,232,233,'#e7ecdf');c.fillStyle='#fffaf0';c.beginPath();c.roundRect(85,155,371,346,30);c.fill();c.fillStyle='#e9eddf';c.fillRect(99,237,343,247);
    for(const [l,x,y,r,a] of [[4,358,410,70,.14],[3,222,428,57,-.14],[2,139,432,34,.28],[2,167,356,42,-.15],[1,270,334,43,.15],[0,337,292,29,.12]])N.drawCat(c,l,x,y,r,a);
    N.drawCat(c,0,245,104,30,-.12);c.strokeStyle='#b1bfa6';c.lineWidth=8;c.beginPath();c.moveTo(89,211);c.lineTo(89,479);c.quadraticCurveTo(89,497,106,497);c.lineTo(434,497);c.quadraticCurveTo(451,497,451,478);c.lineTo(451,211);c.stroke();c.setLineDash([5,7]);c.lineWidth=2;c.beginPath();c.moveTo(246,152);c.lineTo(246,241);c.stroke();c.setLineDash([]);c.font='22px sans-serif';c.fillStyle='#8c9e7d';c.fillText('✧',435,112);c.fillText('✧',64,332);};
})(globalThis.Nekopon = globalThis.Nekopon || {});
