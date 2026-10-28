'use strict';
// Prova conservadora de layout de captura para três ROMs auditadas.
// Não certifica o SHA do conteúdo em execução no iPhone; certifica o
// ficheiro local que gerou o perfil. Não utilizar em ROMs desconhecidas.
const crypto=require('node:crypto');
const SHA=new Set([
 '5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
 '2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
 'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db'
]);
function inspectCatchRamLayout(rom){
 if(!Buffer.isBuffer(rom)||rom.length!==1048576)
   return {verified:false,reason:'ROM com tamanho não auditado'};
 const sha256=crypto.createHash('sha256').update(rom).digest('hex');
 if(!SHA.has(sha256))
   return {verified:false,reason:'SHA-256 não pertence às três ROMs auditadas'};
 // ItemUseBall (banco 3): duas instruções LD A,[wEnemyMonActualCatchRate]
 // confirmadas em Red, Blue e Green International.
 const opcode=Buffer.from([0xfa,0x07,0xd0]);
 if(!rom.subarray(0xd777,0xd77a).equals(opcode)||
    !rom.subarray(0xd797,0xd79a).equals(opcode))
   return {verified:false,reason:'Routine de captura não corresponde ao layout auditado'};
 return {verified:true,romSha256:sha256,
   source:'SHA-256 ROM local + ItemUseBall duas leituras de D007; pret/pokered symbols',
   enemyBattleMonStart:0xcfe5,statusAddress:0xcfe9,
   typeAddresses:[0xcfea,0xcfeb],baseCatchRateAddress:0xcfec,
   actualCatchRateAddress:0xd007,
   runtimeRomSha256Proven:false};
}
module.exports={inspectCatchRamLayout};
