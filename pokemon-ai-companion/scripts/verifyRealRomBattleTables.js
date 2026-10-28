'use strict';
// Auditoria independente, de leitura estrita, dos 3 binários reais de 1 MiB.
// Tabelas idênticas não são prova de efeitos/RNG/estado RAM no emulador.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const EXPECTED = Object.freeze({
  red:'5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
  blue:'2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
  green:'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db'
});
// Offsets conhecidos da desmontagem e de romMoveTable/romBattleRuleTables.
const REGIONS = Object.freeze({
  moves:{offset:0x38000,size:165*6,entries:165},
  effectDispatch:{offset:0x3f150,size:86*2,entries:86},
  statModifierRatios:{offset:0x3f6cb,size:13*2,entries:13},
  highCriticalMoves:{offset:0x3e08e,size:5,entries:4},
  unusedHighCriticalMoves:{offset:0x3e01e,size:5,entries:4}
});
const sha256 = data=>crypto.createHash('sha256').update(data).digest('hex');
function inspectRom(name, bytes) {
  if(!Object.hasOwn(EXPECTED,name))throw Error('VARIANTE_DESCONHECIDA '+name);
  if(!Buffer.isBuffer(bytes)||bytes.length!==1048576)
    throw Error(name+': ROM_NAO_TEM_1048576_BYTES');
  const sha=sha256(bytes);
  if(sha!==EXPECTED[name])throw Error(name+': SHA256_ROM_NAO_AUDITADO '+sha);
  let c=0;
  for(let i=0x134;i<=0x14c;i++)c=(c-bytes[i]-1)&255;
  if(c!==bytes[0x14d])throw Error(name+': HEADER_CHECKSUM_INVALIDO');
  const mov=REGIONS.moves.offset;
  for(let i=0;i<165;i++){
    const p=mov+i*6;
    if(bytes[p]!==i+1||bytes[p+5]<1||bytes[p+5]>40)
      throw Error(name+': MOVES_165_ESTRUTURA_INVALIDA_'+(i+1));
  }
  const ptr=REGIONS.effectDispatch.offset;
  const pointers=Array.from({length:86},(_,i)=>bytes.readUInt16LE(ptr+i*2));
  if(new Set(pointers).size!==35||pointers.filter(x=>x===0).length!==7)
    throw Error(name+': EFFECT_DISPATCH_86_ESTRUTURA_INVALIDA');
  const hc=Buffer.from([2,75,152,163,255]);
  if(!bytes.subarray(0x3e08e,0x3e093).equals(hc)||
     !bytes.subarray(0x3e01e,0x3e023).equals(hc))
     throw Error(name+': HIGH_CRITICAL_4_LISTA_INVALIDA');
  const ratios=[25,100,28,100,33,100,40,100,50,100,66,100,1,1,
    15,10,2,1,25,10,3,1,35,10,4,1];
  if(!bytes.subarray(0x3f6cb,0x3f6cb+26).equals(Buffer.from(ratios)))
    throw Error(name+': RATIOS_13_INVALIDOS');
  const tables={};
  for(const [key,r] of Object.entries(REGIONS)){
    const raw=bytes.subarray(r.offset,r.offset+r.size);
    tables[key]={offset:r.offset,bytes:r.size,entries:r.entries,
      sha256:sha256(raw),raw};
  }
  return {name,romSha256:sha,tables};
}
function auditThreeRomBattleTables(roms){
  if(!roms||typeof roms!=='object')throw Error('TRES_ROMS_OBRIGATORIAS');
  const found=Object.keys(EXPECTED).map(name=>inspectRom(name,roms[name]));
  const tables={};
  for(const [name,region] of Object.entries(REGIONS)){
    const first=found[0].tables[name].raw;
    if(found.some(r=>!r.tables[name].raw.equals(first)))
      throw Error('TABELA_DIFERE_ENTRE_VARIANTES '+name);
    tables[name]={offsetHex:'0x'+region.offset.toString(16),
      bytes:region.size,entries:region.entries,sha256:sha256(first),
      identicalAcrossThreeVerified:true};
  }
  return {verified:true,versions:found.map(({name,romSha256})=>({name,romSha256})),
    tables,scope:'Apenas igualdade exata de cinco regiões de dados; não equivale a interpretar os efeitos da batalha'};
}
function readFileRegular(filename){
  const st=fs.lstatSync(filename);
  if(!st.isFile()||st.isSymbolicLink())throw Error('ROM_NAO_E_FICHEIRO_REGULAR');
  return fs.readFileSync(filename);
}
function main(env=process.env){
  const dir=env.POKEMON_ROM_DIR;
  const paths={
    red:env.POKEMON_RED_ROM||(dir&&path.join(dir,'Pokemon Red.gb')),
    blue:env.POKEMON_BLUE_ROM||(dir&&path.join(dir,'Pokemon Blue.gb')),
    green:env.POKEMON_GREEN_ROM||(dir&&path.join(dir,'Pokemon Green International v1.2.1.gb'))
  };
  if(Object.values(paths).some(x=>!x))throw Error('TRES_CAMINHOS_ROM_OBRIGATORIOS');
  const buffers=Object.fromEntries(Object.entries(paths).map(([k,v])=>[k,readFileRegular(v)]));
  const result=auditThreeRomBattleTables(buffers);
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
  return result;
}
module.exports={inspectRom,auditThreeRomBattleTables,main,EXPECTED,REGIONS};
if(require.main===module){
  try{main()}catch(e){console.error('RESULTADO=FALHOU '+e.message);process.exitCode=1;}
}
