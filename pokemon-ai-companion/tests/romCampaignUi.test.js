'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
const start=source.indexOf('function formatCampaignChecklistSection(advice) {');
const end=source.indexOf('\nfunction renderWorldAdvisor(state)',start);
assert.ok(start>=0&&end>start,'Campanha nao integrada no painel');
const format=vm.runInNewContext(
 source.slice(start,end)+'\nformatCampaignChecklistSection;',
 {},{timeout:1000}
);
const sha='5ca7ba01642a3b27b0cc0b5349b52792795b62d3ed977e98a09390659af96b7b';
function good(){
 return {verified:true,mapId:15,romSha256:sha,
  fullWorldStaticIndexVerified:true,
  campaignSummary:{allStaticActions:1992,normalMaps:226,
   unresolvedMapIds:22,observedMapCount:1},
  mapChecklist:{verified:true,mapId:15,romSha256:sha,
   summary:{total:3,confirmedCollected:1,confirmedNotCollected:0,
    progressUnverified:2,needsCutCandidates:1,needsSurfCandidates:0},
   actions:[
    {kind:'HIDDEN_ITEM',x:7,y:4,progress:'COLLECTED_CONFIRMED_FLAG',
      staticObject:{hiddenIndex:3},routeCondition:null},
    {kind:'ITEM',x:6,y:4,progress:'NOT_PROVEN',
      staticObject:{itemOrTrainerId:19},routeCondition:'NEEDS_CUT'},
    {kind:'TRAINER',x:9,y:2,progress:'NOT_PROVEN',
      staticObject:{},routeCondition:null}
   ]}
 };
}
test('live UI enumerates every static object and identifies real hidden event bit',()=>{
 const lines=Array.from(format(good()));
 assert.ok(lines.some(l=>l.includes('1992')&&l.includes('226 mapas')));
 assert.ok(lines.some(l=>l.includes('1/226')));
 assert.ok(lines.some(l=>l.includes('índice evento #3')&&l.includes('flag de recolha')));
 assert.ok(lines.some(l=>l.includes('NEEDS_CUT')&&l.includes('hipótese')));
 assert.ok(lines.some(l=>l.includes('Treinador')&&l.includes('progresso por confirmar')));
 assert.ok(lines.some(l=>l.includes('não provam acesso')));
});
test('UI refuses stale/mismatching static index and wrong map/ROM evidence',()=>{
 const g=good();
 for(const override of [
  {verified:false},
  {fullWorldStaticIndexVerified:false},
  {mapChecklist:{...g.mapChecklist,mapId:16}},
  {mapChecklist:{...g.mapChecklist,romSha256:'0'.repeat(64)}},
  {campaignSummary:{...g.campaignSummary,normalMaps:225}}
 ]){
  assert.equal(format({...g,...override}).length,0);
 }
});
test('UI formats text without HTML injection or claiming actions finished',()=>{
 const g=good();
 g.mapChecklist.actions.push({
   kind:'NPC',x:4,y:4,progress:'NOT_PROVEN',
   staticObject:{},routeCondition:null
 });
 const lines=Array.from(format(g));
 assert.ok(lines.some(l=>l.includes('NPC')&&l.includes('progresso por confirmar')));
 assert.ok(!lines.some(l=>l.includes('campanha concluída')));
 assert.ok(source.includes('body.textContent=lines.join'));
 assert.ok(source.includes('formatCampaignChecklistSection(advice)'));
 assert.ok(source.includes('state.memoryReadStatus?.positionWindow?.verified!==true'));
});
