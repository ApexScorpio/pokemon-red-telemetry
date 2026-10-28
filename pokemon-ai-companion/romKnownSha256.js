'use strict';
// SHA-256 dos 3 binários auditados. Este teste de pertença NÃO prova que
// o RetroArch/SameBoy está a executar esses bytes, nem que a RAM é atómica.
const AUDITED_ROM_SHA256=Object.freeze({
 RED:'5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
 BLUE:'2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
 GREEN_INTERNATIONAL_1_2_1:'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db'
});
const accepted=new Set(Object.values(AUDITED_ROM_SHA256));
function isKnownAuditedRomSha(x){
 return typeof x==='string'&&/^[0-9a-f]{64}$/i.test(x)&&accepted.has(x.toLowerCase());
}
module.exports={AUDITED_ROM_SHA256,isKnownAuditedRomSha};
