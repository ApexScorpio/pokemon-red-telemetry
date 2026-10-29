'use strict';
// Summarise structurally decoded, linear TX_FAR text command targets.
// The input list is supplied by the independent ROM text-pointer auditor.
// Duplicates are kept because more than one NPC/sign may reference one target.
const {decodeRomTextProgram}=require('./romTextScriptDecoder');
const invalid=reason=>({verified:false,reason,dialogueExecuted:false,
  scriptEffectsVerified:false});
function summarizeStaticTextTargets({rom,targets}={}){
 if(!Buffer.isBuffer(rom)||rom.length!==1048576||!Array.isArray(targets)||
    targets.length>1000||targets.some(x=>!Number.isInteger(x)||
      x<0||x>=rom.length))
   return invalid('ROM ou destinos de texto inválidos');
 const data={verified:true,inspected:targets.length,
   uniqueTargetOffsets:new Set(targets).size,
   completeLinearScripts:0,incompleteOrNonlinearScripts:0,
   multilineScripts:0,runtimeDependentScripts:0,totalLiteralSegments:0,
   failureReasons:{},samples:[],dialogueExecuted:false,
   scriptEffectsVerified:false,source:'ROM_TX_FAR_LINEAR_STATIC_AUDIT'};
 for(const fileOffset of targets){
   const p=decodeRomTextProgram({rom,offset:fileOffset});
   if(p.verified!==true||p.scriptComplete!==true){
     data.incompleteOrNonlinearScripts++;
     const reason=String(p.reason||'Desconhecido').slice(0,120);
     data.failureReasons[reason]=(data.failureReasons[reason]||0)+1;
     if(data.samples.length<12)
       data.samples.push({fileOffset,complete:false,reason});
     continue;
   }
   data.completeLinearScripts++;
   data.totalLiteralSegments+=p.segmentCount;
   if(p.segmentCount>1)data.multilineScripts++;
   if(p.containsRuntimeText||p.containsRuntimeCommands)
     data.runtimeDependentScripts++;
   if(data.samples.length<12&&p.segmentCount>1)
     data.samples.push({fileOffset,complete:true,
       segmentCount:p.segmentCount,runtimeDependent:
         p.containsRuntimeText||p.containsRuntimeCommands});
 }
 return data;
}
module.exports={summarizeStaticTextTargets};
