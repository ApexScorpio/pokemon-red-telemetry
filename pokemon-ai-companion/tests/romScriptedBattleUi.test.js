'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
const start=source.indexOf('function formatScriptedBattleEvidenceSection(state,advice) {');
const end=source.indexOf('\nfunction renderWorldAdvisor(state)',start);
assert.ok(start>=0&&end>start,'Scripted-battle UI formatter is missing');
const format=vm.runInNewContext(
 source.slice(start,end)+'\nformatScriptedBattleEvidenceSection;',
 {},{timeout:1000});
const SHA='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
const defs={
 96:{ordinal:2,address:0xd665,values:[null,1,2,3,4],
  offsets:[398255,398344,398441,398515,398551],
  labels:['SCRIPT_SSANNE2F_DEFAULT','SCRIPT_SSANNE2F_RIVAL_START_BATTLE',
   'SCRIPT_SSANNE2F_RIVAL_AFTER_BATTLE','SCRIPT_SSANNE2F_RIVAL_EXIT',
   'SCRIPT_SSANNE2F_NOOP']},
 135:{ordinal:11,address:0xd65f,values:[null,2,0,1],
  offsets:[297995,298070,298118,298696],
  labels:['SCRIPT_GAMECORNER_DEFAULT','SCRIPT_GAMECORNER_ROCKET_BATTLE',
   'SCRIPT_GAMECORNER_ROCKET_EXIT']}
};
function fixture(mapId=96,byte=null){
 const c=defs[mapId],position={verified:true,mapId,x:4,y:6};
 const available=byte!==null;
 const writes=c.offsets.map((offset,i)=>({
  mapId,writeFileOffset:offset,referenceWramAddress:c.address,
  byteValueCandidate:c.values[i],
  referenceLabelCandidate:c.values[i]===null?null:c.labels[c.values[i]],
  executed:false,completedBattle:null,
  valueProvenOnExecutedPath:false,memoryChangeObserved:false,
  opcodeCandidatePhysicallyDecoded:true
 }));
 const o={kind:'SCRIPTED_BATTLE',mapId,ordinal:c.ordinal,
  referenceOnly:true,referenceWramAddress:c.address,
  battleWon:null,canBattleNow:null,mapScriptStateVerified:false,
  actualRomScriptSemanticsVerified:false,
  candidateStateValuesAreCurrentProgress:false,
  nextActionConditional:true,
  status:available?'SCRIPT_BYTE_REPEAT_VERIFIED_REFERENCE_ONLY':'SCRIPT_STATE_UNKNOWN',
  currentMapScriptValue:byte,
  referenceStateName:available?(c.labels[byte]??null):null,
  mapScriptByteRepeated:available,
  staticWriteCandidatesVerified:true,
  candidateStateWritesWithUnknownValue:1,
  candidateStateWritesFromRom:writes};
 const state={connected:true,romRuntimeIdentity:{matched:true},mapId,
  lastUpdate:new Date().toISOString(),
  memoryReadStatus:{verified:true,positionWindow:{...position},
   latePositionWindow:{...position},publicationPositionWindow:{...position}}};
 const advice={verified:true,mapId,romSha256:SHA,observations:[o]};
 return {state,advice,o};
}
function history(mapId=96,from=1,to=2){
 const c=defs[mapId];
 return {verified:true,baselineEstablished:true,
  mapId,romSha256:SHA,currentScriptByte:to,
  referenceStateName:c.labels[to]??null,
  playerActionConfirmed:false,battleWon:null,
  gameplayCompleted:false,snapshotAtomicVerified:false,
  events:[{kind:'SCRIPT_BYTE_CHANGED_BETWEEN_VERIFIED_POLLS',
   romSha256:SHA,mapId,fromScriptByte:from,toScriptByte:to,
   fromReferenceState:c.labels[from]??null,
   toReferenceState:c.labels[to]??null,
   referenceStateNamesOnly:true,snapshotAtomicVerified:false,
   controlFlowVerified:false,playerActionConfirmed:false,
   battleWon:null,gameplayCompleted:false,wasCausedByPlayer:null}]};
}
const lines=(x)=>Array.from(format(x.state,x.advice));
test('S.S. Anne shows all five static physical writes with unknown current progress',()=>{
 const x=fixture(),l=lines(x),txt=l.join('\n');
 assert.ok(txt.includes('S.S. Anne 2F'));
 assert.ok(txt.includes('398255: valor por determinar'));
 for(const [i,value] of defs[96].values.entries())
  assert.ok(txt.includes('Offset '+defs[96].offsets[i]),'offset '+i);
 assert.ok(txt.includes('Byte RAM atual: NÃO CONFIRMADO'));
 assert.ok(txt.includes('ordem física, NÃO cronológica'));
 assert.ok(!txt.includes('Vitória comprovada'));
 assert.ok(txt.includes('NÃO comprovam vitória'));
});
test('Game Corner shows four ROM writes and separate uncertain RAM progress',()=>{
 const x=fixture(135),txt=lines(x).join('\n');
 assert.ok(txt.includes('Rocket — Game Corner'));
 assert.ok(txt.includes('297995: valor por determinar'));
 for(const value of [2,0,1])assert.ok(txt.includes('valor candidato '+value));
 assert.ok(txt.includes('Byte RAM atual: NÃO CONFIRMADO'));
});
test('double-read script and history render an observed change, never victory',()=>{
 const x=fixture(96,2);
 x.state.romRecentScriptedBattleStateChanges=history();
 const txt=lines(x).join('\n');
 assert.ok(txt.includes('Byte RAM observado em leitura dupla: 2'));
 assert.ok(txt.includes('Transições RAM verificadas nesta sessão: 1'));
 assert.ok(txt.includes('1 → 2'));
 assert.ok(txt.includes('causa e ação do jogador desconhecidas'));
 assert.ok(txt.includes('nome apenas da referência'));
});
test('script state without corroborated history never shows guessed transitions',()=>{
 const x=fixture(96,2);
 x.state.romRecentScriptedBattleStateChanges=history(135);
 let txt=lines(x).join('\n');
 assert.ok(txt.includes('Histórico de transições: não comprovado'));
 assert.ok(!txt.includes('1 → 2'));
 const y=fixture(96,2);
 y.state.romRecentScriptedBattleStateChanges=history(96);
 y.state.romRecentScriptedBattleStateChanges.events[0].battleWon=true;
 txt=lines(y).join('\n');
 assert.ok(txt.includes('Histórico de transições: não comprovado'));
 assert.ok(!txt.includes('1 → 2'));
});
test('stale, disconnected, mismatched position, ROM or map fails closed',()=>{
 const items=[];
 const a=fixture();a.state.connected=false;items.push(a);
 const b=fixture();b.state.lastUpdate='2020-01-01T00:00:00.000Z';items.push(b);
 const c=fixture();c.state.memoryReadStatus.publicationPositionWindow.x=5;items.push(c);
 const d=fixture();d.state.romRuntimeIdentity.matched=false;items.push(d);
 const e=fixture();e.state.mapId=135;items.push(e);
 const f=fixture();f.advice.romSha256='wrong';items.push(f);
 const g=fixture();g.state.memoryReadStatus.verified=false;items.push(g);
 for(const x of items)assert.equal(lines(x).length,0);
});
test('misbound, duplicated, or forged actor status never becomes verified advice',()=>{
 const a=fixture();a.o.battleWon=true;assert.equal(lines(a).length,0);
 const b=fixture();b.advice.observations.push({...b.o});assert.equal(lines(b).length,0);
 const c=fixture();c.o.referenceWramAddress=0xd666;assert.equal(lines(c).length,0);
 const d=fixture();d.o.mapScriptStateVerified=true;assert.equal(lines(d).length,0);
 const e=fixture();e.o.canBattleNow=true;assert.equal(lines(e).length,0);
});
test('altered static operand hides physical candidates instead of inventing alternatives',()=>{
 const x=fixture();
 x.o.candidateStateWritesFromRom[1].byteValueCandidate=99;
 const txt=lines(x).join('\n');
 assert.ok(txt.includes('prova física insuficiente'));
 assert.ok(!txt.includes('Offset 398344'));
});
test('all 246 other map IDs omit special battle section',()=>{
 for(let mapId=0;mapId<248;mapId++){
  if(mapId===96||mapId===135)continue;
  const x=fixture();x.state.mapId=mapId;x.advice.mapId=mapId;
  assert.equal(lines(x).length,0,'map #'+mapId);
 }
});
test('world cockpit includes formatter, distinct statuses, and text-only display',()=>{
 assert.match(source,/const scriptedBattleLines=formatScriptedBattleEvidenceSection\(state,advice\)/);
 assert.match(source,/SCRIPT_STATE_UNKNOWN:'Combate especial/);
 assert.match(source,/SCRIPT_BYTE_REPEAT_VERIFIED_REFERENCE_ONLY:/);
 assert.match(source,/SCRIPTED_BATTLE:'⚔️ Combate especial/);
 assert.match(source,/body\.textContent=lines\.join\('\\n'\)/);
});

test('end-to-end cockpit renders special battle without requiring a real emulator',()=>{
 const x=fixture(96);
 x.state.worldAdvisor=x.advice;
 const rendered={content:{textContent:''},source:{textContent:''}};
 const root=source.indexOf('function formatScriptedBattleEvidenceSection(state,advice) {');
 const tail=source.indexOf('\n// Renderização Principal do Cockpit',root);
 assert.ok(root>=0&&tail>root);
 const run=vm.runInNewContext(
  source.slice(root,tail)+'\nrenderWorldAdvisor;',
  {document:{getElementById:id=>id==='world-advisor-content'?
    rendered.content:id==='world-advisor-source'?rendered.source:null},
   formatCampaignChecklistSection:()=>[]},{timeout:1000});
 run(x.state);
 assert.ok(rendered.content.textContent.includes('--- COMBATE ESPECIAL: Rival'));
 assert.ok(rendered.content.textContent.includes('Byte RAM atual: NÃO CONFIRMADO'));
 assert.ok(rendered.content.textContent.includes('Combates especiais: 1'));
 assert.ok(rendered.source.textContent.includes('Perfil ROM local'));
});
test('end-to-end cockpit hides all special details when final position is stale',()=>{
 const x=fixture(135,2);
 x.state.worldAdvisor=x.advice;
 x.state.memoryReadStatus.publicationPositionWindow.x=99;
 const rendered={content:{textContent:''},source:{textContent:''}};
 const root=source.indexOf('function formatScriptedBattleEvidenceSection(state,advice) {');
 const tail=source.indexOf('\n// Renderização Principal do Cockpit',root);
 const run=vm.runInNewContext(source.slice(root,tail)+'\nrenderWorldAdvisor;',
  {document:{getElementById:id=>id==='world-advisor-content'?
    rendered.content:id==='world-advisor-source'?rendered.source:null},
   formatCampaignChecklistSection:()=>[]},{timeout:1000});
 run(x.state);
 assert.ok(rendered.content.textContent.includes('Aguardar nova leitura'));
 assert.ok(!rendered.content.textContent.includes('--- COMBATE ESPECIAL'));
});
