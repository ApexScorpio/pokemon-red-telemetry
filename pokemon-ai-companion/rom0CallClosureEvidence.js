'use strict';
// ROM0 interprocedural candidates from exact physical bytes.
// This is a static CALL/RST/JR/JP reachability inventory, not executed code,
// a verified effect, bank-state evidence, or proof of ROM mapping completion.
const {decodeOpcode}=require('./romMapCodeAtlas');
const ROM_SIZE=1048576,ROM0_END=0x4000;
const MAX_ROOTS=512;
const invalid=reason=>({verified:false,reason,source:'ROM0_CALL_CLOSURE_V1',
 semantic100PercentCertified:false,runtimeEffectsVerified:false});
function traceRom0CallClosure({rom,roots,maxInstructions=ROM0_END}={}){
 if(!Buffer.isBuffer(rom)||rom.length!==ROM_SIZE)
  return invalid('ROM must contain exactly 1 MiB');
 if(!Array.isArray(roots)||roots.length===0||roots.length>MAX_ROOTS||
    !Number.isInteger(maxInstructions)||maxInstructions<1||
    maxInstructions>ROM0_END)
  return invalid('Unbounded or invalid roots / instruction budget');
 const sourceRoots=roots.map(x=>typeof x==='number'?x:x?.targetCpu);
 if(sourceRoots.some(x=>!Number.isInteger(x)||x<0||x>=ROM0_END))
  return invalid('Root is not a physical ROM0 CPU address');
 const uniqueRoots=[...new Set(sourceRoots)].sort((a,b)=>a-b);
 const queue=uniqueRoots.slice(),scheduled=new Set(queue),visited=new Set();
 const owners=new Int32Array(ROM0_END),instructions=[];
 const problems=[],callTargets=new Set(),byReason=Object.create(null);
 let consumed=0,callEdges=0,restartEdges=0,branchEdges=0;
 let romxUnknown=0,indirectUnknown=0,valid=0;
 const problem=(pc,reason,targetCpu=null)=>{
  byReason[reason]=(byReason[reason]||0)+1;
  if(problems.length<128)problems.push({pc,reason,targetCpu});
 };
 for(let cursor=0;cursor<queue.length&&valid<maxInstructions;cursor++){
  consumed=cursor+1;
  const pc=queue[cursor];
  if(visited.has(pc))continue;
  visited.add(pc);
  const d=decodeOpcode(rom,0,pc);
  if(!d.ok){problem(pc,'DECODE_'+String(d.reason||'UNKNOWN'));continue;}
  if(Array.from({length:d.size},(_,i)=>pc+i)
    .some(x=>x>=ROM0_END||(owners[x]!==0&&owners[x]!==pc+1))){
   problem(pc,'OVERLAPPING_OPCODE_CANDIDATES');
   continue;
  }
  for(let i=0;i<d.size;i++)owners[pc+i]=pc+1;
  valid++;
  instructions.push({pc,opcode:d.opcode,size:d.size,kind:d.kind});
  if(d.kind==='indirect'){
   indirectUnknown++;
   problem(pc,'JP_HL_RUNTIME_TARGET_UNKNOWN');
  }
  for(const edge of d.targets){
   const to=edge.pc;
   if(edge.kind==='call'||edge.kind==='restart'){
    if(edge.kind==='restart')restartEdges++;else callEdges++;
    if(to>=0&&to<ROM0_END)callTargets.add(to);
   }else if(edge.kind!=='fallthrough')branchEdges++;
   if(!Number.isInteger(to)||to<0||to>=ROM0_END){
    if(to>=ROM0_END&&to<0x8000){
     romxUnknown++;
     problem(pc,'ROMX_ACTIVE_BANK_UNKNOWN',to);
    }else problem(pc,'OUTSIDE_FIXED_ROM0',to);
    continue;
   }
   if(!scheduled.has(to)){
    queue.push(to);
    scheduled.add(to);
   }
  }
 }
 // No branch/call is reported as executed. An exhausted queue only proves
 // that this bounded static decoder has no additional queued candidates.
 const remainingQueue=queue.length-consumed;
 return {verified:true,source:'ROM0_CALL_CLOSURE_V1',
  uniqueSeedAddresses:uniqueRoots.length,seedAddresses:uniqueRoots,
  candidateInstructions:valid,candidateInstructionBytes:owners.reduce(
   (n,x)=>n+(x!==0?1:0),0),
  traversedDirectCallEdges:callEdges,traversedRestartEdges:restartEdges,
  traversedBranchEdges:branchEdges,
  distinctRom0CallTargets:callTargets.size,
  rom0CallTargets:[...callTargets].sort((a,b)=>a-b),
  unresolvedRomxTransfers:romxUnknown,indirectJumpsUnknown:indirectUnknown,
  unresolvedCandidateCount:Object.values(byReason).reduce((n,x)=>n+x,0),
  unresolvedReasonCounts:{...byReason},problemSamples:problems,
  problemSamplesTruncated:Object.values(byReason).reduce((n,x)=>n+x,0)>problems.length,
  remainingQueue,budgetExhausted:remainingQueue>0,
  staticCandidateQueueExhausted:remainingQueue===0,
  runtimeEffectsVerified:false,semantic100PercentCertified:false,
  activeRomBankKnown:false,executedBranchesVerified:false,
  warning:'CALL and RST to ROM0 add statically reachable candidate instructions only. ROMX bank, indirect HL, event effects and actual execution remain unknown.'};
}
module.exports={traceRom0CallClosure};
