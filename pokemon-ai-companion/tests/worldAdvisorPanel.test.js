'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
// Isolate the actual browser renderer without running the full cockpit's
// background polling, timers or RetroArch connection.
const script=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
// The real renderer depends on the immediately preceding checklist formatter.
// Include both production functions in this isolated VM; never mock away the
// formatter or silently suppress ReferenceError from integration.
const start=script.indexOf('function formatCampaignChecklistSection(advice) {');
const renderStart=script.indexOf('function renderWorldAdvisor(state) {',start);
const end=script.indexOf('// Renderização Principal do Cockpit',renderStart);
if(start<0||renderStart<=start||end<=renderStart)
 throw Error('World checklist formatter or renderer section unavailable');
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
test('world map shows physical candidate cross-map flag hints without causal claims',()=>{
 const state=live();
 state.worldAdvisor.romStaticFlagCandidatesVerified=true;
 state.worldAdvisor.romStaticFlagCausalEffectsVerified=false;
 state.worldAdvisor.romStaticFlagCandidatesWorldTotal=8;
 state.worldAdvisor.romStaticFlagCandidates=[{
  bitIndex:81,possibleWriterMapId:15,possibleReaderMapId:45,
  possibleWriterKind:'NPC',possibleReaderKind:'TRAINER',
  possibleWriterOrdinal:2,possibleReaderOrdinal:3,
  possibleWriteOpcode:'SET_BIT',
  verifiedActionDependency:false,causalLinkObserved:false
 }];
 const output=render(state);
 assert.match(output.body.textContent,/RELAÇÕES ENTRE MAPAS/);
 assert.match(output.body.textContent,/8 na ROM/);
 assert.match(output.body.textContent,/Flag candidata #81/);
 assert.match(output.body.textContent,/mapa #15/);
 assert.match(output.body.textContent,/mapa #45/);
 assert.match(output.body.textContent,/NÃO comprova sequência/);
 assert.equal(output.body.innerHTML,null);
 state.worldAdvisor.romStaticFlagCausalEffectsVerified=true;
 assert.doesNotMatch(render(state).body.textContent,/Flag candidata #81/);
 state.worldAdvisor.romStaticFlagCausalEffectsVerified=false;
 state.connected=false;
 assert.doesNotMatch(render(state).body.textContent,/Flag candidata #81/);
});
test('ROM-verified bit branch and two TX_FAR pointers show as static alternatives only',()=>{
 const s=live();
 s.worldAdvisor.romStaticFlagCandidatesVerified=true;
 s.worldAdvisor.romStaticFlagCausalEffectsVerified=false;
 s.worldAdvisor.romStaticFlagCandidatesWorldTotal=8;
 s.worldAdvisor.romStaticFlagCandidates=[{
  bitIndex:1231,possibleWriterMapId:148,possibleReaderMapId:149,
  possibleWriterKind:'NPC',possibleReaderKind:'NPC',
  possibleWriterOrdinal:4,possibleReaderOrdinal:1,
  possibleWriteOpcode:'SET_BIT',verifiedActionDependency:false,
  causalLinkObserved:false,readerConditionalDirectionVerified:true,
  readerBranchCondition:{verified:true,condition:'NZ',
   takenTargetCpu:22728,jumpTakenIfBitSet:true,branchActuallyTaken:null},
  readerTwoAlternativeTextScriptsVerified:true,
  readerDualTextChoice:{
   alternativeTextScriptsStaticallyProven:true,
   textOnBitClearPointerCpu:22737,textOnBitSetPointerCpu:22742
  }
 }];
 const r=render(s);
 assert.match(r.body.textContent,/Flag candidata #1231/);
 assert.match(r.body.textContent,/ramo NZ se bit ativo/);
 assert.match(r.body.textContent,/Dois textos TX_FAR confirmados/);
 assert.match(r.body.textContent,/bit 0/);
 assert.match(r.body.textContent,/bit 1/);
 assert.match(r.body.textContent,/NÃO está comprovado/);
 assert.equal(r.body.innerHTML,null);
 s.worldAdvisor.romStaticFlagCandidates[0].readerBranchCondition.branchActuallyTaken=true;
 assert.doesNotMatch(render(s).body.textContent,/ramo NZ se bit ativo/);
 s.worldAdvisor.romStaticFlagCandidates[0].readerTwoAlternativeTextScriptsVerified=false;
 assert.doesNotMatch(render(s).body.textContent,/Dois textos TX_FAR confirmados/);
});
test('external map and event names are labeled as reference, not ROM-executed truth',()=>{
 const s=live();
 s.worldAdvisor.romStaticFlagCandidatesVerified=true;
 s.worldAdvisor.romStaticFlagCausalEffectsVerified=false;
 s.worldAdvisor.romStaticFlagCandidatesWorldTotal=8;
 s.worldAdvisor.romStaticFlagCandidates=[{
  bitIndex:1231,possibleWriterMapId:148,possibleReaderMapId:149,
  possibleWriterKind:'NPC',possibleReaderKind:'NPC',
  possibleWriterOrdinal:4,possibleReaderOrdinal:1,
  possibleWriteOpcode:'SET_BIT',verifiedActionDependency:false,
  causalLinkObserved:false,referenceNameSource:'pret/pokered',
  referenceNameIsRomIntrinsic:false,referenceEventName:'EVENT_RESCUED_MR_FUJI',
  writerReferenceMapName:'POKEMON_TOWER_7F',
  readerReferenceMapName:'MR_FUJIS_HOUSE'
 }];
 const r=render(s);
 assert.match(r.body.textContent,/EVENT_RESCUED_MR_FUJI/);
 assert.match(r.body.textContent,/POKEMON_TOWER_7F/);
 assert.match(r.body.textContent,/MR_FUJIS_HOUSE/);
 assert.match(r.body.textContent,/EXTERNOS à ROM/);
 assert.equal(r.body.innerHTML,null);
 s.worldAdvisor.romStaticFlagCandidates[0].referenceNameSource='UNVERIFIED';
 assert.doesNotMatch(render(s).body.textContent,/EVENT_RESCUED_MR_FUJI/);
});
test('all physical BIT SET RES operations in current map are shown without gameplay claims',()=>{
 const s=live();
 s.worldAdvisor.romAllFlagOperationsVerified=true;
 s.worldAdvisor.romAllFlagOperationsRuntimeEffectsVerified=false;
 s.worldAdvisor.romAllFlagOperationsHandlerScoped=135;
 s.worldAdvisor.romAllFlagOperations=[{
  bitIndex:1231,domain:'WORLD_EVENT_BIT',operation:'BIT_TEST',
  actorKind:'NPC',actorOrdinal:2,opcodeFileOffset:121016,
  externalLabelSource:'pret/pokered',labelIntrinsicToRom:false,
  externalEventLabel:'EVENT_RESCUED_MR_FUJI',
  instructionExecuted:false,causalEffectVerified:false,
  bitValueInCurrentSave:null,conditionalBranch:{
   verified:true,condition:'NZ',branchActuallyTaken:null,
   jumpTakenIfBitSet:true
  }
 },{
  bitIndex:7,domain:'HIDDEN_ITEM_BIT',operation:'SET_BIT',
  actorKind:'NPC',actorOrdinal:1,opcodeFileOffset:5555,
  labelIntrinsicToRom:false,instructionExecuted:false,
  causalEffectVerified:false,bitValueInCurrentSave:null
 }];
 const shown=render(s).body.textContent;
 assert.match(shown,/TODOS OS SCRIPTS DESTE MAPA/);
 assert.match(shown,/135 operacoes identificadas/);
 assert.match(shown,/EVENT_RESCUED_MR_FUJI/);
 assert.match(shown,/BIT_TEST bit 1231/);
 assert.match(shown,/SET_BIT bit 7/);
 assert.match(shown,/nenhuma execucao comprovada/);
 assert.match(shown,/nao prova que o NPC foi ativado/);
 s.worldAdvisor.romAllFlagOperationsRuntimeEffectsVerified=true;
 assert.doesNotMatch(render(s).body.textContent,/BIT_TEST bit 1231/);
 s.worldAdvisor.romAllFlagOperationsRuntimeEffectsVerified=false;
 s.connected=false;
 assert.doesNotMatch(render(s).body.textContent,/BIT_TEST bit 1231/);
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
 assert.match(text,/Desvio multimapa TEÓRICO: 2 transições/);
 assert.match(text,/2 warps, 0 fronteiras/);
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

test('map-level return-cycle is only a hypothesis for exactly the same ROM item',()=>{
 const s=live();
 s.romWorldDetourCycles={verified:true,romSha256:s.worldAdvisor.romSha256,
   mapId:15,target:{mapId:15,x:5,y:3},
   candidates:[{mapIds:[15,16,17,15],transitions:3,
     includesOutdoorBorder:true,returnsToTargetSideProven:false}]};
 let text=render(s).body.textContent;
 assert.match(text,/Voltas ENTRE MAPAS para investigar/);
 assert.match(text,/Mapas #15 → #16 → #17 → #15/);
 assert.match(text,/NÃO comprovado que a volta regresse do lado acessível/);
 s.romWorldDetourCycles.target.x=8;
 assert.doesNotMatch(render(s).body.textContent,/Voltas ENTRE MAPAS para investigar/);
 s.romWorldDetourCycles.target.x=5;
 s.romWorldDetourCycles.romSha256='0'.repeat(64);
 assert.doesNotMatch(render(s).body.textContent,/Voltas ENTRE MAPAS para investigar/);
});
test('full ROM geometry route takes precedence over loose cycles only for same item',()=>{
 const s=live();
 s.romWorldDetourCycles={verified:true,romSha256:s.worldAdvisor.romSha256,
   mapId:15,target:{mapId:15,x:5,y:3},
   candidates:[{mapIds:[15,16,17,15],transitions:3,
     includesOutdoorBorder:true}]};
 s.romCrossMapItemRoute={verified:true,found:true,
   romSha256:s.worldAdvisor.romSha256,sourceMapId:15,
   target:{mapId:15,x:5,y:3},warpTransitions:2,theoreticalSteps:14,
   segments:[{sourceWarpTile:{x:4,y:3},destinationMapId:16}]};
 let text=render(s).body.textContent;
 assert.match(text,/Desvio multimapa TEÓRICO/);
 assert.doesNotMatch(text,/Voltas ENTRE MAPAS para investigar/);
 s.romCrossMapItemRoute.target.x=40;
 text=render(s).body.textContent;
 assert.doesNotMatch(text,/Desvio multimapa TEÓRICO/);
 assert.match(text,/Voltas ENTRE MAPAS para investigar/);
});

test('a LAST_MAP D365 destination is labelled as non-atomic evidence, never open',()=>{
 const s=live();
 s.romLocalExitAccess={verified:true,romSha256:s.worldAdvisor.romSha256,
   mapId:15,positionFromRam:{x:12,y:3},
   counts:{WARP:1},truncated:false,
   exits:[{kind:'WARP',sourceWarpIndex:1,
     sourceTile:{x:12,y:4},destinationMapId:18,
     destinationEvidence:'RAM_SEQUENTIAL_LAST_MAP',
     staticDestinationStatus:'LAST_MAP_RAM_REQUIRED',
     terrainStatus:'THEORETICAL_TERRAIN_PATH',approach:null}]};
 const text=render(s).body.textContent;
 assert.match(text,/Warp #1/);
 assert.match(text,/mapa #18/);
 assert.match(text,/destino D365 relido; passagem não comprovada/);
});

test('source-only outdoor crossing tile is never described as confirmed destination',()=>{
 const s=live();
 s.romLocalExitAccess={verified:true,romSha256:s.worldAdvisor.romSha256,
   mapId:15,positionFromRam:{x:12,y:3},
   counts:{OUTDOOR_BORDER:1},truncated:false,
   exits:[{kind:'OUTDOOR_BORDER',direction:'north',destinationMapId:4,
     terrainStatus:'BORDER_SOURCE_TERRAIN_CANDIDATES_ALIGNMENT_UNKNOWN',
     borderEvidence:{verified:true,terrainCandidateCount:2,
       neighborAlignmentVerified:false,borderTiles:[
         {tile:{x:12,y:0},steps:3,terrainStatus:'TERRAIN_TO_BORDER_POSSIBLE'},
         {tile:{x:13,y:0},steps:4,terrainStatus:'TERRAIN_TO_BORDER_POSSIBLE'}
       ]}}]};
 const body=render(s).body.textContent;
 assert.match(body,/tiles de borda alcançáveis na ROM/);
 assert.match(body,/Borda de origem: 2 tiles candidatos/);
 assert.match(body,/Tile de borda possível: X:12 Y:0/);
 assert.match(body,/travessia e destino NÃO confirmados/);
});

test('map-return hint shows only source first step and border tile without arrival proof',()=>{
 const s=live();
 s.romWorldDetourCycles={verified:true,romSha256:s.worldAdvisor.romSha256,
   mapId:15,target:{mapId:15,x:5,y:3},
   candidates:[{mapIds:[15,16,17,15],transitions:3,
     includesOutdoorBorder:true,
     firstExitEvidence:{known:true,kind:'OUTDOOR_BORDER',
       fromMapId:15,toMapId:16,terrainStatus:'BORDER_SOURCE_TERRAIN_CANDIDATES_ALIGNMENT_UNKNOWN',
       firstTerrainStep:{x:4,y:3},candidateBorderTile:{x:89,y:3},
       crossingAlignmentVerified:false}}]};
 const body=render(s).body.textContent;
 assert.match(body,/Primeira saída candidata: mapa #15 → #16/);
 assert.match(body,/Primeiro passo TEÓRICO: X:4 Y:3/);
 assert.match(body,/Tile de borda CANDIDATO: X:89 Y:3/);
 assert.match(body,/alinhamento com destino NÃO verificado/);
});

test('pointer-aligned border shows separate source and destination, not traversed',()=>{
 const s=live();
 s.romLocalExitAccess={verified:true,
   romSha256:s.worldAdvisor.romSha256,mapId:15,
   positionFromRam:{x:12,y:3},truncated:false,
   counts:{OUTDOOR_BORDER:1},
   exits:[{kind:'OUTDOOR_BORDER',direction:'east',destinationMapId:3,
     terrainStatus:'BORDER_ALIGNED_TERRAIN_CANDIDATES_TRANSFER_UNVERIFIED',
     borderEvidence:{verified:true,neighborAlignmentVerified:true,
       terrainCandidateCount:1,borderTiles:[{
         tile:{x:89,y:4},destinationTile:{x:0,y:12},steps:1,
         terrainStatus:'TERRAIN_TO_BORDER_POSSIBLE',
         destinationTerrainStatus:'STATIC_LAND_CANDIDATE'
       }]}}]};
 const body=render(s).body.textContent;
 assert.match(body,/alinhamento ROM conferido, travessia NÃO confirmada/);
 assert.match(body,/Tile DESTINO de referência: X:0 Y:12/);
 assert.match(body,/transferência no jogo NÃO comprovada/);
});
test('aligned first return-cycle step still cannot certify target item access',()=>{
 const s=live();
 s.romWorldDetourCycles={verified:true,romSha256:s.worldAdvisor.romSha256,
   mapId:15,target:{mapId:15,x:5,y:3},
   candidates:[{mapIds:[15,16,17,15],transitions:3,
     includesOutdoorBorder:true,firstExitEvidence:{
       known:true,kind:'OUTDOOR_BORDER',fromMapId:15,toMapId:16,
       terrainStatus:'BORDER_ALIGNED_TERRAIN_CANDIDATES_TRANSFER_UNVERIFIED',
       firstTerrainStep:{x:88,y:4},candidateBorderTile:{x:89,y:4},
       candidateDestinationTile:{x:0,y:12},
       crossingAlignmentVerified:true}}]};
 const body=render(s).body.textContent;
 assert.match(body,/alinhamento confirmado por ponteiros ROM/);
 assert.match(body,/Tile DESTINO de referência: X:0 Y:12/);
 assert.match(body,/passagem efetiva NÃO observada/);
 assert.match(body,/NÃO comprovado que a volta regresse do lado acessível/);
});

test('worldwide 78-border geometry is reported as reference, not unlocked route',()=>{
 const s=live();
 s.romOutdoorOverlapIndex={verified:true,romSha256:s.worldAdvisor.romSha256,
   edgeCount:78,overlappingTilePairs:1484,
   staticLandCompatiblePairs:400,bordersWithoutLandPairs:8};
 const text=render(s).body.textContent;
 assert.match(text,/FRONTEIRAS DE KANTO — MATRIZ ROM MUNDIAL/);
 assert.match(text,/78 ligações alinhadas/);
 assert.match(text,/1?484 pares de tiles sobrepostos/);
 assert.match(text,/8 fronteiras sem par terrestre estático/);
 assert.match(text,/0 travessias executadas comprovadas/);
 s.romOutdoorOverlapIndex.romSha256='0'.repeat(64);
 assert.doesNotMatch(render(s).body.textContent,/FRONTEIRAS DE KANTO — MATRIZ ROM MUNDIAL/);
});
test('global objectives flag zero-land border but do not mark it blocked',()=>{
 const s=live();
 s.globalCampaignObjectives={verified:true,romSha256:s.worldAdvisor.romSha256,
   sourceMapId:15,mapCount:226,mapsWithPending:1,mapsWithUnknown:0,
   objectives:[{mapId:16,mapName:'Rota de teste',
     pending:{hiddenItems:1,hiddenCoins:0,trainerGatesOpen:0,
       stationaryGatesOpen:0},unknown:{trainers:0,stationaryPokemon:0},
     mapHopCount:1,
     route:[{kind:'OUTDOOR_BOUNDARY',romAlignedBorder:true,
       staticLandCompatiblePairs:0}],
     firstTransitionTerrainEvidence:'TERRAIN_NOT_VERIFIED'}]};
 const text=render(s).body.textContent;
 assert.match(text,/fronteira\(s\) da rota sem par terrestre ROM/);
 assert.match(text,/Surf\/script por confirmar/);
 assert.doesNotMatch(text,/permanentemente bloqueado/);
});

test('batch routes never cross-identify normal versus hidden item at same coordinates',()=>{
 const s=live(),sha=s.worldAdvisor.romSha256;
 s.worldAdvisor.observations=[
  {kind:'ITEM',what:'Visível',x:5,y:3,status:'NOT_REMOVED_FLAG'},
  {kind:'HIDDEN_ITEM',what:'Oculto',x:5,y:3,status:'NOT_COLLECTED_FLAG'}
 ];
 const route=hidden=>({
   verified:true,found:true,romSha256:sha,sourceMapId:15,
   target:{mapId:15,x:5,y:3,hidden},warpTransitions:1,
   outdoorTransitions:0,transitionCount:1,theoreticalSteps:8,
   segments:[{kind:'WARP',sourceWarpTile:{x:3,y:5},destinationMapId:6}]
 });
 s.romCrossMapItemRoutes={verified:true,romSha256:sha,sourceMapId:15,
   results:[route(false)]};
 let t=render(s).body.textContent;
 assert.equal((t.match(/Desvio multimapa TEÓRICO/g)||[]).length,1);
 s.romCrossMapItemRoutes.results=[route(true)];
 t=render(s).body.textContent;
 assert.equal((t.match(/Desvio multimapa TEÓRICO/g)||[]).length,1);
 s.romCrossMapItemRoutes.results=[route(false),route(true)];
 t=render(s).body.textContent;
 assert.equal((t.match(/Desvio multimapa TEÓRICO/g)||[]).length,2);
 s.romCrossMapItemRoutes.romSha256='0'.repeat(64);
 t=render(s).body.textContent;
 assert.doesNotMatch(t,/Desvio multimapa TEÓRICO/);
});

test('unresolved batch item distinguishes search exhaustion from geometric no-route',()=>{
 const s=live(),sha=s.worldAdvisor.romSha256;
 s.worldAdvisor.observations=[{kind:'ITEM',what:'Item sem caminho',
   x:5,y:3,status:'NOT_REMOVED_FLAG',accessStatus:'NO_SAME_MAP_PATH'}];
 s.romCrossMapItemRoutes={verified:true,romSha256:sha,sourceMapId:15,
   results:[{verified:true,found:false,romSha256:sha,sourceMapId:15,
     target:{mapId:15,x:5,y:3,hidden:false},maxStatesExceeded:true}]};
 let t=render(s).body.textContent;
 assert.match(t,/pesquisa interrompida pelo limite de estados/);
 assert.doesNotMatch(t,/acesso garantido/i);
 s.romCrossMapItemRoutes.results[0].maxStatesExceeded=false;
 t=render(s).body.textContent;
 assert.match(t,/nenhum caminho demonstrado no modelo ROM; não prova bloqueio/);
 s.romCrossMapItemRoutes.romSha256='0'.repeat(64);
 t=render(s).body.textContent;
 assert.doesNotMatch(t,/pesquisa interrompida|nenhum caminho demonstrado no modelo ROM/);
});

test('strength hypothesis is never labelled as confirmed movement',()=>{
 const s=live();
 s.worldAdvisor.observations=[{kind:'ITEM',what:'Objeto para lá da rocha',
  x:5,y:3,status:'NOT_REMOVED_FLAG',
  accessStatus:'STRENGTH_SEQUENCE_HYPOTHESIS',
  accessRoute:{steps:9,usesStrength:true,pushCount:2}}];
 const t=render(s).body.textContent;
 assert.match(t,/Possível sequência de empurrões com Strength/);
 assert.match(t,/2 empurrões teóricos/);
 assert.match(t,/execução por confirmar/);
 assert.doesNotMatch(t,/Strength concluído|acesso garantido/);
});

test('Strength UI marks first push as hypothetical, not a free walking step',()=>{
 const s=live();
 s.worldAdvisor.observations=[{
   kind:'ITEM',what:'Rocha à frente',x:5,y:3,
   status:'NOT_REMOVED_FLAG',
   accessStatus:'STRENGTH_SEQUENCE_HYPOTHESIS',
   accessRoute:{steps:5,usesStrength:true,pushCount:2,nextStep:null,
     firstPush:{direction:'east',from:{x:2,y:3},to:{x:3,y:3}}}
 }];
 const output=render(s).body.textContent;
 assert.match(output,/Primeiro empurrão TEÓRICO: east/);
 assert.match(output,/de posição|da posição/);
 assert.match(output,/execução por confirmar/);
 assert.doesNotMatch(output,/passagem garantida/);
});

test('Strength D728 status is not presented as an observed push',()=>{
 const s=live();
 s.worldAdvisor.observations=[{kind:'ITEM',what:'Item após rocha',
   x:5,y:3,status:'NOT_REMOVED_FLAG',
   accessStatus:'STRENGTH_SEQUENCE_HYPOTHESIS',
   accessRoute:{steps:4,usesStrength:true,pushCount:1,
     strengthFieldActiveAtSample:true}}];
 let t=render(s).body.textContent;
 assert.match(t,/bit RAM \$D728 ativo nesta leitura/);
 assert.match(t,/não prova empurrão/);
 s.worldAdvisor.observations[0].accessRoute.strengthFieldActiveAtSample=false;
 t=render(s).body.textContent;
 assert.match(t,/bit RAM \$D728 inativo/);
 s.worldAdvisor.observations[0].accessRoute.strengthFieldActiveAtSample=null;
 t=render(s).body.textContent;
 assert.match(t,/ativação na RAM ainda por confirmar/);
});

test('remote pending item route includes exact map tile but no guaranteed access',()=>{
 const s=live(),sha=s.worldAdvisor.romSha256;
 s.globalFlagItemRoutes={verified:true,romSha256:sha,sourceMapId:15,
   items:[{kind:'HIDDEN_ITEM',mapName:'Cerulean City',mapId:3,x:0,y:12,
     route:{verified:true,found:true,transitionCount:1,warpTransitions:0,
       outdoorTransitions:1,segments:[{kind:'OUTDOOR_BORDER',
         sourceBorderTile:{x:89,y:4},destinationMapId:3}]}}]};
 const text=render(s).body.textContent;
 assert.match(text,/ITENS OCULTOS NOUTROS MAPAS/);
 assert.match(text,/Cerulean City \(#3\) X:0 Y:12/);
 assert.match(text,/1 transições teóricas/);
 assert.match(text,/acesso NÃO garantido/);
 s.globalFlagItemRoutes.romSha256='0'.repeat(64);
 assert.doesNotMatch(render(s).body.textContent,/ITENS OCULTOS NOUTROS MAPAS/);
});

test('unknown remote connection shows pending item without claiming permanent block',()=>{
 const state=live(),sha=state.worldAdvisor.romSha256;
 state.globalFlagItemRoutes={verified:true,romSha256:sha,sourceMapId:15,
   items:[{kind:'HIDDEN_ITEM',mapName:'Outro mapa',mapId:50,x:2,y:3,
     route:null,routeNotAttemptedReason:'NO_STATIC_MAP_ROUTE'}]};
 const shown=render(state).body.textContent;
 assert.match(shown,/Outro mapa \(#50\) X:2 Y:3/);
 assert.match(shown,/ligação estática entre mapas por determinar/);
 assert.match(shown,/NÃO prova bloqueio/);
});

test('remote panel distinguishes total backlog from the four visible route slots',()=>{
 const s=live(),sha=s.worldAdvisor.romSha256;
 s.globalFlagItemRoutes={verified:true,romSha256:sha,sourceMapId:15,
   totalPendingRemote:17,mapsWithPendingRemote:9,
   totalWithoutStaticRoute:7,items:[{
     kind:'HIDDEN_ITEM',mapName:'Mapa remoto',mapId:50,x:4,y:5,
     route:null,routeNotAttemptedReason:'NO_STATIC_MAP_ROUTE'}]};
 const result=render(s).body.textContent;
 assert.match(result,/A mostrar 1 de 17 objetivos ocultos pendentes/);
 assert.match(result,/em 9 mapas/);
 assert.match(result,/Rotas estáticas por determinar: 7 objetivos/);
 assert.match(result,/NÃO significa bloqueados/);
});

test('world agenda labels visible ROM objects as unconfirmed, never uncollected',()=>{
 const state=live(),sha=state.worldAdvisor.romSha256;
 state.globalCampaignObjectives={verified:true,romSha256:sha,
   sourceMapId:15,mapCount:226,mapsWithPending:0,mapsWithUnknown:1,
   objectives:[{mapId:15,mapName:'Route 4',mapHopCount:0,
     pending:{hiddenItems:0,hiddenCoins:0,trainerGatesOpen:0,
       stationaryGatesOpen:0},
     unknown:{trainers:0,stationaryPokemon:0,visibleItems:2}}]};
 const output=render(state).body.textContent;
 assert.match(output,/2 itens visíveis na ROM \(recolha por confirmar\)/);
 assert.doesNotMatch(output,/itens visíveis por recolher/);
});

test('visible objects in other maps show coordinates without pretending still uncollected',()=>{
 const s=live(),sha=s.worldAdvisor.romSha256;
 s.globalCampaignObjectives={verified:true,romSha256:sha,
   sourceMapId:15,mapCount:226,objectiveIndexCount:2,
   remoteObjectiveIndex:[{mapId:15,mapHopCount:0},{mapId:20,mapHopCount:2}],
   objectives:[],mapsWithPending:0,mapsWithUnknown:1};
 const mapProgress=Array.from({length:226},(_,i)=>({
   mapId:i,name:i===20?'Mapa 20':'Mapa '+i,
   visibleItems:{unresolved:i===20?2:0},
   flagRecords:{visibleItems:i===20?[
     {x:3,y:6,itemId:42,collected:null},
     {x:2,y:1,itemId:43,collected:null}]:[]}
 }));
 s.globalCampaignLedger={verified:true,romSha256:sha,mapCount:226,mapProgress};
 const output=render(s).body.textContent;
 assert.match(output,/ITENS VISÍVEIS NOUTROS MAPAS/);
 assert.match(output,/A mostrar 2 de 2 objetos visíveis ROM remotos/);
 assert.match(output,/Mapa 20 \(#20\) X:3 Y:6/);
 assert.match(output,/ID item ROM #42/);
 assert.match(output,/recolha individual DESCONHECIDA/);
 assert.match(output,/Presença estática na ROM não significa item ainda disponível/);
 s.globalCampaignLedger.romSha256='0'.repeat(64);
 assert.doesNotMatch(render(s).body.textContent,/ITENS VISÍVEIS NOUTROS MAPAS/);
});

test('ROM-wide NPCs and signs disclose text ids and unknown dialogue outcome',()=>{
 const s=live(),sha=s.worldAdvisor.romSha256;
 s.globalCampaignObjectives={verified:true,romSha256:sha,
   sourceMapId:15,mapCount:226,objectiveIndexCount:2,
   remoteObjectiveIndex:[{mapId:15,mapHopCount:0},{mapId:20,mapHopCount:2}],
   objectives:[{mapId:20,mapName:'Mapa 20',mapHopCount:2,
     pending:{},unknown:{npcInteractions:1,signInteractions:1}}],
   mapsWithPending:0,mapsWithUnknown:1};
 s.globalCampaignLedger={verified:true,romSha256:sha,mapCount:226,
   mapProgress:Array.from({length:226},(_,id)=>({
     mapId:id,name:'Mapa '+id,
     visibleItems:{unresolved:0},
     flagRecords:{visibleItems:[]},
     interactions:{unresolved:id===20?2:0},
     interactionRecords:{npcs:id===20?[[1,3,4,7]]:[],
       signs:id===20?[[1,5,2,8]]:[]}
   }))};
 const output=render(s).body.textContent;
 assert.match(output,/NPCS E SINAIS NOUTROS MAPAS/);
 assert.match(output,/A mostrar 2 de 2 pontos de interação/);
 assert.match(output,/NPC — Mapa 20 \(#20\) X:3 Y:4/);
 assert.match(output,/SINAL — Mapa 20 \(#20\) X:5 Y:2/);
 assert.match(output,/Text ID #7/);
 assert.match(output,/efeito e execução DESCONHECIDOS/);
 assert.doesNotMatch(output,/diálogo concluído/);
 s.globalCampaignLedger.romSha256='0'.repeat(64);
 assert.doesNotMatch(render(s).body.textContent,/NPCS E SINAIS NOUTROS MAPAS/);
});

test('remote NPC and sign can show verified ROM entry without claiming dialogue outcome',()=>{
 const s=live(),sha=s.worldAdvisor.romSha256;
 s.globalCampaignObjectives={verified:true,romSha256:sha,
   sourceMapId:15,mapCount:226,objectiveIndexCount:1,
   remoteObjectiveIndex:[{mapId:20,mapHopCount:2}],
   objectives:[],mapsWithPending:0,mapsWithUnknown:1};
 s.globalCampaignLedger={verified:true,romSha256:sha,mapCount:226,
   mapProgress:Array.from({length:226},(_,i)=>({
     mapId:i,name:'Mapa '+i,visibleItems:{unresolved:0},
     flagRecords:{visibleItems:[]},
     interactions:{unresolved:i===20?1:0},
     interactionRecords:{npcs:i===20?
       [[1,3,4,7,'TX_FAR',6,0x5400]]:[],signs:[]}
   }))};
 const message=render(s).body.textContent;
 assert.match(message,/Entrada ROM TX_FAR/);
 assert.match(message,/banco 6/);
 assert.match(message,/CPU 0x5400/);
 assert.match(message,/efeito e execução DESCONHECIDOS/);
 assert.doesNotMatch(message,/diálogo executado/);
});

test('world ROM mart lists show exact article IDs without invented prices or availability',()=>{
 const s=live(),sha=s.worldAdvisor.romSha256;
 s.globalCampaignObjectives={verified:true,romSha256:sha,
   sourceMapId:15,mapCount:226,objectiveIndexCount:2,
   remoteObjectiveIndex:[{mapId:15,mapHopCount:0},{mapId:20,mapHopCount:2}],
   objectives:[],mapsWithPending:0,mapsWithUnknown:1};
 s.globalCampaignLedger={verified:true,romSha256:sha,mapCount:226,
   mapProgress:Array.from({length:226},(_,id)=>({
     mapId:id,name:'Mapa '+id,visibleItems:{unresolved:0},
     flagRecords:{visibleItems:[]},interactions:{unresolved:id===20?1:0},
     interactionRecords:{npcs:id===20?
       [[1,3,4,7,'SCRIPT_MART',0,0x24ea,[4,20,29]]]:[],signs:[]}
   }))};
 const output=render(s).body.textContent;
 assert.match(output,/LOJAS IDENTIFICADAS NA ROM/);
 assert.match(output,/Artigos ROM \(3\): 4, 20, 29/);
 assert.match(output,/preços e acesso atual DESCONHECIDOS/);
 assert.match(output,/sem prova de compra, preço ou stock atual/);
 s.globalCampaignLedger.romSha256='0'.repeat(64);
 assert.doesNotMatch(render(s).body.textContent,/LOJAS IDENTIFICADAS NA ROM/);
});

test('world mart displays authenticated ROM base prices and names, never live quote',()=>{
 const s=live(),sha=s.worldAdvisor.romSha256;
 s.globalCampaignObjectives={verified:true,romSha256:sha,
   sourceMapId:15,mapCount:226,objectiveIndexCount:2,
   remoteObjectiveIndex:[{mapId:15,mapHopCount:0},{mapId:56,mapHopCount:2}],
   objectives:[],mapsWithPending:0,mapsWithUnknown:1};
 s.globalCampaignLedger={verified:true,romSha256:sha,mapCount:226,
   mapProgress:Array.from({length:226},(_,id)=>({
     mapId:id,name:'Mapa '+id,visibleItems:{unresolved:0},
     flagRecords:{visibleItems:[]},interactions:{unresolved:id===56?1:0},
     interactionRecords:{npcs:id===56?[[
       1,3,4,7,'SCRIPT_MART',0,0x24ea,[4,20],
       [{id:4,name:'POKE_BALL',baseRomPricePokedollars:200,priceIsLive:false},
        {id:20,name:'POTION',baseRomPricePokedollars:300,priceIsLive:false}]
     ]]:[],signs:[]}
   }))};
 const result=render(s).body.textContent;
 assert.match(result,/POKE_BALL #4 — 200 Poké\$ \(preço-base ROM\)/);
 assert.match(result,/POTION #20 — 300 Poké\$ \(preço-base ROM\)/);
 assert.match(result,/sem prova de compra, preço ou stock atual/);
});

test('Painel mostra texto TX_FAR sem HTML nem conclusão inventada',()=>{
 const s=live(),sha=s.worldAdvisor.romSha256;
 s.globalCampaignObjectives={verified:true,romSha256:sha,
   sourceMapId:15,mapCount:226,objectiveIndexCount:2,
   remoteObjectiveIndex:[{mapId:15,mapHopCount:0},{mapId:19,mapHopCount:1}],
   objectives:[],mapsWithPending:0,mapsWithUnknown:1};
 s.globalCampaignLedger={verified:true,romSha256:sha,mapCount:226,
   mapProgress:Array.from({length:226},(_,mapId)=>({
     mapId,name:'Mapa '+mapId,visibleItems:{unresolved:0},
     flagRecords:{visibleItems:[]},
     interactions:{unresolved:mapId===19?1:0},
     interactionRecords:{npcs:[],signs:mapId===19?[
       [1,5,2,7,'TX_FAR',6,0x5400,{
         verified:true,firstStringOnly:true,
         text:'Hi <PLAYER>! <img onerror=alert(1)>',
         containsRuntimeVariables:true,dialogueExecuted:false,
         textOutcomeVerified:false}]
       ]:[]}
   }))};
 const result=render(s);
 assert.match(result.body.textContent,/Início literal ROM/);
 assert.match(result.body.textContent,/<img onerror=alert\(1\)>/);
 assert.match(result.body.textContent,/contém variáveis RAM/);
 assert.match(result.body.textContent,/efeitos por interpretar/);
 assert.match(result.body.textContent,/1 transição estática hipotética/);
 assert.doesNotMatch(result.body.textContent,/1 transições estáticas hipotéticas/);
 assert.equal(result.body.innerHTML,null);
 s.globalCampaignLedger.romSha256='0'.repeat(64);
 assert.doesNotMatch(render(s).body.textContent,/Início literal ROM/);
});

test('Painel usa sequências textuais ROM estáticas, sem executar HTML ou scripts',()=>{
 const s=live(),sha=s.worldAdvisor.romSha256;
 s.globalCampaignObjectives={verified:true,romSha256:sha,
   sourceMapId:15,mapCount:226,objectiveIndexCount:2,
   remoteObjectiveIndex:[{mapId:15,mapHopCount:0},{mapId:19,mapHopCount:1}],
   objectives:[],mapsWithPending:0,mapsWithUnknown:1};
 s.globalCampaignLedger={verified:true,romSha256:sha,mapCount:226,
   mapProgress:Array.from({length:226},(_,mapId)=>({
     mapId,name:'Mapa '+mapId,visibleItems:{unresolved:0},
     flagRecords:{visibleItems:[]},
     interactions:{unresolved:mapId===19?1:0},
     interactionRecords:{npcs:[],signs:mapId===19?[
       [1,5,2,7,'TX_FAR',6,0x5400,{
         verified:true,firstStringOnly:true,text:'Hi',
         containsRuntimeVariables:false,dialogueExecuted:false,
         textOutcomeVerified:false,program:{
           verified:true,scriptComplete:true,text:'Hi | <script>alert(1)</script>',
           segmentCount:2,termination:'TEXT_PROMPT',containsRuntimeText:false,
           containsRuntimeCommands:true,dialogueExecuted:false,
           textOutcomeVerified:false,scriptEffectsVerified:false}}]
       ]:[]}
   }))};
 const output=render(s);
 assert.match(output.body.textContent,/Segmentos literais ROM \(2, fecho TEXT_PROMPT corroborado\)/);
 assert.match(output.body.textContent,/<script>alert\(1\)<\/script>/);
 assert.match(output.body.textContent,/há conteúdo dependente da RAM/);
 assert.match(output.body.textContent,/condições e efeitos por interpretar/);
 assert.doesNotMatch(output.body.textContent,/Início literal ROM/);
 assert.equal(output.body.innerHTML,null);
 s.globalCampaignLedger.mapProgress[19].interactionRecords.signs[0][7]
  .program.scriptEffectsVerified=true;
 const fallback=render(s);
 assert.match(fallback.body.textContent,/Início literal ROM/);
 assert.doesNotMatch(fallback.body.textContent,/Segmentos literais ROM/);
});

test('isolated world panel renders live ROM checklist only under corroborated RAM',()=>{
 const s=live(),sha=s.worldAdvisor.romSha256;
 s.worldAdvisor.fullWorldStaticIndexVerified=true;
 s.worldAdvisor.campaignSummary={
  allStaticActions:1992,normalMaps:226,unresolvedMapIds:22,
  observedMapCount:1,scriptReferencesBound:1126
 };
 s.worldAdvisor.mapChecklist={
  verified:true,mapId:15,romSha256:sha,
  summary:{total:2,confirmedCollected:1,confirmedNotCollected:0,
   progressUnverified:1,needsCutCandidates:1,needsSurfCandidates:0},
  actions:[{
   kind:'HIDDEN_ITEM',x:7,y:4,progress:'COLLECTED_CONFIRMED_FLAG',
   staticObject:{hiddenIndex:3},scriptReferenceBound:false
  },{
   kind:'ITEM',x:5,y:3,progress:'NOT_PROVEN',
   staticObject:{itemOrTrainerId:19},routeCondition:'NEEDS_CUT',
   scriptReferenceBound:true,scriptCommand:'TX_START_ASM',
   scriptTextPointerVerified:true
  }]
 };
 const content=render(s).body.textContent;
 assert.match(content,/CHECKLIST COMPLETA DESTE MAPA/);
 assert.match(content,/índice evento #3/);
 assert.match(content,/TX_START_ASM/);
 assert.match(content,/efeito não certificado/);
 assert.match(content,/1992 objetos/);
 s.memoryReadStatus.positionWindow.verified=false;
 const stale=render(s).body.textContent;
 assert.doesNotMatch(stale,/CHECKLIST COMPLETA/);
 assert.match(stale,/Aguardar nova leitura/);
});
