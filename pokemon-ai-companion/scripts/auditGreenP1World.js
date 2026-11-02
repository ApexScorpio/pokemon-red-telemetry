'use strict';
// Run: node scripts/auditGreenP1World.js /path/to/user-provided-green-p1.gb
// Read-only output. No ROM, save, profile, or session file is modified.
const fs=require('node:fs');
const {inspectGreenP1Layout}=require('../romGreenP1WorldProbe');
function main(paths){
 if(!Array.isArray(paths)||paths.length!==1)
   throw Error('É necessário exatamente um caminho para a ROM Green U p1');
 const result=inspectGreenP1Layout(fs.readFileSync(paths[0]));
 if(result.verified!==true)throw Error(result.reason);
 const {maps,...summary}=result;
 return {...summary,perMapStaticObjects:maps};
}
if(require.main===module){
 try{console.log(JSON.stringify(main(process.argv.slice(2)),null,2));}
 catch(e){console.error('GREEN_P1_ROM_AUDIT_FAILED: '+e.message);process.exitCode=1;}
}
module.exports={main};
