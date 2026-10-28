// Lance l'API et le frontend en parallèle (multiplateforme, sans dépendance).
import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const procs = [
  ['api', ['run', 'dev', '--workspace', 'server']],
  ['web', ['run', 'dev', '--workspace', 'web']],
].map(([name, args]) => {
  const p = spawn(npm, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
  const prefix = (chunk) => chunk.toString().split(/\r?\n/).filter(Boolean).map((l) => `[${name}] ${l}`).join('\n');
  p.stdout.on('data', (c) => console.log(prefix(c)));
  p.stderr.on('data', (c) => console.error(prefix(c)));
  p.on('exit', (code) => { console.log(`[${name}] arrêté (code ${code})`); shutdown(code ?? 0); });
  return p;
});

function shutdown(code) {
  for (const p of procs) if (!p.killed) p.kill();
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
