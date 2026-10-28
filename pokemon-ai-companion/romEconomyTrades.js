'use strict';
// PokéGuide Gen I: economy, shop stocks, NPC trades, prize corner and fishing.
// Every emitted value is read directly from an exact SHA-256 audited ROM.
// Source layouts: pret/pokered data/items/{marts,prices,tm_prices,vending_prices}.asm,
// data/events/{trades,prizes,prize_mon_levels}.asm, engine/events/in_game_trades.asm.
// Static merchandise is not proof of current shop/NPC accessibility or purchase.
const crypto = require('node:crypto');
const BANK=0x4000, BYTES=64*BANK;
const SHA=Object.freeze({
 red:'5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
 blue:'2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
 green:'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db'
});
const ITEM_NAMES=[
 'NO_ITEM','MASTER_BALL','ULTRA_BALL','GREAT_BALL','POKE_BALL','TOWN_MAP','BICYCLE','SURFBOARD','SAFARI_BALL','POKEDEX','MOON_STONE',
 'ANTIDOTE','BURN_HEAL','ICE_HEAL','AWAKENING','PARLYZ_HEAL','FULL_RESTORE','MAX_POTION','HYPER_POTION','SUPER_POTION','POTION',
 'BOULDERBADGE','CASCADEBADGE','THUNDERBADGE','RAINBOWBADGE','SOULBADGE','MARSHBADGE','VOLCANOBADGE','EARTHBADGE','ESCAPE_ROPE','REPEL','OLD_AMBER',
 'FIRE_STONE','THUNDER_STONE','WATER_STONE','HP_UP','PROTEIN','IRON','CARBOS','CALCIUM','RARE_CANDY','DOME_FOSSIL','HELIX_FOSSIL','SECRET_KEY','ITEM_2C',
 'BIKE_VOUCHER','X_ACCURACY','LEAF_STONE','CARD_KEY','NUGGET','ITEM_32','POKE_DOLL','FULL_HEAL','REVIVE','MAX_REVIVE','GUARD_SPEC','SUPER_REPEL','MAX_REPEL',
 'DIRE_HIT','COIN','FRESH_WATER','SODA_POP','LEMONADE','S_S_TICKET','GOLD_TEETH','X_ATTACK','X_DEFEND','X_SPEED','X_SPECIAL','COIN_CASE','OAKS_PARCEL',
 'ITEMFINDER','SILPH_SCOPE','POKE_FLUTE','LIFT_KEY','EXP_ALL','OLD_ROD','GOOD_ROD','SUPER_ROD','PP_UP','ETHER','MAX_ETHER','ELIXER','MAX_ELIXER'];
const SHOP_DEFINITIONS=Object.freeze([
 ['ViridianMart',42],['PewterMart',56],['CeruleanMart',67],['UnusedBikeShopClerk',null],
 ['VermilionMart',91],['LavenderMart',150],['CeladonMart2FClerk1',123],['CeladonMart2FClerk2',123],
 ['CeladonMart4F',125],['CeladonMart5FClerk1',136],['CeladonMart5FClerk2',136],
 ['FuchsiaMart',152],['UnusedMartClerk',null],['CinnabarMart',172],['SaffronMart',180],['IndigoPlateauLobby',174]]);
// Game Corner prize-room map, Gen I. Trade locations from actual map IDs in map_constants.asm.
const TRADE_MAP_IDS=Object.freeze([86,48,null,170,196,191,63,168,168,71]);
const POS=Object.freeze({trades:0x71b7b,prizes:0x52859,prizeLevels:0x5298a});
function sha(b){return crypto.createHash('sha256').update(b).digest('hex');}
function bankAt(pos){return {fileOffset:pos,bank:Math.floor(pos/BANK),cpuAddress:pos<BANK?pos:0x4000+pos%BANK};}
function locateUnique(rom,needle){
 const a=rom.indexOf(needle);if(a<0||rom.indexOf(needle,a+1)!==-1)return null;
 if(Math.floor(a/BANK)!==Math.floor((a+needle.length-1)/BANK))return null;
 return a;
}
function bcd(b){let val=0;for(const x of b){const hi=x>>4,lo=x&15;if(hi>9||lo>9)return null;val=100*val+10*hi+lo;}return val;}
function nick(b){let text='',ended=false;for(const x of b){
 if(x===0x50){ended=true;break;}
 if(x>=0x80&&x<=0x99)text+=String.fromCharCode(x-0x80+65);
 else if(x>=0xa0&&x<=0xb9)text+=String.fromCharCode(x-0xa0+97);
 else if(x===0x7f)text+=' ';
 else if(x===0xe3)text+='-';
 else return null;
 }return ended&&text?text:null;}
function itemName(id){if(id>=0&&id<ITEM_NAMES.length)return ITEM_NAMES[id];
 if(id>=0xc9&&id<=0xfa)return 'TM'+String(id-0xc8).padStart(2,'0');
 if(id>=0xc4&&id<=0xc8)return 'HM'+String(id-0xc3).padStart(2,'0');
 return null;}
function sourceList(rom){
 const invalid=[];const offset=locateUnique(rom,Buffer.from([0,0,0,0,0x12,0,0,6,0,0,2,0,0,0,0,0,0,0]));
 if(offset===null||offset+291>(Math.floor(offset/BANK)+1)*BANK)return {verified:false,reason:'ItemPrices not unique'};
 const items=[];
 for(let id=1;id<=83;id++){
  const at=offset+(id-1)*3,price=bcd(rom.subarray(at,at+3));
  if(price===null)invalid.push(id);
  items.push({id,name:itemName(id),pricePokedollars:price,priceReadFromRom:true,shopAvailabilityNotImplied:true});
 }
 const elevatorPrices=[...rom.subarray(offset+83*3,offset+97*3)];
 if(invalid.length||elevatorPrices.some(x=>x!==0)||items[3].pricePokedollars!==200||
   items[1].pricePokedollars!==1200||items[2].pricePokedollars!==600||
   items[48].pricePokedollars!==10000||items[58].pricePokedollars!==10)
  return {verified:false,reason:'BCD prices or sentinel differ from audited layout',invalid};
 return {verified:true,location:bankAt(offset),itemCount:items.length,floorIdEntries:14,items,
  itemPricesSource:'ROM ItemPrices, 83 3-byte packed BCD entries and 14 elevator zero-value slots',
  zeroPriceDoesNotProveItemBuyable:true};
}
function marts(rom){
 const start=locateUnique(rom,Buffer.from([0xfe,4,4,11,15,12,0xff,0xfe,7,4,20]));
 if(start===null)return {verified:false,reason:'Mart scripts missing/ambiguous'};
 let p=start;const shops=[];
 for(const [label,mapId] of SHOP_DEFINITIONS){
  const at=p;
  if(rom[p++]!==0xfe)return {verified:false,reason:'Shop script header invalid',label};
  const n=rom[p++];if(n<1||n>12||p+n+1>(Math.floor(at/BANK)+1)*BANK)return {verified:false,reason:'Shop count invalid',label};
  const itemIds=[...rom.subarray(p,p+n)];p+=n;
  if(rom[p++]!==0xff||itemIds.some(id=>!itemName(id)))return {verified:false,reason:'Item or terminator invalid',label};
  shops.push({label,mapId,referencedInCanonicalScript:mapId!==null,location:bankAt(at),
   inventory:itemIds.map(id=>({id,name:itemName(id)})),liveAccessible:null});
 }
 return {verified:true,location:bankAt(start),lengthBytes:p-start,shopCount:shops.length,
  referencedShopScripts:shops.filter(s=>s.referencedInCanonicalScript).length,shops};
}
function technicalMachinePrices(rom){
 const at=locateUnique(rom,Buffer.from([0x32,0x21,0x34,0x24,0x34,0x21,0x45,0x55]));
 if(at===null||at+25>(Math.floor(at/BANK)+1)*BANK)return {verified:false,reason:'TM price table not unique'};
 const entries=[];for(let i=0;i<25;i++){
  const octet=rom[at+i],hi=octet>>4,lo=octet&15;
  if(hi<1||hi>5||lo<1||lo>5)return {verified:false,reason:'TM price nibble invalid'};
  for(const thousand of [hi,lo]){const no=entries.length+1;entries.push({number:no,itemId:0xc8+no,
    name:'TM'+String(no).padStart(2,'0'),pricePokedollars:thousand*1000});}
 }
 return {verified:true,location:bankAt(at),entries};
}
function vending(rom){
 const at=locateUnique(rom,Buffer.from([0x3c,0,2,0,0x3d,0,3,0,0x3e,0,3,0x50]));
 if(at===null)return {verified:false,reason:'VendingPrices sequence not unique'};
 const items=[];
 for(let i=0;i<3;i++){
  const id=rom[at+i*4],price=bcd(rom.subarray(at+i*4+1,at+i*4+4));
  if(price===null||id!==0x3c+i)return {verified:false,reason:'Vending item mismatch'};
  items.push({id,name:itemName(id),pricePokedollars:price});
 }
 return {verified:true,location:bankAt(at),mapId:126,items,currentMachineAvailabilityVerified:false};
}
function trades(rom){
 const at=POS.trades, rows=[];
 if(rom.length<at+10*14)return {verified:false,reason:'Truncated trade ROM'};
 // The actual DoInGameTradeDialogue bank contains `ld hl, TradeMons`.
 const bank=Math.floor(at/BANK),cpu=0x4000+at%BANK;
 const pointer=Buffer.from([0x21,cpu&255,cpu>>8]);
 if(rom.subarray(bank*BANK,(bank+1)*BANK).indexOf(pointer)<0)
  return {verified:false,reason:'TradeMons code reference not found'};
 for(let i=0;i<10;i++){
  const p=at+i*14,requested=rom[p],received=rom[p+1],dialog=rom[p+2];
  const nickname=nick(rom.subarray(p+3,p+14));
  if(!requested||requested>190||!received||received>190||dialog>2||!nickname)
   return {verified:false,reason:'Trade record failed validation',index:i};
  rows.push({index:i,mapId:TRADE_MAP_IDS[i],unusedInReference:i===2,
   requestedInternalId:requested,receivedInternalId:received,dialogueId:dialog,
   receivedNickname:nickname,completed:null,requiresLiveTradeFlag:true,
   location:bankAt(p)});
 }
 return {verified:true,location:bankAt(at),trades:rows,recordCount:10,
  differencesFromOriginalReferencePossible:true};
}
function prizeCorner(rom){
 const at=POS.prizes;
 // Gen I prize menu has three 3-entry lists and BCD2 coin prices (2 bytes each).
 // A terminator @ (0x50) follows each group; list #3 uses TM IDs.
 let p=at;const groups=[];
 for(let j=0;j<3;j++){
  const ids=[...rom.subarray(p,p+3)];p+=3;
  if(rom[p++]!==0x50||ids.some(id=>j===2?(id<0xc9||id>0xfa):(id<1||id>190)))
   return {verified:false,reason:'Prize item list invalid',group:j};
  const coins=[];
  for(let i=0;i<3;i++){const n=bcd(rom.subarray(p,p+2));p+=2;
   if(n===null||n<1||n>9999)return {verified:false,reason:'Coin BCD invalid',group:j};coins.push(n);}
  if(rom[p++]!==0x50)return {verified:false,reason:'Missing cost terminator',group:j};
  groups.push({kind:j===2?'tm':'pokemon',products:ids.map((id,i)=>({id,coinPrice:coins[i],
   itemName:j===2?itemName(id):null}))});
 }
 if(p-at!==33||groups[2].products.map(x=>x.id).join(',')!=='223,215,250')
  return {verified:false,reason:'TM prize anchor mismatch'};
 const dict=[];
 for(let k=0;k<6;k++){
  const species=rom[POS.prizeLevels+k*2],level=rom[POS.prizeLevels+k*2+1];
  if(species!==groups[Math.floor(k/3)].products[k%3].id||level<1||level>100)
   return {verified:false,reason:'Prize level dictionary does not match menu',index:k};
  dict.push({speciesInternalId:species,level});
 }
 for(let k=0;k<6;k++)groups[Math.floor(k/3)].products[k%3].level=dict[k].level;
 return {verified:true,location:bankAt(at),levelsLocation:bankAt(POS.prizeLevels),
  mapId:137,menus:groups,allCostsInCoins:true,currentAvailabilityVerified:false};
}
function fishing(rom){
 // SuperRodData has 33 (map ID, bank-local 16-bit group pointer) entries + 0xff.
 // The grouping and level/species choices are read from the binary, not inferred.
 const at=0xe919,first=[0,0x7d,0x69,1,0x7d,0x69,3,0x87,0x69];
 if(!rom.subarray(at,at+first.length).equals(Buffer.from(first)))
  return {verified:false,reason:'SuperRodData pointer table incompatible'};
 const entries=[],distinct=new Set();
 for(let i=0;i<33;i++){
  const pos=at+i*3,mapId=rom[pos],cpu=rom.readUInt16LE(pos+1);
  if(mapId>=248||distinct.has(mapId)||cpu<0x4000||cpu>=0x8000)
   return {verified:false,reason:'Super Rod map/pointer validation failed',index:i};
  distinct.add(mapId);
  const address=3*BANK+cpu-0x4000;
  if(address>=4*BANK)return {verified:false,reason:'Super Rod group bank invalid'};
  const count=rom[address];
  if(count<1||count>4||address+1+count*2>4*BANK)
   return {verified:false,reason:'Super Rod group slots invalid'};
  const slots=[];
  for(let j=0;j<count;j++){
   const level=rom[address+1+j*2],speciesId=rom[address+2+j*2];
   if(level<1||level>100||speciesId<1||speciesId>190)
    return {verified:false,reason:'Super Rod species/level invalid'};
   slots.push({level,speciesInternalId:speciesId,
    conditionalSpeciesChance:{numerator:1,denominator:count}});
  }
  entries.push({mapId,groupLocation:bankAt(address),slots,
   eligibleFishingActionRequired:true,noBiteChanceOnEligibleAttempt:{numerator:1,denominator:2},
   bitesChanceOnEligibleAttempt:{numerator:1,denominator:2}});
 }
 if(rom[at+33*3]!==0xff)return {verified:false,reason:'SuperRodData missing terminator'};
 const old=rom.subarray(0xe252,0xe255);
 if(old[0]!==0x01||old[1]!==133||old[2]!==5)
  return {verified:false,reason:'Old Rod engine immediate not verified'};
 const gr=rom.subarray(0xe27f,0xe27f+4),goodSlots=[];
 for(let i=0;i<2;i++){
  const level=gr[i*2],species=gr[i*2+1];
  if(level<1||level>100||species<1||species>190)return {verified:false,reason:'Good Rod species invalid'};
  goodSlots.push({level,speciesInternalId:species,conditionalSpeciesChance:{numerator:1,denominator:2}});
 }
 return {verified:true,location:bankAt(at),superRodMaps:entries.length,superRod:entries,
  oldRod:{level:old[2],speciesInternalId:old[1],source:'ROM bank3 ItemUseOldRod LD BC immediate at 0xe252; pret/pokered ItemUseOldRod',
   immediateVerified:true,engineAddress:bankAt(0xe252),
   bitesChanceOnEligibleAttempt:{numerator:1,denominator:1}},
  goodRod:{location:bankAt(0xe27f),slots:goodSlots,bitesChanceOnEligibleAttempt:{numerator:1,denominator:2}},
  conditionalProbabilitiesOnly:true,canFishCurrentTileVerified:false,
  source:'ROM SuperRodData, GoodRodMons and pret/pokered engine/items/item_effects.asm'};
}
function auditEconomyTrades(rom){
 if(!Buffer.isBuffer(rom)||rom.length!==BYTES)return {verified:false,reason:'ROM expected 1048576 bytes'};
 const digest=sha(rom),version=Object.keys(SHA).find(k=>SHA[k]===digest);
 if(!version)return {verified:false,reason:'ROM SHA-256 is not an audited Red/Blue/Green variant',sha256:digest};
 const fields={itemPrices:sourceList(rom),martShops:marts(rom),tmPrices:technicalMachinePrices(rom),
  vending:vending(rom),npcTrades:trades(rom),prizeCorner:prizeCorner(rom),fishing:fishing(rom)};
 const failed=Object.entries(fields).filter(([,v])=>!v.verified).map(([key,v])=>({table:key,reason:v.reason}));
 return {schema:'pokeguide-gen1-economy-trades-v1',romSha256:digest,version,
  verified:failed.length===0,failed,source:'EXACT_LOCAL_ROM_BYTES_SHA256_AND_TABLE_STRUCTURE',
  runtimeIdentityVerified:false,livePurchaseFlagsVerified:false,
  ...fields};
}
module.exports={auditEconomyTrades,bcd,ITEM_NAMES,SHOP_DEFINITIONS,TRADE_MAP_IDS,SHA};