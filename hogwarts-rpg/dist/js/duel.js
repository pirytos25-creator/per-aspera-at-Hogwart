import * as T from '../assets/three.module.js';

// Formal duels against characters who fight back: they keep their distance, circle,
// read your spells (side-step or raise Protego), stagger when hit and are knocked
// down by a strong Expelliarmus. A duel opens and closes with a bow.
export const DUELISTS={
 ada:{name:'Ada · Gryffindor',look:{color:'#a64a43',skin:'#6e4a37',style:'pony',hair:'#120d0b',eyes:'#2e1f15',face:{soft:.8}},hp:90,skill:.42,aggression:.5,spells:['basic','basic','basic','expelliarmus'],reward:{xp:80,coins:25},
  intro:'Na mój znak. I nie celuj w twarz!',win:'Dobra robota! Następnym razem nie dam się tak łatwo.',lose:'Wstawaj. Uniki, pamiętasz?'},
 tymon:{name:'Tymon · Slytherin',look:{color:'#508e78',skin:'#d9b79a',style:'curly',hair:'#1b1512',eyes:'#56603a',face:{nose:.5}},hp:125,skill:.6,aggression:.62,spells:['basic','basic','leviosa','expelliarmus'],reward:{xp:130,coins:40},
  intro:'Ukłon, potem walka. Tak się to robi.',win:'Hm. Szczęście początkującego.',lose:'Za wolno. Ćwicz tarczę.'},
 wrzos:{name:'Bartłomiej Wrzos',look:{color:'#8a3f36',robe:'#2b2421',hair:'#4b4038',beard:true,face:{old:.45,broad:.6},build:1.12,scale:1.05},hp:175,skill:.78,aggression:.74,spells:['basic','basic','leviosa','expelliarmus','expelliarmus'],reward:{xp:220,coins:70},
  intro:'Pokaż, czego się nauczyłeś. Bez litości, ale z honorem.',win:'Znakomicie. Masz w sobie duszę pojedynkowicza.',lose:'Dobrze walczyłeś. Wróć, gdy będziesz gotów.'},
};
const SPELL={basic:{color:'#f3c27c',damage:9,speed:17,cost:.8},expelliarmus:{color:'#ff7a6b',damage:16,speed:22,cost:1.6},leviosa:{color:'#bd9eff',damage:6,speed:15,cost:1.3}};
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);

export function createDuels(ctx){
 // ctx: scene, effects, audio, rig, player, playerPos, playerVelocity, createActor, labelSprite, toast, banner(text,ms),
 //      hurtPlayer(amount,dir), addEntity(e), removeEntity(e), onFinish(won,def), colliders(), floor()
 let d=null;
 const tmp=V();
 function arenaPoint(t){return d.arena.center.clone().addScaledVector(d.arena.axis,t);}
 return {
  get active(){return !!d;},
  get opponent(){return d?.entity||null;},
  start(id,arena){
   const def=DUELISTS[id];if(!def||d)return false;
   const actor=ctx.createActor({...def.look,mood:'focus'});
   const pos=arena.center.clone().addScaledVector(arena.axis,arena.half);pos.y=ctx.floor(pos);
   actor.root.position.copy(pos);ctx.scene.add(actor.root);
   const entity={id:'duelist-'+id,type:'duelist',name:def.name,pos:actor.root.position,actor,hp:def.hp,maxHp:def.hp,hidden:false};
   ctx.addEntity(entity);
   d={id,def,arena,actor,entity,phase:'bow',t:0,castT:1.8,moveDir:Math.random()<.5?1:-1,moveT:2,vel:V(),stagger:0,shieldUntil:0,shieldCd:0,dodgeCd:0,down:0,yielded:false,won:null,react:0};
   // both duellists take their marks and face each other
   const p=arena.center.clone().addScaledVector(arena.axis,-arena.half);p.y=ctx.floor(p);
   ctx.playerPos.copy(p);ctx.player.root.position.copy(p);
   ctx.player.root.rotation.y=Math.atan2(pos.x-p.x,pos.z-p.z);actor.root.rotation.y=Math.atan2(p.x-pos.x,p.z-pos.z);
   ctx.playerVelocity.set(0,0,0);
   actor.lookAt(ctx.player.head);actor.setExpression('focus');
   ctx.banner(def.name,1600);ctx.say?.(actor,def.name,def.intro);
   setTimeout(()=>{if(d){actor.bow();ctx.player.bow?.();}},900);
   return true;
  },
  abort(){if(!d)return;ctx.removeEntity(d.entity);ctx.scene.remove(d.actor.root);d.actor.dispose();d=null;},
  // the player's bolt reached the duellist (projectiles test the body along their flight)
  bodyTest(pos){if(!d||d.yielded)return false;tmp.copy(d.entity.pos);tmp.y+=1.05;return Math.hypot(pos.x-tmp.x,pos.z-tmp.z)<.45&&Math.abs(pos.y-tmp.y)<.95;},
  hit(spell,damage){
   if(!d||d.yielded||d.phase!=='fight')return;
   const a=d.actor;
   if(performance.now()<d.shieldUntil){ctx.effects.ring(d.entity.pos.clone().add(V(0,.4,0)),'#a6ebff',2,.35);ctx.audio.note(900,.14);return;}
   d.entity.hp=Math.max(0,d.entity.hp-damage);
   ctx.rig.shake(.08);
   const front=true;
   if(spell==='leviosa'){d.stagger=1.6;a.hit(front);ctx.effects.ring(d.entity.pos.clone(),'#c8a3ff',2,1.1);}
   else if(spell==='expelliarmus'&&(d.entity.hp<d.def.hp*.35||Math.random()<.4)){a.knockdown();d.down=2.2;d.vel.copy(d.arena.axis).multiplyScalar(3.4);}
   else{a.hit(front);d.stagger=.55;}
   a.setExpression('pain',.8);
   if(d.entity.hp<=0){d.yielded=true;d.won=true;if(!a.state().down)a.knockdown();d.down=0;d.phase='end';d.t=0;ctx.banner('Zwycięstwo!',2200);}
  },
  playerDefeated(){if(!d||d.phase==='end')return false;d.phase='end';d.t=0;d.won=false;d.actor.gesture('cheer');d.actor.setExpression('smug',3);ctx.banner('Porażka',2200);return true;},
  update(dt,elapsed){
   if(!d)return;
   const a=d.actor,e=d.entity,pp=ctx.playerPos;
   d.t+=dt;
   const toPlayer=V(pp.x-e.pos.x,0,pp.z-e.pos.z),dist=toPlayer.length();toPlayer.normalize();
   let speed=0,side=0,back=false;
   if(d.phase==='bow'){
    if(d.t>2.8&&d.t<2.8+dt)ctx.banner('3',600);if(d.t>3.4&&d.t<3.4+dt)ctx.banner('2',600);if(d.t>4&&d.t<4+dt)ctx.banner('1',600);
    if(d.t>4.6){d.phase='fight';d.t=0;ctx.banner('Pojedynek!',900);a.setGuard(true);}
   }else if(d.phase==='fight'){
    d.down=Math.max(0,d.down-dt);d.stagger=Math.max(0,d.stagger-dt);d.castT-=dt;d.moveT-=dt;d.shieldCd-=dt;d.dodgeCd-=dt;d.react-=dt;
    if(d.down<=0&&a.state().down)a.getUp();
    const busy=d.down>0||a.state().down||d.stagger>0;
    if(!busy){
     // read incoming spells
     const threat=ctx.effects.incoming(V(e.pos.x,e.pos.y+1.1,e.pos.z),.9,.75,false);
     if(threat&&d.react<=0){
      d.react=.6;
      if(Math.random()<d.def.skill){
       const useShield=d.shieldCd<=0&&(Math.random()<.45||d.dodgeCd>0);
       if(useShield){a.cast('protego');d.shieldUntil=performance.now()+1500;d.shieldCd=5;ctx.effects.shield(e.pos,1.5);}
       else if(d.dodgeCd<=0){const s=Math.random()<.5?1:-1;const right=V(threat.dir.z,0,-threat.dir.x).multiplyScalar(s);
        const r=a.root.rotation.y,lx=Math.cos(r),lz=-Math.sin(r);a.dodge(right.x*lx+right.z*lz>0?'l':'r');d.vel.copy(right).multiplyScalar(8.5);d.dodgeCd=1.6;ctx.audio.swish?.();}
      }
     }
     // footwork: keep a duelling distance and circle
     if(d.moveT<=0){d.moveT=1.4+Math.random()*2;d.moveDir=Math.random()<.5?1:-1;}
     const want=dist>11?1:dist<6.5?-1:0;
     const lateral=V(toPlayer.z,0,-toPlayer.x).multiplyScalar(d.moveDir);
     const move=toPlayer.clone().multiplyScalar(want).add(lateral.multiplyScalar(want?0.4:1)).normalize().multiplyScalar(want>0?2.4:1.5);
     if(d.vel.lengthSq()<1)d.vel.lerp(move,1-Math.exp(-4*dt));
     // attack
     if(d.castT<=0&&dist<16){
      const spell=d.def.spells[Math.floor(Math.random()*d.def.spells.length)],S=SPELL[spell];
      const timing=a.cast(spell,1+d.def.skill*.4);
      d.castT=(2.6-d.def.aggression*1.5)*S.cost*(.75+Math.random()*.5);
      setTimeout(()=>{
       if(!d||d.phase!=='fight'||a.state().down)return;
       const from=a.tipWorld(V());
       // aim where the player will be, a little better with skill
       const lead=ctx.playerVelocity.clone().multiplyScalar(from.distanceTo(pp)/S.speed*d.def.skill*.8);
       const to=pp.clone().add(lead).add(V(0,1.05,0));
       ctx.effects.projectile(from,to.clone().addScaledVector(to.clone().sub(from).normalize(),8),{color:S.color,hostile:true,damage:S.damage,speed:S.speed});
       ctx.flash?.(S.color);
      },timing.release*1000);
     }
    }
    // move (dodges carry their own burst)
    d.vel.multiplyScalar(Math.exp(-(busy?5:1.2)*dt));
    const next=e.pos.clone().addScaledVector(d.vel,dt);
    const c=d.arena.center,ax=d.arena.axis,rel=next.clone().sub(c),along=rel.dot(ax),perp=rel.clone().addScaledVector(ax,-along);
    const maxA=d.arena.half+3,maxP=d.arena.width||5;
    if(Math.abs(along)>maxA)next.addScaledVector(ax,(Math.sign(along)*maxA-along));
    if(perp.length()>maxP)next.sub(perp.clone().setLength(perp.length()-maxP));
    next.y=ctx.floor(next);
    const moved=next.distanceTo(e.pos)/Math.max(dt,1e-4);e.pos.copy(next);
    // always face the opponent; legs choose forward, back or a side step
    const yaw=Math.atan2(pp.x-e.pos.x,pp.z-e.pos.z),diff=Math.atan2(Math.sin(yaw-a.root.rotation.y),Math.cos(yaw-a.root.rotation.y));
    a.root.rotation.y+=diff*(1-Math.exp(-8*dt));
    const r=a.root.rotation.y,vx=d.vel.x,vz=d.vel.z,fw=vx*Math.sin(r)+vz*Math.cos(r),sd=vx*Math.cos(r)-vz*Math.sin(r);
    speed=busy?0:moved;side=Math.abs(sd)>Math.abs(fw)*.6&&speed>.3?Math.sign(sd):0;back=fw<-.3;
   }else if(d.phase==='end'){
    if(d.won&&d.t>1.6&&d.t<1.6+dt)a.getUp();
    if(d.t>3.1&&d.t<3.1+dt){a.setGuard(false);a.setExpression(d.won?'kind':'happy');a.bow();ctx.say?.(a,d.def.name,d.won?d.def.win:d.def.lose);}
    if(d.t>5.2){const def=d.def,won=d.won;this.abort();ctx.onFinish(won,def);return;}
   }
   a.update(dt,elapsed,{speed,side,back},a.speaking?.());
  }
 };
}
