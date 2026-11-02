'use strict';
// For an IPv4 literal RetroArch target, require exact UDP sender IP + port.
// For localhost, require loopback. Arbitrary DNS names retain legacy
// port-only compatibility: their resolved address is not known in this layer.
// This protects reply provenance, not UDP authenticity or gameplay state.
const net=require('node:net');
function senderMatchesTarget(rinfo,target){
 if(!rinfo||!target||typeof rinfo.address!=='string'||
    !Number.isInteger(rinfo.port)||
    !Number.isInteger(target.port)||rinfo.port!==target.port||
    typeof target.host!=='string'||!target.host)return false;
 const host=target.host;
 if(net.isIP(host)===4)return rinfo.address===host;
 if(host==='localhost')return rinfo.address==='127.0.0.1';
 if(net.isIP(host)!==0)return false; // udp4 can't match an IPv6 literal
 return net.isIP(rinfo.address)===4; // DNS hostname: port-only fallback
}
module.exports={senderMatchesTarget};
