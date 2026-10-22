const form = document.querySelector('#downloadForm');
const input = document.querySelector('#url');
const status = document.querySelector('#status');
const paste = document.querySelector('#paste');
const install = document.querySelector('#install');
let deferredPrompt;

function platform(value) {
  try {
    const host = new URL(value).hostname.replace('www.', '');
    if (host === 'instagram.com' || host.endsWith('.instagram.com')) return 'Instagram';
    if (host === 'pinterest.com' || host.endsWith('.pinterest.com') || host === 'pin.it') return 'Pinterest';
    if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be') return 'YouTube';
  } catch {}
  return null;
}

paste.onclick = async () => {
  try { input.value = await navigator.clipboard.readText(); input.focus(); status.textContent = 'Link colado.'; }
  catch { input.focus(); status.textContent = 'Cole o link usando o teclado.'; }
};

form.onsubmit = async (event) => {
  event.preventDefault();
  const url = input.value.trim();
  const name = platform(url);
  if (!name) { status.textContent = 'Insira um link público válido do Instagram, Pinterest ou YouTube.'; status.className = 'status error'; return; }
  status.textContent = `Preparando vídeo do ${name}…`;
  try {
    const response = await fetch('./api/download', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
    if (!response.ok) { const data = await response.json().catch(() => ({})); throw Error(data.message || `O servidor respondeu com erro (${response.status}).`); }
    const blob = await response.blob();
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'creepfly-video.mp4'; link.click();
    status.textContent = 'Download iniciado.'; status.className = 'status success';
  } catch (error) {
    status.textContent = error instanceof TypeError ? 'Não foi possível conectar ao servidor.' : (error.message || 'Não foi possível baixar este vídeo agora.');
    status.className = 'status error';
  }
};

addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); deferredPrompt = event; install.hidden = false; });
install.onclick = async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; install.hidden = true; };
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
