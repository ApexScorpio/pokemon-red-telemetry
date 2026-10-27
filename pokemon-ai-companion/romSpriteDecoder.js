'use strict';
// Descompressão 100% local dos sprites Pokémon Gen I.
// Baseada nas rotinas do próprio jogo: pret/pokered/home/uncompress.asm
// Input ROM -> bitstream/RLE -> 2 planos 1bpp -> differential/XOR -> PNG 2bpp.
// Nunca depende da PokeAPI ou das imagens Gen5.
const zlib=require('node:zlib');

function bitReader(buffer,start,end){
 let pos=start,bit=0;
 return {
  read(){
   if(pos>=end)throw new Error('Sprite comprimido excedeu o banco ROM');
   const v=(buffer[pos]>>(7-bit))&1;
   if(++bit===8){bit=0;pos++;}
   return v;
  },
  get(n){let x=0;for(let i=0;i<n;i++)x=(x<<1)|this.read();return x;},
  get bytesConsumed(){return pos-start+(bit?1:0);}
 };
}
function differentialDecode(plane,widthTiles,heightPx){
 for(let y=0;y<heightPx;y++){
  let previous=0;
  for(let x=0;x<widthTiles;x++){
   const at=x*heightPx+y,encoded=plane[at];let decoded=0;
   for(let bit=7;bit>=0;bit--){
    previous ^= (encoded>>bit)&1;
    decoded |= previous<<bit;
   }
   plane[at]=decoded;
  }
 }
}
function decompressSprite(buffer,offset,expectedDim){
 if(!Buffer.isBuffer(buffer)||offset<0||offset>=buffer.length)throw new Error('Sprite ROM inválido');
 const dim=buffer[offset],wt=dim>>4,ht=dim&15;
 if(wt<1||wt>7||ht<1||ht>7||expectedDim!==undefined&&dim!==expectedDim)
  throw new Error('Dimensões do sprite não correspondem à ROM');
 const heightPx=8*ht,totalPairs=4*wt*heightPx;
 const bankEnd=Math.min(buffer.length,(Math.floor(offset/16384)+1)*16384);
 const reader=bitReader(buffer,offset+1,bankEnd);
 const first=reader.read();
 const planes=[null,null];let unpackMode=0;
 for(let chunk=0;chunk<2;chunk++){
  if(chunk===1){
   const modeBit=reader.read();
   unpackMode=modeBit?1+reader.read():0;
  }
  let encodedPairs=[];
  let inZeros=reader.read()===0;
  while(encodedPairs.length<totalPairs){
   if(inZeros){
    let ones=0;
    while(reader.read()){
     if(++ones>=16)throw new Error('Sprite RLE ultrapassou 16 bits');
    }
    const num=reader.get(ones+1)+(2**(ones+1)-1);
    if(encodedPairs.length+num>totalPairs)throw new Error('Sprite RLE acima do tamanho declarado');
    for(let i=0;i<num;i++)encodedPairs.push(0);
    inZeros=false;
   }else{
    const pair=reader.get(2);
    if(pair===0)inZeros=true;
    else encodedPairs.push(pair);
   }
  }
  const plane=Buffer.alloc(wt*heightPx);
  for(let i=0;i<encodedPairs.length;i++){
   const pairCol=Math.floor(i/heightPx),y=i%heightPx;
   const tileColumn=Math.floor(pairCol/4),shift=2*(3-pairCol%4);
   plane[tileColumn*heightPx+y] |= encodedPairs[i]<<shift;
  }
  planes[first^chunk]=plane;
 }
 if(unpackMode===0){
  differentialDecode(planes[0],wt,heightPx);
  differentialDecode(planes[1],wt,heightPx);
 }else if(unpackMode===1){
  const source=planes[first],target=planes[first^1];
  differentialDecode(source,wt,heightPx);
  for(let i=0;i<source.length;i++)target[i]^=source[i];
 }else if(unpackMode===2){
  differentialDecode(planes[0],wt,heightPx);
  differentialDecode(planes[1],wt,heightPx);
  const source=planes[first],target=planes[first^1];
  for(let i=0;i<source.length;i++)target[i]^=source[i];
 }else throw new Error('Modo de sprite inválido');
 const width=wt*8,height=ht*8,pixels=Buffer.alloc(width*height);
 for(let y=0;y<height;y++){
  for(let col=0;col<wt;col++){
   const k=col*height+y;
   for(let bit=7;bit>=0;bit--){
    const color=(((planes[0][k]>>bit)&1)<<1)|((planes[1][k]>>bit)&1);
    pixels[y*width+col*8+7-bit]=color;
   }
  }
 }
 return {width,height,widthTiles:wt,heightTiles:ht,mode:unpackMode,
  bytesConsumed:reader.bytesConsumed+1,pixels,
  pixelFormat:'GEN1_INDEXED_2BPP',paletteSource:'GRAYSCALE_NEUTRAL; SAMEBOY_COLORS_NOT_APPLIED'};
}
const CRC=Array.from({length:256},(_,i)=>{let v=i;for(let j=0;j<8;j++)v=(v&1)?0xEDB88320^(v>>>1):v>>>1;return v>>>0;});
function pngChunk(kind,data){
 const name=Buffer.from(kind,'ascii'),size=Buffer.alloc(4),sum=Buffer.alloc(4);
 size.writeUInt32BE(data.length);
 let x=0xFFFFFFFF;for(const b of Buffer.concat([name,data]))x=CRC[(x^b)&255]^(x>>>8);
 sum.writeUInt32BE((x^0xFFFFFFFF)>>>0);
 return Buffer.concat([size,name,data,sum]);
}
function toPng(decoded){
 const {width,height,pixels}=decoded;
 if(pixels.length!==width*height)throw new Error('Imagem descodificada incompleta');
 const stride=1+width*4,rowData=Buffer.alloc(stride*height);
 for(let y=0;y<height;y++){
  const row=y*stride;rowData[row]=0; // filtro PNG None
  for(let x=0;x<width;x++){
   const shade=255-85*pixels[y*width+x],at=row+1+x*4;
   rowData[at]=shade;rowData[at+1]=shade;rowData[at+2]=shade;rowData[at+3]=255;
  }
 }
 const head=Buffer.alloc(13);head.writeUInt32BE(width,0);head.writeUInt32BE(height,4);
 head[8]=8;head[9]=6; // 8-bit RGBA
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),
  pngChunk('IHDR',head),pngChunk('IDAT',zlib.deflateSync(rowData)),pngChunk('IEND',Buffer.alloc(0))]);
}
function spritePngBase64(rom,offset,expectedDim){
 return toPng(decompressSprite(rom,offset,expectedDim)).toString('base64');
}
module.exports={decompressSprite,toPng,spritePngBase64};
