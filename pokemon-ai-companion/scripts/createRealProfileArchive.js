'use strict';
// Create a verified Gen I profile archive only from three user-supplied original ROMs.
// Source ROMs are opened read-only. Destination must be new, on D: or S: in Windows.
const fs=require('node:fs');
const path=require('node:path');
const {readRom}=require('../romComprehensiveAudit');
const {saveVerifiedProfileArchive}=require('../romProfileArchive');
function parseArguments(argv){
 const keys=['--red','--blue','--green','--out'],options={};
 for(let i=0;i<argv.length;i+=2){
  const key=argv[i],value=argv[i+1];
  if(!keys.includes(key)||!value||value.startsWith('--')||options[key])
   throw Error('Argumentos invalidos: usar --red ROM --blue ROM --green ROM --out D:/ficheiro.zip');
  options[key]=value;
 }
 if(keys.some(key=>!options[key])||Object.keys(options).length!==4)
  throw Error('Sao necessarios --red, --blue, --green e --out');
 const destination=path.resolve(options['--out']);
 if(process.platform==='win32'&&!/^[ds]:[\\/]/i.test(destination))
  throw Error('Saida apenas em D: ou S:');
 if(!destination.toLowerCase().endsWith('.zip'))
  throw Error('Destino tem de terminar em .zip');
 for(const key of ['--red','--blue','--green']){
  const entry=fs.lstatSync(options[key]);
  if(!entry.isFile()||entry.isSymbolicLink())
   throw Error('Entrada ROM deve ser um ficheiro regular');
 }
 if(fs.existsSync(destination))
  throw Error('Destino ja existe: nao sobrescrever');
 return {sources:{
  red:options['--red'],blue:options['--blue'],green:options['--green']
 },destination};
}
function main(argv){
 const {sources,destination}=parseArguments(argv);
 const roms=Object.fromEntries(Object.entries(sources).map(
  ([variant,filename])=>[variant,readRom(filename)]));
 const report=saveVerifiedProfileArchive(destination,roms);
 process.stdout.write(JSON.stringify({
  verified:report.verified,
  profiles:report.entryCount,
  archiveBytes:report.bytes,
  status:'POKEGUIDE_PROFILE_ARCHIVE_OK'
 })+'\n');
 return report;
}
if(require.main===module){
 try{main(process.argv.slice(2))}
 catch(error){console.error('POKEGUIDE_PROFILE_ARCHIVE_FAILED '+error.message);process.exitCode=1}
}
module.exports={main,parseArguments};
