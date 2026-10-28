'use strict';
// PokéGuide: one-pass evidence ledger for all 64 banks and all three exact Gen I ROMs.
// Read-only inputs (.gb or ZIP with one .gb); no ROM bytes are written or uploaded.
// Code/graphics/script bytes are NOT called semantically decoded merely because scanned.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const zlib=require('node:zlib');
const {auditMapCodeAtlas}=require('./romMapCodeAtlas');
const {mapGuideIndex,REFERENCE_UNUSED_IDS}=require('./romAreaGuide');
const BANK=0x4000, ROM_BYTES=64*BANK;
const KNOWN=Object.freeze({
 red:'5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
 blue:'2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
 green:'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db'
});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(b){let c=0xffffffff;for(const n of b)c=crcTable[(c^n)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function readRom(source){
 const st=fs.lstatSync(source);if(!st.isFile()||st.isSymbolicLink())throw Error('Entrada tem de ser ficheiro regular, não atalho/link');
 const data=fs.readFileSync(source);
 if(!/\.zip$/i.test(source))return data;
 if(data.length>8*1024*1024||data.length<22)throw Error('ZIP inválido ou demasiado grande');
 let eocd=-1;
 for(let p=data.length-22;p>=Math.max(0,data.length-65557);p--){if(data.readUInt32LE(p)===0x06054b50){eocd=p;break;}}
 if(eocd<0||data.readUInt16LE(eocd+4)!==0||data.readUInt16LE(eocd+6)!==0)throw Error('ZIP com índice inválido ou multidisco');
 const count=data.readUInt16LE(eocd+10),size=data.readUInt32LE(eocd+12);
 let cursor=data.readUInt32LE(eocd+16),found=[];
 if(count>128||cursor+size>eocd)throw Error('Índice ZIP fora dos limites');
 for(let i=0;i<count;i++){
  if(cursor+46>data.length||data.readUInt32LE(cursor)!==0x02014b50)throw Error('Entrada central ZIP inválida');
  const flags=data.readUInt16LE(cursor+8),method=data.readUInt16LE(cursor+10),crc=data.readUInt32LE(cursor+16),
    packed=data.readUInt32LE(cursor+20),unpacked=data.readUInt32LE(cursor+24),
    nameLen=data.readUInt16LE(cursor+28),extra=data.readUInt16LE(cursor+30),comment=data.readUInt16LE(cursor+32),
    local=data.readUInt32LE(cursor+42);
  if(cursor+46+nameLen+extra+comment>data.length)throw Error('Nome ZIP truncado');
  const name=data.subarray(cursor+46,cursor+46+nameLen).toString('utf8');
  cursor+=46+nameLen+extra+comment;
  if(!/\.gbc?$/i.test(name))continue;
  if(name.includes('/')||name.includes('\\')||name.includes('..')||flags&1||![0,8].includes(method)||unpacked!==ROM_BYTES||packed>2*ROM_BYTES)throw Error('Entrada ROM ZIP não permitida');
  if(local+30>data.length||data.readUInt32LE(local)!==0x04034b50)throw Error('Cabeçalho local ZIP inválido');
  const localNameLen=data.readUInt16LE(local+26),localExtra=data.readUInt16LE(local+28);
  const from=local+30+localNameLen+localExtra;
  if(from+packed>data.length)throw Error('ROM ZIP truncada');
  const slice=data.subarray(from,from+packed);
  const rom=method===8?zlib.inflateRawSync(slice,{maxOutputLength:ROM_BYTES}):slice;
  if(rom.length!==unpacked||crc32(rom)!==crc)throw Error('CRC32 da ROM ZIP inválido');
  found.push(rom);
 }
 if(found.length!==1)throw Error('ZIP tem de conter exatamente uma ROM Game Boy');
 return found[0];
}
function header(b){
 let c=0;for(let i=0x134;i<=0x14c;i++)c=(c-b[i]-1)&255;
 return {title:b.subarray(0x134,0x144).toString('latin1').split('\0')[0].trim(),
  romSizeCode:b[0x148],headerChecksumValid:c===b[0x14d]};
}
function bankOffset(bank,cpu){
 if(!Number.isInteger(bank)||!Number.isInteger(cpu)||bank<0||bank>=64)return null;
 if(bank===0)return cpu>=0&&cpu<0x4000?cpu:null;
 return cpu>=0x4000&&cpu<0x8000?bank*BANK+cpu-0x4000:null;
}
function coverageLedger(b,profile){
 const states=new Uint8Array(b.length),claims=[],errors=[];
 const cover=(domain,at,length,evidence,level='decoded')=>{
  if(!Number.isSafeInteger(at)||!Number.isSafeInteger(length)||at<0||length<1||at+length>b.length){
   errors.push({domain,at,length,reason:'intervalo inválido'});return;
  }
  const value=level==='decoded'?2:1;
  for(let p=at;p<at+length;p++)states[p]=Math.max(states[p],value);
  claims.push({domain,start:at,endExclusive:at+length,bytes:length,
    evidence,level});
 };
 const at=(value)=>value&&Number.isInteger(value.fileOffset)?value.fileOffset:null;
 const verified=profile&&!profile.unknownLayout;
 if(b.length>=0x150)cover('header',0x134,0x1c,'cabeçalho e checksum', 'structured');
 if(verified){
  const o=profile.offsets||{};
  for(const [key,length] of [['names',1900],['dexOrder',190],['baseStats',4200],['growthRates',24],['evolutions',380]]){
   const p=at(o[key]);if(p!==null&&profile.validated?.[key]===true)cover(key,p,length,'ROM profile: '+key);
  }
  const m=at(o.moveNames);
  if(m!==null&&Array.isArray(profile.moveNames)&&profile.moveNames.length===165){
   let q=m,ok=true;for(let i=0;i<165;i++){
    while(q<b.length&&q-m<3000&&b[q]!==0x50)q++;
    if(q>=b.length||q-m>=3000){ok=false;break;}q++;
   }
   if(ok&&Math.floor((q-1)/BANK)===Math.floor(m/BANK))cover('moveNames',m,q-m,'165 strings terminadas por 0x50');
  }
  if(profile.moveStatsStatus?.verified===true&&profile.moveStats?.length===165){
   const p=at(o.moveData);if(p!==null)cover('moveStats',p,990,'165 movimentos × 6 bytes');
  }
  if(profile.typeMatchupsStatus?.verified===true&&profile.typeMatchups?.length===82){
   const p=at(o.typeMatchups);if(p!==null)cover('typeMatchups',p,247,'82 triplos e FF');
  }
  if(profile.battleRuleTables?.verified===true){
   const r=profile.battleRuleTables;
   cover('statModifierRatios',r.statModifierRatiosOffset,26,'13 rácios, SHA da ROM');
   cover('highCriticalMoves',r.highCriticalMovesOffset,5,'4 IDs e FF, SHA da ROM');
  }
  const world=profile.world;
  if(world?.wildEncounters?.valid===true){
   const w=world.wildEncounters;
   const p=at(w.pointerTable);
   if(p!==null){
    cover('wildPointers',p,248*2,'248 ponteiros validados');
    const all=new Set();
    for(const item of w.data||[]){
     const start=bankOffset(w.pointerTable.bank,item.pointerCpu);
     if(start===null||all.has(start))continue;all.add(start);
     let length=2;
     for(const type of ['grass','water'])length+=item[type]?.rateByte>0?20:0;
     cover('wildEncounterSlots',start,length,'grass/water rate + slots');
    }
   }
  }
  if(world?.maps?.valid===true){
   const maps=world.maps;
   const ptr=at(maps.pointerTable),banks=at(maps.bankTable);
   if(ptr!==null)cover('mapPointers',ptr,496,'MapHeaderPointers');
   if(banks!==null)cover('mapBanks',banks,248,'MapHeaderBanks');
   for(const map of maps.data||[]){
    if(!map.valid)continue;
    const hp=bankOffset(map.mapBank,map.mapHeaderPointerCpu);
    if(hp!==null){
     const bits=map.connectionFlags.toString(2).replace(/0/g,'').length;
     cover('mapHeader',hp,12+11*bits,'mapa '+map.mapId);
    }
    const bp=bankOffset(map.mapBank,map.blocksPointerCpu);
    if(bp!==null&&map.blockBytes===map.widthBlocks*map.heightBlocks)
     cover('mapBlocks',bp,map.blockBytes,'mapa '+map.mapId,'structured');
    const op=bankOffset(map.mapBank,map.objectPointerCpu),end=map.objects?.rawEndOffset;
    if(op!==null&&Number.isInteger(end)&&end>op&&end-op<=2048)
     cover('mapObjects',op,end-op,'warps, signs e atores no mapa '+map.mapId);
   }
  }
  if(profile.trainerParties?.verified===true&&
     Number.isInteger(profile.trainerParties.pointerTableFileOffset))
    cover('trainerPartyPointers',profile.trainerParties.pointerTableFileOffset,47*2,
      '47 classes de treinadores; apontadores estruturais');
  const hidden=world?.hiddenItemScripts;
  if(hidden?.valid){
   const c=at(hidden.coordinateTable),e=at(hidden.eventMapTable);
   if(c!==null)cover('hiddenItemCoordinates',c,54*3+1,'54 coordenadas + FF');
   if(e!==null)cover('hiddenEventMapPointers',e,85+1+85*2,'85 mapas, terminador e ponteiros','structured');
   const cc=at(hidden.hiddenCoins?.coordinateTable);
   if(cc!==null&&hidden.hiddenCoins?.valid===true)cover('hiddenCoinCoordinates',cc,12*3+1,'12 entradas + FF');
  }
 }
 const banks=[];
 for(let bank=0;bank<b.length/BANK;bank++){
  const begin=bank*BANK,end=begin+BANK;
  let decoded=0,structured=0;
  const unknownRuns=[];
  for(let i=begin;i<end;){
   if(states[i]!==0){if(states[i]===2)decoded++;else structured++;i++;continue;}
   const start=i;while(i<end&&states[i]===0)i++;
   unknownRuns.push({start,endExclusive:i,bytes:i-start});
  }
  banks.push({bank,sha256:hash(b.subarray(begin,end)),
   decodedBytes:decoded,structuredOnlyBytes:structured,
   unclassifiedBytes:BANK-decoded-structured,unclassifiedRanges:unknownRuns});
 }
 const summary=banks.reduce((x,y)=>({decodedBytes:x.decodedBytes+y.decodedBytes,
  structuredOnlyBytes:x.structuredOnlyBytes+y.structuredOnlyBytes,
  unclassifiedBytes:x.unclassifiedBytes+y.unclassifiedBytes}),
  {decodedBytes:0,structuredOnlyBytes:0,unclassifiedBytes:0});
 if(Object.values(summary).reduce((a,b)=>a+b,0)!==b.length)throw Error('ledger: byte coverage mismatch');
 return {totalBytes:b.length,bytesRead:b.length,bankCount:banks.length,
  ...summary,semanticCoverageCertified:false,
  interpretation:'Contagem PARCIAL de bytes com anotação estrutural validada. NÃO é percentagem de lógica do jogo compreendida.',
  claims,errors,banks};
}
function summarize(profile){
 const w=profile.world||{},maps=w.maps||{},enc=w.wildEncounters||{},hidden=w.hiddenItemScripts||{};
 const mapData=(maps.data||[]).filter(x=>x.valid);
 const actors=mapData.flatMap(m=>m.objects?.objects||[]);
 const evo=profile.species||[];
 const referenceUnused=new Set(REFERENCE_UNUSED_IDS);
 const reservedEntries=(maps.data||[]).filter(m=>referenceUnused.has(m.mapId)&&!m.valid).length;
 const unresolvedNonReservedEntries=(maps.data||[]).filter(m=>!m.valid&&!referenceUnused.has(m.mapId)).length;
 return {knownLayout:!profile.unknownLayout,
  reservedMapIdsWithoutHeader:reservedEntries,
  unresolvedMapIdsBeyondReserved:unresolvedNonReservedEntries,
  pokemonInternalSlots:evo.length,baseStats:evo.filter(s=>s.stats).length,
  moves:profile.moveStatsStatus?.verified?profile.moveStats?.length:0,
  typeRules:profile.typeMatchupsStatus?.verified?profile.typeMatchups?.length:0,
  wildMaps:enc.valid?enc.data?.length:0,
  mapsNormalDecoded:maps.validMapHeaders||0,mapIdsTotal:maps.totalMapIds||null,
  trainerObjects:actors.filter(a=>a.kind==='trainer').length,
  fixedPokemonObjects:actors.filter(a=>a.kind==='wildPokemon').length,
  visibleItemObjects:actors.filter(a=>a.kind==='item').length,
  trainerEventLinks:maps.trainerEventsVerified||0,
  staticEncounterLinks:maps.staticEncountersVerified||0,
  hiddenItemCoordinates:hidden.valid?hidden.items?.length:0,
  hiddenCoins:hidden.hiddenCoins?.valid?hidden.hiddenCoins.coins?.length:0,
  trainerPartiesVerified:profile.trainerParties?.verified===true,
  trainerPartiesCount:profile.trainerParties?.verified?profile.trainerParties.teamCount:null,
  spritePixelsDecoded:evo.filter(s=>s.sprite?.pixelsDecoded).length,
  evolutionEntries:evo.reduce((n,s)=>n+(s.evolutions?.length||0),0),
  levelLearnsetEntries:evo.reduce((n,s)=>n+(s.learnset?.length||0),0),
  battleCaptureLayoutVerified:profile.battleCaptureLayout?.verified===true,
  battleRuleTablesVerified:profile.battleRuleTables?.verified===true,
  economyTradesVerified:profile.economyTrades?.verified===true,
  itemPrices:profile.economyTrades?.itemPrices?.verified?profile.economyTrades.itemPrices.itemCount:0,
  martScripts:profile.economyTrades?.martShops?.verified?profile.economyTrades.martShops.shopCount:0,
  npcTrades:profile.economyTrades?.npcTrades?.verified?profile.economyTrades.npcTrades.recordCount:0,
  prizeProducts:profile.economyTrades?.prizeCorner?.verified?profile.economyTrades.prizeCorner.menus.reduce((n,m)=>n+m.products.length,0):0,
  superRodMaps:profile.economyTrades?.fishing?.verified?profile.economyTrades.fishing.superRodMaps:0,
  itemEffectDispatchEntries:profile.economyTrades?.itemDispatch?.verified?profile.economyTrades.itemDispatch.itemCount:0,
  itemEffectHandlerCount:profile.economyTrades?.itemDispatch?.verified?profile.economyTrades.itemDispatch.distinctHandlers:0,
  moveEffectsVerified:profile.moveEffectDispatch?.verified===true,
  moveEffectSlots:profile.moveEffectDispatch?.verified?profile.moveEffectDispatch.effectSlots:0,
  movesWithKnownEffectDestination:profile.moveEffectDispatch?.verified?profile.moveEffectDispatch.moveCount:0,
  warpEntries:profile.world?.warpGraph?.verified?profile.world.warpGraph.totalWarpEntries:0,
  exteriorConnections:profile.world?.outdoorConnections?.verified?profile.world.outdoorConnections.edgeCount:0,
  elevatorFloorMenuOptions:profile.world?.elevatorDestinations?.verified?profile.world.elevatorDestinations.totalMenuFloorChoices:0,
  landTerrainCells:profile.world?.terrainAtlas?.verified?profile.world.terrainAtlas.totals.terrainCells:0,
  landWalkableCells:profile.world?.terrainAtlas?.verified?profile.world.terrainAtlas.totals.walkableLandTerrainCells:0,
  landBlockedCells:profile.world?.terrainAtlas?.verified?profile.world.terrainAtlas.totals.blockedLandTerrainCells:0};
}
const GAP_DOMAINS=[
 ['cpuReachability','Sem CFG completo de instruções, chamadas bancadas e handlers'],
 ['scriptBytecode','Sem interpretação e cobertura de todos os ramos de scripts'],
 ['hiddenEventSemantics','Coordenadas não provam todas as condições/efeitos'],
 ['textAndDialogue','Textos e condições de diálogo por cenário não exaustivos'],
 ['graphicsPalettes','Sprites e blocos não provam paletas finais do emulador'],
 ['battleAllEffects','Todos os 165 golpes, exceções e efeitos no turno por validar'],
 ['captureAndSafari','Efeitos de bolas, Safari, estados, falhas e RNG por validar'],
 ['fishingTradesGifts','Trocas, presentes, pesca e condições não integralmente confirmados'],
 ['shopsPrices','Lojas, preços, stock e recompensas por versão não integralmente provados'],
 ['mapCollisionTriggers','Colisões, warps condicionais e triggers de terreno incompletos'],
 ['partyAndInventory','Inventário, equipamento, PP, DVs e stat experience dependem de RAM/SRAM'],
 ['runtimeCoherence','Sem prova de snapshot atómico e estado temporal do emulador'],
 ['loadedRomIdentity','CRC do emulador não comprova por si só SHA-256 do binário carregado'],
 ['endToEndVisual','Sem screenshots analisadas do ecrã real e interação iPhone']
];
function structuredCatalogue(profile){
 const world=profile.world||{},maps=world.maps||{},wild=world.wildEncounters||{};
 return {
  provenance:'Extraído do binário local identificado por SHA-256; observações estáticas, não estado do jogador',
  species:(profile.species||[]).map(s=>({
   internalId:s.internalId,name:s.name,dex:s.dex,baseStats:s.stats||null,
   evolutions:s.evolutions||null,learnset:s.learnset||null,
   sprites:s.sprite?{bank:s.sprite.bank||null,verified:s.sprite.verified===true,
     pixelsDecoded:s.sprite.pixelsDecoded===true,front:s.sprite.front||null,
     back:s.sprite.back||null}:null
  })),
  moveNames:profile.moveNames||null,
  moves:profile.moveStatsStatus?.verified?profile.moveStats:null,
  moveStatsStatus:profile.moveStatsStatus||null,
  typeRules:profile.typeMatchupsStatus?.verified?profile.typeMatchups:null,
  typeRulesStatus:profile.typeMatchupsStatus||null,
  battleRules:profile.battleRuleTables?.verified?profile.battleRuleTables:null,
  economyTrades:profile.economyTrades?.verified?profile.economyTrades:null,
  moveEffectDispatch:profile.moveEffectDispatch?.verified?profile.moveEffectDispatch:null,
  warpGraph:world.warpGraph?.verified?world.warpGraph:null,
  outdoorConnections:world.outdoorConnections?.verified?world.outdoorConnections:null,
  elevatorDestinations:world.elevatorDestinations?.verified?world.elevatorDestinations:null,
  landTerrainAtlas:world.terrainAtlas?.verified?world.terrainAtlas:null,
  economyTradesStatus:profile.economyTrades?{
   verified:profile.economyTrades.verified,failed:profile.economyTrades.failed}:null,
  growthRates:profile.growthRates||null,
  wildEncounters:wild.valid===true?(wild.data||[]).map(m=>({
   mapId:m.mapId,grass:m.grass,water:m.water,pointerCpu:m.pointerCpu
  })):null,
  maps:maps.valid===true?(maps.data||[]).map(m=>m.valid?({
   mapId:m.mapId,valid:true,mapBank:m.mapBank,
   mapHeaderPointerCpu:m.mapHeaderPointerCpu,tilesetId:m.tilesetId,
   heightTiles:m.heightTiles,widthTiles:m.widthTiles,
   blockSha256:m.blockSha256,blocksPointerCpu:m.blocksPointerCpu,
   widthBlocks:m.widthBlocks,heightBlocks:m.heightBlocks,
   blockDataBase64:m.blockDataBase64||null,blockBytes:m.blockBytes||null,
   scriptPointerCpu:m.scriptPointerCpu,textPointerCpu:m.textPointerCpu,
   connectionFlags:m.connectionFlags,
   objects:m.objects?{warps:m.objects.warps,signs:m.objects.signs,
     objects:m.objects.objects}:null,
   trainerEvents:m.trainerEvents||[],staticEncounterEvents:m.staticEncounterEvents||[]
  }):{mapId:m.mapId,valid:false,reason:m.invalidReason||'Sem cabeçalho normal validado'}):null,
  trainerParties:profile.trainerParties?.verified?{
   source:profile.trainerParties.source,rosters:profile.trainerParties.rosters,
   classNames:profile.trainerParties.classNames||null,
   classCount:profile.trainerParties.classCount,
   teamCount:profile.trainerParties.teamCount}:null,
  hiddenEvents:world.hiddenItemScripts?.valid?{
   source:world.hiddenItemScripts.source,
   items:world.hiddenItemScripts.items,
   hiddenCoins:world.hiddenItemScripts.hiddenCoins||null,
   totalEvents:world.hiddenItemScripts.totalEvents,
   maps:world.hiddenItemScripts.maps}:null,
  captureLayout:profile.battleCaptureLayout?.verified?profile.battleCaptureLayout:null
 };
}
function auditOne(label,b,decoder){
 if(!Buffer.isBuffer(b)||b.length!==ROM_BYTES)throw Error(label+': tamanho ROM inválido');
 const sha256=hash(b);
 if(sha256!==KNOWN[label])throw Error(label+': SHA-256 inesperado: '+sha256);
 const h=header(b);if(!h.headerChecksumValid||h.romSizeCode!==0x05)throw Error(label+': cabeçalho inválido');
 const profile=decoder(b,label+'.gb');
 if(!profile||profile.hash?.sha256!==sha256)throw Error(label+': perfil/ROM divergentes');
 const ledger=coverageLedger(b,profile),data=summarize(profile);
 const decodedMaps=profile.world?.maps?.valid===true?profile.world.maps.data:null;
 const mapCode=decodedMaps?auditMapCodeAtlas(b,decodedMaps):null;
 return {identity:{variant:label,sha256,title:h.title,bytes:b.length,
  crc32:crc32(b).toString(16).toUpperCase().padStart(8,'0'),headerChecksumValid:true},
  counts:data,coverage:ledger,catalogue:structuredCatalogue(profile),
  mapScriptsAndCode:mapCode,mapGuides:mapGuideIndex(profile),
  unresolved:GAP_DOMAINS.map(([domain,reason])=>({domain,status:'NOT_CERTIFIED',reason})),
  runtimeProven:false,semantic100PercentCertified:false};
}
function compareRomBanks(a,b){
 if(a.length!==b.length)throw Error('ROM lengths differ');
 let equal=0,different=0;const banks=[];
 for(let bank=0;bank<a.length/BANK;bank++){
  let n=0,runs=[],at=bank*BANK,end=at+BANK;
  while(at<end){if(a[at]===b[at]){equal++;at++;continue;}
   const start=at;while(at<end&&a[at]!==b[at]){n++;different++;at++;}
   runs.push({start,endExclusive:at,bytes:at-start});
  }
  banks.push({bank,bytesDiffering:n,differenceRuns:runs});
 }
 return {equalBytes:equal,differentBytes:different,bankCount:banks.length,banks};
}
function runBatch(sources,{decoder,outDir}={}){
 const labels=['red','blue','green'];
 if(!decoder)decoder=require('./romVariantRegistry').inspectRomBuffer;
 const images={},audits={};
 for(const label of labels){
  if(typeof sources[label]!=='string')throw Error('Falta --'+label);
  images[label]=readRom(sources[label]);
  audits[label]=auditOne(label,images[label],decoder);
 }
 const comparisons={red_blue:compareRomBanks(images.red,images.blue),
   red_green:compareRomBanks(images.red,images.green),
   blue_green:compareRomBanks(images.blue,images.green)};
 const report={schema:'pokeguide-full-rom-inventory-v1',
  principles:{allFileBytesScanned:true,allRomBytesSemanticallyDecoded:false,
   liveRuntimeValidated:false,noRomDataRedistributed:true},
  variants:audits,comparisons};
 if(outDir){
  const dest=path.resolve(outDir);
  if(process.platform==='win32'&&/^c:/i.test(dest))throw Error('Saída em C: proibida por política do projeto');
  if(!fs.statSync(dest).isDirectory())throw Error('Diretório --out inexistente');
  const file=path.join(dest,'pokeguide-inventario-integral-'+KNOWN.red.slice(0,8)+'.json');
  fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  report.outputPath=file;
 }
 return report;
}
if(require.main===module){
 try{
  const args=process.argv.slice(2),get=(k)=>{const i=args.indexOf('--'+k);return i>=0?args[i+1]:null};
  const result=runBatch({red:get('red'),blue:get('blue'),green:get('green')},{outDir:get('out')});
  console.log(JSON.stringify({reportPath:result.outputPath||null,
   versions:Object.fromEntries(Object.entries(result.variants).map(([name,v])=>[name,{
    sha256:v.identity.sha256,decodedBytes:v.coverage.decodedBytes,
    structuredBytes:v.coverage.structuredOnlyBytes,
    unclassifiedBytes:v.coverage.unclassifiedBytes,counts:v.counts,
    mapGuides:v.mapGuides?.maps.length||0,
    normalMapGuidesValidated:v.mapGuides?.maps.filter(x=>x.verified).length||0,
    reservedUnusedMapIds:v.mapGuides?.reservedIdsWithoutHeader??null,
    unresolvedNonReservedMapIds:v.mapGuides?.unresolvedNonReservedIds??null,
    mapScriptRoots:v.mapScriptsAndCode?.totals?.scriptSeeds||0,
    mapTextReferences:v.mapScriptsAndCode?.totals?.referencedTextEntries||0,
    codeCandidateInstructions:v.mapScriptsAndCode?.graph?.instructions||0,
    codeUnresolvedTransfers:v.mapScriptsAndCode?.graph?.unresolvedTargets?.length||0
   }])),comparisons:Object.fromEntries(Object.entries(result.comparisons).map(([k,v])=>[k,v.differentBytes])),
   semantic100PercentCertified:false},null,2));
 }catch(e){console.error('INVENTARIO_ROM_FALHOU: '+e.message);process.exitCode=1;}
}
module.exports={readRom,coverageLedger,structuredCatalogue,auditOne,compareRomBanks,runBatch,KNOWN};