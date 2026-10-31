'use strict';
// Fail-closed policy for the live ROM-reading server (not the offline preview).
// No mutation, public exposure, external AI or GitHub upload without opt-in.
const fs=require('node:fs'),path=require('node:path');
const ALLOWED_STATIC=Object.freeze({
 '.html':'text/html; charset=utf-8',
 '.css':'text/css; charset=utf-8',
 '.js':'application/javascript; charset=utf-8',
 '.json':'application/json; charset=utf-8',
 '.png':'image/png','.svg':'image/svg+xml',
 '.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp',
 '.gif':'image/gif','.ico':'image/x-icon',
 '.woff':'font/woff','.woff2':'font/woff2'
});
function createServerSafetyPolicy(env={}){
 const yes=name=>env[name]==='1';
 return Object.freeze({
  bindHost:yes('POKEGUIDE_ALLOW_LAN')?'0.0.0.0':'127.0.0.1',
  allowUpdate:yes('POKEGUIDE_ALLOW_UPDATE')&&
   yes('POKEGUIDE_AUTOUPDATE_OPT_IN'),
  allowWriteApi:yes('POKEGUIDE_WRITE_API_OPT_IN'),
  allowExternalAi:yes('POKEGUIDE_AI_OPT_IN'),
  allowGitHubSync:yes('POKEGUIDE_GITHUB_SYNC_OPT_IN')
 });
}
function denySideEffect(policy,method,pathname){
 if(pathname==='/api/update')
  return !(method==='POST'&&policy.allowUpdate);
 if(pathname==='/api/config'||pathname==='/api/test-battle')
  return !(method==='POST'&&policy.allowWriteApi);
 if(pathname==='/api/ask-ai'||pathname==='/api/advice-now')
  return !(method==='POST'&&policy.allowExternalAi);
 return false;
}
function publicFile(root,uriPath){
 if(typeof uriPath!=='string'||!uriPath.startsWith('/'))return null;
 let name;
 try{name=decodeURIComponent(uriPath==='/'?'index.html':uriPath.slice(1));}
 catch{return null;}
 if(!name||name.includes('\\')||name.includes('\0')||
    name.split('/').some(s=>s==='..'||s==='.'||s.startsWith('.')))
  return null;
 const extension=path.extname(name).toLowerCase();
 if(!Object.hasOwn(ALLOWED_STATIC,extension))return null;
 const rootPath=path.resolve(root),candidate=path.resolve(rootPath,name);
 const relative=path.relative(rootPath,candidate);
 if(relative.startsWith('..')||path.isAbsolute(relative))return null;
 try{
  const rootReal=fs.realpathSync(rootPath);
  const fileReal=fs.realpathSync(candidate);
  const realRelative=path.relative(rootReal,fileReal);
  if(realRelative.startsWith('..')||path.isAbsolute(realRelative))
   return null;
  if(!fs.statSync(fileReal).isFile())return null;
 }catch{return null;}
 return {file:candidate,type:ALLOWED_STATIC[extension]};
}
module.exports={createServerSafetyPolicy,denySideEffect,publicFile};
