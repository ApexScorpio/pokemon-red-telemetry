'use strict';

/**
 * Auditoria só de leitura de todas as 12 caixas do save original de Pokémon Red/Blue.
 * Não toca no save nem força escrita no emulador.
 *
 * Uso: node saveAudit.js "S:\saves\Pokemon Red.sav"
 * Atenção: .sav reflete o ÚLTIMO SAVE, não necessariamente a RAM atual do jogo!
 */
const fs = require('fs');
const path = require('path');
const { decodeGen1Text } = require('./data/pokemonData');
const species = require('./data/gen1CanonicalIds.json').internalPokemonIds;
const itemNames = require('./data/exact_items.json');
const symbols = fs.readFileSync(path.join(__dirname, 'data', 'pokered.sym'), 'utf8');

function symbol(name) {
  const m = symbols.match(new RegExp('^([0-9a-f]{2}):([0-9a-f]{4}) ' + name + '$','im'));
  if (!m) throw new Error('Símbolo SRAM/WRAM desconhecido: ' + name);
  return { bank: parseInt(m[1],16), address: parseInt(m[2],16) };
}
function readStruct(buffer, name, size) {
  const { bank, address } = symbol(name);
  if (address < 0xA000 || address + size > 0xC000 || bank > 3)
    throw new Error('Offset SRAM impossível: ' + name);
  const offset = bank * 0x2000 + (address - 0xA000);
  if (offset + size > buffer.length) throw new Error('SRAM incompleta: ' + name);
  return buffer.subarray(offset, offset + size);
}
function be16(bytes, pos) { return (bytes[pos] << 8) | bytes[pos+1]; }
function be24(bytes, pos) { return (bytes[pos] * 65536) + (bytes[pos+1]<<8) + bytes[pos+2]; }
function textName(b) { return decodeGen1Text(Array.from(b, n=>n.toString(16).padStart(2,'0'))); }
function decodeBox(buffer, symbolName, number) {
  const boxLength=symbol('wBoxDataEnd').address-symbol('wBoxDataStart').address;
  const b=readStruct(buffer,symbolName,boxLength),count=b[0];
  if(count>20) return {number,valid:false,error:'Contagem da caixa maior que 20',count};
  const pokemon=[]; const problems=[];
  for(let i=0;i<count;i++){
    const sid=b[1+i],idInfo=species[sid],pos=22+i*33;
    const moves=Array.from(b.subarray(pos+8,pos+12)).filter(Boolean);
    const level=b[pos+3],hp=be16(b,pos+1);
    const s={
      slot:i+1,internalId:sid,dex:idInfo?.dex || null,
      speciesSymbol:idInfo?.symbol||null,level,hp,
      exp:be24(b,pos+14),movesIds:moves,
      dvs:{attack:b[pos+27]>>4,defense:b[pos+27]&15,speed:b[pos+28]>>4,special:b[pos+28]&15},
      trainerName:textName(b.subarray(682+i*11,682+(i+1)*11)),
      nickname:textName(b.subarray(902+i*11,902+(i+1)*11))
    };
    if(!idInfo || !idInfo.dex || level<1 || level>100 || hp>999) {
      s.valid=false;
      s.warning='Valor fora de intervalo ou ID inválido para espécie normal';
      problems.push('Slot '+(i+1)+': '+s.warning);
    } else s.valid=true;
    if(b[1+i]!==b[pos]) {
      s.valid=false;
      s.warning='ID da lista difere do ID na ficha do Pokémon';
      problems.push('Slot '+(i+1)+': '+s.warning);
    }
    pokemon.push(s);
  }
  return {number,valid:problems.length===0,count,pokemon,problems};
}
function dexFlags(bytes, base) {
  const result=[];
  for(let b=0;b<19;b++)for(let bit=0;bit<8;bit++){
    const id=b*8+bit+1;
    if(id<=151 && (bytes[base+b]&(1<<bit)))result.push(id);
  }
  return result;
}
function auditSave(filename) {
  const bytes=fs.readFileSync(filename);
  if(bytes.length<0x8000) throw new Error('Save demasiado pequeno: esperado SRAM de 32 KiB, 4 bancos.');
  const extraBytes=bytes.length-0x8000;
  const main=readStruct(bytes,'sMainData',
    symbol('wMainDataEnd').address-symbol('wMainDataStart').address);
  const offset=(name)=>symbol(name).address-symbol('wMainDataStart').address;
  const currentIndex=main[offset('wCurrentBoxNum')]&0x7f;
  if(currentIndex>11)throw new Error('Índice de caixa atualmente selecionada impossível: '+currentIndex);
  const boxes=[];
  for(let number=1;number<=12;number++){
    // A caixa ativa tem a cópia autorizada em sCurBoxData, não no slot de backup.
    const bankSymbol=number===currentIndex+1?'sCurBoxData':'sBox'+number;
    const box=decodeBox(bytes,bankSymbol,number);
    box.isCurrent=number===currentIndex+1;
    box.sourceSymbol=bankSymbol;
    boxes.push(box);
  }
  const bagCount=main[offset('wNumBagItems')];
  const pcItemCount=main[offset('wNumBoxItems')];
  function items(count,pos,max){
    if(count>max) return {valid:false,count,error:'Contagem de itens inválida'};
    return {valid:true,count,items:Array.from({length:count},(_,i)=>{
      const id=main[pos+i*2],quantity=main[pos+i*2+1];
      return {id,name:itemNames[id]||null,quantity,valid:id>0&&id!==0xff&&quantity>0};
    })};
  }
  const inventory=items(bagCount,offset('wBagItems'),20);
  const storedItems=items(pcItemCount,offset('wBoxItems'),50);
  const seen=dexFlags(main,offset('wPokedexSeen'));
  const owned=dexFlags(main,offset('wPokedexOwned'));
  const count=boxes.reduce((sum,b)=>sum+b.count,0);
  const complete=boxes.every(b=>b.valid)&&inventory.valid&&storedItems.valid&&
    inventory.items.every(i=>i.valid)&&storedItems.items.every(i=>i.valid);
  const stat=fs.statSync(filename);
  return {
    source:'Pokémon Red/Blue save file on disk; NOT live RetroArch RAM',
    filename:path.basename(filename),savedFileModifiedAt:stat.mtime.toISOString(),
    bytesRead:bytes.length, extraBytesBeyond32KiB:extraBytes,
    all12BoxesScanned:true,allBoxesValid:complete,
    currentBox:currentIndex+1,totalPokemonInAllBoxes:count,
    originalSpeciesNotInTheSaveCannotBeInferred:true,
    pokedexOwned:owned,pokedexSeen:seen,inventory,storedItems,
    boxes,
    livePartyAvailable:false,liveDaycareAvailable:false,
    romIdentityVerified:false,realTimeState:false
  };
}
if(require.main===module){
 const filename=process.argv[2];
 if(!filename){console.error('Uso: node saveAudit.js "<ficheiro.sav>"');process.exitCode=2}
 else try {console.log(JSON.stringify(auditSave(filename),null,2))}
 catch(error){console.error(error.message);process.exitCode=1}
}
module.exports={auditSave};
