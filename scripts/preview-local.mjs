import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { access, readFile, stat, mkdir, writeFile, cp } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import readline from 'node:readline';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const snapshotRoot = path.resolve(root, '../workbench-private/atlas-preview/terminal-v1');
const args = new Set(process.argv.slice(2));
const children = new Set(), servers = new Set();
const urls = { new: 'http://127.0.0.1:4321/', old: 'http://127.0.0.1:4322/' };
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const exists = async p => { try { await access(p); return true; } catch { return false; } };
const running = async url => { try { return (await fetch(url, { signal: AbortSignal.timeout(1000) })).ok; } catch { return false; } };
function child(cmd, argv, options = {}) {
  const proc = spawn(cmd, argv, { cwd: root, windowsHide: true, stdio: 'pipe', ...options });
  children.add(proc); proc.on('exit', () => children.delete(proc)); return proc;
}
const execute = (cmd, argv, options) => new Promise((resolve, reject) => {
  const p = child(cmd, argv, options); p.once('error', reject); p.once('exit', code => code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)));
});
function browser(url) {
  if (args.has('--no-open')) return;
  if (process.platform === 'win32') child('cmd.exe', ['/d', '/c', 'start', '""', url], { stdio: 'ignore' });
  else child(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { stdio: 'ignore' });
}
async function oldSnapshot() {
  const site = path.join(snapshotRoot, 'site');
  if (await exists(path.join(site, 'index.html'))) return site;
  console.log('Preparing terminal-v1 snapshot without switching branches...');
  const src = path.join(snapshotRoot, 'source'); await mkdir(src, { recursive: true });
  const archive = path.join(snapshotRoot, 'source.tar');
  const historyRoot = path.resolve(root, '../workbench-private/watermark-release-20261010/backup/website-history.git');
  const historyArgs = await exists(path.join(historyRoot, 'HEAD')) ? ['--git-dir', historyRoot] : [];
  await execute('git', [...historyArgs, 'archive', '--format=tar', '--output', archive, '2dd03eb69ab2f26eeacae8daf01c37851de16c73']);
  await execute('tar', ['-xf', archive, '-C', src]);
  const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const options = { cwd: src, stdio: 'inherit', shell: process.platform === 'win32' };
  await execute(pnpm, ['install', '--frozen-lockfile', '--store-dir', path.resolve(root, '../.cache/pnpm-store')], options);
  await execute(pnpm, ['build'], options);
  await cp(path.join(src, 'dist'), site, { recursive: true });
  await writeFile(path.join(snapshotRoot, 'snapshot.json'), JSON.stringify({ tag: 'terminal-v1', commit: '2dd03eb69ab2f26eeacae8daf01c37851de16c73', created: new Date().toISOString() }, null, 2));
  return site;
}
async function startOld() {
  if (await running(urls.old)) return;
  const site = await oldSnapshot();
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, urls.old).pathname);
      let target = path.resolve(site, '.' + pathname);
      if (target !== site && !target.startsWith(site + path.sep)) { res.writeHead(403); return res.end(); }
      if (await exists(target) && (await stat(target)).isDirectory()) target = path.join(target, 'index.html');
      if (!(await exists(target))) { res.writeHead(404); return res.end(await readFile(path.join(site, '404.html'))); }
      res.writeHead(200, { 'Content-Type': types[path.extname(target)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(await readFile(target));
    } catch { res.writeHead(500); res.end('Preview request failed'); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(4322, '127.0.0.1', resolve); }); servers.add(server);
}
async function startNew() {
  if (await running(urls.new)) return;
  if (!(await exists(path.join(root, 'node_modules/astro/bin/astro.mjs')))) throw new Error('Run pnpm install before previewing.');
  const p = child(process.execPath, ['scripts/preview-dev.mjs']);
  p.stderr?.on('data', d => process.stderr.write(d));
  for (let i = 0; i < 240; i++) { if (await running(urls.new)) return; if (p.exitCode !== null && p.exitCode !== 0) throw new Error('New preview server stopped.'); await new Promise(r => setTimeout(r, 250)); }
  throw new Error('New preview did not become ready.');
}
let busy = false;
async function select(mode) {
  if (busy) return; busy = true;
  try {
    if (mode === 'new' || mode === 'both') { await startNew(); browser(urls.new); console.log(`NEW / main: ${urls.new}`); }
    if (mode === 'old' || mode === 'both') { await startOld(); browser(urls.old); console.log(`OLD / terminal-v1: ${urls.old}`); }
    console.log('1 = new | 2 = old | 3 = both | Q = stop. You can switch freely.');
  } catch (e) { console.error(e.message); process.exitCode = 1; }
  finally { busy = false; }
}
function stop() {
  for (const s of servers) s.close(); for (const p of children) p.kill();
  if (process.stdin.isTTY) process.stdin.setRawMode(false); process.exit(process.exitCode ?? 0);
}
process.on('SIGINT', stop); process.on('SIGTERM', stop);
console.log('\nRONHWUNG / LOCAL EXPLORATION\n [1] New miniature atlas\n [2] Original terminal-v1\n [3] Open both versions\n [Q] Stop preview\n');
if (args.has('--new')) await select('new'); else if (args.has('--old')) await select('old'); else if (args.has('--both')) await select('both');
if (process.stdin.isTTY) {
  readline.emitKeypressEvents(process.stdin); process.stdin.setRawMode(true); process.stdin.resume();
  process.stdin.on('keypress', (_text, key) => {
    if (key.name === 'q' || (key.ctrl && key.name === 'c')) stop();
    if (key.name === '1') void select('new'); if (key.name === '2') void select('old'); if (key.name === '3') void select('both');
  });
} else if (![...args].some(a => ['--new', '--old', '--both'].includes(a))) await select('both');
