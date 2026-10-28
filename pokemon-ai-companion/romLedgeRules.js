'use strict';
// Gen I ledges: an 8-row ROM table in bank 6, HandleLedges only checks
// OVERWORLD tileset (ID 0). Direction, standing tile, ahead tile, PAD mask.
// The table matching does NOT prove the current movement flag, held input,
// sprite collisions, that the player is on the tile, or a jump actually occurs.
const crypto=require('node:crypto');
const SHA=new Set([
 '5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b',
 '2a951313c2640e8c2cb21f25d1db019ae6245d9c7121f754fa61afd7bee6452d',
 'aafa14e96651b077a9de7a336ab98ac0b0db3148e750671092631ea9dc1eb7db']);
const AT=6*0x4000+0x66cf-0x4000;
const RAW=Buffer.from([
 0x00,0x2c,0x37,0x80, 0x00,0x39,0x36,0x80, 0x00,0x39,0x37,0x80,
 0x08,0x2c,0x27,0x20, 0x08,0x39,0x27,0x20,
 0x0c,0x2c,0x0d,0x10, 0x0c,0x2c,0x1d,0x10, 0x0c,0x39,0x0d,0x10,
 0xff]);
const DIRECTIONS={0:'south',8:'west',12:'east'};
function readLedgeRules(rom){
 if(!Buffer.isBuffer(rom)||rom.length!==1048576)return {verified:false,reason:'ROM de 1 MiB ausente'};
 const sha=crypto.createHash('sha256').update(rom).digest('hex');
 if(!SHA.has(sha))return {verified:false,reason:'SHA-256 fora das três ROMs auditadas'};
 if(!rom.subarray(AT,AT+RAW.length).equals(RAW))return {verified:false,reason:'LedgeTiles não coincide com o bloco de código da ROM'};
 const entries=Array.from({length:8},(_,i)=>{
   const [face,standingTileId,ledgeTileId,padMask]=RAW.subarray(i*4,i*4+4);
   return {direction:DIRECTIONS[face],facingByte:face,standingTileId,ledgeTileId,
    requiredPadMask:padMask,sourceRomOffset:AT+i*4,
    guaranteedJump:false,flagsNotVerified:true};
 });
 return {verified:true,romSha256:sha,tilesetId:0,entries,count:8,
  gameplaySource:'pret/pokered engine/overworld/ledges.asm HandleLedges',
  runtimeLedgeHappenedProven:false,playerTileFromLiveRamProven:false};
}
const STATIC_RULES=Array.from({length:8},(_,i)=>{
 const [f,s,t,p]=RAW.subarray(i*4,i*4+4);
 return {direction:DIRECTIONS[f],standingTileId:s,ledgeTileId:t,requiredPadMask:p};
});
function ledgeCandidate({romSha256,tilesetId,standingTileId,ledgeTileId,direction}={}){
 if(!SHA.has(String(romSha256||'').toLowerCase())||!Number.isInteger(tilesetId)||tilesetId<0||tilesetId>23||
    !Number.isInteger(standingTileId)||standingTileId<0||standingTileId>95||
    !Number.isInteger(ledgeTileId)||ledgeTileId<0||ledgeTileId>95||
    !['north','south','west','east'].includes(direction))
  return {verified:false,reason:'Identidade ROM, tileset, tile ou direção inválidos'};
 const rule=tilesetId===0?STATIC_RULES.find(r=>r.direction===direction&&
   r.standingTileId===standingTileId&&r.ledgeTileId===ledgeTileId):null;
 return {verified:true,ledgeCandidate:!!rule,requiredPadMask:rule?.requiredPadMask??null,
  eligibleIfMovementFlagsAndInputVerified:!!rule,
  jumpInCurrentFrameVerified:false,
  source:'ROM_SHA256_LedgeTiles_CONDITIONAL_NO_RAM_SNAPSHOT',
  unmetEvidence:['wMovementFlags BIT_LEDGE_OR_FISHING',
   'wSpritePlayerStateData1FacingDirection',
   'hJoyHeld required PAD mask in same frame',
   'player and front tile in same running frame']};
}
module.exports={readLedgeRules,ledgeCandidate,STATIC_RULES};