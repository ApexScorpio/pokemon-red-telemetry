const { execFileSync, spawn } = require('child_process');

const ROOT = __dirname;
const CHECK_INTERVAL_MS = 60 * 1000;
let serverProcess = null;
let checkingForUpdates = false;
let shuttingDown = false;

function git(args) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30000
  }).trim();
}

function launchServer() {
  if (shuttingDown) return;
  console.log('[Updater] A iniciar o Pokémon AI Companion...');
  serverProcess = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    stdio: 'inherit',
    windowsHide: true
  });

  serverProcess.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.log(`[Updater] Servidor terminou (código ${code ?? 'n/a'}). A reiniciar em 1 segundo...`);
    setTimeout(launchServer, 1000);
  });
}

function checkForUpdates() {
  if (checkingForUpdates || shuttingDown) return;
  checkingForUpdates = true;

  try {
    git(['fetch', 'origin', 'main']);
    const local = git(['rev-parse', 'HEAD']);
    const remote = git(['rev-parse', 'origin/main']);

    if (local === remote) {
      console.log('[Updater] Já está na versão mais recente.');
      return;
    }

    const changedFiles = git(['diff', '--name-only', local, remote]).split('\n').map(s => s.trim()).filter(Boolean);
    const hasCodeChanges = changedFiles.some(f => 
      !f.endsWith('.md') && 
      !f.endsWith('.txt') && 
      !f.includes('battle_history_log') && 
      !f.includes('dialog_history_log') && 
      !f.includes('battle_detection_debug') && 
      !f.includes('last_known_state')
    );

    if (!hasCodeChanges) {
      console.log('[Updater] Código local já está na versão mais recente (apenas telemetria remota atualizada).');
      return;
    }

    console.log('[Updater] Novo código detetado no GitHub. A descarregar...');
    try {
      git(['checkout', '--', ':/README.md', ':/telemetria.md', ':/public/telemetria.md', ':/public/telemetria.txt']);
    } catch (e) {}

    try {
      git(['pull', '--rebase', '-X', 'theirs', 'origin', 'main']);
    } catch (pullErr) {
      try { git(['rebase', '--abort']); } catch (e) {}
      git(['merge', '-X', 'theirs', '--no-edit', 'origin/main']);
    }

    console.log('[Updater] Código atualizado. A reiniciar o servidor...');
    if (serverProcess && !serverProcess.killed) serverProcess.kill();
  } catch (err) {
    console.warn('[Updater] Não foi possível verificar/instalar atualizações:', err.message);
  } finally {
    checkingForUpdates = false;
  }
}

console.log('[Updater] A verificar atualizações no GitHub...');
try {
  git(['fetch', 'origin', 'main']);
  const local = git(['rev-parse', 'HEAD']);
  const remote = git(['rev-parse', 'origin/main']);
  if (local !== remote) {
    const diff = git(['diff', '--name-only', local, remote]).split('\n').map(s => s.trim()).filter(Boolean);
    const hasCode = diff.some(f => !f.endsWith('.md') && !f.endsWith('.txt') && !f.includes('last_known_state'));
    if (hasCode) {
      git(['checkout', '--', 'README.md', 'telemetria.md', 'public/telemetria.md', 'public/telemetria.txt']);
      git(['merge', '-X', 'theirs', '--no-edit', 'origin/main']);
      console.log('[Updater] Código atualizado no arranque.');
    } else {
      console.log('[Updater] Código local atualizado (commits remotos são apenas telemetria).');
    }
  } else {
    console.log('[Updater] Verificação inicial concluída.');
  }
} catch (err) {
  console.warn('[Updater] Aviso no arranque (a usar versão local):', err.message);
}

launchServer();
setInterval(checkForUpdates, CHECK_INTERVAL_MS);

function shutdown() {
  shuttingDown = true;
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
