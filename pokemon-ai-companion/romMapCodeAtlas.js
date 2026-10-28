'use strict';
// ROM bank-aware LR35902 static code-candidate graph starting at verified
// map script pointers. This is NOT proof that all discovered paths execute.
// No runtime, save, file mutation, heuristic assumed switchable bank or bank 0 -> bank N calls.
const BANK=0x4000;
const INVALID=new Set([0xd3,0xdb,0xdd,0xe3,0xe4,0xeb,0xec,0xed,0xf4,0xfc,0xfd]);
const IMM8=new Set([0x06,0x0e,0x10,0x16,0x18,0x1e,0x20,0x26,0x28,0x2e,0x30,0x36,0x38,0x3e,
 0xc6,0xce,0xd6,0xde,0xe0,0xe6,0xe8,0xee,0xf0,0xf6,0xf8,0xfe]);
const IMM16=new Set([0x01,0x08,0x11,0x21,0x31,0xc2,0xc3,0xc4,0xca,0xcc,0xcd,0xd2,0xd4,0xda,0xdc,0xea,0xfa]);
const JR_COND=new Set([0x20,0x28,0x30,0x38]);
const JP_COND=new Set([0xc2,0xca,0xd2,0xda]);
const CALL_COND=new Set([0xc4,0xcc,0xd4,0xdc]);
const RET_COND=new Set([0xc0,0xc8,0xd0,0xd8]);
const RST=new Set([0xc7,0xcf,0xd7,0xdf,0xe7,0xef,0xf7,0xff]);
function cpuToOffset(bank,pc,size){
 if(!Number.isInteger(bank)||!Number.isInteger(pc)||bank<0||bank>=size/BANK)return null;
 if(pc<0x4000)return pc>=0?pc:null;
 if(pc<0x8000&&bank>0)return bank*BANK+pc-0x4000;
 return null;
}
function sizeOf(op){return op===0xcb?2:IMM16.has(op)?3:IMM8.has(op)?2:1;}
function decodeOpcode(rom,bank,pc){
 const at=cpuToOffset(bank,pc,rom.length);
 if(at===null)return {ok:false,reason:'invalid CPU/bank mapping',bank,pc};
 const opcode=rom[at],size=sizeOf(opcode);
 if(INVALID.has(opcode))return {ok:false,reason:'undocumented opcode',bank,pc,at,opcode};
 const next=pc+size;
 if(next>0x8000||(pc<0x4000&&next>0x4000)||at+size>rom.length||
    Math.floor(at/BANK)!==Math.floor((at+size-1)/BANK))
  return {ok:false,reason:'instruction crosses bank boundary',bank,pc,at,opcode};
 const n8=size>1?rom[at+1]:null,n16=size===3?rom.readUInt16LE(at+1):null;
 const to=[];let fallthrough=true,kind='linear';
 if(opcode===0x18||JR_COND.has(opcode)){
  const target=next+(n8>=128?n8-256:n8);
  to.push({pc:target,kind:'relative'});fallthrough=opcode!==0x18;kind='branch';
 }else if(opcode===0xc3||JP_COND.has(opcode)){
  to.push({pc:n16,kind:'absolute'});fallthrough=opcode!==0xc3;kind='branch';
 }else if(opcode===0xcd||CALL_COND.has(opcode)){
  to.push({pc:n16,kind:'call'});kind='call';
 }else if(RST.has(opcode)){
  to.push({pc:opcode&0x38,kind:'restart'});kind='call';
 }else if(opcode===0xc9||opcode===0xd9||opcode===0xe9||opcode===0x76||opcode===0x10){
  fallthrough=false;kind=opcode===0xe9?'indirect':opcode===0x76?'halt':opcode===0x10?'stop':'return';
 }else if(RET_COND.has(opcode)){kind='conditional-return';}
 if(fallthrough)to.push({pc:next,kind:'fallthrough'});
 return {ok:true,bank,pc,at,opcode,size,kind,targets:to};
}
function mapScriptAndTextReferences(rom,maps){
 if(!Buffer.isBuffer(rom)||rom.length%BANK||rom.length<2*BANK)throw Error('Invalid ROM');
 if(!Array.isArray(maps))throw Error('Need ROM-decoded map header catalogue');
 const results=[],scriptSeeds=[],textTableRanges=[];
 for(const m of maps){
  const entry={mapId:m.mapId,valid:false,script:null,textPointerTable:null,textReferences:[],errors:[]};
  results.push(entry);
  if(!m.valid)continue;
  if(!Number.isInteger(m.mapId)||!Number.isInteger(m.mapBank)||
     !Number.isInteger(m.mapHeaderPointerCpu)){entry.errors.push('Unverified header fields');continue;}
  const at=cpuToOffset(m.mapBank,m.mapHeaderPointerCpu,rom.length);
  if(at===null||at+10>rom.length){entry.errors.push('Header out of ROM bank');continue;}
  const textCpu=rom.readUInt16LE(at+5),scriptCpu=rom.readUInt16LE(at+7);
  const textAt=cpuToOffset(m.mapBank,textCpu,rom.length);
  const scriptAt=cpuToOffset(m.mapBank,scriptCpu,rom.length);
  if(textAt===null||scriptAt===null){entry.errors.push('Text or script pointer outside map ROM bank');continue;}
  entry.script={bank:m.mapBank,cpu:scriptCpu,fileOffset:scriptAt};
  entry.textPointerTable={bank:m.mapBank,cpu:textCpu,fileOffset:textAt};
  scriptSeeds.push({mapId:m.mapId,bank:m.mapBank,pc:scriptCpu});
  // TEXT_* IDs are one-based references. Read the pointer table, but do NOT
  // interpret the handler target as text: it may be executable ASM.
  const ids=[...(m.objects?.signs||[]).map(o=>o.textId),
    ...(m.objects?.objects||[]).map(o=>Number.isInteger(o.textId)?(o.textId&0x3f):null)];
  // In Gen I object text IDs, 0x40 denotes trainer battle metadata and
  // 0x80 denotes static Pokemon metadata. Only the lower six bits index text.
  const highest=ids.length?Math.max(...ids.filter(x=>Number.isInteger(x))):0;
  if(!Number.isSafeInteger(highest)||highest<0||highest>80||
    textAt+highest*2>(m.mapBank+1)*BANK){entry.errors.push('Text count/table bounds not proven');continue;}
  entry.textPointerTable.entryCountFromObjects=highest;
  entry.valid=true;
  if(highest>0)textTableRanges.push({mapId:m.mapId,bank:m.mapBank,start:textAt,endExclusive:textAt+highest*2});
  for(let id=1;id<=highest;id++){
   const targetCpu=rom.readUInt16LE(textAt+(id-1)*2);
   const dest=cpuToOffset(m.mapBank,targetCpu,rom.length);
   const ref={id,targetCpu,fileOffset:dest,valid:dest!==null};
   if(dest===null)entry.errors.push('Text pointer '+id+' not in bank');
   entry.textReferences.push(ref);
  }
 }
 return {maps:results,scriptSeeds,textTableRanges,
  totals:{normalMapHeaders:maps.filter(m=>m.valid).length,
   scriptSeeds:scriptSeeds.length,uniqueScriptSeeds:new Set(scriptSeeds.map(s=>s.bank+':'+s.pc)).size,
   referencedTextEntries:results.reduce((x,m)=>x+m.textReferences.length,0),
   invalidScriptReferences:results.filter(x=>x.errors.some(e=>e.includes('outside map'))).length,
   invalidTextPointers:results.reduce((x,m)=>x+m.textReferences.filter(r=>!r.valid).length,0)}};
}
function staticCodeGraph(rom,seeds,{maxInstructions=200000,maxEdges=1000000}={}){
 if(!Buffer.isBuffer(rom)||rom.length%BANK||rom.length<2*BANK)throw Error('Invalid ROM');
 if(!Array.isArray(seeds)||!Number.isInteger(maxInstructions)||maxInstructions<1||maxInstructions>500000)
  throw Error('Invalid graph scan settings');
 const visited=new Set(),states=new Uint8Array(rom.length),owners=new Int32Array(rom.length);
 const work=[],unresolved=[],edges=[],errors=[];let opcodeCount=0,conflicts=0;
 function enqueue(bank,pc,origin){
  const at=cpuToOffset(bank,pc,rom.length);
  if(at===null){if(unresolved.length<4000)unresolved.push({bank,pc,origin,reason:'ambiguous/unmapped CPU bank target'});return;}
  if(!visited.has(at))work.push({bank:pc<0x4000?0:bank,pc,origin});
 }
 for(const s of seeds){if(!s||!Number.isInteger(s.bank)||!Number.isInteger(s.pc))throw Error('Invalid root');enqueue(s.bank,s.pc,'seed');}
 while(work.length && opcodeCount<maxInstructions && edges.length<maxEdges){
  const {bank,pc,origin}=work.pop(),at=cpuToOffset(bank,pc,rom.length);
  if(at===null||visited.has(at))continue;
  const d=decodeOpcode(rom,bank,pc);
  if(!d.ok){visited.add(at);if(errors.length<5000)errors.push({...d,origin});continue;}
  let overlapping=false;
  for(let k=at;k<at+d.size;k++)if(owners[k]!==0&&owners[k]!==at+1)overlapping=true;
  if(overlapping){visited.add(at);conflicts++;if(errors.length<5000)errors.push({at,pc,bank,reason:'contradictory instruction boundary'});continue;}
  visited.add(at);opcodeCount++;
  for(let k=at;k<at+d.size;k++){owners[k]=at+1;states[k]=1;}
  for(const target of d.targets){
   const cpu=target.pc;
   if(cpu<0||cpu>=0x8000){if(unresolved.length<4000)unresolved.push({bank,pc,at,to:cpu,reason:'branch out of ROM address space'});continue;}
   // Calls/jumps made from fixed bank 0 into a switchable bank 0x4000-0x7FFF
   // require current MBC bank knowledge; treating it as the seed bank is unsound.
   if(bank===0&&cpu>=0x4000){
    if(unresolved.length<4000)unresolved.push({bank,pc,at,to:cpu,reason:'current switchable ROM bank unknown'});
    continue;
   }
   const targetBank=cpu<0x4000?0:bank;
   const mapped=cpuToOffset(targetBank,cpu,rom.length);
   if(mapped===null){if(unresolved.length<4000)unresolved.push({bank,pc,at,to:cpu,reason:'unmapped target'});continue;}
   if(edges.length<maxEdges)edges.push({from:at,to:mapped,kind:target.kind});
   enqueue(targetBank,cpu,target.kind);
  }
  if(d.kind==='indirect'&&unresolved.length<4000)unresolved.push({bank,pc,at,reason:'JP (HL) indirect target unknown'});
 }
 const bankCounts=[];let candidateBytes=0;
 for(let bank=0;bank<rom.length/BANK;bank++){
  let bytes=0;const start=bank*BANK;
  for(let p=start;p<start+BANK;p++)bytes+=states[p];
  candidateBytes+=bytes;bankCounts.push({bank,candidateInstructionBytes:bytes,unclassifiedInstructionBytes:BANK-bytes});
 }
 return {verified:false,classification:'STATIC_CODE_CANDIDATE_NOT_SEMANTICALLY_PROVEN',
  candidateInstructionBytes:candidateBytes,instructions:opcodeCount,edges:edges.length,
  unresolvedTargets:unresolved,errors,conflictingInstructions:conflicts,
  limitsReached:work.length>0,pendingWork:work.length,byBank:bankCounts,
  // No CPU instructions are marked as 100% semantically understood.
  warning:'Switchable banks and runtime-dependent transfers are not resolved; false positives and data interpreted as code remain possible.'};
}
function auditMapCodeAtlas(rom,maps,opts={}){
 const refs=mapScriptAndTextReferences(rom,maps);
 const graph=staticCodeGraph(rom,refs.scriptSeeds,opts);
 return {schema:'pokeguide-static-map-code-xrefs-v1',sources:'ROM map header verified pointers',
  ...refs,graph,runtimeValidated:false,semantic100PercentCertified:false};
}
module.exports={cpuToOffset,decodeOpcode,mapScriptAndTextReferences,staticCodeGraph,auditMapCodeAtlas};