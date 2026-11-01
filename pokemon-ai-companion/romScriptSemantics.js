'use strict';
// Abstract execution from an authenticated TX_ASM entry, never from a candidate
// graph. CPU semantics: gbdev/pandocs CPU_Instruction_Set; bank mapping and
// event domains reuse the existing audited modules. Unknown instructions STOP.
const {decodeOpcode,cpuToOffset}=require('./romMapCodeAtlas');
const {domain}=require('./romAsmEventBitEvidence');
const {category}=require('./romAsmAbsoluteMemoryEvidence');
const {classifyRomxHeaderBankCandidates}=require('./romRomxBankAccess');
const regs=['b','c','d','e','h','l',null,'a'];
const concrete=x=>Number.isInteger(x);
// Substitute one stable RAM read only. Unsupported predicates are not
// constraints. This finite byte domain never enumerates ROM execution paths.
function constrainedBank(value,conditions){
 const reads=new Set();
 function collect(v){if(!v||typeof v!=='object')return;if(Object.hasOwn(v,'read')){if(!v.volatile)reads.add(v.read);return;}for(const x of Object.values(v))collect(x);}
 collect(value);
 if(reads.size!==1)return null;
 const address=[...reads][0];
 if(!((address>=0xc000&&address<0xe000)||(address>=0xff80&&address<0xffff)))return null;
 function evaluate(v,byte){
  if(concrete(v))return v;
  if(v?.read===address&&!v.volatile)return byte;
  if(['AND','OR','XOR'].includes(v?.op)){
   const a=evaluate(v.value,byte),b=evaluate(v.mask,byte);
   if(a!==null&&b!==null)return v.op==='AND'?a&b:v.op==='OR'?a|b:a^b;
  }
  return null;
 }
 function predicate(p,byte){
  if(typeof p==='boolean')return p;
  if(p?.not!==undefined){const v=predicate(p.not,byte);return v===null?null:!v;}
  if(p?.equals){const a=evaluate(p.equals[0],byte),b=evaluate(p.equals[1],byte);return a===null||b===null?null:a===b;}
  if(p?.zero!==undefined){const v=evaluate(p.zero,byte);return v===null?null:v===0;}
  if(p?.bitClear){const v=evaluate(p.bitClear.value,byte);return v===null?null:(v&(1<<p.bitClear.bit))===0;}
  return null;
 }
 const banks=new Set();let feasibleByteCount=0;
 for(let byte=0;byte<256;byte++){
  if(conditions.some(c=>{const p=predicate(c.predicate,byte);return p!==null&&p!==c.taken;}))continue;
  const v=evaluate(value,byte);if(v===null)return null;
  feasibleByteCount++;banks.add((v&127)||1);
 }
 return {sourceAddress:address,feasibleByteCount,selectedBanks:[...banks].sort((a,b)=>a-b)};
}
function logic(op,a,b){
 if(op==='AND'&&b===255||op==='OR'&&b===0||op==='XOR'&&b===0)return a;
 if(op==='AND'&&b===0)return 0;
 if(op==='OR'&&b===255)return 255;
 if(a!==null&&JSON.stringify(a)===JSON.stringify(b))return op==='XOR'?0:a;
 return concrete(a)&&concrete(b)?op==='AND'?a&b:op==='OR'?a|b:a^b:{op,value:a,mask:b};
}
const clone=s=>({...s,r:{...s.r},mem:{...s.mem},stack:s.stack.slice(),seen:new Set(s.seen),conditions:s.conditions.slice(),trace:s.trace.slice()});
// Lossless effect data in a ROM-local DAG. Array chunks (traces and conditions)
// and symbolic expressions are shared, rather than expanded for every path.
function packHandlers(handlers){
 const nodes=[],ids=new Map(),keys=[],keyIds=new Map();
 const keyId=k=>{if(!keyIds.has(k)){keyIds.set(k,keys.length);keys.push(k);}return keyIds.get(k);};
 const intern=node=>{const key=JSON.stringify(node);if(!ids.has(key)){ids.set(key,nodes.length);nodes.push(node);}return -1-ids.get(key);};
 const encode=value=>{
  if(value===null||typeof value!=='object')return typeof value==='number'&&value<0?intern(['n',value]):value===undefined?null:value;
  if(Array.isArray(value)){
   const items=value.map(encode);
   if(items.length<=16)return intern(['a',...items]);
   const chunks=[];for(let i=0;i<items.length;i+=16)chunks.push(intern(['a',...items.slice(i,i+16)]));
   return intern(['t',...chunks]);
  }
  return intern(['o',...Object.entries(value).filter(([,v])=>v!==undefined).flatMap(([k,v])=>[keyId(k),encode(v)])]);
 };
 const roots=handlers.map(h=>encode({...h,
  unresolvedCount:h.unresolvedCount??h.unresolved.length,
  unresolvedReasonCounts:h.unresolvedReasonCounts??h.unresolved.reduce((out,u)=>(out[u.reason]=(out[u.reason]||0)+1,out),{}),
  unresolvedWriteCategoryCounts:h.unresolvedWriteCategoryCounts??h.unresolved.filter(u=>u.reason==='UNRESOLVED_MEMORY_OR_BANK_WRITE').reduce((out,u)=>{
   const key=Number.isInteger(u.address)&&u.address>=0x2000&&u.address<0x4000?'UNKNOWN_BANK':'UNKNOWN_MEMORY';
   out[key]=(out[key]||0)+1;return out;
  },{}),
  unresolvedSamplesBounded:h.unresolved.length>4||h.unresolvedSamplesBounded===true,
  unresolved:h.unresolved.slice(0,4)}));
 return {encoding:'rom-handler-dag-v1',keys,nodes,roots};
}
function unpackHandlers(data){
 const cache=new Map();
 const decode=v=>{
  if(typeof v!=='number'||v>=0)return v;
  const id=-1-v;if(cache.has(id))return cache.get(id);
  const n=data.nodes[id];
  const out=n[0]==='n'?n[1]:n[0]==='a'?n.slice(1).map(decode):n[0]==='t'?n.slice(1).flatMap(decode):Object.fromEntries(Array.from({length:(n.length-1)/2},(_,i)=>[data.keys[n[1+i*2]],decode(n[2+i*2])]));
  cache.set(id,out);return out;
 };
 return data.roots.map(decode);
}
const decodedWorlds=new WeakMap();
function resolveSemantics(world,row){
 if(world?.verified!==true||!row)return null;
 if(row.semantics)return row.semantics; // Existing v1 profiles.
 if(!decodedWorlds.has(world))decodedWorlds.set(world,world.handlerData?unpackHandlers(world.handlerData):world.handlers||[]);
 return decodedWorlds.get(world).find(h=>h.handlerOffset===row.handlerOffset)||null;
}
function interpretHandler({rom,fileOffset,maxSteps=2048,maxPaths=128,entryKind='TX_ASM'}={}){
 if(!Buffer.isBuffer(rom)||rom.length!==1048576||!Number.isInteger(fileOffset)||fileOffset<0||fileOffset>=rom.length||(entryKind==='TX_ASM'&&rom[fileOffset]!==8)||!['TX_ASM','MAP_SCRIPT_ROOT'].includes(entryKind)||!Number.isInteger(maxSteps)||maxSteps<1||maxSteps>8192||!Number.isInteger(maxPaths)||maxPaths<1||maxPaths>256)
  return {verified:false,effects:[],reason:'Authenticated TX_ASM byte required'};
 const bank=Math.floor(fileOffset/0x4000),pc=(bank?0x4000+fileOffset%0x4000:fileOffset)+(entryKind==='TX_ASM'?1:0);
 const mbc3=classifyRomxHeaderBankCandidates({rom,targetCpu:0x4000}).mapperFamilyFromHeader==='MBC3';
 const queue=[{pc,bank,r:{},mem:{},stack:[],seen:new Set(),conditions:[],trace:[],z:null,c:null,n:null,h:null}],effects=[],unresolved=[];
 let steps=0,paths=1,returns=0;
 const stop=(s,reason,offset,detail={})=>unresolved.push({offset,reason,bank:s.bank,...detail,conditions:s.conditions});
 const read=(s,a)=>{
  if(!concrete(a))return null;
  const at=a<0x8000?cpuToOffset(s.bank,a,rom.length):null;
  // Hardware registers can change between reads without a CPU write.
  if(a>=0xff00&&a<0xff80)return {read:a,volatile:true,sample:s.trace.length};
  return at!==null?rom[at]:Object.hasOwn(s.mem,a)?s.mem[a]:{read:a};
 };
 const hl=s=>concrete(s.r.h)&&concrete(s.r.l)?s.r.h*256+s.r.l:null;
 const pair=(s,i)=>concrete(s.r[regs[i]])&&concrete(s.r[regs[i+1]])?s.r[regs[i]]*256+s.r[regs[i+1]]:null;
 const get=(s,i)=>i===6?(hl(s)!==null?read(s,hl(s)):null):s.r[regs[i]]??null;
 const write=(s,a,value,d)=>{
  if(mbc3&&concrete(a)&&a>=0x2000&&a<0x4000){
   const proof=concrete(value)?null:constrainedBank(value,s.conditions);
   if(!concrete(value)&&proof?.selectedBanks.length!==1){
    stop(s,'UNRESOLVED_MEMORY_OR_BANK_WRITE',d.at,{address:a,value,bankSelection:proof?{...proof,selectedBanks:proof.selectedBanks.slice(0,8),candidateBankCount:proof.selectedBanks.length,candidatesBounded:proof.selectedBanks.length>8}:null,
     runtimeRequirement:proof?{instructionOffset:d.at,handlerOffset:fileOffset,
      sourceAddress:proof.sourceAddress,width:1,controller:'MBC3',bankRegisterAddress:a,
      reason:'LIVE_RAM_BYTE_REQUIRED_FOR_SYMBOLIC_BANK_WRITE',bankExpression:value,
      possibleBanks:proof.selectedBanks.filter(b=>b<rom.length/0x4000).slice(0,8),
      physicalCandidateCount:proof.selectedBanks.filter(b=>b<rom.length/0x4000).length,
      candidatesBounded:proof.selectedBanks.filter(b=>b<rom.length/0x4000).length>8,
      conditions:s.conditions.slice()}:null});return false;
   }
   const selected=concrete(value)?(value&0x7f)||1:proof.selectedBanks[0];
   if(selected>=rom.length/0x4000){stop(s,'ROM_BANK_OR_TARGET_UNKNOWN',d.at);return false;}
   s.bank=selected;return true;
  }
  // HRAM is ordinary memory. I/O, IE and unresolved MBC writes still stop:
  // in particular the HRAM bank mirror does not itself switch the ROM bank.
  if(!concrete(a)||!((a>=0xc000&&a<0xe000)||(a>=0xff80&&a<0xffff))){stop(s,'UNRESOLVED_MEMORY_OR_BANK_WRITE',d.at,{address:a,value});return false;}
  const before=read(s,a);s.mem[a]=value;
  if(value!==null&&JSON.stringify(value)!==JSON.stringify(before))effects.push({handlerOffset:fileOffset,instructionOffset:d.at,type:'RAM_WRITE',address:a,domain:domain(a)?.kind??category(a),gameplayStateTransitionProven:domain(a)!==null||category(a)==='CURRENT_MAP_D35E',before,value,conditions:s.conditions.slice(),trace:s.trace.slice(),observedExecution:false});
  return true;
 };
 const put=(s,i,v,d)=>i===6?write(s,hl(s),v,d):(s.r[regs[i]]=v,true);
 const flags=s=>[s.z,s.n,s.h,s.c].every(x=>typeof x==='boolean')?
  Number(s.z)*128+Number(s.n)*64+Number(s.h)*32+Number(s.c)*16:{flags:{z:s.z,n:s.n,h:s.h,c:s.c}};
 const bytes=t=>t?.af?{hi:t.a,lo:flags(t)}:t&&'returnPc' in t?{hi:t.returnPc>>8,lo:t.returnPc&255}:t;
 const word=t=>{const b=bytes(t);return concrete(b?.hi)&&concrete(b?.lo)?b.hi*256+b.lo:null;};
 function condition(s,op){const i=(op>>3)&3;return i===0?(typeof s.z==='boolean'?!s.z:{not:s.z}):i===1?s.z:i===2?(typeof s.c==='boolean'?!s.c:{not:s.c}):s.c;}
 function fork(s,p,yes,no,d,prepare=()=>true){
  // A symbolic value denotes the same read/expression until overwritten.
  // Re-testing it cannot take the opposite edge on the same path. Volatile
  // reads carry distinct sample IDs and therefore do not alias here.
  const normalize=q=>q&&typeof q==='object'&&Object.keys(q).length===1&&Object.hasOwn(q,'not')?
   (()=>{const [v,neg]=normalize(q.not);return [v,!neg];})():[JSON.stringify(q),false];
  if(typeof p!=='boolean'){
   const [key,neg]=normalize(p);
   for(const c of s.conditions){const [prior,inverted]=normalize(c.predicate);if(prior===key){p=c.taken!==inverted!==neg;break;}}
  }
  if(typeof p==='boolean'){if(p&&!prepare(s))return;s.pc=p?yes:no;queue.push(s);return;}
  if(paths>=maxPaths){stop(s,'PATH_BUDGET',d.at);return;}
  paths++;
  for(const taken of [true,false]){const t=clone(s);if(taken&&!prepare(t))continue;t.conditions.push({instructionOffset:d.at,predicate:p,taken});t.pc=taken?yes:no;queue.push(t);}
 }
 while(queue.length&&steps<maxSteps){
  // Fair scheduling: an unresolved deep path must not starve its sibling.
  const s=queue.shift();const d=decodeOpcode(rom,s.bank,s.pc);steps++;
  if(!d.ok){stop(s,d.reason,d.at);continue;}
  const stateKey=JSON.stringify([s.bank,s.pc,s.r,s.mem,s.stack,s.z,s.c,s.n,s.h]);
  if(s.seen.has(stateKey)){stop(s,'LOOP_REQUIRES_FIXPOINT',d.at);continue;}
  s.seen.add(stateKey);
  s.trace.push(d.at);const op=d.opcode,n=rom[d.at+1],nn=d.size===3?rom.readUInt16LE(d.at+1):null,next=s.pc+d.size;
  s.pc=next;let ok=true;
  if(op===0x00){} // NOP
  else if(op===0x76){stop(s,'HALT_REQUIRES_INTERRUPT_STATE',d.at,{requiredState:['IME','IE_FFFF','IF_FF0F']});continue;}
  else if([1,0x11,0x21].includes(op)){const i=(op>>4)*2;s.r[regs[i]]=nn>>8;s.r[regs[i+1]]=nn&255;}
  else if([0x09,0x19,0x29].includes(op)){
   const a=hl(s),b=pair(s,((op>>4)&3)*2),sum=concrete(a)&&concrete(b)?a+b:null;
   s.r.h=sum===null?null:(sum&65535)>>8;s.r.l=sum===null?null:sum&255;
   s.c=sum===null?null:sum>65535;s.n=false;s.h=sum===null?null:(a&0xfff)+(b&0xfff)>0xfff; // Z preserved.
  }
  else if([0x02,0x12,0x0a,0x1a].includes(op)){
   const a=pair(s,((op>>4)&1)*2);
   if(a===null){stop(s,'INDIRECT_MEMORY_UNKNOWN',d.at);continue;}
   if(op&8)s.r.a=read(s,a);else ok=write(s,a,s.r.a??null,d);
  }
  else if([0xe0,0xf0,0xe2,0xf2].includes(op)){
   const low=(op&2)?s.r.c:n;
   if(!concrete(low)){stop(s,'INDIRECT_MEMORY_UNKNOWN',d.at);continue;}
   const a=0xff00+low;
   if(op&0x10)s.r.a=read(s,a);else ok=write(s,a,s.r.a??null,d);
  }
  else if((op&0xc7)===6&&op<0x40)ok=put(s,(op>>3)&7,n,d);
  else if(op<0x40&&((op&0xc7)===4||(op&0xc7)===5)){
   const i=(op>>3)&7,v=get(s,i),delta=(op&1)?-1:1;
   const result=concrete(v)?(v+delta)&255:{op:'ADD_BYTE',value:v,delta};
   ok=put(s,i,result,d);s.z=concrete(result)?result===0:{zero:result};
   s.n=delta<0;s.h=concrete(v)?delta>0?(v&15)===15:(v&15)===0:null;
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
  else if(op===0xaf){s.r.a=0;s.z=true;s.c=false;s.n=false;s.h=false;}
  else if((op>=0x80&&op<=0x9f)||[0xc6,0xce,0xd6,0xde].includes(op)){
   const a=s.r.a??null,b=op<0xc0?get(s,op&7):n;
   const kind=(op>>3)&3,subtract=kind>=2;
   const carry=kind&1?s.c:false;
   const sum=concrete(a)&&concrete(b)&&typeof carry==='boolean'?a+(subtract?-1:1)*(b+Number(carry)):null;
   const value=sum===null?{op:subtract?'SUB_BYTE':'ADD_BYTE',left:a,right:b,carry}:sum&255;
   s.r.a=value;s.z=concrete(value)?value===0:{zero:value};
   s.c=sum===null?{carry:{subtract,left:a,right:b,carry}}:subtract?sum<0:sum>255;
   s.n=subtract;s.h=sum===null?null:subtract?(a&15)<(b&15)+Number(carry):(a&15)+(b&15)+Number(carry)>15;
  }
  else if(op===0x37){s.c=true;s.n=false;s.h=false;}
  else if(op===0x2f){s.r.a=concrete(s.r.a)?s.r.a^255:{op:'XOR',value:s.r.a??null,mask:255};s.n=true;s.h=true;}
  else if(op===0x3f){s.c=typeof s.c==='boolean'?!s.c:{not:s.c};s.n=false;s.h=false;}
  else if([0x07,0x0f,0x17,0x1f].includes(op)){
   const v=s.r.a??null,right=!!(op&8),through=!!(op&0x10),carry=s.c;
   const out=concrete(v)?!!(v&(right?1:128)):{bitSet:{value:v,bit:right?0:7}};
   s.r.a=concrete(v)&&(!through||typeof carry==='boolean')?
    right?(v>>1)|((through?Number(carry):Number(out))<<7):((v<<1)|(through?Number(carry):Number(out)))&255:
    {op:right?'ROTATE_RIGHT':'ROTATE_LEFT',value:v,carry:through?carry:out};
   s.c=out;s.z=false;s.n=false;s.h=false;
  }
  else if(op>=0xa0&&op<=0xbf){
   const a=s.r.a??null,v=get(s,op&7),kind=(op>>3)&3;
   if(kind===3){s.z=concrete(a)&&concrete(v)?a===v:{equals:[a,v]};s.c=concrete(a)&&concrete(v)?a<v:null;}
   else {const result=logic(['AND','XOR','OR'][kind],a,v);s.r.a=result;s.z=concrete(result)?result===0:{zero:result};s.c=false;}
   s.n=kind===3;s.h=kind===3?concrete(a)&&concrete(v)?(a&15)<(v&15):null:kind===0;
  }
  else if([0xe6,0xf6,0xee,0xfe].includes(op)){
   const a=s.r.a??null;
   if(op===0xfe){s.z=concrete(a)?a===n:{equals:[a,n]};s.c=concrete(a)?a<n:null;}
   else {s.r.a=logic(op===0xe6?'AND':op===0xf6?'OR':'XOR',a,n);s.z=concrete(s.r.a)?s.r.a===0:{zero:s.r.a};s.c=false;}
   s.n=op===0xfe;s.h=op===0xfe?concrete(a)?(a&15)<(n&15):null:op===0xe6;
  }
  else if(op===0xcb){
   const i=n&7,b=(n>>3)&7,v=get(s,i);
   if(n<0x40){
    const carry=s.c,through=b===2||b===3,right=[1,3,5,7].includes(b);
    s.c=b===6?false:concrete(v)?!!(v&(right?1:128)):{bitSet:{value:v,bit:right?0:7}};
    let value;
    if(concrete(v)&&(!through||typeof carry==='boolean')){
     value=b===0?((v<<1)|(v>>7))&255:b===1?(v>>1)|((v&1)<<7):
      b===2?((v<<1)|Number(carry))&255:b===3?(v>>1)|(Number(carry)<<7):
      b===4?(v<<1)&255:b===5?(v>>1)|(v&128):b===6?((v<<4)|(v>>4))&255:v>>1;
    }else value={op:['RLC','RRC','RL','RR','SLA','SRA','SWAP','SRL'][b],value:v,...(through?{carry}:{} )};
    ok=put(s,i,value,d);s.z=concrete(value)?value===0:{zero:value};s.n=false;s.h=false;
   }
   else if(n<0x80){s.z=concrete(v)?(v&(1<<b))===0:{bitClear:{value:v,bit:b}};s.n=false;s.h=true;}
   else {const value=concrete(v)?n<0xc0?v&~(1<<b):v|(1<<b):{op:n<0xc0?'RESET_BIT':'SET_BIT',value:v,bit:b};ok=put(s,i,value,d);}
  }
  else if(op===0x18||op===0xc3)s.pc=d.targets[0].pc;
  else if(op===0xe9){const target=hl(s);if(target===null){stop(s,'INDIRECT_TARGET_UNKNOWN',d.at);continue;}s.pc=target;}
  else if([0x20,0x28,0x30,0x38,0xc2,0xca,0xd2,0xda].includes(op)){
   fork(s,condition(s,op),d.targets[0].pc,next,d);continue;
  }
  else if([0xc4,0xcc,0xd4,0xdc].includes(op)){
   fork(s,condition(s,op),nn,next,d,t=>{if(t.stack.length>=32){stop(t,'CALL_DEPTH',d.at);return false;}t.stack.push({returnPc:next});return true;});continue;
  }
  else if([0xc0,0xc8,0xd0,0xd8].includes(op)){
   const t=s.stack[s.stack.length-1];
   fork(s,condition(s,op),word(t)??next,next,d,q=>{if(!t){returns++;return false;}if(!concrete(word(t))){stop(q,'RETURN_STACK_UNKNOWN',d.at);return false;}q.stack.pop();return true;});continue;
  }
  else if(op===0xcd||(op&0xc7)===0xc7){if(s.stack.length>=32){stop(s,'CALL_DEPTH',d.at);continue;}s.stack.push({returnPc:next});s.pc=op===0xcd?nn:op&0x38;}
  else if(op===0xc9){const top=s.stack.pop();if(!top){returns++;continue;}if(!concrete(word(top))){stop(s,'RETURN_STACK_UNKNOWN',d.at);continue;}s.pc=word(top);}
  else if([0xc5,0xd5,0xe5].includes(op)){const i=((op>>4)&3)*2;s.stack.push({hi:s.r[regs[i]],lo:s.r[regs[i+1]]});}
  else if(op===0xf5)s.stack.push({af:true,a:s.r.a,z:s.z,c:s.c,n:s.n,h:s.h});
  else if(op===0xf1){
   const t=s.stack.pop(),b=bytes(t);if(!b){stop(s,'AF_STACK_UNKNOWN',d.at);continue;}
   s.r.a=b.hi;
   for(const [key,bit] of [['z',7],['n',6],['h',5],['c',4]])s[key]=t.af?t[key]:concrete(b.lo)?!!(b.lo&(1<<bit)):b.lo?.flags?.[key]??null;
  }
  else if([0xc1,0xd1,0xe1].includes(op)){
   const t=bytes(s.stack.pop());if(!t){stop(s,'STACK_UNKNOWN',d.at);continue;}
   const i=((op>>4)&3)*2;s.r[regs[i]]=t.hi;s.r[regs[i+1]]=t.lo;
  }
  else {stop(s,'UNSUPPORTED_OPCODE_'+op.toString(16),d.at);continue;}
  if(ok){if(cpuToOffset(s.bank,s.pc,rom.length)===null)stop(s,'ROM_BANK_OR_TARGET_UNKNOWN',d.at);else queue.push(s);}
 }
 for(const s of queue)stop(s,'STEP_BUDGET',cpuToOffset(s.bank,s.pc,rom.length),{pendingCpu:s.pc});
 const unique=[...new Map(effects.map(e=>[JSON.stringify([e.instructionOffset,e.conditions,e.value]),e])).values()];
 // Separate requirements from diagnostic samples: a fifth frontier must survive
 // compact serialization. Existing maxPaths/maxSteps bound their total size;
 // packHandlers shares expressions and branch conditions across requirements.
 const runtimeRequirements=[...new Map(unresolved.filter(u=>u.runtimeRequirement).map(u=>[JSON.stringify(u.runtimeRequirement),u.runtimeRequirement])).values()];
 for(const u of unresolved)delete u.runtimeRequirement;
 return {verified:true,handlerOffset:fileOffset,effects:unique,unresolved,runtimeRequirements,steps,paths,returns,complete:unresolved.length===0,preconditions:[entryKind==='MAP_SCRIPT_ROOT'?'MAP_SCRIPT_ROOT_INVOKED':'HANDLER_INVOKED',...(entryKind==='MAP_SCRIPT_ROOT'?['HEADER_BANK_CONTEXT_ASSUMED_NOT_OBSERVED']:[]),'VALID_NONALIASING_CALL_STACK','NO_EXTERNAL_MEMORY_MUTATION_DURING_PATH',...(mbc3?['HEADER_DECLARED_MBC3_BEHAVIOR']:[])],observedExecution:false,eventCompleted:null};
}
function interpretWorld({rom,atlas}={}){
 const handlers=new Map(),rows=[];
 for(const r of atlas.references){
  let semantics=null;
  if(r.textPointerVerified===true&&r.scriptCommand==='TX_START_ASM'){
   if(!handlers.has(r.scriptFileOffset))handlers.set(r.scriptFileOffset,interpretHandler({rom,fileOffset:r.scriptFileOffset}));
   semantics=handlers.get(r.scriptFileOffset);
  }
  const row={mapId:r.mapId,kind:r.kind,ordinal:r.ordinal,x:r.x,y:r.y,scriptFileOffset:r.scriptFileOffset,handlerOffset:semantics?.handlerOffset??null};
  Object.defineProperty(row,'semantics',{value:semantics,enumerable:false});rows.push(row);
 }
 const effects=[...new Map([...handlers.values()].flatMap(h=>h.effects)
  .filter(e=>e.gameplayStateTransitionProven).map(e=>[
   JSON.stringify([e.instructionOffset,e.conditions,e.value]),e])).values()];
 const result={verified:true,romSha256:atlas.romSha256,rows,handlerData:packHandlers([...handlers.values()]),formallyProvenScriptEffects:effects.length,examples:effects.slice(0,12),fullScriptSemanticsCertified:false};
 Object.defineProperty(result,'handlers',{value:[...handlers.values()],enumerable:false});
 return result;
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
function requirementsForSemantics(semantics){
 if(semantics?.verified!==true)return [];
 // Current telemetry has no authenticated HRAM bank-mirror snapshot. Do not
 // consume arbitrary bytes/bitmaps or introduce a second snapshot identity.
 return (semantics.runtimeRequirements||[]).map(r=>({...r,status:'UNKNOWN',
  missingEvidence:'NO_AUTHENTICATED_SOURCE_BYTE_IN_CURRENT_TELEMETRY',
  observedRam:null,selectedBank:null,observedExecution:false,eventCompleted:null,
  limitations:semantics.preconditions,conditionalPredictionOnly:true}));
}
module.exports={interpretHandler,interpretWorld,guidanceForSemantics,requirementsForSemantics,resolveSemantics,packHandlers,unpackHandlers};
