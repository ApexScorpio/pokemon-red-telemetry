'use strict';
// Compara campos críticos no início/fim de um intervalo de leituras UDP.
// A igualdade em duas leituras NÃO é atomicidade, garantia de mesmo frame,
// nem prova de que a ROM no emulador tenha o SHA da ROM local.
const ok=(a,n)=>Array.isArray(a)&&a.length===n&&
  a.every(x=>typeof x==='string'&&/^[0-9a-f]{2}$/i.test(x));
const equal=(a,b)=>a.every((x,i)=>x.toUpperCase()===b[i].toUpperCase());
function verifyBattleWindow({combatBlock,playerBlock,modifierBlock,battleFlag,mapId,
  rereadEnemy,rereadPlayer,rereadStages,rereadFlag,rereadMapId}={}) {
  if(!ok(combatBlock,255)||!ok(playerBlock,30)||!ok(modifierBlock,280)||
    !ok(rereadEnemy,40)||!ok(rereadPlayer,29)||!ok(rereadStages,26)||
    !ok(rereadFlag,1)||!ok(rereadMapId,1)||
    !Number.isInteger(battleFlag)||![1,2].includes(battleFlag)||
    !Number.isInteger(mapId)||mapId<0||mapId>247) {
    return {verified:false,reason:'Leitura de confirmação incompleta ou flag/mapa inválidos',
      atomicSnapshotVerified:false};
  }
  const checks={
    enemy:equal(combatBlock.slice(5,45),rereadEnemy),
    player:equal(playerBlock.slice(0,29),rereadPlayer),
    stages:equal(modifierBlock.slice(250,276),rereadStages),
    battleFlag:parseInt(rereadFlag[0],16)===battleFlag,
    map:parseInt(rereadMapId[0],16)===mapId
  };
  const verified=Object.values(checks).every(Boolean);
  return {verified,checks,
    atomicSnapshotVerified:false,
    reason:verified?'Duas leituras coincidentes; NÃO prova atomicidade temporal':
      'O combate, mapa ou atributos mudaram durante a leitura; descartar amostra',
    source:'RetroArch RAM: CFE5..D00C, D014..D030, CD1A..CD33, D057, D35E'};
}
module.exports={verifyBattleWindow};
