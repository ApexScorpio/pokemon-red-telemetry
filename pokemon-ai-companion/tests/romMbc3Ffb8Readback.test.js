'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const dgram=require('node:dgram');
const {probeReadOnlyRetroArch}=
 require('../romReadOnlyRetroArchProbe');
const {SOURCE_CPU_ADDRESSES}=
 require('../romMbc3RamSourceReadback');

const world=Buffer.alloc(784);
world[336]=0x03;
world[350]=0x40;
world[423]=0xaa;
world[742]=0x80;

async function withMock(config,callback){
 const socket=dgram.createSocket('udp4');
 const commands=[];
 let statusCount=0;

 socket.on('message',(packet,remote)=>{
  const command=packet.toString('ascii');
  commands.push(command);

  let response=null;

  if(command==='GET_STATUS'){
   statusCount++;
   const crc=config.changeCRC&&statusCount>1?
    '12345678':'9F7FDD53';
   const mode=config.changeMode&&statusCount>1?
    'PAUSED':'PLAYING';

   response='GET_STATUS '+mode+' gb,test,crc32='+crc;
  }else{
   const match=/^READ_CORE_MEMORY ([0-9A-F]{4}) (\d+)$/
    .exec(command);

   if(match){
    const start=parseInt(match[1],16);
    const length=Number(match[2]);

    if(start===0xffb8&&config.badByte){
     response='READ_CORE_MEMORY FFB8 -1';
    }else{
     const result=Buffer.alloc(length);

     for(let i=0;i<length;i++){
      const address=start+i;

      if(address>=0xd5a0&&address<0xd5a0+784)
       result[i]=world[address-0xd5a0];

      if(address===0xd35e)
       result[i]=config.changeMap&&
        commands.filter(c=>
         c==='READ_CORE_MEMORY D35E 1').length>1?
        11:10;

      if(address===0xd361)result[i]=5;

      if(address===0xd362)
       result[i]=config.changePosition&&
        commands.filter(c=>
         c==='READ_CORE_MEMORY D361 2').length>1?
        9:8;

      if(address===0xffb8)
       result[i]=config.changeFfb8&&
        commands.filter(c=>
         c==='READ_CORE_MEMORY FFB8 1').length>1?
        0x43:0x42;
     }

     response='READ_CORE_MEMORY '+match[1]+' '+
      [...result].map(x=>
       x.toString(16).toUpperCase().padStart(2,'0')
      ).join(' ');
    }
   }
  }

  if(response!==null)
   socket.send(
    Buffer.from(response,'ascii'),
    remote.port,
    remote.address
   );
 });

 await new Promise((resolve,reject)=>{
  socket.once('error',reject);
  socket.bind(0,'127.0.0.1',resolve);
 });

 try{
  return await callback({
   commands,
   port:socket.address().port
  });
 }finally{
  await new Promise(resolve=>socket.close(resolve));
 }
}

function options(port,extra={}){
 return {
  host:'127.0.0.1',
  port,
  timeoutMs:900,
  ...extra
 };
}

test('FFB8 is disabled by default',async()=>{
 await withMock({},async mock=>{
  const result=await probeReadOnlyRetroArch(
   options(mock.port)
  );

  assert.equal(result.verified,true);
  assert.equal(result.ffb8ReadbackRequested,false);
  assert.equal(result.ffb8ReadbackVerified,false);
  assert.equal(result.ffb8SourceEvidence,null);
  assert.equal(
   mock.commands.filter(c=>
    c==='READ_CORE_MEMORY FFB8 1').length,
   0
  );
  assert.equal(mock.commands.length,15);
 });
});

test('opt-in reads FFB8 twice without proving bank or event',async()=>{
 await withMock({},async mock=>{
  const result=await probeReadOnlyRetroArch(
   options(mock.port,{ffb8Readback:true})
  );

  assert.equal(result.verified,true);
  assert.equal(result.ffb8ReadbackRequested,true);
  assert.equal(result.ffb8ReadbackVerified,true);
  assert.equal(result.ffb8SourceEvidence.addressCpu,0xffb8);
  assert.equal(result.ffb8SourceEvidence.firstHex,'42');
  assert.equal(result.ffb8SourceEvidence.repeatHex,'42');
  assert.equal(result.ffb8SourceEvidence.repeatedStable,true);
  assert.equal(result.ffb8SourceEvidence.readOnly,true);
  assert.equal(result.ffb8SourceEvidence.selectedBank,null);
  assert.equal(
   result.ffb8SourceEvidence.bankRegisterWriteObserved,
   false
  );
  assert.equal(
   result.ffb8SourceEvidence.gameplayEventObserved,
   false
  );
  assert.equal(
   result.ffb8SourceEvidence.activeRomSha256Verified,
   false
  );
  assert.equal(
   result.ffb8SourceEvidence.snapshotAtomicVerified,
   false
  );
  assert.equal(result.activeRomSha256Verified,false);
  assert.equal(result.playerActionConfirmed,false);
  assert.equal(result.gameEffectsCertified,false);
  assert.equal(mock.commands.length,17);

  assert.equal(
   mock.commands.filter(c=>
    c==='READ_CORE_MEMORY FFB8 1').length,
   2
  );

  assert.ok(mock.commands.every(c=>
   c==='GET_STATUS'||
   /^READ_CORE_MEMORY [0-9A-F]{4} \d+$/.test(c)
  ));
 });
});

test('changed FFB8 byte is rejected',async()=>{
 await withMock({changeFfb8:true},async mock=>{
  const result=await probeReadOnlyRetroArch(
   options(mock.port,{ffb8Readback:true})
  );

  assert.equal(result.verified,false);
  assert.equal(
   result.status,
   'FFB8_SOURCE_RAM_READBACK_CHANGED'
  );
  assert.equal(result.ffb8ReadbackVerified,false);
  assert.equal(result.gameEffectsCertified,false);
 });
});

test('malformed FFB8 response is rejected',async()=>{
 await withMock({badByte:true},async mock=>{
  const result=await probeReadOnlyRetroArch(
   options(mock.port,{ffb8Readback:true})
  );

  assert.equal(result.verified,false);
  assert.equal(
   result.status,
   'RETROARCH_CORE_MEMORY_UNAVAILABLE'
  );
  assert.equal(result.ffb8ReadbackVerified,false);
 });
});

test('changed ROM, status, map or position invalidates FFB8',async()=>{
 for(const [config,status] of [
  [{changeCRC:true},'RETROARCH_CONTENT_OR_CRC_CHANGED'],
  [{changeMode:true},'FFB8_SOURCE_STATUS_CHANGED'],
  [{changeMap:true},'REMOTE_RAM_READBACK_REJECTED'],
  [{changePosition:true},'REMOTE_RAM_READBACK_REJECTED']
 ]){
  await withMock(config,async mock=>{
   const result=await probeReadOnlyRetroArch(
    options(mock.port,{ffb8Readback:true})
   );

   assert.equal(result.verified,false);
   assert.equal(result.status,status);
   assert.equal(result.ffb8ReadbackVerified,false);
   assert.equal(result.gameEffectsCertified,false);
  });
 }
});

test('eight existing RAM sources are unchanged and combinable',async()=>{
 assert.deepEqual(SOURCE_CPU_ADDRESSES,[
  0xc0ef,0xcf08,0xcf09,0xd0b7,
  0xd52b,0xff8b,0xffb9,0xffe8
 ]);

 await withMock({},async mock=>{
  const result=await probeReadOnlyRetroArch(
   options(mock.port,{
    mbc3SourceReadback:true,
    ffb8Readback:true
   })
  );

  assert.equal(result.verified,true);
  assert.equal(result.mbc3SourceStableBytes,8);
  assert.equal(result.mbc3SourceReadbackVerified,true);
  assert.equal(result.ffb8ReadbackVerified,true);
  assert.equal(result.mbc3ActiveBankVerified,false);
  assert.equal(result.snapshotAtomicVerified,false);
  assert.equal(mock.commands.length,33);

  for(const address of SOURCE_CPU_ADDRESSES){
   const command='READ_CORE_MEMORY '+
    address.toString(16).toUpperCase().padStart(4,'0')+
    ' 1';

   assert.equal(
    mock.commands.filter(c=>c===command).length,
    2
   );
  }
 });
});

test('invalid opt-in type fails before any network request',async()=>{
 const result=await probeReadOnlyRetroArch({
  host:'127.0.0.1',
  port:55355,
  ffb8Readback:'true'
 });

 assert.equal(result.verified,false);
 assert.equal(
  result.status,
  'PROBE_TARGET_NOT_PRIVATE_OR_INVALID'
 );
 assert.equal(result.readOnlyRequests,0);
});