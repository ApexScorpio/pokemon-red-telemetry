const { execFileSync } = require('child_process');

console.log('[Updater] A verificar atualizações no GitHub...');

try {
  execFileSync('git', ['pull', '--ff-only', 'origin', 'main'], {
    cwd: __dirname,
    stdio: 'inherit',
    timeout: 30000
  });
  console.log('[Updater] Verificação concluída.');
} catch (err) {
  console.warn('[Updater] Não foi possível atualizar. Vou iniciar a versão local.');
  console.warn(err.message);
}

console.log('[Updater] A iniciar o Pokémon AI Companion...');
require('./server');
