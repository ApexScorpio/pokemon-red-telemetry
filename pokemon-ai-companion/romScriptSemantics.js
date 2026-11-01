'use strict';
// Abstract execution from an authenticated TX_ASM entry, never from a candidate
// graph. CPU semantics: gbdev/pandocs CPU_Instruction_Set; bank mapping and
// event domains reuse the existing audited modules. Unknown instructions STOP.
const {decodeOpcode,cpuToOffset}=require('./romMapCodeAtlas');
const {domain}=require('./romAsmEventBitEvidence');
const {category}=require('./romAsmAbsoluteMemoryEvidence');
const regs=['b','c','d','e','h','l',null,'a'];
const concrete=x=>Number.isInteger(x);
function logic(op,a,b){
 if(op==='AND'&&b===255||op==='OR'&&b===0||op==='XOR'&&b===0)return a;
 if(op==='AND'&&b===0)return 0;
 if(op==='OR'&&b===255)return 255;
 if(a!==null&&JSON.stringify(a)===JSON.stringify(b))return op==='XOR'?0:a;
 return concrete(a)&&concrete(b)?op==='AND'?a&b:op==='OR'?a|b:a^b:{op,value:a,mask:b};
}
const clone=s=>({...s,r:{...s.r},mem:{...s.mem},stack:s.stack.slice(),conditions:s.conditions.slice(),trace:s.trace.slice()});
function interpretHandler({rom,fileOffset,maxSteps=2048,maxPaths=128}={}){
 if(!Buffer.isBuffer(rom)||rom.length!==1048576||!Number.isInteger(fileOffset)||fileOffset<0||fileOffset>=rom.length||rom[fileOffset]!==8||!Number.isInteger(maxSteps)||maxSteps<1||maxSteps>8192||!Number.isInteger(maxPaths)||maxPaths<1||maxPaths>256)
  return {verified:false,effects:[],reason:'Authenticated TX_ASM byte required'};
 const bank=Math.floor(fileOffset/0x4000),pc=bank?0x4000+fileOffset%0x4000+1:fileOffset+1;
 const queue=[{pc,r:{},mem:{},stack:[],conditions:[],trace:[],z:null,c:null}],effects=[],unresolved=[];
 let steps=0,paths=1,returns=0;
 const stop=(s,reason,offset)=>unresolved.push({offset,reason,conditions:s.conditions});
 const read=(s,a)=>Object.hasOwn(s.mem,a)?s.mem[a]:{read:a};
 const hl=s=>concrete(s.r.h)&&concrete(s.r.l)?s.r.h*256+s.r.l:null;
 const get=(s,i)=>i===6?(hl(s)!==null?read(s,hl(s)):null):s.r[regs[i]]??null;
 const write=(s,a,value,d)=>{
  if(!concrete(a)||a<0xc000||a>=0xe000){stop(s,'UNRESOLVED_MEMORY_OR_BANK_WRITE',d.at);return false;}
  const before=read(s,a);s.mem[a]=value;
  if(value!==null&&JSON.stringify(value)!==JSON.stringify(before))effects.push({handlerOffset:fileOffset,instructionOffset:d.at,type:'RAM_WRITE',address:a,domain:domain(a)?.kind??category(a),gameplayStateTransitionProven:domain(a)!==null||category(a)==='CURRENT_MAP_D35E',before,value,conditions:s.conditions.slice(),trace:s.trace.slice(),observedExecution:false});
  return true;
 };
 const put=(s,i,v,d)=>i===6?write(s,hl(s),v,d):(s.r[regs[i]]=v,true);
 function condition(s,op){const i=(op>>3)&3;return i===0?(typeof s.z==='boolean'?!s.z:{not:s.z}):i===1?s.z:i===2?(typeof s.c==='boolean'?!s.c:{not:s.c}):s.c;}
 function fork(s,p,yes,no,d,prepare=()=>true){
  if(typeof p==='boolean'){if(p&&!prepare(s))return;s.pc=p?yes:no;queue.push(s);return;}
  if(paths>=maxPaths){stop(s,'PATH_BUDGET',d.at);return;}
  paths++;
  for(const taken of [true,false]){const t=clone(s);if(taken&&!prepare(t))continue;t.conditions.push({instructionOffset:d.at,predicate:p,taken});t.pc=taken?yes:no;queue.push(t);}
 }
 while(queue.length&&steps<maxSteps){
  const s=queue.pop();const d=decodeOpcode(rom,bank,s.pc);steps++;
  if(!d.ok){stop(s,d.reason,d.at);continue;}
  if(s.trace.includes(d.at)){stop(s,'LOOP_REQUIRES_FIXPOINT',d.at);continue;}
  s.trace.push(d.at);const op=d.opcode,n=rom[d.at+1],nn=d.size===3?rom.readUInt16LE(d.at+1):null,next=s.pc+d.size;
  s.pc=next;let ok=true;
  if(op===0x00){} // NOP
  else if([1,0x11,0x21].includes(op)){const i=(op>>4)*2;s.r[regs[i]]=nn>>8;s.r[regs[i+1]]=nn&255;}
  else if((op&0xc7)===6&&op<0x40)ok=put(s,(op>>3)&7,n,d);
  else if(op<0x40&&((op&0xc7)===4||(op&0xc7)===5)){
   const i=(op>>3)&7,v=get(s,i),delta=(op&1)?-1:1;
   const result=concrete(v)?(v+delta)&255:{op:'ADD_BYTE',value:v,delta};
   ok=put(s,i,result,d);s.z=concrete(result)?result===0:{zero:result};
  }
  else if([3,0x13,0x23,0x0b,0x1b,0x2b].includes(op)){
   const i=((op>>4)&3)*2,h=s.r[regs[i]],l=s.r[regs[i+1]];
   const v=concrete(h)&&concrete(l)?((h*256+l)+((op&8)?-1:1))&65535:null;
   s.r[regs[i]]=v===null?null:v>>8;s.r[regs[i+1]]=v===null?null:v&255;
  }
  else if(op>=0x40&&op<=0x7f&&op!==0x76)ok=put(s,(op>>3)&7,get(s,op&7),d);
  else if(op===0xfa)s.r.a=read(s,nn);
  else if(op===0xea)ok=write(s,nn,s.r.a??null,d);
  else if([0x22,0x32,0x2a,0x3a].includes(op)){
   const a=hl(s);if(a===null){stop(s,'INDIRECT_MEMORY_UNKNOWN',d.at);continue;}
   if(op===0x22||op===0x32)ok=write(s,a,s.r.a??null,d);else s.r.a=read(s,a);
   const v=(a+(op===0x22||op===0x2a?1:-1))&65535;s.r.h=v>>8;s.r.l=v&255;
  }
  else if(op===0xaf){s.r.a=0;s.z=true;s.c=false;}
  else if(op>=0xa0&&op<=0xbf){
   const a=s.r.a??null,v=get(s,op&7),kind=(op>>3)&3;
   if(kind===3){s.z=concrete(a)&&concrete(v)?a===v:{equals:[a,v]};s.c=concrete(a)&&concrete(v)?a<v:null;}
   else {const result=logic(['AND','XOR','OR'][kind],a,v);s.r.a=result;s.z=concrete(result)?result===0:{zero:result};s.c=false;}
  }
  else if([0xe6,0xf6,0xee,0xfe].includes(op)){
   const a=s.r.a??null;
   if(op===0xfe){s.z=concrete(a)?a===n:{equals:[a,n]};s.c=concrete(a)?a<n:null;}
   else {s.r.a=logic(op===0xe6?'AND':op===0xf6?'OR':'XOR',a,n);s.z=concrete(s.r.a)?s.r.a===0:{zero:s.r.a};s.c=false;}
  }
  else if(op===0xcb){
   const i=n&7,b=(n>>3)&7,v=get(s,i);
   if(n<0x40){stop(s,'CB_ROTATE_UNSUPPORTED',d.at);continue;}
   if(n<0x80){s.z=concrete(v)?(v&(1<<b))===0:{bitClear:{value:v,bit:b}};}
   else {const value=concrete(v)?n<0xc0?v&~(1<<b):v|(1<<b):{op:n<0xc0?'RESET_BIT':'SET_BIT',value:v,bit:b};ok=put(s,i,value,d);}
  }
  else if(op===0x18||op===0xc3)s.pc=d.targets[0].pc;
  else if([0x20,0x28,0x30,0x38,0xc2,0xca,0xd2,0xda].includes(op)){
   fork(s,condition(s,op),d.targets[0].pc,next,d);continue;
  }
  else if([0xc4,0xcc,0xd4,0xdc].includes(op)){
   fork(s,condition(s,op),nn,next,d,t=>{if(t.stack.length>=32){stop(t,'CALL_DEPTH',d.at);return false;}t.stack.push({returnPc:next});return true;});continue;
  }
  else if([0xc0,0xc8,0xd0,0xd8].includes(op)){
   const t=s.stack[s.stack.length-1];
   fork(s,condition(s,op),t?.returnPc??next,next,d,q=>{if(!t){returns++;return false;}if(!concrete(t.returnPc)){stop(q,'RETURN_STACK_UNKNOWN',d.at);return false;}q.stack.pop();return true;});continue;
  }
  else if(op===0xcd){if(s.stack.length>=32){stop(s,'CALL_DEPTH',d.at);continue;}s.stack.push({returnPc:next});s.pc=nn;}
  else if(op===0xc9){const top=s.stack.pop();if(!top){returns++;continue;}if(!concrete(top.returnPc)){stop(s,'RETURN_STACK_UNKNOWN',d.at);continue;}s.pc=top.returnPc;}
  else if([0xc5,0xd5,0xe5].includes(op)){const i=((op>>4)&3)*2;s.stack.push({hi:s.r[regs[i]],lo:s.r[regs[i+1]]});}
  else if(op===0xf5)s.stack.push({af:true,a:s.r.a,z:s.z,c:s.c});
  else if(op===0xf1){const t=s.stack.pop();if(!t?.af){stop(s,'AF_STACK_UNKNOWN',d.at);continue;}s.r.a=t.a;s.z=t.z;s.c=t.c;}
  else if([0xc1,0xd1,0xe1].includes(op)){const t=s.stack.pop();if(!t||t.af||'returnPc' in t){stop(s,'STACK_UNKNOWN',d.at);continue;}const i=((op>>4)&3)*2;s.r[regs[i]]=t.hi;s.r[regs[i+1]]=t.lo;}
  else {stop(s,'UNSUPPORTED_OPCODE_'+op.toString(16),d.at);continue;}
  if(ok){if(cpuToOffset(bank,s.pc,rom.length)===null)stop(s,'ROM_BANK_OR_TARGET_UNKNOWN',d.at);else queue.push(s);}
 }
 for(const s of queue)stop(s,'STEP_BUDGET',null);
 const unique=[...new Map(effects.map(e=>[JSON.stringify([e.instructionOffset,e.conditions,e.value]),e])).values()];
 return {verified:true,handlerOffset:fileOffset,effects:unique,unresolved,steps,paths,returns,complete:unresolved.length===0,preconditions:['HANDLER_INVOKED','VALID_NONALIASING_CALL_STACK','NO_EXTERNAL_MEMORY_MUTATION_DURING_PATH'],observedExecution:false,eventCompleted:null};
}
function interpretWorld({rom,atlas}={}){
 const handlers=new Map(),rows=[];
 for(const r of atlas.references){
  let semantics=null;
  if(r.textPointerVerified===true&&r.scriptCommand==='TX_START_ASM'){
   if(!handlers.has(r.scriptFileOffset))handlers.set(r.scriptFileOffset,interpretHandler({rom,fileOffset:r.scriptFileOffset}));
   semantics=handlers.get(r.scriptFileOffset);
  }
  rows.push({mapId:r.mapId,kind:r.kind,ordinal:r.ordinal,x:r.x,y:r.y,scriptFileOffset:r.scriptFileOffset,semantics});
 }
 const effects=[...new Map([...handlers.values()].flatMap(h=>h.effects)
  .filter(e=>e.gameplayStateTransitionProven).map(e=>[
   JSON.stringify([e.instructionOffset,e.conditions,e.value]),e])).values()];
 return {verified:true,romSha256:atlas.romSha256,rows,handlers:[...handlers.values()],formallyProvenScriptEffects:effects.length,examples:effects.slice(0,12),fullScriptSemanticsCertified:false};
}
function guidanceForSemantics(semantics,bitmap){
 if(semantics?.verified!==true)return [];
 const byteAt=a=>{
  if(bitmap?.verified!==true||a<0xd747||a>0xd886)return null;
  let v=0;for(let b=0;b<8;b++){const bit=bitmap.bits?.find(x=>x.bitIndex===(a-0xd747)*8+b);if(typeof bit?.flagSet!=='boolean')return null;if(bit.flagSet)v|=1<<b;}return v;
 };
 const value=x=>concrete(x)?x:x?.read!==undefined?byteAt(x.read):null;
 const predicate=p=>{
  if(typeof p==='boolean')return p;
  if(p?.not!==undefined){const v=predicate(p.not);return v===null?null:!v;}
  if(p?.bitClear){const v=value(p.bitClear.value);return v===null?null:(v&(1<<p.bitClear.bit))===0;}
  if(p?.equals){const a=value(p.equals[0]),b=value(p.equals[1]);return a===null||b===null?null:a===b;}
  if(p?.zero!==undefined){const v=value(p.zero);return v===null?null:v===0;}
  return null;
 };
 return semantics.effects.map(e=>({...e,status:'PREDICTED_CONDITIONAL_EFFECT',eventCompleted:null,accessibleNow:null,
  conditionsInCurrentSnapshot:e.conditions.map(c=>{const v=predicate(c.predicate);return v===null?'UNKNOWN':v===c.taken?'MATCHES':'DOES_NOT_MATCH';}),
  observedCurrentBit:bitmap?.verified===true&&e.value?.bit!==undefined&&e.address>=0xd747&&e.address<=0xd886?bitmap.bits?.find(b=>b.bitIndex===(e.address-0xd747)*8+e.value.bit)?.flagSet??null:null}));
}
module.exports={interpretHandler,interpretWorld,guidanceForSemantics};
