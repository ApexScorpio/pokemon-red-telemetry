'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
// Isolate the actual browser renderer without running the full cockpit's
// background polling, timers or RetroArch connection.
const script=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
const start=script.indexOf('function renderWorldAdvisor(state) {');
const end=script.indexOf('// Renderização Principal do Cockpit',start);
if(start<0||end<0)throw Error('renderWorldAdvisor section unavailable');
function render(state){
 let body={textContent:'',innerHTML:null},source={textContent:'',innerHTML:null};
 const document={getElementById:id=>id==='world-advisor-content'?body:
    id==='world-advisor-source'?source:null};
 const context={document,Date,state};
 vm.runInNewContext(script.slice(start,end)+'\nrenderWorldAdvisor(state);',context);
 return {body,source};
}
const live=()=>({
 connected:true,lastUpdate:new Date().toISOString(),mapId:15,
 memoryReadStatus:{verified:true,positionWindow:{verified:true}},
 romRuntimeIdentity:{matched:true},
 worldAdvisor:{verified:true,mapId:15,mapName:'Route 4',romSha256:'5ca7ba01',
  position:{x:12,y:3},trainerFlagsVerified:false,hiddenFlagsVerified:true,
  observations:[
   {kind:'ITEM',what:'<img src=x onerror=alert(1)>',x:5,y:3,
    status:'NOT_REMOVED_FLAG',consequence:'Requer condições de ROM/RAM',
    accessStatus:'NEEDS_CUT',accessRoute:{steps:7}},
   {kind:'HIDDEN_ITEM',what:'Hidden',x:6,y:2,
    status:'COLLECTED_FLAG',consequence:'Flag comprovada'}
  ]}
});
test('displays conditional route without HTML injection or guaranteed access',()=>{
 const {body,source}=render(live());
 assert.match(body.textContent,/Possível passagem dependente de Cut/);
 assert.match(body.textContent,/passos teóricos/);
 assert.match(body.textContent,/estado: parcial/i);
 assert.match(body.textContent,/<img src=x onerror/);
 assert.equal(body.innerHTML,null);
 assert.match(source.textContent,/leitura RAM recente/);
});
test('offline and stale samples hide all old action details',()=>{
 const old=live();old.connected=false;
 assert.doesNotMatch(render(old).body.textContent,/NEEDS_CUT|<img/);
 const stale=live();stale.lastUpdate=new Date(Date.now()-30000).toISOString();
 assert.doesNotMatch(render(stale).body.textContent,/TM04|<img/);
 const inconsistent=live();inconsistent.memoryReadStatus.positionWindow.verified=false;
 assert.match(render(inconsistent).body.textContent,/Aguardar nova leitura/);
});
test('reject map mismatch and ROM identity mismatch',()=>{
 const wrong=live();wrong.worldAdvisor.mapId=16;
 assert.match(render(wrong).body.textContent,/Não é seguro mostrar/);
 const unknown=live();unknown.romRuntimeIdentity.matched=false;
 assert.match(render(unknown).source.textContent,/sem prova/);
});

test('hidden coins are shown with own status and no fake collection of items',()=>{
 const state=live();
 state.worldAdvisor.observations=[{kind:'HIDDEN_COIN',what:'20 fichas ocultas',
   x:4,y:4,status:'COIN_NOT_COLLECTED_FLAG',
   consequence:'Interagir pode revelar fichas'}];
 state.worldAdvisor.coinFlagsVerified=true;
 const {body}=render(state);
 assert.match(body.textContent,/Fichas ocultas por recolher/);
 assert.match(body.textContent,/Fichas: 1/);
 assert.doesNotMatch(body.textContent,/Item oculto recolhido/);
});

test('global campaign rollup is shown only when ROM SHA and map coverage match',()=>{
 const s=live();
 s.globalCampaignLedger={verified:true,romSha256:s.worldAdvisor.romSha256,
   mapCount:226,totals:{hiddenItemsCollected:10,hiddenItems:54,
     hiddenCoinsCollected:2,hiddenCoins:12,trainerGatesClosed:11,
     trainersUnknown:5,scriptedVictories:1,stationaryGatesClosed:3}};
 assert.match(render(s).body.textContent,/KANTO \(226 mapas\)/);
 assert.match(render(s).body.textContent,/11 portões fechados/);
 assert.match(render(s).body.textContent,/não prova captura/);
 s.globalCampaignLedger.romSha256='0'.repeat(64);
 assert.match(render(s).body.textContent,/sem prova global RAM\/ROM/);
});

test('socket close persists offline state so periodic refresh cannot resurrect advice',()=>{
 const from=script.indexOf('// WebSocket Connection');
 const to=script.indexOf('// Painel Daycare:',from);
 assert.ok(from>=0&&to>from);
 const observed=[];
 let periodic=null;
 class FakeSocket {constructor(url){this.url=url;}}
 const context={
   WebSocket:FakeSocket,window:{location:{protocol:'http:',host:'localhost'}},
   elConnectionStatus:{textContent:''},
   elConnectionPulse:{classList:{add(){},remove(){}}},
   renderWorldAdvisor:s=>observed.push(s.connected),
   setTimeout:()=>null,setInterval:cb=>{periodic=cb;},
   lastState:{connected:true},socket:null
 };
 vm.runInNewContext(script.slice(from,to)+'\nconnectWebSocket(); socket.onclose();',context);
 assert.equal(context.lastState.connected,false);
 assert.deepEqual(observed,[false]);
 periodic();
 assert.deepEqual(observed,[false,false]);
});

test('Kanto objectives list separates pending flags and unverified travel',()=>{
 const s=live();
 s.globalCampaignObjectives={verified:true,romSha256:s.worldAdvisor.romSha256,
   sourceMapId:15,mapCount:226,mapsWithPending:2,mapsWithUnknown:1,
   objectives:[
     {mapId:15,mapName:'Route 4',pending:{hiddenItems:1,hiddenCoins:0,
       trainerGatesOpen:0,stationaryGatesOpen:0},unknown:{trainers:0,stationaryPokemon:0},
       mapHopCount:0},
     {mapId:18,mapName:'Cerulean City',pending:{hiddenItems:0,hiddenCoins:0,
       trainerGatesOpen:2,stationaryGatesOpen:0},unknown:{trainers:1,stationaryPokemon:0},
       mapHopCount:null}
   ]};
 const output=render(s).body.textContent;
 assert.match(output,/OBJETIVOS DE KANTO/);
 assert.match(output,/1 item oculto/);
 assert.match(output,/2 portões de treino abertos/);
 assert.match(output,/rota estática não determinada/);
 assert.doesNotMatch(output,/acesso garantido/i);
 s.globalCampaignObjectives.romSha256='0'.repeat(64);
 assert.doesNotMatch(render(s).body.textContent,/OBJETIVOS DE KANTO/);
});

test('encounter weights are shown as conditional species distributions, not per-step chances',()=>{
 const s=live();
 s.worldAdvisor.observations=[{kind:'WILD_ENCOUNTER',
   what:'Encontros na relva',status:'ROM_ENCOUNTER_TABLE',
   slots:[{internalId:25,level:4,weight:51},
     {internalId:25,level:4,weight:51},
     {internalId:1,level:3,weight:154}],
   consequence:'Taxa por passo não calculada'}];
 const text=render(s).body.textContent;
 assert.match(text,/Fauna: 1/);
 assert.match(text,/Espécie interna #25 Nv\.4: 39\.84%/);
 assert.match(text,/se ocorrer um encontro/);
 assert.doesNotMatch(text,/39\.84% por passo/);
});

test('cross-map detour appears only for same SHA and exact item coordinates',()=>{
 const s=live();
 s.romCrossMapItemRoute={verified:true,found:true,romSha256:s.worldAdvisor.romSha256,
   sourceMapId:15,target:{mapId:15,x:5,y:3},
   warpTransitions:2,theoreticalSteps:29,
   segments:[{sourceWarpTile:{x:3,y:5},destinationMapId:6}],
   nextTerrainTile:{x:4,y:3}};
 let text=render(s).body.textContent;
 assert.match(text,/Desvio multimapa TEÓRICO: 2 warps/);
 assert.match(text,/acesso NÃO garantido/);
 s.romCrossMapItemRoute.target.x=99;
 text=render(s).body.textContent;
 assert.doesNotMatch(text,/Desvio multimapa TEÓRICO/);
});
test('recent flag changes keep victory and gate closure distinct, without causal claims',()=>{
 const s=live();
 s.worldRecentFlagChanges={verified:true,romSha256:s.worldAdvisor.romSha256,
   events:[{kind:'TRAINER_GATE_FLAG_RAISED',amount:1,mapId:15,
      mapName:'Route 4'},
     {kind:'SCRIPT_VICTORY_FLAG_RAISED',amount:1,mapId:3,
      mapName:'Cerulean City'}]};
 const text=render(s).body.textContent;
 assert.match(text,/portão\/evento de treinador fechado/);
 assert.match(text,/flag específica de vitória ativada/);
 assert.match(text,/não prova de ação, captura ou vitória/);
 s.worldRecentFlagChanges.romSha256='0'.repeat(64);
 assert.doesNotMatch(render(s).body.textContent,/MUDANÇAS DE FLAGS/);
});

test('reference event flags and Route 4 toggle remain clearly conditional',()=>{
 const s=live();
 s.romWorldEventAtlas={
   verified:true,romSha256:s.worldAdvisor.romSha256,
   summary:{namedEventBits:507,namedEventBitsSet:2,
     referenceToggleBits:228,toggleRemovedFlagBitsSet:1},
   milestones:[
     {name:'EVENT_GOT_HM01',flagSet:true},
     {name:'EVENT_GOT_HM03',flagSet:false}
   ],
   toggleFlags:[{
     mapId:15,name:'TOGGLE_ROUTE_4_ITEM',removedFlagSet:true
   },{
     mapId:3,name:'TOGGLE_CERULEAN_RIVAL',removedFlagSet:true
   }]
 };
 const output=render(s).body.textContent;
 assert.match(output,/Eventos nomeados com bit ativo: 2\/507/);
 assert.match(output,/remoção de objetos ativas: 1\/228/);
 assert.match(output,/HM01 Cut: bit ativo/);
 assert.match(output,/HM03 Surf: bit inativo/);
 assert.match(output,/ROUTE 4 ITEM: remoção marcada na RAM/);
 assert.doesNotMatch(output,/CERULEAN RIVAL/);
 assert.match(output,/não certificam conclusão de história/);
 s.romWorldEventAtlas.romSha256='0'.repeat(64);
 assert.doesNotMatch(render(s).body.textContent,/EVENTOS DO JOGO: BITS/);
});

test('named event transitions show change of flag but never claim completion',()=>{
 const s=live();
 s.worldRecentNamedChanges={
   verified:true,romSha256:s.worldAdvisor.romSha256,
   events:[
     {kind:'NAMED_EVENT_BIT_CHANGED',name:'EVENT_GOT_HM01',
       eventBitIndex:1504,flagSet:true},
     {kind:'OBJECT_TOGGLE_BIT_CHANGED',name:'TOGGLE_ROUTE_4_ITEM',
       mapId:15,toggleIndex:27,flagSet:false}
   ]
 };
 const text=render(s).body.textContent;
 assert.match(text,/MUDANÇAS EM EVENTOS E OBJETOS NOMEADOS/);
 assert.match(text,/GOT HM01: bit ativado/);
 assert.match(text,/ROUTE 4 ITEM \(#15\): flag de remoção desativada/);
 assert.match(text,/não provam quem agiu, missão terminada ou passagem aberta/);
 s.worldRecentNamedChanges.romSha256='0'.repeat(64);
 assert.doesNotMatch(render(s).body.textContent,/MUDANÇAS EM EVENTOS E OBJETOS NOMEADOS/);
});

test('verified elevator menu shows ROM choices without claiming a selected floor',()=>{
 const s=live();
 s.romElevatorOptions={verified:true,hasElevator:true,
   romSha256:s.worldAdvisor.romSha256,mapId:15,
   elevatorName:'Elevador de teste (não real)',
   options:[{floorMenuIndex:0,destinationMapId:122,destinationWarpIndex:5},
     {floorMenuIndex:1,destinationMapId:123,destinationWarpIndex:2}]};
 const body=render(s).body.textContent;
 assert.match(body,/ELEVADOR — PISOS POSSÍVEIS DA ROM/);
 assert.match(body,/Piso\/opção 1: mapa #122/);
 assert.match(body,/Piso\/opção 2: mapa #123/);
 assert.match(body,/disponível agora: por confirmar/);
 assert.match(body,/condições do script não observadas/);
 s.romElevatorOptions.mapId=127;
 assert.doesNotMatch(render(s).body.textContent,/ELEVADOR — PISOS POSSÍVEIS/);
});

test('global goals describe Cut and Surf actions rather than guaranteed access',()=>{
 const s=live();
 s.globalCampaignObjectives={verified:true,romSha256:s.worldAdvisor.romSha256,
   sourceMapId:15,mapCount:226,mapsWithPending:1,mapsWithUnknown:0,
   objectives:[{mapId:16,mapName:'Route 5',
     pending:{hiddenItems:1,hiddenCoins:0,trainerGatesOpen:0,
       stationaryGatesOpen:0},unknown:{trainers:0,stationaryPokemon:0},
     mapHopCount:1,firstTransitionTerrainEvidence:'LOCAL_TERRAIN_PATH_CANDIDATE',
     firstTransitionConditionalAccess:'TERRAIN_PATH_REQUIRES_CUT_ACTION'}]};
 const t=render(s).body.textContent;
 assert.match(t,/Cut: ação em campo ainda por confirmar/);
 assert.doesNotMatch(t,/acesso garantido/i);
 s.globalCampaignObjectives.objectives[0].firstTransitionConditionalAccess=
   'SURF_NOT_USABLE_IN_CURRENT_PARTY';
 const second=render(s).body.textContent;
 assert.match(second,/Surf indisponível no estado de capacidades conhecido/);
});
