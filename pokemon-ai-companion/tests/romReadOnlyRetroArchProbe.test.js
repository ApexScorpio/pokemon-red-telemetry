'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const dgram=require('node:dgram');
const {probeReadOnlyRetroArch,parseStatus,parseMemory,privateIpv4}
 =require('../romReadOnlyRetroArchProbe');
const world=Buffer.alloc(784);
world[336]=0x03;world[350]=0x40;world[423]=0xaa;world[742]=0x80;
function mockServer({crc='9F7FDD53',mutation=false,changeMap=false,
 changePosition=false,contentless=false,dropAll=false}={}){
 const socket=dgram.createSocket('udp4'),commands=[];
 let statusCount=0;
 socket.on('message',(packet,remote)=>{
  const cmd=packet.toString('ascii');
  commands.push(cmd);
  if(dropAll)return;
  let reply=null;
  if(cmd==='GET_STATUS'){
   statusCount++;
   reply=contentless?'GET_STATUS CONTENTLESS':
    'GET_STATUS PLAYING gb,test,crc32='+crc;
  }else{
   const match=/^READ_CORE_MEMORY ([0-9A-F]{4}) (\d+)$/.exec(cmd);
   if(match){
    const addr=parseInt(match[1],16),length=Number(match[2]);
    if(length<1||length>160)return;
    const arr=Buffer.alloc(length);
    for(let i=0;i<length;i++){
     const absolute=addr+i;
     if(absolute>=0xD5A0&&absolute<0xD5A0+784)
      arr[i]=world[absolute-0xD5A0];
     if(absolute===0xD35E)
      arr[i]=changeMap&&commands.filter(x=>x==='READ_CORE_MEMORY D35E 1').length>1?
       11:10;
     if(absolute===0xD361)arr[i]=5;
     if(absolute===0xD362)arr[i]=changePosition&&
      commands.filter(x=>x==='READ_CORE_MEMORY D361 2').length>1?9:8;
     if(mutation&&addr>=0xD6F0&&absolute===0xD747)arr[i]=0x80;
    }
    reply='READ_CORE_MEMORY '+match[1]+' '+
     [...arr].map(n=>n.toString(16).toUpperCase().padStart(2,'0')).join(' ');
   }
  }
  if(reply!==null)
   socket.send(Buffer.from(reply),remote.port,remote.address);
 });
 return new Promise((resolve,reject)=>{
  socket.once('error',reject);
  socket.bind(0,'127.0.0.1',()=>resolve({socket,commands,
   port:socket.address().port,statusCount:()=>statusCount}));
 });
}
async function withMock(options,callback){
 const m=await mockServer(options);
 try{return await callback(m);}finally{
  await new Promise(resolve=>m.socket.close(resolve));
 }
}
test('only RFC1918/loopback literal IPs may be contacted',()=>{
 for(const x of ['127.0.0.1','192.168.1.145','10.2.3.4','172.16.0.1',
  '172.31.255.254'])
  assert.equal(privateIpv4(x),true);
 for(const x of ['example.com','8.8.8.8','0.0.0.0','172.32.1.1',
  '169.254.10.8','::1'])
  assert.equal(privateIpv4(x),false);
});
test('official GET_STATUS and READ_CORE_MEMORY byte parser fails closed',()=>{
 assert.deepEqual(parseStatus('GET_STATUS PLAYING gb,pokemon,crc32=9f7fdd53'),
  {contentLoaded:true,mode:'PLAYING',crc32:'9F7FDD53',variant:'red'});
 assert.deepEqual(parseStatus('GET_STATUS CONTENTLESS'),{contentLoaded:false});
 assert.equal(parseStatus('GET_STATUS error'),null);
 assert.deepEqual(parseMemory('READ_CORE_MEMORY D747 ab 00','D747',2),
  ['AB','00']);
 for(const bad of ['READ_CORE_MEMORY D747 -1','READ_CORE_MEMORY D747 AA',
  'WRITE_CORE_MEMORY D747 AA BB','READ_CORE_MEMORY D746 AA BB',
  'READ_CORE_MEMORY D747 G1 02']){
  assert.equal(parseMemory(bad,'D747',2),null);
 }
});
test('direct UDP probe sends only readonly commands and validates repeated bytes',async()=>{
 await withMock({},async m=>{
  const r=await probeReadOnlyRetroArch({host:'127.0.0.1',port:m.port,timeoutMs:900});
  assert.equal(r.verified,true);
  assert.equal(r.status,'REMOTE_RAM_FLAGS_REPEAT_CORROBORATED');
  assert.equal(r.variant,'red');
  assert.equal(r.romProfileCRC32Matched,true);
  assert.equal(r.activeRomSha256Verified,false);
  assert.equal(r.mapId,10);
  assert.equal(r.matchedFlagBytes,336);
  assert.equal(r.playerActionConfirmed,false);
  assert.equal(r.snapshotAtomicVerified,false);
  assert.equal(r.gameEffectsCertified,false);
  assert.equal(r.readOnlyRequests,m.commands.length);
  assert.equal(m.statusCount(),2);
  assert.equal(m.commands.filter(x=>x.startsWith('READ_CORE_MEMORY')).length,12);
  assert.ok(m.commands.every(x=>x==='GET_STATUS'||
   /^READ_CORE_MEMORY [A-F0-9]{4} \d+$/.test(x)));
  assert.ok(m.commands.every(x=>!/(WRITE|SAVE|LOAD|QUIT|RESET|PAUSE|MENU|FRAMEADVANCE)/.test(x)));
 });
});
test('a changed event flag between reads is rejected, even when ROM CRC matches',async()=>{
 await withMock({mutation:true},async m=>{
  const r=await probeReadOnlyRetroArch({host:'127.0.0.1',port:m.port,timeoutMs:900});
  assert.equal(r.verified,false);
  assert.equal(r.status,'REMOTE_RAM_READBACK_REJECTED');
  assert.equal(r.rejectedDomain,'WORLD_EVENTS');
  assert.equal(r.gameEffectsCertified,false);
 });
});
test('Blue and Green International CRCs are recognized without claiming SHA identity',async()=>{
 for(const [crc,variant] of [['D6DA8A1A','blue'],['3C2DD8AE','green-international']]){
  await withMock({crc},async m=>{
   const r=await probeReadOnlyRetroArch({host:'127.0.0.1',port:m.port,timeoutMs:900});
   assert.equal(r.verified,true);
   assert.equal(r.variant,variant);
   assert.equal(r.romProfileCRC32Matched,true);
   assert.equal(r.activeRomSha256Verified,false);
   assert.equal(r.gameEffectsCertified,false);
  });
 }
});
test('moving map or position between remote reads never certifies progress',async()=>{
 for(const [config,field] of [[{changeMap:true},'mapRepeated'],
  [{changePosition:true},'positionRepeated']]){
  await withMock(config,async m=>{
   const r=await probeReadOnlyRetroArch({host:'127.0.0.1',port:m.port,timeoutMs:900});
   assert.equal(r.verified,false);
   assert.equal(r.status,'REMOTE_RAM_READBACK_REJECTED');
   assert.equal(r[field],false);
  });
 }
});
test('contentless or CRC outside the three known ROMs never reads RAM',async()=>{
 for(const config of [{contentless:true},{crc:'01020304'}]){
  await withMock(config,async m=>{
   const r=await probeReadOnlyRetroArch({host:'127.0.0.1',port:m.port,timeoutMs:900});
   assert.equal(r.verified,false);
   assert.equal(m.commands.length,1);
   assert.equal(m.commands[0],'GET_STATUS');
  });
 }
});
test('invalid address or timeout is reported without claiming a live session',async()=>{
 const invalid=await probeReadOnlyRetroArch({host:'8.8.8.8'});
 assert.equal(invalid.status,'PROBE_TARGET_NOT_PRIVATE_OR_INVALID');
 await withMock({dropAll:true},async m=>{
  const noReply=await probeReadOnlyRetroArch({
   host:'127.0.0.1',port:m.port,timeoutMs:300
  });
  assert.equal(noReply.verified,false);
  assert.equal(noReply.status,'RETROARCH_UDP_NO_REPLY');
  assert.deepEqual(m.commands,['GET_STATUS']);
 });
});
