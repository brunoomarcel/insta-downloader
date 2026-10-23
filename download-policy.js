export async function resolveWithFallback(url, run) {
  try {
    return await run(url);
  } catch (error) {
    const host = new URL(url).hostname;
    const instagram = host === 'instagram.com' || host.endsWith('.instagram.com');
    if (!instagram || !/empty media response|API is not granting access/i.test(error.message)) throw error;
    return run(url, ['--extractor-args', 'instagram:app_id=ios']);
  }
}

export function publicDownloadError(error) {
  if (/empty media response/i.test(error.message)) return 'O Instagram não retornou o vídeo. Tente outro link público ou tente novamente mais tarde.';
  if (/SSL_ERROR|SSL_connect|Connection timed out|curl: \((28|35)\)/i.test(error.message)) return 'Não foi possível conectar ao Instagram. Tente novamente mais tarde.';
  if (/login required|redirected to the login|only available for registered users/i.test(error.message)) return 'O Instagram restringiu o acesso a este vídeo. Verifique se ele está disponível sem login.';
  return 'Não foi possível obter este vídeo. Tente novamente mais tarde.';
}
