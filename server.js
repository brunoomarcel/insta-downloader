import Fastify from 'fastify';
import { spawn, spawnSync } from 'node:child_process';
import { createReadStream, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';

const app = Fastify({ logger: true, bodyLimit: 16 * 1024 });
const root = path.dirname(fileURLToPath(import.meta.url));
const publicFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']], ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']], ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/manifest.webmanifest', ['manifest.webmanifest', 'application/manifest+json']], ['/sw.js', ['sw.js', 'text/javascript; charset=utf-8']], ['/icon.svg', ['icon.svg', 'image/svg+xml']]
]);
const allowedHost = (value) => { try { const host = new URL(value).hostname.toLowerCase().replace(/^www\./, ''); return host === 'instagram.com' || host.endsWith('.instagram.com') || host === 'pinterest.com' || host.endsWith('.pinterest.com') || host === 'pin.it' || host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be'; } catch { return false; } };
const hasYtDlp = () => {
  if (existsSync('/usr/local/bin/yt-dlp') || existsSync('/usr/bin/yt-dlp')) return true;
  const command = process.platform === 'win32' ? 'where.exe' : 'which';
  return spawnSync(command, ['yt-dlp'], { stdio: 'ignore' }).status === 0;
};
for (const [route, [file, type]] of publicFiles) app.get(route, async (_request, reply) => reply.type(type).send(readFileSync(path.join(root, file))));

function resolveMediaUrl(url) {
  return new Promise((resolve, reject) => {
    const args = ['--get-url', '--no-playlist', '--no-warnings', '--max-filesize', '100M', '-f', 'best'];
    if (new URL(url).hostname.toLowerCase().includes('instagram.com')) args.push('--impersonate', 'chrome');
    const cookieFile = path.join(root, 'cookies', 'instagram.txt');
    if (existsSync(cookieFile)) args.push('--cookies', cookieFile);
    if (globalThis.process.env.YT_DLP_INSECURE_TLS === 'true') args.push('--no-check-certificates');
    args.push(url);
    const downloaderProcess = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; let error = '';
    downloaderProcess.stdout.on('data', chunk => { output += chunk.toString(); }); downloaderProcess.stderr.on('data', chunk => { error += chunk.toString(); });
    downloaderProcess.on('error', reject); downloaderProcess.on('close', code => { const mediaUrl = output.trim().split(/\r?\n/).filter(Boolean)[0]; if (code === 0 && mediaUrl) resolve(mediaUrl); else reject(new Error(error.slice(-500) || 'Não foi possível encontrar o vídeo.')); });
  });
}

function downloadYoutube(url) {
  return new Promise((resolve, reject) => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'creepfly-'));
    const output = path.join(directory, 'video.%(ext)s');
    const args = ['--no-playlist', '--no-warnings', '--max-filesize', '100M', '-f', 'bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best', '--merge-output-format', 'mp4', '-o', output, url];
    const downloaderProcess = spawn('yt-dlp', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let error = '';
    downloaderProcess.stderr.on('data', chunk => { error += chunk.toString(); });
    downloaderProcess.on('error', reason => { rmSync(directory, { recursive: true, force: true }); reject(reason); });
    downloaderProcess.on('close', code => {
      const file = path.join(directory, 'video.mp4');
      if (code === 0 && existsSync(file)) resolve({ directory, file });
      else { rmSync(directory, { recursive: true, force: true }); reject(new Error(error.slice(-500) || 'Não foi possível baixar o vídeo.')); }
    });
  });
}

app.post('/api/download', async (request, reply) => {
  const url = typeof request.body?.url === 'string' ? request.body.url.trim() : '';
  if (!allowedHost(url)) return reply.code(422).send({ message: 'Use um link público do Instagram, Pinterest ou YouTube.' });
  if (!hasYtDlp()) return reply.code(503).send({ message: 'O yt-dlp ainda não está instalado no servidor.' });
  if (new URL(url).hostname.toLowerCase().includes('youtube.com') || new URL(url).hostname.toLowerCase() === 'youtu.be') {
    let downloaded;
    try {
      downloaded = await downloadYoutube(url);
      const stream = createReadStream(downloaded.file);
      stream.on('close', () => rmSync(downloaded.directory, { recursive: true, force: true }));
      reply.header('Content-Type', 'video/mp4').header('Content-Disposition', 'attachment; filename="creepfly-video.mp4"').header('Cache-Control', 'no-store');
      return reply.send(stream);
    } catch (error) { return reply.code(502).send({ message: error.message || 'Não foi possível obter este vídeo.' }); }
  }
  try {
    const mediaUrl = await resolveMediaUrl(url);
    const mediaResponse = await fetch(mediaUrl, { signal: AbortSignal.timeout(120000) });
    if (!mediaResponse.ok || !mediaResponse.body) throw new Error(`Falha ao obter o vídeo (${mediaResponse.status}).`);
    reply.header('Content-Type', mediaResponse.headers.get('content-type') || 'video/mp4').header('Content-Disposition', 'attachment; filename="creepfly-video.mp4"').header('Cache-Control', 'no-store');
    return reply.send(Readable.fromWeb(mediaResponse.body));
  } catch (error) { return reply.code(502).send({ message: error.message || 'Não foi possível obter este vídeo.' }); }
});

app.listen({ host: '0.0.0.0', port: Number(process.env.PORT || 3000) }).catch(error => { app.log.error(error); process.exit(1); });
