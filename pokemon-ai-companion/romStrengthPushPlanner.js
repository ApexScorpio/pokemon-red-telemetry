'use strict';
// Conservative, bounded, local Strength PUSH hypothesis. No movement action
// is certified: Gen I first requires Rainbow Badge+move, Strength activation,
// two attempts to initiate pushing, ROM collision and sprites to cooperate.
// Sources: pret/pokered engine/overworld/push_boulder.asm,
// engine/overworld/player_state.asm, engine/menus/start_sub_menus.asm.
const {terrainBytes}=require('./romItemReachability');
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const directions=[['north',0,-1],['east',1,0],['south',0,1],['west',-1,0]];
const validPos=p=>Number.isInteger(p?.x)&&Number.isInteger(p?.y)&&p.x>=0&&p.y>=0;
function planStrengthPushes({terrain,romSha256,position,target,
 positionVerified=false,spritesVerified=false,actors=[],
 canStrength=null,maxStates=1600,maxPushes=8}={}){
 const sha=String(romSha256||'').toLowerCase();
 const fail=reason=>({verified:false,found:false,reason,accessibleNow:null,
   pushExecutionVerified:false,strengthActivationVerified:false});
 if(!isKnownAuditedRomSha(sha)||!positionVerified||!spritesVerified||
    ![true,false,null].includes(canStrength)||!Array.isArray(actors)||
    !validPos(position)||!validPos(target)||
    !Number.isInteger(maxStates)||maxStates<1||maxStates>5000||
    !Number.isInteger(maxPushes)||maxPushes<1||maxPushes>12)
   return fail('Identidade ROM, sprites RAM, coordenadas ou orçamento não comprovados');
 const grid=terrainBytes(terrain,sha);
 if(!grid)return fail('Matriz de colisão ROM não verificada');
 const {width,height,tiles,bits,pairs,tilesetId}=grid;
 const inside=p=>p.x>=0&&p.y>=0&&p.x<width&&p.y<height;
 if(!inside(position)||!inside(target))return fail('Coordenadas fora do mapa ROM');
 const id=p=>p.y*width+p.x,xy=n=>({x:n%width,y:Math.floor(n/width)});
 const boulders=[],occupied=new Set(),all=new Set();
 for(const actor of actors){
   if(!validPos(actor)||!inside(actor))
     return fail('Sprite RAM com coordenadas inválidas');
   const i=id(actor);
   if(all.has(i))return fail('Sprites sobrepostos na mesma célula RAM');
   all.add(i);
   if(actor.type==='boulder'||actor.pictureId===63)boulders.push(i);
   else occupied.add(i);
 }
 if(!boulders.length||boulders.length>8)
   return fail('Sem rocha observada ou excesso de rochas para pesquisa limitada');
 if(all.has(id(position)))return fail('Jogador sobre sprite, leitura RAM incoerente');
 // Only static land cells. Water/Cut/ledges and stairs require a different
 // movement state and cannot be treated as a free boulder destination.
 const walk=i=>{
   const tile=tiles[i];
   return (bits[i>>3]&(1<<(i&7)))!==0&&tile!==0x14&&tile!==0x48&&
     tile!==0x15&&!(tilesetId===0&&tile===0x3d);
 };
 const pairOK=(a,b)=>!pairs.some(p=>(p[0]===tiles[a]&&p[1]===tiles[b])||
   (p[1]===tiles[a]&&p[0]===tiles[b]));
 const start=id(position);
 if(!walk(start))return fail('Jogador não está num tile terrestre corroborado');
 const key=(player,rocks)=>player+'|'+rocks.join(',');
 const queue=[{player:start,rocks:boulders.slice().sort((a,b)=>a-b),
   pushes:[],steps:0,firstStep:null}];
 const visited=new Set([key(start,queue[0].rocks)]);
 let processed=0,cursor=0;
 const itemContact=s=>{
   const player=xy(s.player);
   const adjacent=Math.abs(player.x-target.x)+Math.abs(player.y-target.y)===1;
   const same=player.x===target.x&&player.y===target.y;
   return (target.hidden===true?same||adjacent:adjacent)&&
     !s.rocks.includes(id(target))&&!occupied.has(id(target));
 };
 for(;cursor<queue.length&&processed<maxStates;cursor++){
   const s=queue[cursor];processed++;
   if(s.pushes.length>0&&itemContact(s)){
     return {verified:true,found:true,romSha256:sha,mapId:grid.mapId,
       target:{x:target.x,y:target.y,hidden:target.hidden===true},
       steps:s.steps,firstStep:s.firstStep,pushCount:s.pushes.length,
       pushes:s.pushes,statesExplored:processed,
       abilityKnown:canStrength,requiresActivation:true,
       strengthActivationVerified:false,doublePushAttemptRequired:true,
       pushExecutionVerified:false,routeNavigableNowProven:false,
       accessibleNow:null,
       reason:'Sequência de empurrões geometricamente possível; ações, flags, colisões dinâmicas e scripts por comprovar.'};
   }
   const here=xy(s.player),rockSet=new Set(s.rocks);
   for(const [direction,dx,dy] of directions){
     const next={x:here.x+dx,y:here.y+dy};
     if(!inside(next))continue;
     const n=id(next);
     if(occupied.has(n)||!walk(n)||!pairOK(s.player,n))continue;
     let rocks=s.rocks,pushes=s.pushes;
     if(rockSet.has(n)){
       if(s.pushes.length>=maxPushes)continue;
       const ahead={x:next.x+dx,y:next.y+dy};
       if(!inside(ahead))continue;
       const a=id(ahead);
       if(!walk(a)||occupied.has(a)||rockSet.has(a)||
          !pairOK(n,a))continue;
       rocks=s.rocks.filter(x=>x!==n).concat(a).sort((a,b)=>a-b);
       pushes=[...s.pushes,{direction,
         from:{x:next.x,y:next.y},to:ahead,
         requiresStrengthActivation:true,
         actualPushObserved:false}];
     }
     const k=key(n,rocks);
     if(visited.has(k)||queue.length>=maxStates*4)continue;
     visited.add(k);
     queue.push({player:n,rocks,pushes,steps:s.steps+1,
       firstStep:s.firstStep||next});
   }
 }
 const budget=cursor<queue.length;
 return {verified:true,found:false,romSha256:sha,mapId:grid.mapId,
   statesExplored:processed,maxStatesExceeded:budget,
   pushExecutionVerified:false,strengthActivationVerified:false,
   accessibleNow:null,routeNavigableNowProven:false,
   reason:budget?'Pesquisa geométrica limitada por estados, não prova bloqueio':
     'Nenhuma sequência de empurrões dentro deste modelo estático; não prova bloqueio do jogo'};
}
module.exports={planStrengthPushes};
