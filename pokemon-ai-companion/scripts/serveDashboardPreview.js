'use strict';
// Passive local dashboard preview. Never import RetroArchClient, ROM profiles,
// sync clients, updaters or the RetroArch UDP transport. No file writes.
// The real dashboard is served with an explicit disconnected RAM state.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {WebSocketServer}=require('ws');
const ROOT=path.resolve(__dirname,'../public');
const CONTENT_TYPES=Object.freeze({
 '.html':'text/html; charset=utf-8',
 '.js':'application/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8',
 '.json':'application/json; charset=utf-8',
 '.svg':'image/svg+xml',
 '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
 '.webp':'image/webp','.gif':'image/gif','.ico':'image/x-icon',
 '.woff':'font/woff','.woff2':'font/woff2'
});
const SAFE_STATE=Object.freeze({
 connected:false,isSimulation:false,lastUpdate:null,
 romValidation:'Pré-visualização LOCAL — nenhum jogo ligado',
 romRuntimeIdentity:{matched:false,source:'NO_EMULATOR_CONTACT'},
 memoryReadStatus:{verified:false,completeness:'NO_EMULATOR_READ'},
 trainerName:'SEM JOGO',rivalName:'',money:0,coins:0,
 mapId:0,mapName:'Sem dados do jogo',areaInfo:null,coords:null,
 playerDirection:'Indisponível',playerMode:'Sem ligação ao emulador',
 playTime:'0h 0m 0s',inBattle:false,battleType:'None',battle:null,
 party:[],partyCount:0,inventory:[],badges:[],
 pcBox:{boxNum:1,count:0,freeSlots:20,pokemon:[]},
 totalPokemonOwned:0,pokedexOwned:[],pokedexSeen:[],
 pokedexOwnedCount:0,pokedexSeenCount:0,recentHistory:[],
 actionHistory:[],dialogHistory:[],
 globalCampaignLedger:{verified:false,mapProgress:[],
  reason:'PREVIEW_NO_RAM'},
 worldRecentCompleteEventChanges:{verified:false,events:[],
  reason:'PREVIEW_NO_RAM'},
 romCompleteEventDelta:{verified:false,changes:[],
  reason:'PREVIEW_NO_RAM'},
 worldAdvisor:{verified:false,observations:[],
  reason:'PREVIEW_NO_RAM'},
 aiAdvice:'Pré-visualização local: RAM, RetroArch e GitHub Sync desligados.'
});
const respond=(res,code,type,content)=>{
 res.writeHead(code,{
  'Content-Type':type,
  'Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer'
 });
 res.end(content);
};
function createReadOnlyPreviewServer({publicRoot=ROOT}={}){
 const root=path.resolve(publicRoot);
 const stateJSON=JSON.stringify(SAFE_STATE);
 const server=http.createServer((req,res)=>{
  if(req.method!=='GET'){
   respond(res,405,'text/plain; charset=utf-8','READ_ONLY_PREVIEW');
   return;
  }
  let uri;
  try{uri=new URL(req.url,'http://127.0.0.1');}
  catch{respond(res,400,'text/plain','INVALID_REQUEST');return;}
  if(uri.pathname==='/api/state'){
   respond(res,200,'application/json; charset=utf-8',stateJSON);
   return;
  }
  if(uri.pathname==='/api/preview-health'){
   respond(res,200,'application/json; charset=utf-8',
    JSON.stringify({preview:true,connected:false,readOnly:true,
     emulatorContact:false,githubSync:false,romWrites:false}));
   return;
  }
  if(uri.pathname.startsWith('/api/')||
     uri.pathname==='/telemetria.md'||
     uri.pathname==='/telemetria.txt'){
   respond(res,403,'text/plain; charset=utf-8','PREVIEW_ENDPOINT_DISABLED');
   return;
  }
  let name;
  try{name=decodeURIComponent(uri.pathname==='/'
   ?'index.html':uri.pathname.slice(1));}
  catch{respond(res,400,'text/plain','INVALID_PATH');return;}
  if(!name||name.includes('\0')||name.includes('\\')||
     name.split('/').some(s=>s==='.'||s==='..'||s.startsWith('.'))){
   respond(res,403,'text/plain','PATH_BLOCKED');return;
  }
  const file=path.resolve(root,name);
  const relative=path.relative(root,file);
  const ext=path.extname(file).toLowerCase();
  if(relative.startsWith('..')||path.isAbsolute(relative)||
     !Object.hasOwn(CONTENT_TYPES,ext)){
   respond(res,403,'text/plain','PATH_BLOCKED');return;
  }
  // Do not follow symlinks/reparse-backed file entries.
  fs.lstat(file,(err,stat)=>{
   if(err||!stat.isFile()||stat.isSymbolicLink()){
    respond(res,404,'text/plain','FILE_NOT_FOUND');return;
   }
   fs.readFile(file,(readErr,body)=>{
    if(readErr){respond(res,404,'text/plain','FILE_NOT_FOUND');return;}
    respond(res,200,CONTENT_TYPES[ext],body);
   });
  });
 });
 const ws=new WebSocketServer({server,path:'/ws',
  perMessageDeflate:false});
 ws.on('connection',client=>{
  client.send(stateJSON);
  // No instructions are accepted from any WebSocket client.
  client.on('message',()=>client.close(1008,'READ_ONLY_PREVIEW'));
 });
 server.on('close',()=>ws.clients.forEach(c=>c.terminate()));
 return server;
}
function main(){
 const portRaw=process.env.POKEGUIDE_PREVIEW_PORT??'3001';
 if(!/^\d{1,5}$/.test(portRaw))throw new Error('INVALID_PREVIEW_PORT');
 const port=Number(portRaw);
 if(!Number.isInteger(port)||port<1024||port>65535)
  throw new Error('PREVIEW_PORT_OUT_OF_RANGE');
 const server=createReadOnlyPreviewServer();
 server.listen(port,'127.0.0.1',()=>{
  process.stdout.write('POKEGUIDE_LOCAL_PREVIEW_READY=TRUE\n'+
   'POKEGUIDE_LISTEN_HOST=127.0.0.1\n'+
   'POKEGUIDE_LISTEN_PORT='+port+'\n'+
   'POKEGUIDE_RETROARCH_CONTACT=FALSE\n'+
   'POKEGUIDE_GITHUB_SYNC=FALSE\n');
 });
 server.on('error',err=>{
  process.stderr.write('PREVIEW_SERVER_FAILED='+String(err.code||'UNKNOWN')+'\n');
  process.exitCode=1;
 });
}
if(require.main===module)main();
module.exports={createReadOnlyPreviewServer,SAFE_STATE};
