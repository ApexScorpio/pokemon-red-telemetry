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

    const changedFiles = git(['diff', '--name-only', local, remote]).split('\n').filter(Boolean);
    const hasCodeChanges = changedFiles.some(f => !f.endsWith('.md') && !f.endsWith('.txt'));

    console.log('[Updater] Nova versão detetada no GitHub. A descarregar...');
    try {
      git(['checkout', '--', ':/README.md', ':/telemetria.md', ':/public/telemetria.md', ':/public/telemetria.txt']);
    } catch (e) {}
    try {
      git(['checkout', '--', 'README.md', 'telemetria.md', 'public/telemetria.md', 'public/telemetria.txt']);
    } catch (e) {}
    git(['pull', '--ff-only', 'origin', 'main']);

    if (hasCodeChanges) {
      console.log('[Updater] Código atualizado. A reiniciar o servidor...');
      if (serverProcess && !serverProcess.killed) serverProcess.kill();
    } else {
      console.log('[Updater] Apenas ficheiros de telemetria/dados atualizados. O servidor mantém-se ativo.');
    }
  } catch (err) {
    console.warn('[Updater] Não foi possível verificar/instalar atualizações:', err.message);
  } finally {
    checkingForUpdates = false;
  }
}

console.log('[Updater] A verificar atualizações no GitHub...');
try {
  try {
    git(['checkout', '--', 'README.md', 'telemetria.md', 'public/telemetria.md', 'public/telemetria.txt']);
  } catch (e) {}
  git(['pull', '--ff-only', 'origin', 'main']);
  console.log('[Updater] Verificação inicial concluída.');
} catch (err) {
  console.warn('[Updater] Não foi possível atualizar no arranque. Vou usar a versão local:', err.message);
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
