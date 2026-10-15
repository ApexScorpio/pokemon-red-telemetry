const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const RetroArchClient = require('./retroarchClient');
const { askAdvisor, getLiveAdvice } = require('./aiAdvisor');
const { formatTelemetryMarkdown, syncToGitHub, triggerDebouncedSync, getLastSyncTimeString, GITHUB_FILE_URL, GITHUB_RAW_URL } = require('./githubSync');

const PORT = 3001;
const IPHONE_IP = '192.168.1.145';
const RETROARCH_PORT = 55355;

const client = new RetroArchClient(IPHONE_IP, RETROARCH_PORT);

// Servidor HTTP
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // Atualização manual: pull da versão mais recente e reinício pelo supervisor start.js
  if (url.pathname === '/api/update' && req.method === 'POST') {
    const { execFileSync } = require('child_process');
    try {
      execFileSync('git', ['fetch', 'origin', 'main'], {
        cwd: __dirname, stdio: 'pipe', timeout: 30000
      });
      execFileSync('git', ['pull', '--ff-only', 'origin', 'main'], {
        cwd: __dirname, stdio: 'pipe', timeout: 30000
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Pull concluído. A reiniciar o companion...' }));
      setTimeout(() => process.exit(0), 700);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: (err.stderr && err.stderr.toString().trim()) || err.message }));
    }
    return;
  }

  if (url.pathname === '/api/state') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(client.latestState));
  }

  // Exportar dados completos em Markdown para o ChatGPT e sincronizar com o GitHub
  if (url.pathname === '/api/export-markdown') {
    const markdown = formatTelemetryMarkdown(client.latestState);
    const syncRes = await syncToGitHub(client.latestState);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      success: true,
      markdown,
      timestamp: (syncRes && syncRes.timestamp) ? syncRes.timestamp : new Date().toLocaleTimeString('pt-PT'),
      githubUrl: GITHUB_FILE_URL,
      rawUrl: GITHUB_RAW_URL
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

  // Ficheiros estáticos
  let filePath = path.join(__dirname, 'public', url.pathname === '/' ? 'index.html' : url.pathname);
  const ext = path.extname(filePath);
  const contentTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml'
  };

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      return res.end('Ficheiro não encontrado');
    }
    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
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
  triggerDebouncedSync(state);
});

// Inicia servidor
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`⚡ POKÉMON RED AI COMPANION (GROQ AI ATIVO) ⚡`);
  console.log(`- Dashboard PC:      http://localhost:${PORT}`);
  console.log(`- Dashboard iPhone:  http://192.168.1.50:${PORT}`);
  console.log(`- Alvo RetroArch:    ${client.ip}:${client.port}`);
  console.log(`======================================================\n`);
  client.init();
});
