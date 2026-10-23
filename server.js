import Fastify from 'fastify';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
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
const allowedHost = (value) => { try { const host = new URL(value).hostname.toLowerCase().replace(/^www\./, ''); return host === 'instagram.com' || host.endsWith('.instagram.com') || host === 'pinterest.com' || host.endsWith('.pinterest.com') || host === 'pin.it'; } catch { return false; } };
const hasYtDlp = () => {
  if (existsSync('/usr/local/bin/yt-dlp') || existsSync('/usr/bin/yt-dlp')) return true;
  const command = process.platform === 'win32' ? 'where.exe' : 'which';
  return spawnSync(command, ['yt-dlp'], { stdio: 'ignore' }).status === 0;
};
for (const [route, [file, type]] of publicFiles) app.get(route, async (_request, reply) => reply.type(type).send(readFileSync(path.join(root, file))));

function cookieFileFromEnvironment() {
  const encodedCookies = process.env.YT_DLP_COOKIES_B64?.trim();
  if (!encodedCookies) return null;

  const cookieFile = path.join(root, 'cookies', `.instagram-runtime-${randomUUID()}.txt`);
  writeFileSync(cookieFile, Buffer.from(encodedCookies, 'base64'), { mode: 0o600 });
  return cookieFile;
}

function runYtDlp(url, extraArgs = []) {
  return new Promise((resolve, reject) => {
    const isInstagram = new URL(url).hostname.toLowerCase().includes('instagram.com');
    const args = ['--get-url', '--no-playlist', '--no-warnings', '--max-filesize', '100M', '-f', 'best[ext=mp4]/best', '--retries', '3', '--fragment-retries', '3'];
    if (isInstagram) args.push('--impersonate', 'chrome', '--add-header', 'Referer:https://www.instagram.com/');
    args.push(...extraArgs);
    const runtimeCookieFile = cookieFileFromEnvironment();
    const cookieFile = runtimeCookieFile || path.join(root, 'cookies', 'instagram.txt');
    if (existsSync(cookieFile)) args.push('--cookies', cookieFile);
    if (globalThis.process.env.YT_DLP_INSECURE_TLS === 'true') args.push('--no-check-certificates');
    args.push(url);
    const downloaderProcess = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; let error = '';
    downloaderProcess.stdout.on('data', chunk => { output += chunk.toString(); }); downloaderProcess.stderr.on('data', chunk => { error += chunk.toString(); });
    downloaderProcess.on('error', errorObject => {
      if (runtimeCookieFile && existsSync(runtimeCookieFile)) unlinkSync(runtimeCookieFile);
      reject(errorObject);
    });
    downloaderProcess.on('close', code => {
      if (runtimeCookieFile && existsSync(runtimeCookieFile)) unlinkSync(runtimeCookieFile);
      const mediaUrl = output.trim().split(/\r?\n/).filter(Boolean)[0];
      if (code === 0 && mediaUrl) return resolve(mediaUrl);
      if (isInstagram && /logged-in|cookies-from-browser|authentication/i.test(error)) {
        return reject(new Error('O Instagram exige uma sessão autorizada. Configure YT_DLP_COOKIES_B64 ou monte cookies/instagram.txt no servidor.'));
      }
      reject(new Error(error.slice(-500) || 'Não foi possível encontrar o vídeo.'));
    });
  });
}

async function resolveMediaUrl(url) {
  try {
    return await runYtDlp(url);
  } catch (error) {
    const isInstagram = new URL(url).hostname.toLowerCase().includes('instagram.com');
    if (!isInstagram || !/logged-in|cookies-from-browser|authentication|empty media response/i.test(error.message)) throw error;
    return runYtDlp(url, ['--extractor-args', 'instagram:app_id=ios']);
  }
}

app.post('/api/download', async (request, reply) => {
  const url = typeof request.body?.url === 'string' ? request.body.url.trim() : '';
  if (!allowedHost(url)) return reply.code(422).send({ message: 'Use um link público do Instagram ou Pinterest.' });
  if (!hasYtDlp()) return reply.code(503).send({ message: 'O yt-dlp ainda não está instalado no servidor.' });
  try {
    const mediaUrl = await resolveMediaUrl(url);
    const mediaResponse = await fetch(mediaUrl, { signal: AbortSignal.timeout(120000) });
    if (!mediaResponse.ok || !mediaResponse.body) throw new Error(`Falha ao obter o vídeo (${mediaResponse.status}).`);
    reply.header('Content-Type', mediaResponse.headers.get('content-type') || 'video/mp4').header('Content-Disposition', 'attachment; filename="creepfly-video.mp4"').header('Cache-Control', 'no-store');
    return reply.send(Readable.fromWeb(mediaResponse.body));
  } catch (error) { return reply.code(502).send({ message: error.message || 'Não foi possível obter este vídeo.' }); }
});

app.listen({ host: '0.0.0.0', port: Number(process.env.PORT || 3000) }).catch(error => { app.log.error(error); process.exit(1); });
