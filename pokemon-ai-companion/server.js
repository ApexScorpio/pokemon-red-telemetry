const http = require('http');
const fs = require('fs');
const path = require('path');
const { createServerSafetyPolicy, denySideEffect, publicFile } = require('./serverSafetyPolicy');
const { WebSocketServer } = require('ws');
const RetroArchClient = require('./retroarchClient');
const {buildLocalConnectionResponse}=require('./romRuntimeConnectionSnapshot');
const { askAdvisor, getLiveAdvice } = require('./aiAdvisor');
const { formatTelemetryMarkdown, syncToGitHub, triggerDebouncedSync, getLastSyncTimeString, GITHUB_FILE_URL, GITHUB_RAW_URL } = require('./githubSync');

const PORT = 3001;
const POLICY = createServerSafetyPolicy(process.env);
const BIND_HOST = POLICY.bindHost;
const IPHONE_IP = '192.168.1.145';
const RETROARCH_PORT = 55355;

const client = new RetroArchClient(IPHONE_IP, RETROARCH_PORT);

// Servidor HTTP
const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  if(req.method==='OPTIONS'){
    res.writeHead(405);return res.end('CROSS_ORIGIN_NOT_ALLOWED');
  }
  let url;
  try{url=new URL(req.url,'http://127.0.0.1');}
  catch{res.writeHead(400);return res.end('INVALID_REQUEST');}
  if(denySideEffect(POLICY,req.method,url.pathname)){
    res.writeHead(403,{'Content-Type':'application/json'});
    return res.end(JSON.stringify({success:false,error:'FEATURE_REQUIRES_EXPLICIT_OPT_IN'}));
  }

  // Atualização manual: pull da versão mais recente e reinício pelo supervisor start.js
  if (url.pathname === '/api/update' && req.method === 'POST') {
    const { execFileSync } = require('child_process');
    const git = (args) => execFileSync('git', args, {
      cwd: __dirname, encoding:'utf8', stdio:['ignore','pipe','pipe'], timeout:30000
    }).trim();
    const json=(status,data)=>{
      res.writeHead(status,{'Content-Type':'application/json'});
      res.end(JSON.stringify(data));
    };
    try{
      const activeBranch=git(['symbolic-ref','--quiet','--short','HEAD']);
      if(activeBranch!=='main')
        return json(409,{success:false,error:'UPDATE_REJECTED_OUTSIDE_MAIN'});
      git(['fetch','origin','main']);
      const current=git(['rev-parse','HEAD']),target=git(['rev-parse','origin/main']);
      if(current===target)return json(200,{success:true,message:'Código já atualizado.'});
      const diff=git(['diff','--name-only',current,target]).split('\n')
        .map(x=>x.trim()).filter(Boolean);
      const hasCode=diff.some(x=>!x.endsWith('.md')&&!x.endsWith('.txt')&&
        !x.includes('last_known_state')&&!x.includes('battle_history_log'));
      if(!hasCode)return json(200,{success:true,
        message:'Sem novas alterações de código (apenas documentos/telemetria).'});
      const dirty=git(['status','--porcelain','--untracked-files=no']);
      if(dirty)return json(409,{success:false,
        message:'Atualização não instalada: alterações locais detetadas. Nenhum ficheiro foi apagado.'});
      // Só fast-forward. Nunca fazer checkout destrutivo nem merge "theirs".
      git(['merge','--ff-only','origin/main']);
      json(200,{success:true,message:'Código atualizado sem apagar alterações locais. A reiniciar…'});
      setTimeout(()=>process.exit(0),700);
    }catch(err){
      json(500,{success:false,error:'UPDATE_FAILED_WITHOUT_MODIFYING_UNCOMMITTED_WORK'});
    }
    return;
  }

  if (url.pathname === '/api/runtime-connection') {
    if(req.method!=='GET'){
      res.writeHead(405);return res.end('METHOD_NOT_ALLOWED');
    }
    const result=buildLocalConnectionResponse({
      remoteAddress:req.socket?.remoteAddress,
      client,startupHost:IPHONE_IP,startupPort:RETROARCH_PORT
    });
    res.writeHead(result.status,{'Content-Type':'application/json; charset=utf-8'});
    return res.end(JSON.stringify(result.body));
  }

  if (url.pathname === '/api/state') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(client.latestState));
  }

  // Endpoint direto de telemetria em texto puro (Markdown) com 0ms de atraso e sem cache
  if (url.pathname === '/telemetria.md' || url.pathname === '/telemetria.txt' || url.pathname === '/api/telemetria.md') {
    const markdown = formatTelemetryMarkdown(client.latestState);
    res.writeHead(200, {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    return res.end(markdown);
  }

  // Exportar dados completos em Markdown para o ChatGPT e sincronizar com o GitHub
  if (url.pathname === '/api/export-markdown') {
    const markdown = formatTelemetryMarkdown(client.latestState);
    const syncRes = POLICY.allowGitHubSync
      ? await syncToGitHub(client.latestState) : null;
    const synchronized=syncRes?.success===true;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success:true,markdown,githubSyncEnabled:POLICY.allowGitHubSync,
      githubSynchronized:synchronized,
      timestamp:synchronized?syncRes.timestamp:null,
      githubUrl:synchronized?GITHUB_FILE_URL:null,
      rawUrl:synchronized?GITHUB_RAW_URL:null
    }));
  }

  // Pergunta direta ao Grok AI com contexto da memória RAM
  if (url.pathname === '/api/ask-ai' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { question } = JSON.parse(body);
        const reply = await askAdvisor(question, client.latestState);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ reply }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // Pedir conselho estratégico em direto da IA
  if (url.pathname === '/api/advice-now' && req.method === 'POST') {
    const advice = await getLiveAdvice(client.latestState);
    if (advice) {
      client.latestState.aiAdvice = advice;
      broadcast(client.latestState);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ advice }));
  }

  if (url.pathname === '/api/config' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (data.ip) client.setTarget(data.ip, data.port || 55355);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ip: client.ip, port: client.port }));
      } catch (e) {
        res.writeHead(400);
        res.end('JSON inválido');
      }
    });
    return;
  }

  // Simulação de batalha para teste visual
  if (url.pathname === '/api/test-battle' && req.method === 'POST') {
    client.isSimulatingBattle = !client.isSimulatingBattle;
    // Separar expressamente o modo de demonstração da telemetria da RAM.
    // Nunca sincronizar ou persistir combate simulado como um combate real.
    client.latestState.isSimulation = client.isSimulatingBattle;
    client.latestState.inBattle = client.isSimulatingBattle;
    if (client.latestState.inBattle) {
      client.latestState.battleType = 'Wild';
      const dummyEnemy = {
        speciesId: 0x22,
        name: 'Onix',
        dex: 95,
        types: ['Rock', 'Ground'],
        hp: 34,
        maxHp: 34,
        level: 14,
        spriteUrl: 'https://play.pokemonshowdown.com/sprites/gen5/onix.png',
        artworkUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/95.png',
        moves: ['Tackle', 'Screech', 'Bide']
      };
      const activeIdx = client.latestState.party && client.latestState.party.findIndex(p => p.hp > 0) !== -1
        ? client.latestState.party.findIndex(p => p.hp > 0)
        : 0;
      const activeMon = (client.latestState.party && client.latestState.party[activeIdx]) || {
        speciesId: 84,
        name: 'Pikachu',
        level: 13,
        hp: 25,
        maxHp: 25,
        partyPos: 0,
        types: ['Electric'],
        spriteUrl: 'https://play.pokemonshowdown.com/sprites/gen5/pikachu.png',
        artworkUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png',
        stats: { attack: 22, defense: 18, speed: 30, special: 24 },
        moves: [{ id: 84, name: 'Thunder Shock', type: 'Electric', power: 40, acc: 100, pp: 30 }]
      };
      activeMon.partyPos = activeIdx;
      if (client.latestState.party) {
        client.latestState.party.forEach((p, idx) => {
          p.isInBattle = (idx === activeIdx);
        });
      }
      const { analyzeBattle } = require('./data/pokemonData');
      client.latestState.battle = {
        enemy: dummyEnemy,
        playerActive: activeMon,
        strategy: analyzeBattle(
          activeMon,
          dummyEnemy,
          true,
          client.latestState.badges || [],
          client.latestState.inventory || [],
          client.latestState.party || []
        )
      };
      getLiveAdvice(client.latestState).then(adv => {
        if (adv) client.latestState.aiAdvice = adv;
        broadcast(client.latestState);
      });
    } else {
      client.latestState.battle = null;
    }
    broadcast(client.latestState);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, inBattle: client.latestState.inBattle }));
  }

  // Serve only files under public/. Reject traversal and symlinks.
  if(req.method!=='GET'){
    res.writeHead(405);return res.end('METHOD_NOT_ALLOWED');
  }
  const asset=publicFile(path.join(__dirname,'public'),url.pathname);
  if(!asset){res.writeHead(404);return res.end('FILE_NOT_FOUND');}
  fs.readFile(asset.file,(err,content)=>{
    if(err){res.writeHead(404);return res.end('FILE_NOT_FOUND');}
    res.writeHead(200,{'Content-Type':asset.type});
    res.end(content);
  });
});

// WebSocket Server
const wss = new WebSocketServer({ server });

function broadcast(data) {
  if (data && typeof data === 'object') {
    data.githubSyncTime = getLastSyncTimeString();
  }
  const json = JSON.stringify(data);
  wss.clients.forEach(c => {
    if (c.readyState === 1) c.send(json);
  });
}

wss.on('connection', (ws) => {
  console.log('[WebSocket] Cliente web conectado ao dashboard');
  ws.send(JSON.stringify(client.latestState));
});

client.on('update', (state) => {
  broadcast(state);
  if(POLICY.allowGitHubSync)triggerDebouncedSync(state);
});

// Inicia servidor
server.listen(PORT, BIND_HOST, () => {
  console.log(`\n======================================================`);
  console.log(`⚡ POKÉMON GEN I COMPANION — RED / BLUE / GREEN ⚡`);
  console.log(`- Dashboard PC:      http://127.0.0.1:${PORT}`);
  console.log(`- Server binding:    ${BIND_HOST}:${PORT}`);
  console.log(`- GitHub upload:     ${POLICY.allowGitHubSync?'OPT_IN':'DISABLED'}`);
  console.log(`- Mutating API:      ${POLICY.allowWriteApi?'OPT_IN':'DISABLED'}`);
  if(POLICY.bindHost!=='127.0.0.1')console.log(`- Dashboard LAN: accessible only after explicit LAN opt-in`);
  console.log(`- Alvo RetroArch:    ${client.ip}:${client.port}`);
  console.log(`======================================================\n`);
  client.init();
});
