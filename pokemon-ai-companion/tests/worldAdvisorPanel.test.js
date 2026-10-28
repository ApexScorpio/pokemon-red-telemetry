'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
// Isolate the actual browser renderer without running the full cockpit's
// background polling, timers or RetroArch connection.
const script=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
const start=script.indexOf('function renderWorldAdvisor(state) {');
const end=script.indexOf('// Renderização Principal do Cockpit',start);
if(start<0||end<0)throw Error('renderWorldAdvisor section unavailable');
function render(state){
 let body={textContent:'',innerHTML:null},source={textContent:'',innerHTML:null};
 const document={getElementById:id=>id==='world-advisor-content'?body:
    id==='world-advisor-source'?source:null};
 const context={document,Date};
 vm.runInNewContext(script.slice(start,end)+'\nrenderWorldAdvisor(state);',context);
 return {body,source};
}
const live=()=>({
 connected:true,lastUpdate:new Date().toISOString(),mapId:15,
 memoryReadStatus:{verified:true,positionWindow:{verified:true}},
 romRuntimeIdentity:{matched:true},
 worldAdvisor:{verified:true,mapId:15,mapName:'Route 4',romSha256:'5ca7ba01',
  position:{x:12,y:3},trainerFlagsVerified:false,hiddenFlagsVerified:true,
  observations:[
   {kind:'ITEM',what:'<img src=x onerror=alert(1)>',x:5,y:3,
    status:'NOT_REMOVED_FLAG',consequence:'Requer condições de ROM/RAM',
    accessStatus:'NEEDS_CUT',accessRoute:{steps:7}},
   {kind:'HIDDEN_ITEM',what:'Hidden',x:6,y:2,
    status:'COLLECTED_FLAG',consequence:'Flag comprovada'}
  ]}
});
test('displays conditional route without HTML injection or guaranteed access',()=>{
 const {body,source}=render(live());
 assert.match(body.textContent,/Possível passagem dependente de Cut/);
 assert.match(body.textContent,/passos teóricos/);
 assert.match(body.textContent,/estado: parcial/i);
 assert.match(body.textContent,/<img src=x onerror/);
 assert.equal(body.innerHTML,null);
 assert.match(source.textContent,/leitura RAM recente/);
});
test('offline and stale samples hide all old action details',()=>{
 const old=live();old.connected=false;
 assert.doesNotMatch(render(old).body.textContent,/NEEDS_CUT|<img/);
 const stale=live();stale.lastUpdate=new Date(Date.now()-30000).toISOString();
 assert.doesNotMatch(render(stale).body.textContent,/TM04|<img/);
 const inconsistent=live();inconsistent.memoryReadStatus.positionWindow.verified=false;
 assert.match(render(inconsistent).body.textContent,/Aguardar nova leitura/);
});
test('reject map mismatch and ROM identity mismatch',()=>{
 const wrong=live();wrong.worldAdvisor.mapId=16;
 assert.match(render(wrong).body.textContent,/Não é seguro mostrar/);
 const unknown=live();unknown.romRuntimeIdentity.matched=false;
 assert.match(render(unknown).source.textContent,/sem prova/);
});
