'use strict';
// Acessibilidade contextual: regras de terreno ROM + posição/flags/sprites RAM.
// "Caminho estático" NÃO equivale a acessibilidade confirmada no jogo.
// Cut $3D (OVERWORLD) e ledges dirigidos vêm de pret/pokered; Surf é
// condicional a terreno/estado da RAM. As transições entre mapas, scripts
// e animações não são certificadas por este módulo.
const crypto=require('node:crypto');
const {STATIC_RULES}=require('./romLedgeRules');
const {isKnownAuditedRomSha}=require('./romKnownSha256');
const valid=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
const dirs=[['north',0,-1],['east',1,0],['south',0,1],['west',-1,0]];
function terrainBytes(map,sha){
 if(!isKnownAuditedRomSha(sha)||map?.verified!==true||
    !valid(map.mapId,0,247)||!valid(map.tilesetId,0,23)||
    !valid(map.width,1,160)||!valid(map.height,1,160)||
    typeof map.tileIdsBase64!=='string'||typeof map.walkingBitsBase64!=='string')
  return null;
 const cells=map.width*map.height;
 const tiles=Buffer.from(map.tileIdsBase64,'base64');
 const bits=Buffer.from(map.walkingBitsBase64,'base64');
 const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
 if(tiles.length!==cells||bits.length!==Math.ceil(cells/8)||
    hash(tiles)!==map.tileIdsSha256||hash(bits)!==map.walkingBitsSha256||
    !Array.isArray(map.landBlockedTilePairs))return null;
 const pairs=map.landBlockedTilePairs;
 if(pairs.some(p=>!Array.isArray(p)||p.length!==2||!p.every(x=>valid(x,0,95))))
  return null;
 return {width:map.width,height:map.height,mapId:map.mapId,tilesetId:map.tilesetId,
   tiles,bits,pairs,romSha256:sha};
}
function computeReach(grid,start,{canCut=false,canSurf=false,
 currentSurf=false,actors=[],spritesVerified=false,ignoreBoulders=false}={}){
 const {width,height,tiles,bits,pairs,tilesetId}=grid;
 const n=width*height;
 const inside=(x,y)=>x>=0&&y>=0&&x<width&&y<height;
 if(!start||!inside(start.x,start.y))return null;
 const index=(x,y)=>y*width+x;
 const walkable=i=>!!(bits[i>>3]&(1<<(i&7)));
 // Só a espécie de água que está reconhecida pela rotina de movimento.
 const water=i=>tiles[i]===0x14||tiles[i]===0x48;
 const tree=i=>tilesetId===0&&tiles[i]===0x3d;
 const collides=(a,b)=>pairs.some(p=>(p[0]===a&&p[1]===b)||(p[1]===a&&p[0]===b));
 const occupied=new Map();
 if(spritesVerified)for(const actor of actors){
   if(!valid(actor?.x,0,width-1)||!valid(actor?.y,0,height-1))continue;
   const i=index(actor.x,actor.y);
   if(i===index(start.x,start.y))continue;
   occupied.set(i,actor.type==='boulder'||actor.pictureId===63?'BOULDER':'SPRITE');
 }
 const blocked=i=>occupied.has(i)&&!(ignoreBoulders&&occupied.get(i)==='BOULDER');
 const isLedge=tilesetId===0?
    new Set(STATIC_RULES.map(e=>e.ledgeTileId)):new Set();
 const length=2*n;
 const prev=new Int32Array(length).fill(-1);
 const changes=new Uint8Array(length);
 const jump=new Uint8Array(length);
 const queue=new Int32Array(length);
 let head=0,tail=0;
 const startMode=currentSurf?1:0;
 const first=index(start.x,start.y)+n*startMode;
 prev[first]=first;queue[tail++]=first;
 function push(from,to,flag=0,didJump=0){
   if(prev[to]!==-1)return;
   prev[to]=from;changes[to]=flag;jump[to]=didJump;queue[tail++]=to;
 }
 while(head<tail){
   const node=queue[head++],mode=node>=n?1:0,i=node%n;
   const x=i%width,y=(i/width)|0;
   for(const [direction,dx,dy] of dirs){
     const xx=x+dx,yy=y+dy;
     if(!inside(xx,yy))continue;
     const next=index(xx,yy);
     if(blocked(next)||collides(tiles[i],tiles[next]))continue;
     // Saliência: ultrapassa o tile da borda numa única ação dirigida.
     // NUNCA atravessar esse tile no sentido inverso como piso normal.
     if(isLedge.has(tiles[next])){
       const rule=STATIC_RULES.find(r=>r.direction===direction&&
         r.standingTileId===tiles[i]&&r.ledgeTileId===tiles[next]);
       if(!rule||mode!==0)continue;
       const x2=xx+dx,y2=yy+dy;
       if(!inside(x2,y2))continue;
       const landing=index(x2,y2);
       if(!walkable(landing)||blocked(landing)||tree(landing)||water(landing))
         continue;
       push(node,landing,0,1);
       continue;
     }
     if(tree(next)){
       if(!canCut||mode!==0)continue;
       push(node,next,1,0);
       continue;
     }
     if(water(next)){
       if(!canSurf)continue;
       push(node,next+n,2,0);
       continue;
     }
     if(walkable(next)){
       // No terreno, desembarcar ao sair da água; a ação precisa de
       // confirmação de animações e event flags no emulador.
       push(node,next,0,0);
     }
   }
 }
 return {prev,changes,jump,width,height,length,visited:tail,
   startMode,startIndex:first,occupiedCount:occupied.size};
}
function candidatePath(reach,item,{hidden=false}={}){
 if(!reach||!valid(item?.x,0,reach.width-1)||
    !valid(item?.y,0,reach.height-1))return null;
 // Objetos visíveis recolhem-se adjacentes. Itens ocultos podem ser
 // pesquisados no próprio tile ou adjacentes, dependendo do script.
 const contacts=hidden?[[item.x,item.y]]:[];
 for(const [,dx,dy] of dirs)contacts.push([item.x+dx,item.y+dy]);
 let best=null;
 for(const [x,y] of contacts){
   if(x<0||y<0||x>=reach.width||y>=reach.height)continue;
   const spot=y*reach.width+x;
   for(const mode of [0,1]){
     const end=spot+mode*reach.width*reach.height;
     if(reach.prev[end]===-1)continue;
     let steps=0,usesCut=false,usesSurf=false,usesLedge=false,node=end;
     while(node!==reach.startIndex){
       const p=reach.prev[node];
       if(p===-1||steps>reach.length)break;
       steps++;usesCut=usesCut||reach.changes[node]===1;
       usesSurf=usesSurf||reach.changes[node]===2;
       usesLedge=usesLedge||reach.jump[node]===1;
       node=p;
     }
     if(node!==reach.startIndex)continue;
     const first=(function(){
       let cursor=end,prior=reach.prev[cursor];
       while(prior!==reach.startIndex&&prior!==cursor&&prior!==-1){
         cursor=prior;prior=reach.prev[cursor];
       }
       return {x:(cursor% (reach.width*reach.height))%reach.width,
         y:Math.floor((cursor%(reach.width*reach.height))/reach.width)};
     })();
     const result={steps,contact:{x,y},nextStep:steps>0?first:null,
       usesCut,usesSurf,usesLedge,withinCurrentMapOnly:true};
     if(!best||result.steps<best.steps)best=result;
   }
 }
 return best;
}
function planItemAccess({terrain,romSha256,position,items=[],
 mapSnapshotVerified=false,positionVerified=false,modeByte=null,
 spritesVerified=false,mapEntities=[],canCut=null,canSurf=null}={}){
 const rows=Array.isArray(items)?items:[];
 const unavailable=(reason)=>({verified:false,reason,
   results:rows.map((item,index)=>({index,itemName:item.name??null,
     accessStatus:'UNKNOWN',accessibleNow:null,reason}))});
 const grid=terrainBytes(terrain,String(romSha256||'').toLowerCase());
 if(!grid||!mapSnapshotVerified||!positionVerified||
    !valid(position?.x,0,grid.width-1)||!valid(position?.y,0,grid.height-1)||
    ![0,1,2].includes(modeByte))
   return unavailable('ROM/terreno/posição/modo de deslocação não corroborados');
 const options={currentSurf:modeByte===2,
   actors:mapEntities,spritesVerified};
 // Executar BFS uma vez por cenário, não uma vez por item.
 const normal=computeReach(grid,position,{...options,
   canCut:canCut===true,canSurf:canSurf===true});
 const withCut=canCut===true?normal:computeReach(grid,position,{...options,
   canCut:true,canSurf:canSurf===true});
 const withSurf=canSurf===true?normal:computeReach(grid,position,{...options,
   canCut:canCut===true,canSurf:true});
 const withBoth=computeReach(grid,position,{...options,canCut:true,canSurf:true});
 const withoutBoulders=computeReach(grid,position,{...options,
   canCut:canCut===true,canSurf:canSurf===true,ignoreBoulders:true});
 const result=rows.map((item,index)=>{
   const out={index,itemName:item.name??null,x:item.x??null,y:item.y??null,
     accessStatus:'UNKNOWN',accessibleNow:null,route:null,
     source:'MAPA_ROM_SHA256_LOCAL + RAM_SEQUENCIAL',reason:null,
     abilities:{canCut,canSurf},
     requiresGlobalRouteVerification:true};
   // Sem vínculo coordenadas↔ROM, a referência manual não prova presença.
   if(item.romItemCoordinatesVerified!==true){
     out.accessStatus='UNVERIFIED_ROM_ITEM';
     out.reason='Objeto ou coordenada sem correspondência validada na ROM do mapa.';
     return out;
   }
   if(item.isCollected===true){
     out.accessStatus='COLLECTED_FLAG';out.reason='Flag de item oculto obtido';
     return out;
   }
   if(item.removedFromMap===true){
     out.accessStatus='REMOVED_FLAG';
     out.reason='Sprite removido na RAM; não demonstra que foi recolhido';
     return out;
   }
   const hidden=item.type==='hidden'||item.kind==='hidden'||item.hiddenIndex!==undefined||
      item.source==='ROM_COORDENADA+SCRIPT_ITEM_ID+RAM_FLAG';
   if(!valid(item.x,0,grid.width-1)||!valid(item.y,0,grid.height-1)){
     out.reason='Coordenadas do objeto não validadas para o mapa atual';
     return out;
   }
   const trial=r=>candidatePath(r,item,{hidden});
   const route=trial(normal);
   if(route){
     out.accessStatus='CONDITIONAL_PATH';
     out.route=route;
     out.reason='Percurso geométrico possível nesta leitura. Não prova ausência de scripts, portas, NPC móveis ou condições de interação.';
   }else{
     const cut=canCut!==true?trial(withCut):null;
     const surf=canSurf!==true?trial(withSurf):null;
     const both=trial(withBoth);
     if(cut){
       out.accessStatus=canCut===false?'NEEDS_CUT':'CUT_CAPABILITY_UNKNOWN';
       out.route=cut;
       out.reason='Percurso local encontrado apenas ao considerar removível um arbusto Cut. Capacidade ou estado do arbusto carecem de confirmação.';
     }else if(surf){
       out.accessStatus=canSurf===false?'NEEDS_SURF':'SURF_CAPABILITY_UNKNOWN';
       out.route=surf;
       out.reason='Percurso local encontrado apenas considerando travessia de água com Surf; ação em campo não verificada.';
     }else if(both){
       out.accessStatus='NEEDS_CUT_AND_SURF_POSSIBLY';
       out.route=both;
       out.reason='Só o cenário hipotético com Cut e Surf encontrou percurso neste mapa.';
     }else {
       const boulder=trial(withoutBoulders);
       if(boulder&&spritesVerified){
         out.accessStatus='POSSIBLE_STRENGTH_BARRIER';
         out.route=boulder;
         out.reason='Rocha observada impede o caminho atual. Strength e uma sequência legal de empurrões ainda não foram comprovados.';
       }else{
         out.accessStatus='NO_SAME_MAP_PATH';
         out.reason='Sem percurso local demonstrado com as regras disponíveis. Pode ser desnível unidirecional, desvio por outro mapa, warp ou script; NÃO prova bloqueio permanente.';
       }
     }
   }
   if(!spritesVerified)out.reason+=' Posições de NPCs/sprites sem confirmação RAM.';
   return out;
 });
 const counts=Object.fromEntries([...new Set(result.map(x=>x.accessStatus))]
   .map(k=>[k,result.filter(x=>x.accessStatus===k).length]));
 return {verified:true,mapId:grid.mapId,romSha256:grid.romSha256,
   atomicSnapshotVerified:false,currentMapRouteVerified:false,
   accessibleNowGuaranteed:false,counts,results:result,
   caveats:['Não prova passabilidade de sprites ou scripts em tempo real',
     'Ledges e Cut derivados da ROM, com estado de animação não observado',
     'As saídas e reentradas por outros mapas não estão incluídas',
     'Strength não é considerado como passagem livre',
     'Nenhum estado condicional autoriza afirmar disponível agora']};
}
module.exports={terrainBytes,computeReach,candidatePath,planItemAccess};
