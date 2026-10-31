'use strict';
// Pure current-process poll scope; a host/port may switch away and back.
// Generation prevents a stale read being accepted after that round trip.
// This does not prove the remote ROM or an atomic frame.
function captureTargetScope(client){
 return {host:client?.ip??null,port:client?.port??null,
  generation:Number.isSafeInteger(client?._targetGeneration)?
   client._targetGeneration:0};
}
function matchesTargetScope(client,scope){
 return !!client&&!!scope&&typeof scope.host==='string'&&
  scope.host!==''&&Number.isInteger(scope.port)&&
  scope.port>=1&&scope.port<=65535&&
  Number.isSafeInteger(scope.generation)&&scope.generation>=0&&
  client.ip===scope.host&&client.port===scope.port&&
  (Number.isSafeInteger(client._targetGeneration)?
   client._targetGeneration:0)===scope.generation;
}
module.exports={captureTargetScope,matchesTargetScope};
